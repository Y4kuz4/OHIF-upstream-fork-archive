import type { Point3 } from '../curve/types';

function normalize(vector: Point3): Point3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < 1e-12) {
    return [0, 0, 1];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function indexToWorld(volume, index: Point3): Point3 | null {
  const fromImageData = volume?.imageData?.indexToWorld?.(index);
  if (fromImageData?.length >= 3) {
    return [fromImageData[0], fromImageData[1], fromImageData[2]];
  }

  const origin = volume?.origin;
  const direction = volume?.direction;
  const spacing = volume?.spacing;
  if (!origin || !direction || !spacing) {
    return null;
  }

  const [i, j, k] = index;
  return [
    origin[0] +
      i * spacing[0] * direction[0] +
      j * spacing[1] * direction[3] +
      k * spacing[2] * direction[6],
    origin[1] +
      i * spacing[0] * direction[1] +
      j * spacing[1] * direction[4] +
      k * spacing[2] * direction[7],
    origin[2] +
      i * spacing[0] * direction[2] +
      j * spacing[1] * direction[5] +
      k * spacing[2] * direction[8],
  ];
}

/** Returns the complete voxel-center extent projected onto the requested world axis. */
export function getVolumeProjectionRange(
  volume,
  axis: Point3 = [0, 0, 1]
): { min: number; max: number } | undefined {
  const dimensions = volume?.dimensions ?? volume?.imageData?.getDimensions?.();
  if (!dimensions?.length || dimensions.some(value => !Number.isFinite(value) || value < 1)) {
    return;
  }

  const normalizedAxis = normalize(axis);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const i of [0, dimensions[0] - 1]) {
    for (const j of [0, dimensions[1] - 1]) {
      for (const k of [0, dimensions[2] - 1]) {
        const world = indexToWorld(volume, [i, j, k]);
        if (!world) {
          return;
        }
        const projection =
          world[0] * normalizedAxis[0] +
          world[1] * normalizedAxis[1] +
          world[2] * normalizedAxis[2];
        min = Math.min(min, projection);
        max = Math.max(max, projection);
      }
    }
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : undefined;
}
