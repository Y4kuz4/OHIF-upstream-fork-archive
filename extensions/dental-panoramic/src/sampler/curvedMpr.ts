import type { Point3 } from '../curve/types';
import { interpolateSpline, polylineLength, resampleByArcLength } from '../curve/geometry';

export type SampleAtWorld = (world: Point3) => number;

/** How samples along the radial slab are combined into one panoramic pixel. */
export type CurvedMprComposite = 'mean' | 'sum' | 'mip';

export const DEFAULT_HEIGHT_MM = 36;
/** Focal-trough thickness (buccal–lingual), similar to a dental panoramic layer. */
export const DEFAULT_THICKNESS_MM = 20;
const MAX_THICKNESS_SAMPLES = 61;

export type CurvedMprOptions = {
  controlPoints: Point3[];
  sampleAtWorld: SampleAtWorld;
  /** Sample spacing along the arch, mm. */
  spacing: number;
  /** Height of the reconstructed strip along `up`, mm. */
  heightMm?: number;
  /**
   * Slab thickness along the radial (buccal–lingual) axis, mm.
   * Several voxels are sampled and combined (`composite`).
   */
  thicknessMm?: number;
  composite?: CurvedMprComposite;
  up?: Point3;
};

export type CurvedMprResult = {
  pixels: Float32Array;
  columns: number;
  rows: number;
  columnSpacing: number;
  rowSpacing: number;
  thicknessMm: number;
  min: number;
  max: number;
};

function normalize(v: Point3): Point3 {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (n < 1e-12) {
    return [0, 0, 1];
  }
  return [v[0] / n, v[1] / n, v[2] / n];
}

function cross(a: Point3, b: Point3): Point3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function thicknessSampleCount(thicknessMm: number, spacing: number): number {
  if (thicknessMm <= 0) {
    return 1;
  }
  const raw = Math.round(thicknessMm / Math.max(spacing, 1e-6)) + 1;
  const clamped = Math.max(3, Math.min(MAX_THICKNESS_SAMPLES, raw));
  return clamped % 2 === 0 ? clamped + 1 : clamped;
}

function combineSlab(values: number[], composite: CurvedMprComposite): number {
  if (values.length === 0) {
    return 0;
  }
  if (composite === 'mip') {
    let m = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] > m) {
        m = values[i];
      }
    }
    return m;
  }
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc += values[i];
  }
  return composite === 'sum' ? acc : acc / values.length;
}

/**
 * CPU curved MPR: columns follow the arch, rows follow `up` (default world Z).
 * Each pixel is a thick slab along the radial (buccal–lingual) axis so the
 * result behaves like a panoramic layer rather than a one-voxel cut.
 */
export function sampleCurvedMpr(options: CurvedMprOptions): CurvedMprResult {
  const { controlPoints, sampleAtWorld, spacing } = options;
  const heightMm = options.heightMm ?? DEFAULT_HEIGHT_MM;
  const thicknessMm = options.thicknessMm ?? DEFAULT_THICKNESS_MM;
  const composite = options.composite ?? 'mean';
  const up = normalize(options.up ?? [0, 0, 1]);

  if (controlPoints.length < 2 || spacing <= 0) {
    return {
      pixels: new Float32Array(0),
      columns: 0,
      rows: 0,
      columnSpacing: spacing,
      rowSpacing: spacing,
      thicknessMm,
      min: 0,
      max: 0,
    };
  }

  const spline = interpolateSpline(controlPoints);
  const samples = resampleByArcLength(spline, spacing);
  const columns = samples.length;
  const halfH = heightMm / 2;
  const rows = Math.max(2, Math.round(heightMm / spacing) + 1);
  const rowSpacing = heightMm / (rows - 1);
  const nT = thicknessSampleCount(thicknessMm, spacing);
  const halfT = thicknessMm / 2;
  const tStep = nT === 1 ? 0 : thicknessMm / (nT - 1);
  const pixels = new Float32Array(rows * columns);
  const slab = new Array<number>(nT);

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let c = 0; c < columns; c++) {
    const p = samples[c];
    const prev = samples[Math.max(0, c - 1)];
    const next = samples[Math.min(columns - 1, c + 1)];
    let T: Point3 = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    T = normalize(T);
    // Radial = buccal–lingual; rows stay roughly world-up.
    const radial = normalize(cross(T, up));
    let U = normalize(cross(radial, T));
    if (U[0] * up[0] + U[1] * up[1] + U[2] * up[2] < 0) {
      U = [-U[0], -U[1], -U[2]];
    }

    for (let r = 0; r < rows; r++) {
      // Row 0 is superior (+up / maxilla) so the stack looks like a real PX, not upside-down.
      const h = halfH - r * rowSpacing;
      const cx = p[0] + h * U[0];
      const cy = p[1] + h * U[1];
      const cz = p[2] + h * U[2];
      for (let k = 0; k < nT; k++) {
        const s = nT === 1 ? 0 : -halfT + k * tStep;
        const world: Point3 = [cx + s * radial[0], cy + s * radial[1], cz + s * radial[2]];
        const value = sampleAtWorld(world);
        slab[k] = Number.isFinite(value) ? value : 0;
      }
      const finite = combineSlab(slab, composite);
      pixels[r * columns + c] = finite;
      if (finite < min) {
        min = finite;
      }
      if (finite > max) {
        max = finite;
      }
    }
  }

  if (!Number.isFinite(min)) {
    min = 0;
    max = 0;
  }

  return {
    pixels,
    columns,
    rows,
    columnSpacing: spacing,
    rowSpacing,
    thicknessMm,
    min,
    max,
  };
}

export function estimateArcSpacing(controlPoints: Point3[], fallback = 0.5): number {
  const spline = interpolateSpline(controlPoints);
  const length = polylineLength(spline);
  if (length <= 0) {
    return fallback;
  }
  return fallback;
}
