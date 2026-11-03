import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue({}) } }));
process.env.VAPID_PUBLIC_KEY ||= 'test';
process.env.VAPID_PRIVATE_KEY ||= 'test';

const { app } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const { runAlerts } = await import('../src/alerts.js');
const { addDays, today } = await import('../src/dates.js');
const { csv } = await import('../src/routes/owner.js');
const { recalculateStreak } = await import('../src/streaks.js');

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

describe('motor de alertas', () => {
  it('socio recibe push y aviso en bandeja a 7, 3 y 0 días, sin duplicados', async () => {
    const sm = await db.member.findFirstOrThrow({
      where: { user: { email: 'socio@powerfit.test' } },
      include: { memberships: true },
    });
    await db.pushSubscription.create({
      data: { userId: sm.userId!, endpoint: 'https://push.example/abc', p256dh: 'k', auth: 'a' },
    });
    const end = sm.memberships[0].endDate;
    for (const d of [7, 7, 3, 0]) await runAlerts(addDays(end, -d));
    const { body } = await socio.get('/api/v1/me/notices').expect(200);
    const mine = await db.notice.findMany({ where: { memberId: sm.id } });
    expect(mine.map((n) => n.kind).sort()).toEqual(['D0', 'D3', 'D7']);
    expect(mine.every((n) => n.pushedAt)).toBe(true);
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
    expect(me.body.membership.status).toBe('ACTIVA');
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
    await recepcion
      .post('/api/v1/members')
      .send({ fullName: 'Prueba Uno', phone: '900111222', planId: plans[0].id, consent: true })
      .expect(201);
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
    await socio.post('/api/v1/loyalty/consent').send({ alias: 'Socio Demo' }).expect(204);
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
