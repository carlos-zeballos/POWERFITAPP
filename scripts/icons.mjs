// Genera íconos PWA y og.png desde el logo (fondo naranja + logo blanco, como el manual §6 aplicación móvil).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const logo = 'data:image/png;base64,' + readFileSync('brand/logo-powerfit.png').toString('base64');
const mark = (w, pad) =>
  `<div style="width:${w}px;height:${w}px;background:#EC661C;display:grid;place-items:center"><div style="height:${w * (1 - 2 * pad)}px;aspect-ratio:423/680;background:#fff;-webkit-mask:url(${logo}) top/100% auto no-repeat"></div></div>`;
const og = `<div style="width:1200px;height:630px;background:#000;display:flex;align-items:center;justify-content:space-between;padding:0 80px;box-sizing:border-box;font-family:Impact,sans-serif"><div style="color:#EC661C;font-size:180px;line-height:.9">POWERFIT<div style="color:#fff;font-size:48px;font-family:sans-serif;margin-top:24px">Gimnasio en Arequipa</div></div><div style="height:520px;aspect-ratio:423/774;background:#EC661C;-webkit-mask:url(${logo}) top/100% auto no-repeat"></div></div>`;
const b = await chromium.launch();
const p = await b.newPage();
for (const [file, html, w, h] of [
  ['icons/icon-192.png', mark(192, 0.12), 192, 192],
  ['icons/icon-512.png', mark(512, 0.12), 512, 512],
  ['icons/maskable-512.png', mark(512, 0.22), 512, 512],
  ['og.png', og, 1200, 630],
]) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<body style="margin:0">${html}</body>`);
  await p.screenshot({ path: `apps/web/public/${file}` });
}
await b.close();
