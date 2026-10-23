import type { TestContext, TestUser } from './support/app.js';
import { createTestContext } from './support/app.js';

describe('Tasks', () => {
  let ctx: TestContext;
  let alice: TestUser; // owner of Acme
  let bob: TestUser; // owner of Globex, stranger to Acme
  let carol: TestUser; // member of Acme
  let dave: TestUser; // disabled member of Acme
  let erin: TestUser; // viewer of Acme
  let acmeId: string;
  let globexId: string;
  let carolResponsibility: string; // active, at most 2 tasks a day
  let aliceResponsibility: string; // active
  let draftResponsibility: string;
  let globexResponsibility: string;

  const as = (user: TestUser, orgId?: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${user.token}`,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;
    return headers;
  };

  const launch = (
    user: TestUser,
    orgId: string,
    body: Record<string, unknown>,
  ) =>
    ctx
      .http()
      .post('/api/v1/tasks')
      .set(as(user, orgId))
      .send({ description: '', dueOn: null, ...body });

  const setStatus = (
    user: TestUser,
    id: string,
    body: Record<string, unknown>,
  ) =>
    ctx
      .http()
      .post(`/api/v1/tasks/${id}/status`)
      .set(as(user, acmeId))
      .send(body);

  const responsibility = async (
    user: TestUser,
    orgId: string,
    assigneeUserId: string,
    maxRunsPerDay: number,
    activate: boolean,
  ): Promise<string> => {
    const id = (
      await ctx
        .http()
        .post('/api/v1/responsibilities')
        .set(as(user, orgId))
        .send({
          assigneeUserId,
          title: 'Relance des devis',
          objective: 'Aucun devis sans suivi.',
          scope: '',
          rules: '',
          successCriteria: 'Chaque devis relancé sous sept jours.',
          maxRunsPerDay,
          escalationUserId: user.id,
          startsOn: null,
          endsOn: null,
        })
        .expect(201)
    ).body.id;
    if (activate) {
      await ctx
        .http()
        .post(`/api/v1/responsibilities/${id}/status`)
        .set(as(user, orgId))
        .send({ status: 'active' })
        .expect(200);
    }
    return id;
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    [alice, bob, carol, dave, erin] = await Promise.all([
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
      ctx.createUser(),
    ]);
    acmeId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set(as(alice))
        .send({ name: 'Acme Dakar', timezone: 'Africa/Dakar' })
        .expect(201)
    ).body.id;
    globexId = (
      await ctx
        .http()
        .post('/api/v1/organizations')
        .set(as(bob))
        .send({ name: 'Globex' })
        .expect(201)
    ).body.id;
    await ctx.admin.query(
      `insert into app.organization_memberships (organization_id, user_id, role, status)
       values ($1, $2, 'member', 'active'), ($1, $3, 'member', 'disabled'),
              ($1, $4, 'viewer', 'active')`,
      [acmeId, carol.id, dave.id, erin.id],
    );
    carolResponsibility = await responsibility(
      alice,
      acmeId,
      carol.id,
      2,
      true,
    );
    aliceResponsibility = await responsibility(
      alice,
      acmeId,
      alice.id,
      5,
      true,
    );
    draftResponsibility = await responsibility(
      alice,
      acmeId,
      carol.id,
      5,
      false,
    );
    globexResponsibility = await responsibility(bob, globexId, bob.id, 5, true);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('launching a task', () => {
    it('lets a manager launch a task on a responsibility, audited', async () => {
      const res = await launch(alice, acmeId, {
        responsibilityId: carolResponsibility,
        assigneeUserId: carol.id,
        title: 'Relancer les devis de la semaine',
      }).expect(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          responsibility: {
            id: carolResponsibility,
            title: 'Relance des devis',
          },
          assignee: expect.objectContaining({ userId: carol.id }),
          status: 'todo',
          outcome: null,
          escalation: { userId: alice.id, email: alice.email },
          createdBy: { userId: alice.id, email: alice.email },
          startedAt: null,
          completedAt: null,
        }),
      );
      const history = await ctx
        .http()
        .get(`/api/v1/tasks/${res.body.id}/history`)
        .set(as(erin, acmeId))
        .expect(200);
      expect(history.body).toEqual([
        expect.objectContaining({
          action: 'task.created',
          actor: { userId: alice.id, email: alice.email },
        }),
      ]);
    });

    it('lets a member launch tasks only for themself, on their own responsibilities', async () => {
      await launch(carol, acmeId, {
        responsibilityId: carolResponsibility,
        assigneeUserId: carol.id,
        title: 'Relance du lundi',
      }).expect(201);
      await launch(carol, acmeId, {
        responsibilityId: null,
        assigneeUserId: carol.id,
        title: 'Préparer la réunion de lundi',
      }).expect(201);
      for (const body of [
        { responsibilityId: null, assigneeUserId: alice.id },
        { responsibilityId: aliceResponsibility, assigneeUserId: carol.id },
      ]) {
        const res = await launch(carol, acmeId, {
          ...body,
          title: 'Hors de mon périmètre',
        }).expect(403);
        expect(res.body.error.code).toBe('PERMISSION_DENIED');
      }
      expect(
        (
          await launch(erin, acmeId, {
            responsibilityId: null,
            assigneeUserId: erin.id,
            title: 'Lecture seule',
          }).expect(403)
        ).body.error.code,
      ).toBe('PERMISSION_DENIED');
    });

    it('applies the daily limit of the responsibility', async () => {
      const res = await launch(alice, acmeId, {
        responsibilityId: carolResponsibility,
        assigneeUserId: carol.id,
        title: 'Troisième relance du jour',
      }).expect(409);
      expect(res.body.error.code).toBe('TASK_DAILY_LIMIT_REACHED');
    });

    it('needs an active responsibility within its period', async () => {
      const draft = await launch(alice, acmeId, {
        responsibilityId: draftResponsibility,
        assigneeUserId: carol.id,
        title: 'Sur un brouillon',
      }).expect(409);
      expect(draft.body.error.code).toBe('RESPONSIBILITY_NOT_ACTIVE');
      await ctx.admin.query(
        `update app.responsibilities set ends_on = current_date - 2 where id = $1`,
        [aliceResponsibility],
      );
      const ended = await launch(alice, acmeId, {
        responsibilityId: aliceResponsibility,
        assigneeUserId: alice.id,
        title: 'Après la fin',
      }).expect(409);
      expect(ended.body.error.code).toBe('RESPONSIBILITY_OUT_OF_PERIOD');
      await ctx.admin.query(
        'update app.responsibilities set ends_on = null where id = $1',
        [aliceResponsibility],
      );
    });

    it('checks the person in charge, the input and the open-task cap', async () => {
      for (const assignee of [dave, bob]) {
        const res = await launch(alice, acmeId, {
          responsibilityId: null,
          assigneeUserId: assignee.id,
          title: 'Mauvaise personne',
        }).expect(400);
        expect(res.body.error.details[0].path).toBe('assigneeUserId');
      }
      await launch(alice, acmeId, {
        responsibilityId: null,
        assigneeUserId: alice.id,
        title: 'Champ serveur',
        status: 'done',
      }).expect(400);

      const { rows } = await ctx.admin.query(
        `select count(*)::int as open from app.tasks
         where organization_id = $1 and status in ('todo', 'in_progress', 'blocked')`,
        [acmeId],
      );
      await ctx.admin.query(
        'update app.organizations set max_open_tasks = $2 where id = $1',
        [acmeId, rows[0].open],
      );
      const capped = await launch(alice, acmeId, {
        responsibilityId: null,
        assigneeUserId: alice.id,
        title: 'Une de trop',
      }).expect(409);
      expect(capped.body.error.code).toBe('TASK_LIMIT_REACHED');
      await ctx.admin.query(
        'update app.organizations set max_open_tasks = 500 where id = $1',
        [acmeId],
      );
    });
  });

  describe('working on a task', () => {
    let carolTask: string;
    let aliceTask: string;

    beforeAll(async () => {
      carolTask = (
        await launch(alice, acmeId, {
          responsibilityId: null,
          assigneeUserId: carol.id,
          title: 'Mettre à jour le fichier clients',
        }).expect(201)
      ).body.id;
      aliceTask = (
        await launch(alice, acmeId, {
          responsibilityId: aliceResponsibility,
          assigneeUserId: alice.id,
          title: 'Relancer Sonatel',
        }).expect(201)
      ).body.id;
    });

    it('lets the person in charge start, block, resume and finish the task', async () => {
      const started = await setStatus(carol, carolTask, {
        status: 'in_progress',
      }).expect(200);
      expect(started.body.startedAt).not.toBeNull();

      const blocked = await setStatus(carol, carolTask, {
        status: 'blocked',
        reason: 'Fichier source introuvable.',
      }).expect(200);
      expect(blocked.body).toEqual(
        expect.objectContaining({
          status: 'blocked',
          blockedReason: 'Fichier source introuvable.',
        }),
      );
      await setStatus(carol, carolTask, { status: 'blocked' }).expect(400);

      const resumed = await setStatus(carol, carolTask, {
        status: 'in_progress',
      }).expect(200);
      expect(resumed.body.blockedReason).toBeNull();
      expect(resumed.body.startedAt).toBe(started.body.startedAt);

      await setStatus(carol, carolTask, { status: 'done' }).expect(400);
      const done = await setStatus(carol, carolTask, {
        status: 'done',
        outcome: 'partial',
        report: 'Deux fiches sur trois mises à jour.',
      }).expect(200);
      expect(done.body).toEqual(
        expect.objectContaining({
          status: 'done',
          outcome: 'partial',
          report: 'Deux fiches sur trois mises à jour.',
        }),
      );
      expect(done.body.completedAt).not.toBeNull();
    });

    it('keeps a closed task closed', async () => {
      const again = await setStatus(carol, carolTask, {
        status: 'in_progress',
      }).expect(409);
      expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION');
      const note = await ctx
        .http()
        .post(`/api/v1/tasks/${carolTask}/notes`)
        .set(as(carol, acmeId))
        .send({ body: 'Trop tard' })
        .expect(409);
      expect(note.body.error.code).toBe('TASK_CLOSED');
      await ctx
        .http()
        .put(`/api/v1/tasks/${carolTask}`)
        .set(as(alice, acmeId))
        .send({
          assigneeUserId: carol.id,
          title: 'Renommée',
          description: '',
          dueOn: null,
        })
        .expect(409);
    });

    it('refuses to finish a task that was never started', async () => {
      const res = await setStatus(alice, aliceTask, {
        status: 'done',
        outcome: 'achieved',
        report: 'Fait.',
      }).expect(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('keeps other people’s tasks out of a member’s hands', async () => {
      expect(
        (
          await setStatus(carol, aliceTask, { status: 'in_progress' }).expect(
            403,
          )
        ).body.error.code,
      ).toBe('PERMISSION_DENIED');
      await ctx
        .http()
        .post(`/api/v1/tasks/${aliceTask}/notes`)
        .set(as(carol, acmeId))
        .send({ body: 'Je passe par là' })
        .expect(403);
      await ctx
        .http()
        .post(`/api/v1/tasks/${aliceTask}/notes`)
        .set(as(erin, acmeId))
        .send({ body: 'Lecture seule' })
        .expect(403);
      await ctx
        .http()
        .put(`/api/v1/tasks/${aliceTask}`)
        .set(as(carol, acmeId))
        .send({
          assigneeUserId: carol.id,
          title: 'Prise',
          description: '',
          dueOn: null,
        })
        .expect(403);
    });

    it('keeps an append-only journal of notes', async () => {
      const added = await ctx
        .http()
        .post(`/api/v1/tasks/${aliceTask}/notes`)
        .set(as(alice, acmeId))
        .send({ body: '  Appel prévu jeudi.  ' })
        .expect(201);
      expect(added.body).toEqual(
        expect.objectContaining({
          body: 'Appel prévu jeudi.',
          author: { userId: alice.id, email: alice.email },
        }),
      );
      const notes = await ctx
        .http()
        .get(`/api/v1/tasks/${aliceTask}/notes`)
        .set(as(erin, acmeId))
        .expect(200);
      expect(notes.body.map((n: { id: string }) => n.id)).toEqual([
        added.body.id,
      ]);
      await expect(
        ctx.admin.query(`update app.task_notes set body = 'x' where id = $1`, [
          added.body.id,
        ]),
      ).rejects.toThrow(/append-only/);
    });

    it('lets a manager reassign and reschedule, with the exact changes recorded', async () => {
      const put = (body: Record<string, unknown>) =>
        ctx
          .http()
          .put(`/api/v1/tasks/${aliceTask}`)
          .set(as(alice, acmeId))
          .send({
            assigneeUserId: alice.id,
            title: 'Relancer Sonatel',
            description: '',
            dueOn: null,
            ...body,
          });
      const disabled = await put({ assigneeUserId: dave.id }).expect(400);
      expect(disabled.body.error.details[0].path).toBe('assigneeUserId');
      const res = await put({
        assigneeUserId: carol.id,
        dueOn: '2020-01-06',
      }).expect(200);
      expect(res.body.dueOn).toBe('2020-01-06');
      const history = await ctx
        .http()
        .get(`/api/v1/tasks/${aliceTask}/history`)
        .set(as(alice, acmeId))
        .expect(200);
      expect(history.body[0].metadata.changes).toEqual({
        assigneeUserId: { from: alice.id, to: carol.id },
        dueOn: { from: null, to: '2020-01-06' },
      });
    });

    it('filters the list and counts open, blocked and overdue tasks', async () => {
      const open = await ctx
        .http()
        .get(`/api/v1/tasks?status=open&assigneeUserId=${carol.id}`)
        .set(as(erin, acmeId))
        .expect(200);
      expect(open.body.map((t: { id: string }) => t.id)).toContain(aliceTask);
      expect(open.body.map((t: { id: string }) => t.id)).not.toContain(
        carolTask,
      );
      const byResponsibility = await ctx
        .http()
        .get(`/api/v1/tasks?responsibilityId=${carolResponsibility}`)
        .set(as(erin, acmeId))
        .expect(200);
      expect(byResponsibility.body).toHaveLength(2);
      const summary = await ctx
        .http()
        .get('/api/v1/tasks/summary')
        .set(as(carol, acmeId))
        .expect(200);
      expect(summary.body).toEqual({
        // Three tasks launched for carol, plus the one reassigned to her.
        todo: 4,
        inProgress: 0,
        blocked: 0,
        overdue: 1,
        mine: 4,
      });
    });
  });

  describe('isolation between organizations', () => {
    let acmeTask: string;

    beforeAll(async () => {
      acmeTask = (
        await launch(alice, acmeId, {
          responsibilityId: null,
          assigneeUserId: carol.id,
          title: 'Tâche confidentielle',
        }).expect(201)
      ).body.id;
    });

    it('answers 404 to a stranger naming the organization', async () => {
      for (const attempt of [
        () => ctx.http().get('/api/v1/tasks').set(as(bob, acmeId)),
        () => ctx.http().get('/api/v1/tasks/summary').set(as(bob, acmeId)),
        () =>
          launch(bob, acmeId, {
            responsibilityId: null,
            assigneeUserId: bob.id,
            title: 'Intrusion',
          }),
      ]) {
        const res = await attempt().expect(404);
        expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
      }
    });

    it('hides the task behind the caller’s own tenant', async () => {
      const path = `/api/v1/tasks/${acmeTask}`;
      for (const attempt of [
        () => ctx.http().get(path).set(as(bob, globexId)),
        () => ctx.http().get(`${path}/notes`).set(as(bob, globexId)),
        () => ctx.http().get(`${path}/history`).set(as(bob, globexId)),
        () =>
          ctx.http().put(path).set(as(bob, globexId)).send({
            assigneeUserId: bob.id,
            title: 'Volée',
            description: '',
            dueOn: null,
          }),
        () =>
          ctx
            .http()
            .post(`${path}/status`)
            .set(as(bob, globexId))
            .send({ status: 'cancelled', reason: '' }),
        () =>
          ctx
            .http()
            .post(`${path}/notes`)
            .set(as(bob, globexId))
            .send({ body: 'Intrusion' }),
        () => ctx.http().get('/api/v1/tasks/nope').set(as(bob, globexId)),
      ]) {
        const res = await attempt().expect(404);
        expect(res.body.error.code).toBe('TASK_NOT_FOUND');
      }
      const globexList = await ctx
        .http()
        .get(`/api/v1/tasks?assigneeUserId=${carol.id}`)
        .set(as(bob, globexId))
        .expect(200);
      expect(globexList.body).toEqual([]);
      const summary = await ctx
        .http()
        .get('/api/v1/tasks/summary')
        .set(as(bob, globexId))
        .expect(200);
      expect(summary.body.todo).toBe(0);
      const { rows } = await ctx.admin.query(
        'select status, title from app.tasks where id = $1',
        [acmeTask],
      );
      expect(rows[0]).toEqual({
        status: 'todo',
        title: 'Tâche confidentielle',
      });
    });

    it('cannot borrow another organization’s responsibility or member', async () => {
      const foreignResponsibility = await launch(bob, globexId, {
        responsibilityId: carolResponsibility,
        assigneeUserId: bob.id,
        title: 'Emprunt',
      }).expect(400);
      expect(foreignResponsibility.body.error.details[0].path).toBe(
        'responsibilityId',
      );
      const foreignMember = await launch(bob, globexId, {
        responsibilityId: globexResponsibility,
        assigneeUserId: carol.id,
        title: 'Emprunt',
      }).expect(400);
      expect(foreignMember.body.error.details[0].path).toBe('assigneeUserId');
    });

    it('keeps tasks and notes inside one organization, even in SQL', async () => {
      await expect(
        ctx.admin.query(
          `insert into app.tasks
             (organization_id, responsibility_id, assignee_user_id, title, created_by)
           values ($1, $2, $3, 'Intrusion', $3)`,
          [acmeId, globexResponsibility, alice.id],
        ),
      ).rejects.toThrow(/foreign key/);
      await expect(
        ctx.admin.query(
          `insert into app.tasks
             (organization_id, assignee_user_id, title, created_by)
           values ($1, $2, 'Intrusion', $2)`,
          [acmeId, bob.id],
        ),
      ).rejects.toThrow(/foreign key/);
      await expect(
        ctx.admin.query(
          `insert into app.task_notes (organization_id, task_id, author_id, body)
           values ($1, $2, $3, 'Intrusion')`,
          [globexId, acmeTask, bob.id],
        ),
      ).rejects.toThrow(/foreign key/);
    });
  });
});
