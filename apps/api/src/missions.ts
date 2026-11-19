import type { PrismaClient } from '@prisma/client';
import { addDays, addMonths, iso, today } from './dates.js';

type PlanTerm = { durationDays: number; durationMonths: number | null };
type MembershipTerm = { id: string; memberId: string; startDate: Date; endDate: Date; plan: PlanTerm };
type Rule = { level: number; title: string; target: number; deadlineMonth?: number; finalWeek?: boolean };
type MissionState = 'UNLOCKED' | 'IN_PROGRESS' | 'LOCKED' | 'MISSED';
type MissionProgress = {
  level: number;
  title: string;
  description: string;
  progress: number;
  target: number;
  deadline: string;
  state: MissionState;
};

function monthsFor(plan: PlanTerm) {
  return (
    plan.durationMonths ??
    (plan.durationDays >= 365
      ? 13
      : plan.durationDays >= 180
        ? 6
        : plan.durationDays >= 90
          ? 3
          : plan.durationDays >= 30
            ? 1
            : 0)
  );
}

function rules(plan: PlanTerm): Rule[] {
  const months = monthsFor(plan);
  if (!months) return [];
  if (months === 1)
    return [
      { level: 1, title: 'Activa tu constancia', target: 7 },
      { level: 2, title: 'Cierre de campeón', target: 6, finalWeek: true },
    ];
  if (months === 3)
    return [
      { level: 1, title: 'Activa tu constancia', target: 7, deadlineMonth: 1 },
      { level: 2, title: 'Segundo mes firme', target: 18, deadlineMonth: 2 },
      { level: 3, title: 'Constancia trimestral', target: 42, deadlineMonth: 3 },
      { level: 4, title: 'Cierre de campeón', target: 6, finalWeek: true },
    ];
  if (months === 6)
    return [
      { level: 1, title: 'Activa tu constancia', target: 7, deadlineMonth: 1 },
      { level: 2, title: 'Primer trimestre firme', target: 22, deadlineMonth: 3 },
      { level: 3, title: 'Constancia semestral', target: 45, deadlineMonth: 5 },
      { level: 4, title: 'Cierre de campeón', target: 6, finalWeek: true },
    ];
  return [
    { level: 1, title: 'Activa tu constancia', target: 7, deadlineMonth: 1 },
    { level: 2, title: 'Trimestre firme', target: 24, deadlineMonth: 3 },
    { level: 3, title: 'Medio año en movimiento', target: 48, deadlineMonth: 6 },
    { level: 4, title: 'Nueve meses constante', target: 72, deadlineMonth: 9 },
    { level: 5, title: 'Compromiso anual', target: 110, deadlineMonth: 11 },
    { level: 6, title: 'Cierre de campeón', target: 6, finalWeek: true },
  ];
}

export function missionSnapshots(membership: MembershipTerm) {
  const months = monthsFor(membership.plan);
  return rules(membership.plan).map((rule) => {
    const endMonth = rule.deadlineMonth ?? (months >= 13 ? 12 : months);
    const deadline = addDays(addMonths(membership.startDate, endMonth), -1);
    const windowStart = rule.finalWeek ? addDays(deadline, -6) : membership.startDate;
    return {
      membershipId: membership.id,
      level: rule.level,
      title: rule.title,
      description: rule.finalWeek
        ? 'Asiste 6 de los últimos 7 días de tu suscripción.'
        : `Registra ${rule.target} asistencias antes del ${iso(deadline)}.`,
      target: rule.target,
      windowStart,
      deadline,
    };
  });
}

export async function createMembershipMissions(db: PrismaClient, membership: MembershipTerm) {
  const snapshots = missionSnapshots(membership);
  if (snapshots.length) await db.membershipMission.createMany({ data: snapshots, skipDuplicates: true });
}

export async function missionsForMembership(db: PrismaClient, membership: MembershipTerm, ref = today()) {
  const [snapshots, attendance] = await Promise.all([
    db.membershipMission.findMany({ where: { membershipId: membership.id }, orderBy: { level: 'asc' } }),
    db.attendance.findMany({
      where: {
        memberId: membership.memberId,
        status: 'VALID',
        attendedOn: { gte: membership.startDate, lte: membership.endDate },
      },
      select: { attendedOn: true },
    }),
  ]);
  const visits = new Set(attendance.map((entry) => iso(entry.attendedOn)));
  const evaluated: MissionProgress[] = snapshots.map((mission) => {
    const effectiveEnd = ref < mission.deadline ? ref : mission.deadline;
    const progress =
      ref < mission.windowStart
        ? 0
        : [...visits].filter((day) => day >= iso(mission.windowStart) && day <= iso(effectiveEnd)).length;
    const unlocked = progress >= mission.target;
    return {
      level: mission.level,
      title: mission.title,
      description: mission.description,
      progress: Math.min(progress, mission.target),
      target: mission.target,
      deadline: iso(mission.deadline),
      state: unlocked ? 'UNLOCKED' : ref > mission.deadline ? 'MISSED' : 'IN_PROGRESS',
    };
  });

  // Las misiones son hitos consecutivos. El avance se sigue calculando con las
  // asistencias reales, pero un nivel no se puede desbloquear ni reclamar antes
  // de que el anterior haya sido alcanzado.
  return evaluated.reduce<MissionProgress[]>((sequence, mission, index) => {
    const previous = sequence[index - 1];
    sequence.push({
      ...mission,
      state: index === 0 || previous.state === 'UNLOCKED' ? mission.state : 'LOCKED',
    });
    return sequence;
  }, []);
}
