/**
 * Colour checks for the site colours (spec admin-console, "The four sites"): WCAG contrast
 * against the console surfaces and OKLab distance under simulated colour-vision
 * deficiencies (Machado et al. 2009, severity 1). Same formulas as the dataviz palette
 * validator the colours were chosen with.
 */

/** Chart and page surfaces of the console (src/styles/global.css). */
export const SURFACES = { light: '#fcfcfb', dark: '#1a1a19' } as const;

export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan';

const MACHADO: Record<Exclude<Vision, 'normal'>, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function srgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (hex: string) => srgb(hex).map(toLinear) as [number, number, number];

export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = linear(h);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function oklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function simulate(hex: string, vision: Vision): [number, number, number] {
  const rgb = linear(hex);
  if (vision === 'normal') return rgb;
  const m = MACHADO[vision];
  const clamp = (c: number) => Math.max(0, Math.min(1, c));
  return m.map((row) => clamp(row[0]! * rgb[0] + row[1]! * rgb[1] + row[2]! * rgb[2])) as [number, number, number];
}

/** OKLab distance ×100 between two colours as seen with the given vision. */
export function deltaE(a: string, b: string, vision: Vision = 'normal'): number {
  const x = oklab(simulate(a, vision));
  const y = oklab(simulate(b, vision));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
