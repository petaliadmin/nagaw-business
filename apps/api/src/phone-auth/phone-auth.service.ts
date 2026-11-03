import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PhoneSessionDto } from '@nagaw/shared';
import { sql } from 'kysely';
import { AuditService } from '../audit/audit.service.js';
import {
  conflict,
  notFound,
  UUID_RE,
  type Executor,
} from '../catalog/catalog.errors.js';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext } from '../common/request-context.js';
import { ENV, type Env } from '../config/env.js';
import { DatabaseService } from '../database/database.service.js';
import { AUTH_ADMIN, type AuthAdmin } from './auth-admin.js';
import { pinPassword } from './pin-password.js';

const phoneTaken = () =>
  conflict(
    'PHONE_TAKEN',
    'Un compte existe déjà avec ce numéro. Connectez-vous avec son code secret.',
  );

const minutes = (n: number) => (n === 1 ? '1 minute' : `${n} minutes`);

/**
 * Accounts reached by a phone number and a 4-digit secret code (ADR-058).
 * Every code tried goes through `signIn`, which counts it before asking
 * Supabase: a number is locked after `pin_max_failures` wrong codes, for
 * `pin_lock_minutes` (platform settings), even under parallel attempts.
 */
@Injectable()
export class PhoneAuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    @Inject(AUTH_ADMIN) private readonly authAdmin: AuthAdmin,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private password(phone: string, pin: string): string {
    const pepper = this.env.PHONE_PIN_PEPPER;
    if (!pepper) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AUTH_NOT_CONFIGURED',
        'La connexion par téléphone n’est pas configurée.',
      );
    }
    return pinPassword(pepper, phone, pin);
  }

  /** Refuses before any change when Supabase cannot sign phones in. */
  private async assertPhoneEnabled() {
    if (!(await this.authAdmin.phoneEnabled())) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'PHONE_SIGN_IN_DISABLED',
        'La connexion par téléphone n’est pas encore activée. Rien n’a été changé : continuez avec votre adresse e-mail pour l’instant.',
      );
    }
  }

  private settings() {
    return this.database.db
      .selectFrom('app.platform_settings')
      .select(['pin_max_failures', 'pin_lock_minutes'])
      .executeTakeFirstOrThrow();
  }

  private async phoneInUse(phone: string, exceptUserId?: string) {
    let q = this.database.db
      .selectFrom('app.user_profiles')
      .select('id')
      .where('phone', '=', phone);
    if (exceptUserId) q = q.where('id', '<>', exceptUserId);
    return (await q.executeTakeFirst()) !== undefined;
  }

  async signIn(phone: string, pin: string): Promise<PhoneSessionDto> {
    const { pin_max_failures: max, pin_lock_minutes: lock } =
      await this.settings();
    // The attempt is counted before it is made, in one statement: parallel
    // attempts each take their own place and cannot exceed the limit. A
    // lock that is over, or failures older than a lock, start again.
    const attempt = await sql<{ failures: number; locked: boolean }>`
      insert into app.phone_sign_in_failures as f (phone, failures, last_failed_at)
      values (${phone}, 1, now())
      on conflict (phone) do update set
        failures = case
          when f.locked_until > now() then f.failures
          when f.locked_until is not null
            or f.last_failed_at < now() - make_interval(mins => ${lock}) then 1
          else f.failures + 1 end,
        locked_until = case when f.locked_until > now() then f.locked_until end,
        last_failed_at = case when f.locked_until > now() then f.last_failed_at else now() end
      returning failures, coalesce(locked_until > now(), false) as locked`.execute(
      this.database.db,
    );
    const counted = attempt.rows[0]!;
    if (counted.locked || counted.failures > max) throw this.locked(lock);

    let session: PhoneSessionDto | null;
    try {
      session = await this.authAdmin.signIn(phone, this.password(phone, pin));
    } catch (error) {
      // Supabase did not answer: the code was not tried, give the place back.
      await this.database.db
        .updateTable('app.phone_sign_in_failures')
        .set({ failures: sql<number>`greatest(failures - 1, 0)` })
        .where('phone', '=', phone)
        .execute();
      throw error;
    }

    if (session) {
      await this.clearFailures(this.database.db, phone);
      return session;
    }

    if (counted.failures >= max) {
      await this.database.db
        .updateTable('app.phone_sign_in_failures')
        .set({
          locked_until: sql<Date>`now() + make_interval(mins => ${lock})`,
        })
        .where('phone', '=', phone)
        .execute();
      throw this.locked(lock);
    }
    const left = max - counted.failures;
    throw new ApiException(
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
      `Numéro ou code secret incorrect. ${left === 1 ? 'Dernier essai' : `Encore ${left} essais`} avant un blocage de ${minutes(lock)}.`,
    );
  }

  private clearFailures(executor: Executor, phone: string) {
    return executor
      .updateTable('app.phone_sign_in_failures')
      .set({ failures: 0, locked_until: null })
      .where('phone', '=', phone)
      .execute();
  }

  private locked(lock: number) {
    return new ApiException(
      HttpStatus.TOO_MANY_REQUESTS,
      'PHONE_LOCKED',
      `Trop de codes faux pour ce numéro. Réessayez dans ${minutes(lock)}, ou demandez un nouveau code à l’équipe Nagaw.`,
    );
  }

  async signUp(phone: string, pin: string): Promise<PhoneSessionDto> {
    if (await this.phoneInUse(phone)) throw phoneTaken();
    await this.assertPhoneEnabled();
    const password = this.password(phone, pin);
    const created = await this.authAdmin.createUser(phone, password);
    if (created === 'phone_taken') throw phoneTaken();
    const session = await this.authAdmin.signIn(phone, password);
    if (!session) {
      throw new Error('A phone account just created refused its password');
    }
    return session;
  }

  /**
   * An account opened with an e-mail takes a number and a code; from then
   * on it signs in with them (the migration of ADR-058).
   */
  async link(
    user: AuthContext,
    phone: string,
    pin: string,
  ): Promise<PhoneSessionDto> {
    const profile = await this.database.db
      .selectFrom('app.user_profiles')
      .select('phone')
      .where('id', '=', user.userId)
      .executeTakeFirst();
    if (!profile) {
      throw conflict('PROFILE_MISSING', 'Profil utilisateur introuvable.');
    }
    if (profile.phone !== '') {
      throw conflict(
        'PHONE_ALREADY_SET',
        'Ce compte a déjà un numéro. Connectez-vous avec lui.',
      );
    }
    if (await this.phoneInUse(phone, user.userId)) throw phoneTaken();
    await this.assertPhoneEnabled();
    const password = this.password(phone, pin);
    const changed = await this.authAdmin.updateUser(user.userId, {
      phone,
      password,
    });
    if (changed === 'phone_taken') throw phoneTaken();
    const session = await this.authAdmin.signIn(phone, password);
    if (!session) {
      throw new Error('An account just given a number refused its password');
    }
    return session;
  }

  /**
   * The platform administrator gives a member of a shop a new code, after
   * checking who is asking (ADR-058); recorded in the shop's history.
   */
  async adminSetPin(
    admin: AuthContext,
    shopId: string,
    userId: string,
    pin: string,
    requestId: string | null,
  ): Promise<void> {
    if (!UUID_RE.test(shopId) || !UUID_RE.test(userId)) {
      throw notFound('MEMBER_NOT_FOUND', 'Membre introuvable.');
    }
    const member = await this.database.db
      .selectFrom('app.organization_memberships as m')
      .innerJoin('app.user_profiles as u', 'u.id', 'm.user_id')
      .select(['u.phone'])
      .where('m.organization_id', '=', shopId)
      .where('m.user_id', '=', userId)
      .executeTakeFirst();
    if (!member) throw notFound('MEMBER_NOT_FOUND', 'Membre introuvable.');
    if (member.phone === '') {
      throw conflict(
        'NO_PHONE',
        'Ce compte se connecte encore avec son adresse e-mail : il n’a pas de code secret.',
      );
    }
    const changed = await this.authAdmin.updateUser(userId, {
      password: this.password(member.phone, pin),
    });
    if (changed !== 'ok') {
      throw new Error('Changing only the password reported a taken number');
    }
    await this.database.db.transaction().execute(async (trx) => {
      await this.clearFailures(trx, member.phone);
      await this.audit.record(trx, {
        organizationId: shopId,
        actorType: 'platform_admin',
        actorId: admin.userId,
        action: 'platform.pin_reset',
        targetType: 'user',
        targetId: userId,
        metadata: {},
        requestId,
      });
    });
  }
}
