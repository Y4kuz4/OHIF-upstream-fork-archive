export async function updatePanoramicViewportImage(viewport, imageId: string): Promise<boolean> {
  if (!viewport || !imageId) {
    return false;
  }

  if (typeof viewport.setStack === 'function') {
    await viewport.setStack([imageId], 0);
  } else if (typeof viewport.setImageIds === 'function') {
    await viewport.setImageIds([imageId]);
  } else {
    return false;
  }

  viewport.render?.();
  return true;
}
