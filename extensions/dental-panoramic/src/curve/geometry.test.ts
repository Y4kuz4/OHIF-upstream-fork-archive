import {
  DEFAULT_PROXIMITY_PX,
  deletePoint,
  hitTestHandle,
  hitTestSegment,
  insertPoint,
  interpolateSpline,
  polylineLength,
  resampleByArcLength,
  resolveCurveClick,
  translatePoints,
} from './geometry';

describe('curve geometry', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it('hits a control point within proximity', () => {
    expect(hitTestHandle(square, [1, 1], 3)).toBe(0);
    expect(hitTestHandle(square, [10, 0], DEFAULT_PROXIMITY_PX)).toBe(1);
    expect(hitTestHandle(square, [50, 50], DEFAULT_PROXIMITY_PX)).toBe(-1);
  });

  it('inserts a point on a segment', () => {
    const hit = hitTestSegment(square, [5, 0], 3);
    expect(hit).toEqual({ insertIndex: 1, t: expect.any(Number) });
    const pts: [number, number, number][] = [
      [0, 0, 0],
      [10, 0, 0],
    ];
    const inserted = insertPoint(pts, hit.insertIndex, [5, 0, 0]);
    expect(inserted).toHaveLength(3);
    expect(inserted[1]).toEqual([5, 0, 0]);
  });

  it('deletes a control point', () => {
    expect(deletePoint([[0, 0, 0], [1, 0, 0], [2, 0, 0]], 1)).toEqual([
      [0, 0, 0],
      [2, 0, 0],
    ]);
  });

  it('translates the whole curve', () => {
    expect(translatePoints([[0, 0, 0], [1, 0, 0]], [0, 2, 0])).toEqual([
      [0, 2, 0],
      [1, 2, 0],
    ]);
  });

  it('RMB finishes only with at least two points', () => {
    expect(
      resolveCurveClick({
        mode: 'draw',
        canvasPoints: [[0, 0]],
        clickCanvas: [1, 1],
        modifiers: { ctrl: false, shift: false, secondary: true },
      })
    ).toEqual({ type: 'ignore', reason: 'need-two-points' });

    expect(
      resolveCurveClick({
        mode: 'draw',
        canvasPoints: [
          [0, 0],
          [10, 0],
        ],
        clickCanvas: [1, 1],
        modifiers: { ctrl: false, shift: false, secondary: true },
      })
    ).toEqual({ type: 'finish' });
  });

  it('LMB adds a point in draw mode', () => {
    expect(
      resolveCurveClick({
        mode: 'draw',
        canvasPoints: [[0, 0]],
        clickCanvas: [40, 0],
        modifiers: { ctrl: false, shift: false, secondary: false },
      })
    ).toEqual({ type: 'add', index: 1 });
  });

  it('Ctrl+click deletes a handle', () => {
    expect(
      resolveCurveClick({
        mode: 'draw',
        canvasPoints: square,
        clickCanvas: [10, 0],
        modifiers: { ctrl: true, shift: false, secondary: false },
      })
    ).toEqual({ type: 'delete', index: 1 });
  });

  it('edit mode drags the whole curve when hitting the line', () => {
    expect(
      resolveCurveClick({
        mode: 'edit',
        canvasPoints: [
          [0, 0],
          [20, 0],
        ],
        clickCanvas: [10, 0],
        modifiers: { ctrl: false, shift: false, secondary: false },
      })
    ).toEqual({ type: 'moveCurve' });
  });

  it('resamples a polyline by approximately equal arc length', () => {
    const line: [number, number, number][] = [
      [0, 0, 0],
      [10, 0, 0],
    ];
    const samples = resampleByArcLength(line, 1);
    expect(samples.length).toBeGreaterThanOrEqual(11);
    expect(samples[0]).toEqual([0, 0, 0]);
    expect(samples[samples.length - 1][0]).toBeCloseTo(10, 5);
    const d0 = Math.hypot(
      samples[1][0] - samples[0][0],
      samples[1][1] - samples[0][1],
      samples[1][2] - samples[0][2]
    );
    const d1 = Math.hypot(
      samples[2][0] - samples[1][0],
      samples[2][1] - samples[1][1],
      samples[2][2] - samples[1][2]
    );
    expect(d0).toBeCloseTo(d1, 5);
  });

  it('spline through three points is longer than the chord', () => {
    const pts: [number, number, number][] = [
      [0, 0, 0],
      [5, 4, 0],
      [10, 0, 0],
    ];
    const spline = interpolateSpline(pts);
    expect(polylineLength(spline)).toBeGreaterThan(10);
  });
});
