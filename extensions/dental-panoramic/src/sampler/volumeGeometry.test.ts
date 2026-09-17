import { getVolumeProjectionRange } from './volumeGeometry';

describe('volume projection range', () => {
  it('covers every slice center using imageData geometry', () => {
    const volume = {
      dimensions: [3, 4, 6],
      imageData: {
        indexToWorld: ([i, j, k]) => [10 + i * 0.5, 20 + j, -30 + k * 2],
      },
    };

    expect(getVolumeProjectionRange(volume)).toEqual({ min: -30, max: -20 });
  });

  it('respects an oriented volume when projecting its full extent', () => {
    const volume = {
      dimensions: [2, 2, 3],
      origin: [0, 0, 5],
      spacing: [1, 1, 4],
      direction: [1, 0, 0, 0, 0, 1, 0, -1, 0],
    };

    expect(getVolumeProjectionRange(volume, [0, 1, 0])).toEqual({ min: -8, max: 0 });
  });
});
