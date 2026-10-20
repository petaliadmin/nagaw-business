import { Controller, Get, HttpStatus } from '@nestjs/common';
import type { MeDto } from '@nagaw/shared';
import { ApiException } from '../common/api-exception.js';
import type { AuthContext } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { CurrentUser } from '../tenancy/current.decorator.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly database: DatabaseService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthContext): Promise<MeDto> {
    const profile = await this.database.db
      .selectFrom('app.user_profiles')
      .selectAll()
      .where('id', '=', user.userId)
      .executeTakeFirst();
    if (!profile) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'PROFILE_MISSING',
        'Profil utilisateur introuvable.',
      );
    }
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      locale: profile.locale,
      timezone: profile.timezone,
      organizations: await this.organizations.listForUser(user.userId),
    };
  }
}
