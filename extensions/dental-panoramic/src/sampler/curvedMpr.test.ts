import { sampleCurvedMpr } from './curvedMpr';
import type { Point3 } from '../curve/types';

const straightArch = {
  controlPoints: [
    [0, 0, 0],
    [10, 0, 0],
  ] as Point3[],
  spacing: 1,
  heightMm: 4,
  up: [0, 0, 1] as Point3,
};

describe('sampleCurvedMpr', () => {
  it('returns empty output for a single control point', () => {
    const result = sampleCurvedMpr({
      controlPoints: [[0, 0, 0]],
      sampleAtWorld: () => 1,
      spacing: 1,
    });
    expect(result.columns).toBe(0);
    expect(result.pixels.length).toBe(0);
  });

  it('samples a synthetic x-ramp along a straight arch', () => {
    const sampleAtWorld = ([x]: Point3) => x;
    const result = sampleCurvedMpr({
      ...straightArch,
      sampleAtWorld,
      thicknessMm: 0,
    });

    expect(result.columns).toBeGreaterThan(5);
    expect(result.rows).toBeGreaterThan(2);
    expect(result.pixels.length).toBe(result.columns * result.rows);
    // First column ~ x=0, last column ~ x=10. Rows share x for a straight X arch.
    expect(result.pixels[0]).toBeCloseTo(0, 0);
    const lastCol = result.columns - 1;
    expect(result.pixels[lastCol]).toBeCloseTo(10, 0);
    const midRow = Math.floor(result.rows / 2);
    expect(result.pixels[midRow * result.columns + lastCol]).toBeCloseTo(10, 0);
  });

  it('varies rows when the sampler depends on Z (up axis)', () => {
    const sampleAtWorld = ([, , z]: Point3) => z;
    const result = sampleCurvedMpr({
      controlPoints: [
        [0, 0, 0],
        [8, 0, 0],
      ],
      sampleAtWorld,
      spacing: 1,
      heightMm: 10,
      thicknessMm: 0,
      up: [0, 0, 1],
    });

    const firstRow = result.pixels[0];
    const lastRow = result.pixels[(result.rows - 1) * result.columns];
    // Row 0 is superior (+Z / maxilla); last row is inferior.
    expect(firstRow).toBeGreaterThan(lastRow);
    expect(result.max - result.min).toBeGreaterThan(5);
    expect(firstRow).toBeCloseTo(5, 0);
    expect(lastRow).toBeCloseTo(-5, 0);
  });

  it('thin slab misses an off-curve peak that a thick slab includes', () => {
    // Straight X arch → radial is ±Y. Peak sits 2 mm off the curve.
    const sampleAtWorld = ([, y]: Point3) => (Math.abs(y - 2) < 0.4 ? 100 : 0);
    const thin = sampleCurvedMpr({
      ...straightArch,
      sampleAtWorld,
      thicknessMm: 0,
    });
    const thick = sampleCurvedMpr({
      ...straightArch,
      sampleAtWorld,
      thicknessMm: 8,
      composite: 'mean',
    });
    expect(thin.max).toBe(0);
    expect(thick.max).toBeGreaterThan(0);
  });

  it('mean of a radial ramp is the midpoint; mip is the peak; sum scales with samples', () => {
    const sampleAtWorld = ([, y]: Point3) => 10 + y;
    const mean = sampleCurvedMpr({
      ...straightArch,
      sampleAtWorld,
      thicknessMm: 8,
      composite: 'mean',
    });
    const mip = sampleCurvedMpr({
      ...straightArch,
      sampleAtWorld,
      thicknessMm: 8,
      composite: 'mip',
    });
    const sum = sampleCurvedMpr({
      ...straightArch,
      sampleAtWorld,
      thicknessMm: 8,
      composite: 'sum',
    });
    const mid = mean.pixels[Math.floor(mean.rows / 2) * mean.columns];
    expect(mid).toBeCloseTo(10, 1);
    expect(mip.max).toBeGreaterThan(mean.max);
    expect(sum.max).toBeGreaterThan(mean.max);
  });
});
