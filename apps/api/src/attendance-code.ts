import { randomInt } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const nextCode = () => String(randomInt(1000, 10_000));

/** Cryptographically random, non-sequential four-digit identifier for reception only. */
export async function newAttendanceCode(db: PrismaClient, exceptMemberId?: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const code = nextCode();
    const used = await db.member.findUnique({ where: { attendanceCode: code }, select: { id: true } });
    if (!used || used.id === exceptMemberId) return code;
  }
  throw new Error('No se pudo generar un código único');
}

export async function backfillAttendanceCodes(db: PrismaClient) {
  const members = await db.member.findMany({ where: { attendanceCode: null }, select: { id: true } });
  for (const member of members)
    await db.member.update({ where: { id: member.id }, data: { attendanceCode: await newAttendanceCode(db) } });
  return members.length;
}
