import { cache, Enums, imageLoader, volumeLoader } from '@cornerstonejs/core';
import { utilities as csUtils } from '@cornerstonejs/core';
import { classes } from '@ohif/core';
import type { Point3 } from '../curve/types';
import { sampleCurvedMpr } from './curvedMpr';
import { getPanoramicThicknessMm } from './thickness';
import { getVolumeProjectionRange } from './volumeGeometry';

const { ImageSet } = classes;
const { VoxelManager, genericMetadataProvider } = csUtils;
const { MetadataModules } = Enums;

export const PANORAMIC_DISPLAY_SET_UID = 'dental-panoramic-derived';
export const PANORAMIC_IMAGE_ID = 'local://dental-panoramic';
const VOLUME_LOADER_SCHEME = 'cornerstoneStreamingImageVolume';

let panoramicGeneration = 0;

function minSpacing(volume): number {
  const spacing = volume?.spacing ?? [1, 1, 1];
  return Math.max(0.2, Math.min(spacing[0] || 1, spacing[1] || 1, spacing[2] || 1));
}

function waitForVolumeLoaded(volume): Promise<void> {
  if (!volume) {
    return Promise.resolve();
  }
  if (volume.loadStatus?.loaded) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const done = () => resolve();
    if (volume.loadStatus?.loading && Array.isArray(volume.loadStatus.callbacks)) {
      volume.loadStatus.callbacks.push(done);
      return;
    }
    if (typeof volume.load === 'function') {
      volume.load(done);
      return;
    }
    resolve();
  });
}

export async function getOrCreateVolume(displaySet, dataSource) {
  if (!displaySet) {
    return null;
  }
  const volumeId = `${displaySet.volumeLoaderSchema ?? VOLUME_LOADER_SCHEME}:${displaySet.displaySetInstanceUID}`;
  let volume = cache.getVolume(volumeId);
  if (!volume) {
    const imageIds = displaySet.imageIds?.length
      ? displaySet.imageIds
      : dataSource.getImageIdsForDisplaySet(displaySet);
    volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
  }
  await waitForVolumeLoaded(volume);
  if (!volume.voxelManager) {
    throw new Error(
      'El volumen CT todavía no está cargado; espera a que termine y vuelve a terminar la curva.'
    );
  }
  return volume;
}

function sampleAtWorldFromVolume(volume) {
  return (world: Point3) => {
    const value = VoxelManager.sampleAtWorld(volume, world, Enums.InterpolationType.LINEAR);
    return Number.isFinite(value) ? value : 0;
  };
}

export function upsertPanoramicDisplaySet({
  displaySetService,
  sourceDisplaySet,
  imageId,
  columns,
  rows,
}) {
  const existing = displaySetService.getDisplaySetByUID?.(PANORAMIC_DISPLAY_SET_UID);
  const instance = {
    SOPInstanceUID: 'dental-panoramic-sop',
    SeriesInstanceUID: 'dental-panoramic-series',
    StudyInstanceUID: sourceDisplaySet.StudyInstanceUID,
    SOPClassUID: sourceDisplaySet.SOPClassUID,
    Modality: 'OT',
    Rows: rows,
    Columns: columns,
    imageId,
  };

  if (existing) {
    existing.imageIds = [imageId];
    existing.images[0] = instance;
    existing.instances = existing.images;
    existing.numImageFrames = 1;
    existing.SeriesDescription = 'Panorámica';
    existing.label = 'Panorámica';
    return existing;
  }

  const imageSet = new ImageSet([instance]);
  imageSet.setAttributes({
    displaySetInstanceUID: PANORAMIC_DISPLAY_SET_UID,
    SOPClassHandlerId: '@ohif/extension-default.sopClassHandlerModule.stack',
    SeriesInstanceUID: 'dental-panoramic-series',
    StudyInstanceUID: sourceDisplaySet.StudyInstanceUID,
    SeriesDescription: 'Panorámica',
    Modality: 'OT',
    isReconstructable: false,
    numImageFrames: 1,
    imageIds: [imageId],
    madeInClient: true,
    supportsWindowLevel: true,
    label: 'Panorámica',
  });
  // ImageSet.uid is random; force a stable id so we can replace the pan.
  Object.defineProperty(imageSet, 'displaySetInstanceUID', {
    value: PANORAMIC_DISPLAY_SET_UID,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  imageSet.displaySetInstanceUID = PANORAMIC_DISPLAY_SET_UID;
  displaySetService.addDisplaySets(imageSet);
  return imageSet;
}

export async function reconstructPanoramic({
  controlPoints,
  displaySet,
  dataSource,
  displaySetService,
  heightMm,
  thicknessMm = getPanoramicThicknessMm(),
}: {
  controlPoints: Point3[];
  displaySet;
  dataSource;
  displaySetService;
  heightMm?: number;
  thicknessMm?: number;
}) {
  const volume = await getOrCreateVolume(displaySet, dataSource);
  if (!volume) {
    throw new Error('No hay volumen para reconstruir la panorámica');
  }

  const spacing = minSpacing(volume);
  const up: Point3 = [0, 0, 1];
  const verticalRange = heightMm == null ? getVolumeProjectionRange(volume, up) : undefined;
  const result = sampleCurvedMpr({
    controlPoints,
    sampleAtWorld: sampleAtWorldFromVolume(volume),
    spacing,
    heightMm,
    verticalRange,
    thicknessMm,
    composite: 'mean',
    up,
  });

  if (!result.columns || !result.rows) {
    throw new Error('La curva no tiene longitud suficiente');
  }

  panoramicGeneration += 1;
  const imageId = `${PANORAMIC_IMAGE_ID}-${panoramicGeneration}`;
  const previousId = `${PANORAMIC_IMAGE_ID}-${panoramicGeneration - 1}`;
  if (panoramicGeneration > 1 && cache.getImage(previousId)) {
    cache.removeImageLoadObject(previousId, { force: true });
  }

  imageLoader.createAndCacheLocalImage(imageId, {
    scalarData: result.pixels,
    dimensions: [result.columns, result.rows],
    spacing: [result.columnSpacing, result.rowSpacing],
    origin: [0, 0, 0],
    direction: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  });

  // StackViewport.buildMetadata destructures GENERAL_SERIES.modality; local images
  // only register IMAGE_PLANE / IMAGE_PIXEL unless we add this.
  genericMetadataProvider.add(imageId, {
    type: MetadataModules.GENERAL_SERIES,
    metadata: { modality: displaySet.Modality || 'CT' },
  });
  const cached = cache.getImage(imageId);
  if (cached) {
    const ww = Math.max(1, result.max - result.min);
    cached.windowWidth = ww;
    cached.windowCenter = (result.max + result.min) / 2;
  }

  const panoramicDisplaySet = upsertPanoramicDisplaySet({
    displaySetService,
    sourceDisplaySet: displaySet,
    imageId,
    columns: result.columns,
    rows: result.rows,
  });

  return { result, panoramicDisplaySet, imageId };
}
