-- Commercial data managed by the owner and read by the public site.
CREATE TYPE "PlanCategory" AS ENUM ('MACHINES', 'DANCE');

ALTER TABLE "Plan"
  ADD COLUMN "category" "PlanCategory" NOT NULL DEFAULT 'MACHINES',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "promotion" TEXT,
  ADD COLUMN "highlighted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "OpeningHour" (
  "id" TEXT NOT NULL,
  "days" TEXT NOT NULL,
  "hours" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OpeningHour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpeningHour_days_key" ON "OpeningHour"("days");
