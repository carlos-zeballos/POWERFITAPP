import { db } from './db.js';
import { addDays, today } from './dates.js';

const monday = (date: Date) => addDays(date, -((date.getUTCDay() + 6) % 7));
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

export async function loyaltySettings() {
  return db.loyaltySettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });
}

/** Rebuilds the weekly projection from valid attendance rows; callers never supply a streak value. */
export async function recalculateStreak(memberId: string, ref = today()) {
  const settings = await loyaltySettings();
  const attendance = await db.attendance.findMany({
    where: { memberId, status: 'VALID', attendedOn: { lte: ref } },
    select: { attendedOn: true },
    orderBy: { attendedOn: 'asc' },
  });
  const currentWeek = monday(ref);
  if (!attendance.length) {
    await db.$transaction([
      db.streakWeek.deleteMany({ where: { memberId } }),
      db.streakState.upsert({
        where: { memberId },
        create: { memberId },
        update: { currentWeeks: 0, bestWeeks: 0, lastQualifyingWeek: null },
      }),
    ]);
    return { currentWeeks: 0, bestWeeks: 0, weeks: [] };
  }
  const firstWeek = monday(attendance[0].attendedOn);
  const counts = new Map<string, number>();
  for (const row of attendance) {
    const key = monday(row.attendedOn).toISOString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const freezes = new Map<string, number>();
  const weeks: { weekStart: Date; attendanceCount: number; metGoal: boolean; freezeUsed: boolean }[] = [];
  for (let weekStart = firstWeek; weekStart <= currentWeek; weekStart = addDays(weekStart, 7)) {
    const attendanceCount = counts.get(weekStart.toISOString()) ?? 0;
    const metGoal = attendanceCount >= settings.weeklyGoal;
    const key = monthKey(weekStart);
    const used = freezes.get(key) ?? 0;
    const freezeUsed = !metGoal && weekStart < currentWeek && used < settings.freezesPerMonth;
    if (freezeUsed) freezes.set(key, used + 1);
    weeks.push({ weekStart, attendanceCount, metGoal, freezeUsed });
  }
  let bestWeeks = 0;
  let run = 0;
  for (const week of weeks) {
    if (week.metGoal || week.freezeUsed) {
      bestWeeks = Math.max(bestWeeks, ++run);
    } else run = 0;
  }
  let currentWeeks = 0;
  let latest = weeks.length - 1;
  if (!weeks[latest].metGoal) latest--;
  for (let i = latest; i >= 0 && (weeks[i].metGoal || weeks[i].freezeUsed); i--) currentWeeks++;
  const last = [...weeks].reverse().find((week) => week.metGoal || week.freezeUsed);
  await db.$transaction(async (tx) => {
    await tx.streakWeek.deleteMany({ where: { memberId } });
    await tx.streakWeek.createMany({ data: weeks.map((week) => ({ memberId, ...week })) });
    await tx.streakState.upsert({
      where: { memberId },
      create: { memberId, currentWeeks, bestWeeks, lastQualifyingWeek: last?.weekStart },
      update: { currentWeeks, bestWeeks, lastQualifyingWeek: last?.weekStart },
    });
  });
  return { currentWeeks, bestWeeks, weeks };
}

export async function recalculateAllStreaks(ref = today()) {
  const members = await db.member.findMany({ select: { id: true } });
  return Promise.all(members.map((member) => recalculateStreak(member.id, ref)));
}
