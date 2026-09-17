import {
  applyPanoramicSharpen,
  clampPanoramicSharpness,
  DEFAULT_SHARPNESS,
  getPanoramicSharpness,
  setPanoramicSharpness,
} from './sharpness';

describe('panoramic sharpness', () => {
  beforeEach(() => setPanoramicSharpness(DEFAULT_SHARPNESS));

  it('clamps the control to 0-100 percent', () => {
    expect(clampPanoramicSharpness(-1)).toBe(0);
    expect(clampPanoramicSharpness(120)).toBe(100);
    expect(clampPanoramicSharpness(32.6)).toBe(33);
    expect(clampPanoramicSharpness(Number.NaN)).toBe(DEFAULT_SHARPNESS);
  });

  it('stores the selected strength', () => {
    expect(setPanoramicSharpness(45)).toBe(45);
    expect(getPanoramicSharpness()).toBe(45);
  });

  it('is a zero-copy no-op at zero strength', () => {
    const pixels = new Float32Array(9);
    expect(applyPanoramicSharpen(pixels, 3, 3, 0)).toBe(pixels);
  });

  it('increases local edge contrast without changing border pixels', () => {
    const pixels = new Float32Array([0, 0, 0, 0, 10, 0, 0, 0, 0]);
    const sharpened = applyPanoramicSharpen(pixels, 3, 3, 50);

    expect(sharpened[4]).toBeGreaterThan(pixels[4]);
    expect(sharpened[0]).toBe(pixels[0]);
  });
});
