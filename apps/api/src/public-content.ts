import type { PrismaClient } from '@prisma/client';

export const POWERFIT_PLANS = [
  {
    name: 'Máquinas | 1 día',
    category: 'MACHINES' as const,
    durationDays: 1,
    durationMonths: null,
    price: 15,
    description: 'Entrenamiento con máquinas.',
    promotion: null,
    highlighted: false,
    publicVisible: true,
    sortOrder: 10,
  },
  {
    name: 'Máquinas | 1 mes',
    category: 'MACHINES' as const,
    durationDays: 30,
    durationMonths: 1,
    price: 100,
    description: 'Entrenamiento con máquinas durante un mes.',
    promotion: null,
    highlighted: true,
    publicVisible: true,
    sortOrder: 20,
  },
  {
    name: 'Máquinas | 3 meses',
    category: 'MACHINES' as const,
    durationDays: 90,
    durationMonths: 3,
    price: 270,
    description: 'Entrenamiento con máquinas durante tres meses.',
    promotion: null,
    highlighted: false,
    publicVisible: true,
    sortOrder: 30,
  },
  {
    name: 'Máquinas | 6 meses',
    category: 'MACHINES' as const,
    durationDays: 180,
    durationMonths: 6,
    price: 480,
    description: 'Entrenamiento con máquinas durante seis meses.',
    promotion: null,
    highlighted: false,
    publicVisible: true,
    sortOrder: 40,
  },
  {
    name: 'Máquinas | 1 año',
    category: 'MACHINES' as const,
    durationDays: 395,
    durationMonths: 13,
    price: 1000,
    description: 'Entrenamiento con máquinas por un año.',
    promotion: '1 mes gratis',
    highlighted: true,
    publicVisible: true,
    sortOrder: 50,
  },
  {
    name: 'Danza | 1 mes',
    category: 'DANCE' as const,
    durationDays: 30,
    durationMonths: 1,
    price: 70,
    description: 'Clases de danza. Cupos y horarios limitados: consulta disponibilidad por WhatsApp.',
    promotion: 'Cupos y horarios limitados',
    highlighted: false,
    publicVisible: true,
    sortOrder: 60,
  },
  {
    name: 'Danza | 3 meses',
    category: 'DANCE' as const,
    durationDays: 90,
    durationMonths: 3,
    price: 180,
    description: 'Clases de danza. Cupos y horarios limitados: consulta disponibilidad por WhatsApp.',
    promotion: 'Cupos y horarios limitados',
    highlighted: true,
    publicVisible: true,
    sortOrder: 70,
  },
];

export const POWERFIT_OPENING_HOURS = [
  { days: 'Lunes a viernes', hours: '5:00 a. m. a 9:30 p. m.', sortOrder: 10 },
  { days: 'Sábados', hours: '6:00 a. m. a 5:00 p. m.', sortOrder: 20 },
  { days: 'Domingos', hours: '7:00 a. m. a 12:00 del mediodía', sortOrder: 30 },
];

/** Initial, idempotent data load. The owner panel is the source of truth after this. */
export async function upsertPowerFitPublicContent(db: PrismaClient) {
  await db.$transaction(async (tx) => {
    for (const plan of POWERFIT_PLANS) {
      await tx.plan.upsert({ where: { name: plan.name }, create: plan, update: plan });
    }
    await tx.openingHour.deleteMany();
    await tx.openingHour.createMany({ data: POWERFIT_OPENING_HOURS });
  });
}
