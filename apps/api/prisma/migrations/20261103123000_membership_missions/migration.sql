CREATE TABLE "MembershipMission" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "windowStart" DATE NOT NULL,
  "deadline" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipMission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MembershipMission_membershipId_level_key" ON "MembershipMission"("membershipId", "level");
CREATE INDEX "MembershipMission_membershipId_deadline_idx" ON "MembershipMission"("membershipId", "deadline");
ALTER TABLE "MembershipMission" ADD CONSTRAINT "MembershipMission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
