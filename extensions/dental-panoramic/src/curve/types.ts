export type Point2 = [number, number];
export type Point3 = [number, number, number];

export type CurveMode = 'draw' | 'edit';

export type CurveModifiers = {
  ctrl: boolean;
  shift: boolean;
  secondary: boolean;
};

export type CurveClickAction =
  | { type: 'add'; index: number }
  | { type: 'insert'; index: number }
  | { type: 'delete'; index: number }
  | { type: 'moveHandle'; index: number }
  | { type: 'moveCurve' }
  | { type: 'finish' }
  | { type: 'ignore'; reason?: string };
