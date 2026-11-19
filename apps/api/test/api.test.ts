import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

const { app } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const { runAlerts } = await import('../src/alerts.js');
const { addDays, iso, membershipEndDate, today } = await import('../src/dates.js');
const { csv } = await import('../src/routes/owner.js');
const { recalculateStreak } = await import('../src/streaks.js');
const { missionSnapshots, missionsForMembership } = await import('../src/missions.js');

const login = async (who: string) => {
  const a = request.agent(app);
  await a
    .post('/api/v1/auth/login')
    .send({ email: `${who}@powerfit.test`, password: 'PowerFit2026!' })
    .expect(200);
  return a;
};
let socio: Awaited<ReturnType<typeof login>>, recepcion: typeof socio, propietario: typeof socio;
beforeAll(async () => {
  [socio, recepcion, propietario] = await Promise.all(['socio', 'recepcion', 'propietario'].map(login));
});

describe('autenticación y roles', () => {
  it('rechaza sin sesión y con rol insuficiente', async () => {
    await request(app).get('/api/v1/members').expect(401);
    await socio.get('/api/v1/members').expect(403);
    await recepcion.get('/api/v1/kpis').expect(403);
    await request(app).post('/api/v1/auth/login').send({ email: 'socio@powerfit.test', password: 'mal' }).expect(401);
  });
  it('refresh emite nueva sesión y logout la revoca', async () => {
    const a = await login('recepcion');
    await a.post('/api/v1/auth/refresh').expect(200);
    await a.post('/api/v1/auth/logout').expect(204);
    await a.post('/api/v1/auth/refresh').expect(401);
  });
});

describe('catálogo público', () => {
  it('lee planes y horarios de la base de datos, y refleja una edición del propietario', async () => {
    const first = await request(app).get('/api/v1/public/catalog').expect(200);
    expect(first.body.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Máquinas | 1 año', price: '1000', promotion: '1 mes gratis' }),
        expect.objectContaining({ name: 'Danza | 3 meses', price: '180', promotion: 'Cupos y horarios limitados' }),
      ]),
    );
    expect(first.body.hours.map((hour: { days: string }) => hour.days)).toEqual([
      'Lunes a viernes',
      'Sábados',
      'Domingos',
    ]);

    const plan = first.body.plans.find((item: { name: string }) => item.name === 'Máquinas | 1 día');
    await propietario.patch(`/api/v1/plans/${plan.id}`).send({ price: 16 }).expect(200);
    expect(
      (await request(app).get('/api/v1/public/catalog').expect(200)).body.plans.find(
        (item: { id: string }) => item.id === plan.id,
      ).price,
    ).toBe('16');
    await propietario.patch(`/api/v1/plans/${plan.id}`).send({ price: 15 }).expect(200);
  });
});

describe('vigencias encadenadas', () => {
  it('calcula los planes mensuales por meses calendario, no por 30 días fijos', () => {
    expect(iso(membershipEndDate(new Date('2026-01-01T00:00:00Z'), { durationDays: 30, durationMonths: 1 }))).toBe(
      '2026-01-31',
    );
    expect(iso(membershipEndDate(new Date('2026-01-05T00:00:00Z'), { durationDays: 30, durationMonths: 1 }))).toBe(
      '2026-02-04',
    );
  });
});

describe('misiones por suscripción', () => {
  it('no crea premios para el plan diario y cierra el plan anual en el mes 12, no en el mes gratis', () => {
    const base = {
      id: 'm1',
      memberId: 'u1',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2027-01-31T00:00:00Z'),
    };
    expect(missionSnapshots({ ...base, plan: { durationDays: 1, durationMonths: null } })).toEqual([]);
    const annual = missionSnapshots({ ...base, plan: { durationDays: 395, durationMonths: 13 } });
    expect(annual).toHaveLength(6);
    expect(annual.at(-1)?.target).toBe(6);
    expect(annual.at(-1)?.deadline.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('mantiene bloqueados los niveles posteriores hasta completar el anterior', async () => {
    const membership = {
      id: 'sequential-missions',
      memberId: 'sequential-member',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-31T00:00:00Z'),
      plan: { durationDays: 30, durationMonths: 1 },
    };
    const snapshots = missionSnapshots(membership);
    const fakeDb = {
      membershipMission: { findMany: vi.fn().mockResolvedValue(snapshots) },
      attendance: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 6 }, (_, index) => ({
            attendedOn: new Date(`2026-01-${String(25 + index).padStart(2, '0')}T00:00:00Z`),
          })),
        ),
      },
    };
    const missions = await missionsForMembership(fakeDb as never, membership, new Date('2026-01-31T00:00:00Z'));
    expect(missions[0].state).toBe('IN_PROGRESS');
    expect(missions[1]).toMatchObject({ progress: 6, target: 6, state: 'LOCKED' });
  });
});

describe('motor de alertas', () => {
  it('socio recibe avisos en bandeja a 7, 3 y 0 días, sin duplicados', async () => {
    const sm = await db.member.findFirstOrThrow({
      where: { user: { email: 'socio@powerfit.test' } },
      include: { memberships: true },
    });
    const end = sm.memberships[0].endDate;
    for (const d of [7, 7, 3, 0]) await runAlerts(addDays(end, -d));
    const { body } = await socio.get('/api/v1/me/notices').expect(200);
    const mine = await db.notice.findMany({ where: { memberId: sm.id } });
    expect(mine.map((n) => n.kind).sort()).toEqual(['D0', 'D3', 'D7']);
    expect(body).toHaveLength(3);
    await socio.post(`/api/v1/me/notices/${body[0].id}/read`).expect(204);
    expect((await db.notice.findUniqueOrThrow({ where: { id: body[0].id } })).readAt).not.toBeNull();
  });
  it('registra la ejecución diaria (idempotente)', async () => {
    const r1 = await runAlerts();
    const r2 = await runAlerts();
    expect(r2.created).toBe(0);
    expect(r1.date).toBe(r2.date);
    expect(await db.jobRun.count({ where: { name: 'alerts', runDate: today() } })).toBe(1);
  });
});

describe('recepción', () => {
  it('renueva en una llamada, a tiempo y sin doble registro', async () => {
    const { body: list } = await recepcion.get('/api/v1/members?status=POR_VENCER').expect(200);
    const m = list.find((x: { fullName: string }) => x.fullName === 'Socio Demo');
    expect(m.membership.status).toBe('POR_VENCER');
    const t = performance.now();
    const { body } = await recepcion
      .post(`/api/v1/members/${m.id}/renew`)
      .send({ fromId: m.membership.id })
      .expect(201);
    expect(performance.now() - t).toBeLessThan(2000);
    expect(body.onTime).toBe(true);
    expect(body.startDate).toBe(addDays(new Date(m.membership.endDate), 1).toISOString().slice(0, 10));
    await recepcion.post(`/api/v1/members/${m.id}/renew`).send({ fromId: m.membership.id }).expect(409);
    const me = await socio.get('/api/v1/me').expect(200);
    // Aunque ya se pagó el siguiente período, la ficha del socio conserva la cobertura actual hasta su vencimiento.
    expect(me.body.membership.status).toBe('POR_VENCER');
    const detail = await recepcion.get(`/api/v1/members/${m.id}`).expect(200);
    expect(detail.body.currentMembership.id).toBe(m.membership.id);
    expect(detail.body.nextMembership.id).toBe(body.id);
  });
  it('alta de socio exige consentimiento y celular válido', async () => {
    const { body: plans } = await recepcion.get('/api/v1/plans');
    await recepcion
      .post('/api/v1/members')
      .send({ fullName: 'Prueba Uno', phone: '900111222', planId: plans[0].id })
      .expect(400);
    await recepcion
      .post('/api/v1/members')
      .send({ fullName: 'Prueba Uno', phone: '12', planId: plans[0].id, consent: true })
      .expect(400);
    const created = await recepcion
      .post('/api/v1/members')
      .send({ fullName: 'Prueba Uno', phone: '900111222', planId: plans[0].id, consent: true })
      .expect(201);
    expect(created.body.attendanceCode).toMatch(/^\d{4}$/);
    const lookup = await recepcion.get(`/api/v1/members?q=${created.body.attendanceCode}`).expect(200);
    expect(lookup.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id })]));
  });
});

describe('propietario', () => {
  it('ve indicadores con línea base y exporta CSV', async () => {
    const { body } = await propietario.get('/api/v1/kpis').expect(200);
    expect(body.baseline).toMatchObject({ renovacionOportuna: 38, tasaBaja: 6.5, avisosOportunos: 52 });
    expect(body.current.renovacionOportuna).toBeTypeOf('number');
    const r = await propietario.get('/api/v1/reports/members.csv').expect(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text).toContain('"Socio";"Celular"');
  });
  it('envía comunicado segmentado', async () => {
    const { body: plans } = await propietario.get('/api/v1/plans');
    const { body } = await propietario
      .post('/api/v1/broadcasts')
      .send({ title: 'Feriado', body: 'Abrimos 8 a 13 h', status: 'VENCIDA', planId: plans[0].id })
      .expect(201);
    expect(body.sentCount).toBeGreaterThan(0);
    expect(await db.notice.count({ where: { broadcastId: body.id } })).toBe(body.sentCount);
  });
  it('CSV neutraliza fórmulas', () => {
    expect(csv([['=1+1', 'a"b']])).toBe('﻿"\'=1+1";"a""b"');
  });
});

describe('fidelizacion', () => {
  it('permanece fuera de alcance mientras el flag esta apagado', async () => {
    process.env.LOYALTY_ENABLED = 'false';
    await socio.get('/api/v1/loyalty/qr').expect(404);
  });

  it('registra QR una sola vez, conserva auditoria y permite anulacion', async () => {
    process.env.LOYALTY_ENABLED = 'true';
    const { body: qr } = await socio.get('/api/v1/loyalty/qr').expect(200);
    const first = await recepcion.post('/api/v1/loyalty/check-ins').send({ qrToken: qr.token }).expect(201);
    expect(first.body.created).toBe(true);
    expect(first.body.pointsAwarded).toBe(10);
    const second = await recepcion.post('/api/v1/loyalty/check-ins').send({ qrToken: qr.token }).expect(200);
    expect(second.body.created).toBe(false);
    expect(second.body.attendance.id).toBe(first.body.attendance.id);
    expect(await db.pointLedger.count({ where: { referenceId: first.body.attendance.id } })).toBe(1);
    await recepcion
      .post(`/api/v1/loyalty/attendances/${first.body.attendance.id}/void`)
      .send({ reason: 'Registro de prueba' })
      .expect(200);
    expect(await db.attendanceAudit.count({ where: { attendanceId: first.body.attendance.id } })).toBe(2);
    process.env.LOYALTY_ENABLED = 'false';
  });

  it('recalcula racha semanal, usa un congelamiento y reacciona a una anulacion', async () => {
    const member = await db.member.findFirstOrThrow({ where: { user: { email: 'socio@powerfit.test' } } });
    const staffUser = await db.user.findFirstOrThrow({ where: { email: 'recepcion@powerfit.test' } });
    await db.attendanceAudit.deleteMany({ where: { attendance: { memberId: member.id } } });
    await db.attendance.deleteMany({ where: { memberId: member.id } });
    await db.loyaltySettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', weeklyGoal: 3, freezesPerMonth: 1 },
      update: { weeklyGoal: 3, freezesPerMonth: 1 },
    });
    const days = [
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ];
    await db.attendance.createMany({
      data: days.map((day) => ({
        memberId: member.id,
        attendedOn: new Date(`${day}T00:00:00Z`),
        source: 'MANUAL',
        createdById: staffUser.id,
      })),
    });
    const first = await recalculateStreak(member.id, new Date('2026-11-02T00:00:00Z'));
    expect(first.currentWeeks).toBe(4);
    expect(first.weeks.find((week) => week.weekStart.toISOString().startsWith('2026-10-19'))?.freezeUsed).toBe(true);
    const voided = await db.attendance.findFirstOrThrow({
      where: { memberId: member.id, attendedOn: new Date('2026-10-28T00:00:00Z') },
    });
    await db.attendance.update({ where: { id: voided.id }, data: { status: 'VOID', voidedAt: new Date() } });
    expect((await recalculateStreak(member.id, new Date('2026-11-02T00:00:00Z'))).currentWeeks).toBe(0);
  });
});
