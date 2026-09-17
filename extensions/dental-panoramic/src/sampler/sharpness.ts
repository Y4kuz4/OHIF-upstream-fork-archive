export const MIN_SHARPNESS = 0;
export const MAX_SHARPNESS = 100;
export const DEFAULT_SHARPNESS = 0;

let sharpness = DEFAULT_SHARPNESS;
const listeners = new Set<(value: number) => void>();

export function clampPanoramicSharpness(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SHARPNESS;
  }
  return Math.max(MIN_SHARPNESS, Math.min(MAX_SHARPNESS, Math.round(value)));
}

export function getPanoramicSharpness(): number {
  return sharpness;
}

export function setPanoramicSharpness(value: number): number {
  const next = clampPanoramicSharpness(value);
  if (next === sharpness) {
    return sharpness;
  }
  sharpness = next;
  listeners.forEach(listener => listener(sharpness));
  return sharpness;
}

export function subscribePanoramicSharpness(listener: (value: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Applies a 3x3 Gaussian unsharp mask. Strength 0 is a zero-copy no-op. */
export function applyPanoramicSharpen(
  pixels: Float32Array,
  columns: number,
  rows: number,
  strength: number
): Float32Array {
  const normalized = clampPanoramicSharpness(strength) / MAX_SHARPNESS;
  if (normalized === 0 || columns < 3 || rows < 3) {
    return pixels;
  }

  const output = new Float32Array(pixels);
  const amount = normalized * 2;

  for (let row = 1; row < rows - 1; row++) {
    const rowOffset = row * columns;
    for (let column = 1; column < columns - 1; column++) {
      const index = rowOffset + column;
      const blur =
        (pixels[index - columns - 1] +
          2 * pixels[index - columns] +
          pixels[index - columns + 1] +
          2 * pixels[index - 1] +
          4 * pixels[index] +
          2 * pixels[index + 1] +
          pixels[index + columns - 1] +
          2 * pixels[index + columns] +
          pixels[index + columns + 1]) /
        16;
      output[index] = pixels[index] + amount * (pixels[index] - blur);
    }
  }

  return output;
}
