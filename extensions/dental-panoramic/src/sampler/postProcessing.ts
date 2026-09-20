export type PanoramicPostProcessingSettings = {
  enabled: boolean;
  denoise: number;
  contrast: number;
  sharpen: number;
};

export const PANORAMIC_POST_PROCESSING_ORIGINAL: PanoramicPostProcessingSettings = {
  enabled: false,
  denoise: 20,
  contrast: 25,
  sharpen: 30,
};

export const PANORAMIC_POST_PROCESSING_SOFT: PanoramicPostProcessingSettings = {
  enabled: true,
  denoise: 20,
  contrast: 25,
  sharpen: 30,
};

let settings = { ...PANORAMIC_POST_PROCESSING_ORIGINAL };
const listeners = new Set<(value: PanoramicPostProcessingSettings) => void>();

function percentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function getPanoramicPostProcessing(): PanoramicPostProcessingSettings {
  return { ...settings };
}

export function setPanoramicPostProcessing(
  next: Partial<PanoramicPostProcessingSettings>
): PanoramicPostProcessingSettings {
  settings = {
    enabled: next.enabled ?? settings.enabled,
    denoise: percentage(next.denoise ?? settings.denoise),
    contrast: percentage(next.contrast ?? settings.contrast),
    sharpen: percentage(next.sharpen ?? settings.sharpen),
  };
  const snapshot = getPanoramicPostProcessing();
  listeners.forEach(listener => listener(snapshot));
  return snapshot;
}

export function subscribePanoramicPostProcessing(
  listener: (value: PanoramicPostProcessingSettings) => void
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizePixels(pixels: ArrayLike<number>, min: number, max: number): Float32Array {
  const normalized = new Float32Array(pixels.length);
  const range = Math.max(1e-6, max - min);
  for (let index = 0; index < pixels.length; index++) {
    normalized[index] = clamp01((Number(pixels[index]) - min) / range);
  }
  return normalized;
}

/** Edge-preserving 5x5 bilateral denoise, the alternative recommended by the recipe. */
function bilateralDenoise(
  source: Float32Array,
  columns: number,
  rows: number,
  strength: number
): Float32Array {
  if (strength <= 0) {
    return source;
  }
  const filtered = new Float32Array(source.length);
  const sigmaSpatial = 2;
  const sigmaRange = 0.08;
  const spatialDenominator = 2 * sigmaSpatial * sigmaSpatial;
  const rangeDenominator = 2 * sigmaRange * sigmaRange;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const center = source[row * columns + column];
      let weighted = 0;
      let totalWeight = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const sampleRow = Math.max(0, Math.min(rows - 1, row + dy));
        for (let dx = -2; dx <= 2; dx++) {
          const sampleColumn = Math.max(0, Math.min(columns - 1, column + dx));
          const sample = source[sampleRow * columns + sampleColumn];
          const difference = sample - center;
          const weight = Math.exp(
            -(dx * dx + dy * dy) / spatialDenominator - (difference * difference) / rangeDenominator
          );
          weighted += sample * weight;
          totalWeight += weight;
        }
      }
      const value = totalWeight > 0 ? weighted / totalWeight : center;
      filtered[row * columns + column] = center + strength * (value - center);
    }
  }
  return filtered;
}

function clahe(
  source: Float32Array,
  columns: number,
  rows: number,
  strength: number
): Float32Array {
  if (strength <= 0) {
    return source;
  }
  const tilesX = Math.min(8, columns);
  const tilesY = Math.min(8, rows);
  const tileWidth = Math.ceil(columns / tilesX);
  const tileHeight = Math.ceil(rows / tilesY);
  const luts: Float32Array[] = new Array(tilesX * tilesY);
  // 25% maps to the recipe's clipLimit 1.5.
  const clipLimit = 1 + 2 * strength;

  for (let tileY = 0; tileY < tilesY; tileY++) {
    for (let tileX = 0; tileX < tilesX; tileX++) {
      const startX = tileX * tileWidth;
      const startY = tileY * tileHeight;
      const endX = Math.min(columns, startX + tileWidth);
      const endY = Math.min(rows, startY + tileHeight);
      const pixelCount = Math.max(1, (endX - startX) * (endY - startY));
      const histogram = new Uint32Array(256);
      for (let row = startY; row < endY; row++) {
        for (let column = startX; column < endX; column++) {
          histogram[Math.min(255, Math.floor(source[row * columns + column] * 256))] += 1;
        }
      }

      const maximumBin = Math.max(1, Math.floor((clipLimit * pixelCount) / 256));
      let excess = 0;
      for (let bin = 0; bin < 256; bin++) {
        if (histogram[bin] > maximumBin) {
          excess += histogram[bin] - maximumBin;
          histogram[bin] = maximumBin;
        }
      }
      const shared = Math.floor(excess / 256);
      const remainder = excess % 256;
      for (let bin = 0; bin < 256; bin++) {
        histogram[bin] += shared + (bin < remainder ? 1 : 0);
      }

      const lut = new Float32Array(256);
      let cumulative = 0;
      for (let bin = 0; bin < 256; bin++) {
        cumulative += histogram[bin];
        lut[bin] = cumulative / pixelCount;
      }
      luts[tileY * tilesX + tileX] = lut;
    }
  }

  const output = new Float32Array(source.length);
  // Interpolate adjacent tile LUTs to avoid visible 8x8 block boundaries.
  for (let row = 0; row < rows; row++) {
    const tilePositionY = row / tileHeight - 0.5;
    const y0 = Math.max(0, Math.min(tilesY - 1, Math.floor(tilePositionY)));
    const y1 = Math.min(tilesY - 1, y0 + 1);
    const fy = clamp01(tilePositionY - Math.floor(tilePositionY));
    for (let column = 0; column < columns; column++) {
      const tilePositionX = column / tileWidth - 0.5;
      const x0 = Math.max(0, Math.min(tilesX - 1, Math.floor(tilePositionX)));
      const x1 = Math.min(tilesX - 1, x0 + 1);
      const fx = clamp01(tilePositionX - Math.floor(tilePositionX));
      const bin = Math.min(255, Math.floor(source[row * columns + column] * 256));
      const top = luts[y0 * tilesX + x0][bin] * (1 - fx) + luts[y0 * tilesX + x1][bin] * fx;
      const bottom = luts[y1 * tilesX + x0][bin] * (1 - fx) + luts[y1 * tilesX + x1][bin] * fx;
      const enhanced = top * (1 - fy) + bottom * fy;
      const blend = Math.min(1, strength * 2);
      output[row * columns + column] = clamp01(
        source[row * columns + column] * (1 - blend) + enhanced * blend
      );
    }
  }
  return output;
}

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let index = -radius; index <= radius; index++) {
    const value = Math.exp(-(index * index) / (2 * sigma * sigma));
    kernel[index + radius] = value;
    sum += value;
  }
  for (let index = 0; index < kernel.length; index++) {
    kernel[index] /= sum;
  }
  return kernel;
}

function gaussianBlur(
  source: Float32Array,
  columns: number,
  rows: number,
  sigma: number
): Float32Array {
  const kernel = gaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let value = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const sampleColumn = Math.max(0, Math.min(columns - 1, column + offset));
        value += source[row * columns + sampleColumn] * kernel[offset + radius];
      }
      horizontal[row * columns + column] = value;
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let value = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const sampleRow = Math.max(0, Math.min(rows - 1, row + offset));
        value += horizontal[sampleRow * columns + column] * kernel[offset + radius];
      }
      output[row * columns + column] = value;
    }
  }
  return output;
}

function unsharpMask(
  source: Float32Array,
  columns: number,
  rows: number,
  strength: number
): Float32Array {
  if (strength <= 0) {
    return source;
  }
  const sigma = Math.min(1.2, 0.8 + (strength / 0.3) * 0.2);
  const amount = Math.min(0.5, (strength / 0.3) * 0.35);
  const blurred = gaussianBlur(source, columns, rows, sigma);
  const output = new Float32Array(source.length);
  for (let index = 0; index < source.length; index++) {
    output[index] = clamp01(source[index] + amount * (source[index] - blurred[index]));
  }
  return output;
}

export function applyPanoramicPostProcessing({
  pixels,
  columns,
  rows,
  min,
  max,
  settings: requestedSettings = getPanoramicPostProcessing(),
}: {
  pixels: ArrayLike<number>;
  columns: number;
  rows: number;
  min: number;
  max: number;
  settings?: PanoramicPostProcessingSettings;
}): Float32Array {
  if (!requestedSettings.enabled || !pixels.length || max <= min) {
    return pixels instanceof Float32Array ? pixels : Float32Array.from(pixels);
  }

  const denoiseStrength = percentage(requestedSettings.denoise) / 100;
  const contrastStrength = percentage(requestedSettings.contrast) / 100;
  const sharpenStrength = percentage(requestedSettings.sharpen) / 100;
  let processed = normalizePixels(pixels, min, max);
  processed = bilateralDenoise(processed, columns, rows, denoiseStrength);
  processed = clahe(processed, columns, rows, contrastStrength);
  processed = unsharpMask(processed, columns, rows, sharpenStrength);

  // The recipe's alpha=1.03 at Contrast 25%.
  const globalContrast = 1 + 0.12 * contrastStrength;
  const midpoint = 0.5;
  const range = max - min;
  const output = new Float32Array(processed.length);
  for (let index = 0; index < processed.length; index++) {
    const value = clamp01((processed[index] - midpoint) * globalContrast + midpoint);
    output[index] = min + value * range;
  }
  return output;
}
