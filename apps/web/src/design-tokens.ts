/**
 * Tokens de marca PowerFit, extraídos del Manual de Identidad (brand/Manual de identidad POWERFIT.pdf).
 * Fuente de verdad para TS; las mismas variables viven en src/index.css (@theme) para CSS/Tailwind.
 */
export const color = {
  // Manual §1 Paleta de color
  orange: '#EC661C', // CMYK 0/70/94/0 · RGB 236/103/28
  black: '#000000',
  white: '#FFFFFF',
  // Derivados (no definidos en el manual): superficies y texto atenuado sobre negro, AA verificado.
  surface: '#141414', // tarjetas sobre negro
  line: '#2A2A2A',
  muted: '#A6A6A6', // 8.4:1 sobre negro
  danger: '#FF6B5B', // 7.0:1 sobre negro (estado vencida)
  ok: '#7BD88F', // 11:1 sobre negro (estado activa)
} as const;

/**
 * Contraste (WCAG 2.1):
 * naranja/negro 6.6:1 (AA texto normal) · blanco/negro 21:1 · negro/naranja 6.6:1 (botones)
 * blanco/naranja 3.2:1 → SOLO texto ≥ 24 px o ≥ 19 px bold (AA texto grande). Nunca texto pequeño blanco sobre naranja.
 * naranja/blanco 3.2:1 → igual restricción.
 */
export const font = {
  display: "'Big Shoulders Stencil Text', Impact, sans-serif", // Manual §2 Tipografía
  // Supuesto: el manual no define tipografía de texto; sus páginas usan una geométrica tipo Lexend.
  body: "'Lexend', system-ui, sans-serif",
} as const;

/** Zona de respeto (no definida en el manual): propuesta = ancho del trazo de la "P" ≈ 12 % del ancho del logo. */
export const logoClearSpace = 0.12;

/** Elementos gráficos del manual: chevrons triples, diagonales naranjas y numeración en círculos. */
export const motif = { chevrons: 3, diagonalDeg: 45 } as const;
