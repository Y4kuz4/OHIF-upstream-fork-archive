import { updatePanoramicViewportImage } from './updatePanoramicViewport';

describe('updatePanoramicViewportImage', () => {
  it('awaits StackViewport.setStack before rendering the new reconstruction', async () => {
    const calls: string[] = [];
    const viewport = {
      setStack: jest.fn(async imageIds => {
        calls.push(`stack:${imageIds[0]}`);
      }),
      render: jest.fn(() => calls.push('render')),
    };

    await expect(updatePanoramicViewportImage(viewport, 'local://panoramic-2')).resolves.toBe(true);

    expect(viewport.setStack).toHaveBeenCalledWith(['local://panoramic-2'], 0);
    expect(calls).toEqual(['stack:local://panoramic-2', 'render']);
  });

  it('does not claim an update when the viewport has no stack replacement API', async () => {
    const viewport = { render: jest.fn() };

    await expect(updatePanoramicViewportImage(viewport, 'local://panoramic-2')).resolves.toBe(
      false
    );
    expect(viewport.render).not.toHaveBeenCalled();
  });
});
