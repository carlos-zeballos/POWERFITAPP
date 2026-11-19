-- A monthly plan expires on the day before the same calendar date in the following month.
ALTER TABLE "Plan" ADD COLUMN "durationMonths" INTEGER;
