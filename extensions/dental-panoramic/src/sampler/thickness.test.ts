import { DEFAULT_THICKNESS_MM } from './curvedMpr';
import {
  clampThicknessMm,
  getPanoramicThicknessMm,
  MAX_THICKNESS_MM,
  MIN_THICKNESS_MM,
  setPanoramicThicknessMm,
} from './thickness';

describe('panoramic thickness', () => {
  afterEach(() => {
    setPanoramicThicknessMm(DEFAULT_THICKNESS_MM);
  });

  it('clamps to the 1–40 mm trough range', () => {
    expect(clampThicknessMm(0)).toBe(MIN_THICKNESS_MM);
    expect(clampThicknessMm(99)).toBe(MAX_THICKNESS_MM);
    expect(clampThicknessMm(12.4)).toBe(12);
    expect(clampThicknessMm(Number.NaN)).toBe(DEFAULT_THICKNESS_MM);
  });

  it('stores the selected thickness for the next reconstruct', () => {
    expect(getPanoramicThicknessMm()).toBe(DEFAULT_THICKNESS_MM);
    expect(setPanoramicThicknessMm(8)).toBe(8);
    expect(getPanoramicThicknessMm()).toBe(8);
  });
});
