import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import gym from './src/config/gym.json' with { type: 'json' };

// SEO técnico generado desde el archivo editable del gimnasio: un solo lugar para datos de contacto.
const seo = (): Plugin => ({
  name: 'powerfit-seo',
  transformIndexHtml(html) {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ExerciseGym',
      name: gym.nombre,
      url: gym.url,
      image: `${gym.url}/og.png`,
      telephone: `+${gym.telefonoWhatsApp}`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: gym.direccion,
        addressLocality: gym.ciudad,
        addressCountry: 'PE',
      },
      geo: { '@type': 'GeoCoordinates', latitude: gym.geo.lat, longitude: gym.geo.lng },
      sameAs: Object.values(gym.redes),
    };
    return html
      .replaceAll('%URL%', gym.url)
      .replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld)}</script></head>`);
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), seo()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
  preview: { proxy: { '/api': 'http://localhost:4000' } },
});
