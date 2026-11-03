ALTER TABLE "Member" ADD COLUMN "attendanceCode" TEXT;

CREATE TABLE "MemberAudit" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "actorId" TEXT NOT NULL,
  "beforeData" JSONB,
  "afterData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberAudit_memberId_createdAt_idx" ON "MemberAudit"("memberId", "createdAt");
CREATE UNIQUE INDEX "Member_attendanceCode_key" ON "Member"("attendanceCode");
ALTER TABLE "MemberAudit" ADD CONSTRAINT "MemberAudit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberAudit" ADD CONSTRAINT "MemberAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
