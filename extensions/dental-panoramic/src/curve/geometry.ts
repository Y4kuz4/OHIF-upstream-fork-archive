import type { CurveClickAction, CurveMode, CurveModifiers, Point2, Point3 } from './types';

export const MIN_POINTS_TO_FINISH = 2;
export const DEFAULT_PROXIMITY_PX = 8;

export function distance2(a: Point2, b: Point2): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function distance3(a: Point3, b: Point3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function hitTestHandle(
  canvasPoints: Point2[],
  click: Point2,
  proximity = DEFAULT_PROXIMITY_PX
): number {
  let best = -1;
  let bestDist = proximity;
  for (let i = 0; i < canvasPoints.length; i++) {
    const d = distance2(canvasPoints[i], click);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Closest point on segment ab to p; returns { t in [0,1], dist, point }. */
export function closestOnSegment(
  a: Point2,
  b: Point2,
  p: Point2
): { t: number; dist: number; point: Point2 } {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) {
    return { t: 0, dist: distance2(a, p), point: [a[0], a[1]] };
  }
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const point: Point2 = [a[0] + t * abx, a[1] + t * aby];
  return { t, dist: distance2(point, p), point };
}

export function hitTestSegment(
  canvasPoints: Point2[],
  click: Point2,
  proximity = DEFAULT_PROXIMITY_PX
): { insertIndex: number; t: number } | null {
  if (canvasPoints.length < 2) {
    return null;
  }
  let best: { insertIndex: number; t: number; dist: number } | null = null;
  for (let i = 0; i < canvasPoints.length - 1; i++) {
    const hit = closestOnSegment(canvasPoints[i], canvasPoints[i + 1], click);
    if (hit.dist <= proximity && (best === null || hit.dist < best.dist)) {
      best = { insertIndex: i + 1, t: hit.t, dist: hit.dist };
    }
  }
  return best ? { insertIndex: best.insertIndex, t: best.t } : null;
}

export function isBeyondEnd(
  canvasPoints: Point2[],
  click: Point2,
  proximity = DEFAULT_PROXIMITY_PX
): 'start' | 'end' | null {
  if (canvasPoints.length < 1) {
    return null;
  }
  const start = canvasPoints[0];
  const end = canvasPoints[canvasPoints.length - 1];
  const dStart = distance2(start, click);
  const dEnd = distance2(end, click);
  if (canvasPoints.length === 1) {
    return dStart <= proximity ? 'start' : null;
  }
  const firstSeg = canvasPoints[1];
  const lastSeg = canvasPoints[canvasPoints.length - 2];
  const startDir: Point2 = [start[0] - firstSeg[0], start[1] - firstSeg[1]];
  const endDir: Point2 = [end[0] - lastSeg[0], end[1] - lastSeg[1]];
  const toClickStart: Point2 = [click[0] - start[0], click[1] - start[1]];
  const toClickEnd: Point2 = [click[0] - end[0], click[1] - end[1]];
  const startAhead = startDir[0] * toClickStart[0] + startDir[1] * toClickStart[1] > 0;
  const endAhead = endDir[0] * toClickEnd[0] + endDir[1] * toClickEnd[1] > 0;
  if (endAhead && dEnd < dStart) {
    return 'end';
  }
  if (startAhead) {
    return 'start';
  }
  return null;
}

export function insertPoint(points: Point3[], index: number, point: Point3): Point3[] {
  return [...points.slice(0, index), point, ...points.slice(index)];
}

export function deletePoint(points: Point3[], index: number): Point3[] {
  if (index < 0 || index >= points.length) {
    return points;
  }
  return [...points.slice(0, index), ...points.slice(index + 1)];
}

export function translatePoints(points: Point3[], delta: Point3): Point3[] {
  return points.map(p => [p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]] as Point3);
}

/**
 * Romexis-style click: LMB add/insert, Ctrl delete/add, RMB finish.
 * Shift is handled as a drag (moveHandle) by the caller, not here.
 */
export function resolveCurveClick(options: {
  mode: CurveMode;
  canvasPoints: Point2[];
  clickCanvas: Point2;
  modifiers: CurveModifiers;
  proximity?: number;
}): CurveClickAction {
  const { mode, canvasPoints, clickCanvas, modifiers } = options;
  const proximity = options.proximity ?? DEFAULT_PROXIMITY_PX;

  if (modifiers.secondary) {
    if (canvasPoints.length < MIN_POINTS_TO_FINISH) {
      return { type: 'ignore', reason: 'need-two-points' };
    }
    return { type: 'finish' };
  }

  const handle = hitTestHandle(canvasPoints, clickCanvas, proximity);

  if (modifiers.ctrl) {
    if (handle >= 0) {
      return { type: 'delete', index: handle };
    }
    const seg = hitTestSegment(canvasPoints, clickCanvas, proximity);
    if (seg) {
      return { type: 'insert', index: seg.insertIndex };
    }
    if (mode === 'edit' && canvasPoints.length > 0) {
      const beyond = isBeyondEnd(canvasPoints, clickCanvas, proximity * 4);
      if (beyond === 'start') {
        return { type: 'insert', index: 0 };
      }
      if (beyond === 'end') {
        return { type: 'insert', index: canvasPoints.length };
      }
    }
    return { type: 'ignore' };
  }

  if (modifiers.shift && handle >= 0) {
    return { type: 'moveHandle', index: handle };
  }

  if (mode === 'edit') {
    if (handle >= 0) {
      return { type: 'moveHandle', index: handle };
    }
    const seg = hitTestSegment(canvasPoints, clickCanvas, proximity);
    if (seg) {
      return { type: 'moveCurve' };
    }
    return { type: 'ignore' };
  }

  // draw mode
  if (handle >= 0) {
    return { type: 'ignore' };
  }
  const seg = hitTestSegment(canvasPoints, clickCanvas, proximity);
  if (seg) {
    return { type: 'insert', index: seg.insertIndex };
  }
  return { type: 'add', index: canvasPoints.length };
}

function catmullRom(p0: Point3, p1: Point3, p2: Point3, p3: Point3, t: number): Point3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const out: Point3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] =
      0.5 *
      (2 * p1[i] +
        (-p0[i] + p2[i]) * t +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  }
  return out;
}

/** Open Catmull-Rom through control points (duplicates ends). */
export function interpolateSpline(points: Point3[], samplesPerSegment = 16): Point3[] {
  if (points.length === 0) {
    return [];
  }
  if (points.length === 1) {
    return [[...points[0]]];
  }
  if (points.length === 2) {
    const out: Point3[] = [];
    for (let i = 0; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment;
      out.push([
        points[0][0] + t * (points[1][0] - points[0][0]),
        points[0][1] + t * (points[1][1] - points[0][1]),
        points[0][2] + t * (points[1][2] - points[0][2]),
      ]);
    }
    return out;
  }

  const out: Point3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const last = i === points.length - 2;
    const count = last ? samplesPerSegment : samplesPerSegment;
    for (let s = 0; s < count; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / samplesPerSegment));
    }
    if (last) {
      out.push([...p2]);
    }
  }
  return out;
}

export function resampleByArcLength(points: Point3[], ds: number): Point3[] {
  if (points.length === 0) {
    return [];
  }
  if (points.length === 1 || ds <= 0) {
    return points.map(p => [...p] as Point3);
  }

  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + distance3(points[i - 1], points[i]));
  }
  const total = lengths[lengths.length - 1];
  if (total < 1e-6) {
    return [[...points[0]]];
  }

  const n = Math.max(2, Math.round(total / ds) + 1);
  const out: Point3[] = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * total;
    while (seg < lengths.length - 2 && lengths[seg + 1] < s) {
      seg++;
    }
    const s0 = lengths[seg];
    const s1 = lengths[seg + 1];
    const t = s1 - s0 < 1e-12 ? 0 : (s - s0) / (s1 - s0);
    const a = points[seg];
    const b = points[seg + 1];
    out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
  }
  return out;
}

/**
 * Builds the two world-space limits of the panoramic focal trough. The radial
 * direction matches the curved-MPR sampler: tangent crossed with world-up.
 */
export function createThicknessEnvelope(
  points: Point3[],
  thicknessMm: number,
  up: Point3 = [0, 0, 1]
): { negative: Point3[]; positive: Point3[] } {
  if (!points.length) {
    return { negative: [], positive: [] };
  }

  const halfThickness = Math.max(0, thicknessMm) / 2;
  const negative: Point3[] = [];
  const positive: Point3[] = [];
  let previousRadial: Point3 | null = null;

  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent: Point3 = [next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]];
    const cross: Point3 = [
      tangent[1] * up[2] - tangent[2] * up[1],
      tangent[2] * up[0] - tangent[0] * up[2],
      tangent[0] * up[1] - tangent[1] * up[0],
    ];
    const length = Math.hypot(cross[0], cross[1], cross[2]);
    let radial: Point3 =
      length > 1e-6
        ? [cross[0] / length, cross[1] / length, cross[2] / length]
        : (previousRadial ?? [1, 0, 0]);

    if (
      previousRadial &&
      radial[0] * previousRadial[0] +
        radial[1] * previousRadial[1] +
        radial[2] * previousRadial[2] <
        0
    ) {
      radial = [-radial[0], -radial[1], -radial[2]];
    }
    previousRadial = radial;

    positive.push([
      points[i][0] + radial[0] * halfThickness,
      points[i][1] + radial[1] * halfThickness,
      points[i][2] + radial[2] * halfThickness,
    ]);
    negative.push([
      points[i][0] - radial[0] * halfThickness,
      points[i][1] - radial[1] * halfThickness,
      points[i][2] - radial[2] * halfThickness,
    ]);
  }

  return { negative, positive };
}

export function polylineLength(points: Point3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance3(points[i - 1], points[i]);
  }
  return total;
}
