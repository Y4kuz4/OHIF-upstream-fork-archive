import {
  applyPanoramicPostProcessing,
  PANORAMIC_POST_PROCESSING_ORIGINAL,
  PANORAMIC_POST_PROCESSING_SOFT,
  setPanoramicPostProcessing,
} from './postProcessing';

describe('panoramic post-processing', () => {
  it('keeps the original pixels unchanged when disabled', () => {
    const pixels = new Float32Array([0, 10, 20, 30]);
    const result = applyPanoramicPostProcessing({
      pixels,
      columns: 2,
      rows: 2,
      min: 0,
      max: 30,
      settings: PANORAMIC_POST_PROCESSING_ORIGINAL,
    });
    expect(Array.from(result)).toEqual(Array.from(pixels));
  });

  it('returns finite values within the original display range', () => {
    const pixels = new Float32Array(64);
    for (let index = 0; index < pixels.length; index++) {
      pixels[index] = index * 10 - 300;
    }
    const result = applyPanoramicPostProcessing({
      pixels,
      columns: 8,
      rows: 8,
      min: -300,
      max: 330,
      settings: PANORAMIC_POST_PROCESSING_SOFT,
    });
    expect(result).toHaveLength(pixels.length);
    expect(Array.from(result).every(Number.isFinite)).toBe(true);
    expect(Math.min(...result)).toBeGreaterThanOrEqual(-300);
    expect(Math.max(...result)).toBeLessThanOrEqual(330);
    expect(Array.from(result)).not.toEqual(Array.from(pixels));
  });

  it('clamps UI percentages', () => {
    expect(setPanoramicPostProcessing({ denoise: -1, contrast: 121, sharpen: 30.4 })).toMatchObject(
      {
        denoise: 0,
        contrast: 100,
        sharpen: 30,
      }
    );
  });
});
