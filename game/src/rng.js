// Seeded deterministic randomness for Sky Courier: the same seed always builds the same
// valley, the same ring course and the same weather, so screenshots are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 2D value noise in [-1, 1], built from a seeded lattice hash. */
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  function lattice(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255 * 2 - 1;
  }
  function noise(x, z) {
    const ix = Math.floor(x); const iz = Math.floor(z);
    const fx = x - ix; const fz = z - iz;
    const a = lattice(ix, iz); const b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1); const d = lattice(ix + 1, iz + 1);
    const u = fade(fx); const v = fade(fz);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
  }
  /** Fractal Brownian motion: 3 octaves, amplitude halves each time. */
  return function fbm(x, z) {
    return noise(x, z) * 0.55 + noise(x * 2.13 + 7.7, z * 2.13 + 3.1) * 0.3
      + noise(x * 4.31 + 13.7, z * 4.31 + 9.4) * 0.15;
  };
}
