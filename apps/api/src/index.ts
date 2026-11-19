import cron from 'node-cron';
import { app } from './app.js';
import { runAlerts } from './alerts.js';

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API PowerFit en :${port}`));
cron.schedule(
  process.env.ALERTS_CRON ?? '0 8 * * *',
  () => void runAlerts().catch((e) => console.error('[alerts] fallo', e)),
  {
    timezone: process.env.TZ_GYM ?? 'America/Lima',
  },
);
