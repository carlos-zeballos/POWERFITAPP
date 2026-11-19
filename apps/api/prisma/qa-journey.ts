/**
 * Recorrido de QA local posterior a `prisma migrate reset`.
 *
 * Crea solo dos operadores (propietario y recepción) y un socio por plan.
 * Los socios se registran usando el endpoint real del propietario; después se
 * les asocia una cuenta local de QA para poder verificar también su portal.
 * Nunca usar en producción.
 */
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { db } from '../src/db.js';
import { app } from '../src/app.js';
import { upsertPowerFitPublicContent } from '../src/public-content.js';
import { iso, today } from '../src/dates.js';

const password = 'PowerFit2026!';
const customers = [
  { plan: 'Máquinas | 1 día', name: 'QA Diario', phone: '900000101', email: 'qa.diario@powerfit.test' },
  { plan: 'Máquinas | 1 mes', name: 'QA Mensual', phone: '900000102', email: 'qa.mensual@powerfit.test' },
  { plan: 'Máquinas | 3 meses', name: 'QA Trimestral', phone: '900000103', email: 'qa.trimestral@powerfit.test' },
  { plan: 'Máquinas | 6 meses', name: 'QA Semestral', phone: '900000104', email: 'qa.semestral@powerfit.test' },
  { plan: 'Máquinas | 1 año', name: 'QA Anual', phone: '900000105', email: 'qa.anual@powerfit.test' },
  { plan: 'Danza | 1 mes', name: 'QA Danza Mensual', phone: '900000106', email: 'qa.danza.mensual@powerfit.test' },
  {
    plan: 'Danza | 3 meses',
    name: 'QA Danza Trimestral',
    phone: '900000107',
    email: 'qa.danza.trimestral@powerfit.test',
  },
] as const;

async function login(email: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
  return agent;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('El recorrido QA no se permite en producción.');
  const hash = await bcrypt.hash(password, 10);
  await upsertPowerFitPublicContent(db);
  await db.loyaltySettings.create({ data: { id: 'default' } });
  await db.pointRule.createMany({
    data: [
      { key: 'attendance', points: 10, metadata: { label: 'Asistencia diaria' } },
      { key: 'weekly_goal', points: 25, metadata: { label: 'Meta semanal' } },
      { key: 'on_time_renewal', points: 50, metadata: { label: 'Renovación oportuna' } },
    ],
  });
  await db.user.createMany({
    data: [
      { email: 'propietario@powerfit.test', name: 'Propietario QA', role: 'OWNER', passwordHash: hash },
      { email: 'recepcion@powerfit.test', name: 'Recepción QA', role: 'STAFF', passwordHash: hash },
    ],
  });

  const owner = await login('propietario@powerfit.test');
  const staff = await login('recepcion@powerfit.test');
  const plans = await owner.get('/api/v1/plans').expect(200);
  const byName = new Map(plans.body.map((plan: { id: string; name: string }) => [plan.name, plan.id]));
  const created: { id: string; plan: string; code: string; email: string; endDate: string }[] = [];

  for (const customer of customers) {
    const planId = byName.get(customer.plan);
    if (!planId) throw new Error(`No se encontró el plan ${customer.plan}`);
    const response = await owner
      .post('/api/v1/members')
      .send({ fullName: customer.name, phone: customer.phone, email: customer.email, planId, consent: true })
      .expect(201);
    const member = response.body as { id: string; attendanceCode: string; memberships: { endDate: string }[] };
    const portalUser = await db.user.create({
      data: { email: customer.email, name: customer.name, role: 'MEMBER', passwordHash: hash },
    });
    await db.member.update({ where: { id: member.id }, data: { userId: portalUser.id } });
    created.push({
      id: member.id,
      plan: customer.plan,
      code: member.attendanceCode,
      email: customer.email,
      endDate: member.memberships[0].endDate.slice(0, 10),
    });
  }

  // Recepción: búsqueda por código, asistencia diaria e idempotencia.
  const regenerated = await owner
    .post(`/api/v1/loyalty/members/${created[0].id}/regenerate-code`)
    .send({ reason: 'Prueba de trazabilidad de código' })
    .expect(200);
  created[0].code = regenerated.body.attendanceCode;
  for (const customer of created) {
    const lookup = await staff.get(`/api/v1/members?q=${customer.code}`).expect(200);
    if (lookup.body.length !== 1 || lookup.body[0].id !== customer.id)
      throw new Error(`Búsqueda falló: ${customer.plan}`);
    await staff.post('/api/v1/loyalty/check-ins').send({ code: customer.code }).expect(201);
  }
  await staff.post('/api/v1/loyalty/check-ins').send({ code: created[1].code }).expect(200);
  await staff.get('/api/v1/loyalty/check-ins/today').expect(200);

  // Propietario: configuración, indicadores, CSV, alertas y comunicado para los siete socios vigentes.
  const hours = await owner.get('/api/v1/business-hours').expect(200);
  await owner
    .put('/api/v1/business-hours')
    .send(
      hours.body.map(
        ({ days, hours: openingHours, sortOrder }: { days: string; hours: string; sortOrder: number }) => ({
          days,
          hours: openingHours,
          sortOrder,
        }),
      ),
    )
    .expect(200);
  const settings = await owner.get('/api/v1/loyalty/settings').expect(200);
  await owner.patch('/api/v1/loyalty/settings').send({ weeklyGoal: settings.body.weeklyGoal }).expect(200);
  await owner
    .post('/api/v1/manual-hours')
    .send({ weekStart: iso(today()), hours: 1 })
    .expect(201);
  await owner.get('/api/v1/kpis').expect(200);
  await owner.get('/api/v1/reports/members.csv').expect(200);
  await owner.get('/api/v1/reports/notices.csv').expect(200);
  const missionControl = await owner.get('/api/v1/loyalty/missions').expect(200);
  if (missionControl.body.summary.members !== 6)
    throw new Error('El control debe excluir el plan diario sin misiones.');
  const detail = await owner.get(`/api/v1/members/${missionControl.body.members[0].memberId}`).expect(200);
  if (!detail.body.memberships[0].missions.length) throw new Error('La ficha administrativa no mostró las misiones.');

  for (const date of new Set(
    created.flatMap((customer) => {
      const end = new Date(`${customer.endDate}T00:00:00Z`);
      return [-7, -3, 0].map((days) => new Date(end.getTime() + days * 86_400_000).toISOString().slice(0, 10));
    }),
  ))
    await owner.post('/api/v1/jobs/alerts').send({ date }).expect(200);
  const broadcast = await owner
    .post('/api/v1/broadcasts')
    .send({
      title: 'Comunicado de prueba QA',
      body: 'Tus datos, asistencia y avisos están conectados.',
    })
    .expect(201);
  if (broadcast.body.sentCount !== customers.length)
    throw new Error('El comunicado no alcanzó a los siete socios activos.');

  // Socio: acceso, membresía, racha/misiones y bandeja de avisos.
  const member = await login(created[1].email);
  await member.get('/api/v1/auth/me').expect(200);
  await member.get('/api/v1/me').expect(200);
  const loyalty = await member.get('/api/v1/loyalty/me').expect(200);
  if (!Array.isArray(loyalty.body.missions) || loyalty.body.missions.length !== 2)
    throw new Error('La membresía mensual no mostró sus dos misiones.');
  const notices = await member.get('/api/v1/me/notices').expect(200);
  if (!notices.body.length) throw new Error('El socio no recibió avisos en su bandeja.');
  await member.post(`/api/v1/me/notices/${notices.body[0].id}/read`).expect(204);

  const summary = {
    date: iso(today()),
    members: await db.member.count(),
    users: await db.user.count(),
    validAttendances: await db.attendance.count({ where: { status: 'VALID' } }),
    notices: await db.notice.count(),
    broadcasts: await db.broadcast.count(),
    customers: created.map(({ plan, code, email, endDate }) => ({ plan, code, email, endDate })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
