-- La aplicación es web: los avisos viven en la bandeja interna y no usa Web Push.
ALTER TABLE "Notice" DROP COLUMN "pushedAt";
DROP TABLE "PushSubscription";
