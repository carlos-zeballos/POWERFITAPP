import webpush from 'web-push';
import { db } from './db.js';

const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subj } = process.env;
export const pushEnabled = Boolean(pub && priv);
if (pushEnabled) webpush.setVapidDetails(subj ?? 'mailto:admin@powerfit.pe', pub!, priv!);

/** Envía push a todos los dispositivos del usuario. Devuelve true si al menos uno lo recibió. */
export async function pushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!pushEnabled) return false;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let ok = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      ok = true;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }); // suscripción caducada
    }
  }
  return ok;
}
