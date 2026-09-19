import type { Point3 } from '../curve/types';

export const PANORAMIC_SC_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.7.3';
export const PANORAMIC_SR_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.88.34';
export const PANORAMIC_CURVE_CONTENT_LABEL = 'PANORAMIC_CURVE';
const CURVE_DATA_CODE = 'PAN_CURVE_DATA';

const COPIED_METADATA_KEYS = [
  'SpecificCharacterSet',
  'PatientName',
  'PatientID',
  'IssuerOfPatientID',
  'PatientBirthDate',
  'PatientSex',
  'PatientAge',
  'PatientSize',
  'PatientWeight',
  'EthnicGroup',
  'PatientComments',
  'OtherPatientIDs',
  'StudyInstanceUID',
  'StudyID',
  'StudyDate',
  'StudyTime',
  'StudyDescription',
  'AccessionNumber',
  'ReferringPhysicianName',
  'NameOfPhysiciansReadingStudy',
  'AdmittingDiagnosesDescription',
  'InstitutionName',
  'InstitutionAddress',
  'StationName',
  'FrameOfReferenceUID',
] as const;

export type PanoramicResult = {
  pixels: ArrayLike<number>;
  rows: number;
  columns: number;
  rowSpacing: number;
  columnSpacing: number;
  min: number;
  max: number;
};

function createDicomUid() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `2.25.${BigInt(`0x${hex}`).toString(10)}`;
}

export type PersistedPanoramicCurve = {
  version: 1;
  points: Point3[];
  thicknessMm: number;
  sourceSeriesInstanceUID?: string;
  sourceDisplaySetUID?: string;
};

function firstInstance(displaySet) {
  return displaySet?.instances?.[0] ?? displaySet?.images?.[0] ?? displaySet?.instance ?? {};
}

export function copySourceMetadata(sourceDisplaySet) {
  const instance = firstInstance(sourceDisplaySet);
  return COPIED_METADATA_KEYS.reduce(
    (metadata, key) => {
      const value = instance?.[key] ?? sourceDisplaySet?.[key];
      if (value !== undefined && value !== null && value !== '') {
        metadata[key] = value;
      }
      return metadata;
    },
    {} as Record<string, unknown>
  );
}

function dicomNow(now = new Date()) {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return {
    date: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    time: `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${pad(
      now.getMilliseconds(),
      3
    )}`,
  };
}

function sourceReferences(sourceDisplaySet) {
  const instances = sourceDisplaySet?.instances ?? sourceDisplaySet?.images ?? [];
  const sourceSeriesInstanceUID =
    sourceDisplaySet?.SeriesInstanceUID ?? firstInstance(sourceDisplaySet)?.SeriesInstanceUID;
  const referencedInstances = instances
    .filter(instance => instance?.SOPClassUID && instance?.SOPInstanceUID)
    .map(instance => ({
      ReferencedSOPClassUID: instance.SOPClassUID,
      ReferencedSOPInstanceUID: instance.SOPInstanceUID,
    }));
  if (!sourceSeriesInstanceUID || !referencedInstances.length) {
    return undefined;
  }
  return [
    {
      SeriesInstanceUID: sourceSeriesInstanceUID,
      ReferencedInstanceSequence: referencedInstances,
    },
  ];
}

function int16Pixels(pixels: ArrayLike<number>) {
  const values = new Int16Array(pixels.length);
  for (let index = 0; index < pixels.length; index++) {
    values[index] = Math.max(-32768, Math.min(32767, Math.round(Number(pixels[index]) || 0)));
  }
  return values.buffer;
}

export function createPanoramicImageDataset({
  sourceDisplaySet,
  result,
  seriesInstanceUID = createDicomUid(),
  sopInstanceUID = createDicomUid(),
  now = new Date(),
}: {
  sourceDisplaySet;
  result: PanoramicResult;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  now?: Date;
}) {
  const { date, time } = dicomNow(now);
  const copied = copySourceMetadata(sourceDisplaySet);
  const references = sourceReferences(sourceDisplaySet);
  if (!copied.StudyInstanceUID) {
    throw new Error('El volumen original no contiene StudyInstanceUID.');
  }
  return {
    ...copied,
    SpecificCharacterSet: copied.SpecificCharacterSet ?? 'ISO_IR 192',
    SOPClassUID: PANORAMIC_SC_SOP_CLASS_UID,
    SOPInstanceUID: sopInstanceUID,
    SeriesInstanceUID: seriesInstanceUID,
    Modality: 'OT',
    ImageType: ['DERIVED', 'SECONDARY'],
    ConversionType: 'WSD',
    SeriesNumber: 9001,
    InstanceNumber: 1,
    SeriesDescription: 'Reconstrucción panorámica dental',
    StudyDate: copied.StudyDate ?? date,
    StudyTime: copied.StudyTime ?? time,
    SeriesDate: date,
    SeriesTime: time,
    ContentDate: date,
    ContentTime: time,
    InstanceCreationDate: date,
    InstanceCreationTime: time,
    Manufacturer: 'OHIF',
    ManufacturerModelName: 'Dental Panoramic',
    DeviceSerialNumber: 'OHIF',
    SoftwareVersions: '1',
    BurnedInAnnotation: 'NO',
    LossyImageCompression: '00',
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: result.rows,
    Columns: result.columns,
    NumberOfFrames: 1,
    PixelSpacing: [result.rowSpacing, result.columnSpacing],
    BitsAllocated: 16,
    BitsStored: 16,
    HighBit: 15,
    PixelRepresentation: 1,
    RescaleIntercept: 0,
    RescaleSlope: 1,
    WindowCenter: (result.max + result.min) / 2,
    WindowWidth: Math.max(1, result.max - result.min),
    ...(references ? { ReferencedSeriesSequence: references } : {}),
    _vrMap: { PixelData: 'OW' },
    PixelData: int16Pixels(result.pixels),
  };
}

export function createPanoramicCurveDataset({
  sourceDisplaySet,
  points,
  thicknessMm,
  sourceDisplaySetUID,
  panoramicImage,
  seriesInstanceUID = createDicomUid(),
  sopInstanceUID = createDicomUid(),
  now = new Date(),
}: {
  sourceDisplaySet;
  points: Point3[];
  thicknessMm: number;
  sourceDisplaySetUID?: string;
  panoramicImage: { SOPClassUID: string; SOPInstanceUID: string };
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  now?: Date;
}) {
  const { date, time } = dicomNow(now);
  const copied = copySourceMetadata(sourceDisplaySet);
  const references = sourceReferences(sourceDisplaySet);
  if (!copied.StudyInstanceUID || !copied.FrameOfReferenceUID) {
    throw new Error(
      'El volumen original no contiene StudyInstanceUID o FrameOfReferenceUID para guardar la curva.'
    );
  }
  const curveData: PersistedPanoramicCurve = {
    version: 1,
    points: points.map(point => [...point] as Point3),
    thicknessMm,
    sourceSeriesInstanceUID:
      sourceDisplaySet.SeriesInstanceUID ?? firstInstance(sourceDisplaySet)?.SeriesInstanceUID,
    sourceDisplaySetUID,
  };
  return {
    ...copied,
    SpecificCharacterSet: copied.SpecificCharacterSet ?? 'ISO_IR 192',
    SOPClassUID: PANORAMIC_SR_SOP_CLASS_UID,
    SOPInstanceUID: sopInstanceUID,
    SeriesInstanceUID: seriesInstanceUID,
    Modality: 'SR',
    SeriesNumber: 9002,
    InstanceNumber: 1,
    SeriesDescription: 'Curva panorámica dental',
    StudyDate: copied.StudyDate ?? date,
    StudyTime: copied.StudyTime ?? time,
    SeriesDate: date,
    SeriesTime: time,
    ContentDate: date,
    ContentTime: time,
    InstanceCreationDate: date,
    InstanceCreationTime: time,
    Manufacturer: 'OHIF',
    ManufacturerModelName: 'Dental Panoramic',
    DeviceSerialNumber: 'OHIF',
    SoftwareVersions: '1',
    CompletionFlag: 'COMPLETE',
    VerificationFlag: 'UNVERIFIED',
    ContentLabel: PANORAMIC_CURVE_CONTENT_LABEL,
    ValueType: 'CONTAINER',
    ContinuityOfContent: 'SEPARATE',
    ConceptNameCodeSequence: {
      CodeValue: 'PAN_CURVE_REPORT',
      CodingSchemeDesignator: '99OHIF',
      CodeMeaning: 'Panoramic curve report',
    },
    ...(references ? { ReferencedSeriesSequence: references } : {}),
    ContentSequence: [
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'SCOORD3D',
        ConceptNameCodeSequence: {
          CodeValue: '121230',
          CodingSchemeDesignator: 'DCM',
          CodeMeaning: 'Path',
        },
        GraphicType: 'POLYLINE',
        GraphicData: points.flat(),
        ReferencedFrameOfReferenceUID: copied.FrameOfReferenceUID,
      },
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'TEXT',
        ConceptNameCodeSequence: {
          CodeValue: CURVE_DATA_CODE,
          CodingSchemeDesignator: '99OHIF',
          CodeMeaning: 'Panoramic curve data',
        },
        TextValue: JSON.stringify(curveData),
      },
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'IMAGE',
        ConceptNameCodeSequence: {
          CodeValue: '121324',
          CodingSchemeDesignator: 'DCM',
          CodeMeaning: 'Source image',
        },
        ReferencedSOPSequence: {
          ReferencedSOPClassUID: panoramicImage.SOPClassUID,
          ReferencedSOPInstanceUID: panoramicImage.SOPInstanceUID,
        },
      },
    ],
  };
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function readPanoramicCurve(instance): PersistedPanoramicCurve | null {
  if (
    instance?.SOPClassUID !== PANORAMIC_SR_SOP_CLASS_UID &&
    instance?.ContentLabel !== PANORAMIC_CURVE_CONTENT_LABEL
  ) {
    return null;
  }
  const item = asArray(instance?.ContentSequence).find(
    content => content?.ConceptNameCodeSequence?.CodeValue === CURVE_DATA_CODE
  );
  if (!item?.TextValue) {
    return null;
  }
  try {
    const parsed = JSON.parse(item.TextValue);
    if (parsed?.version !== 1 || !Array.isArray(parsed.points) || parsed.points.length < 2) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function findPanoramicCurve(displaySets, sourceDisplaySet): PersistedPanoramicCurve | null {
  const candidates: { curve: PersistedPanoramicCurve; timestamp: string }[] = [];
  for (const displaySet of displaySets ?? []) {
    if (
      sourceDisplaySet?.StudyInstanceUID &&
      displaySet?.StudyInstanceUID !== sourceDisplaySet.StudyInstanceUID
    ) {
      continue;
    }
    const instances = displaySet?.instances ?? displaySet?.images ?? [displaySet?.instance];
    for (const instance of instances.filter(Boolean)) {
      const curve = readPanoramicCurve(instance);
      if (
        curve &&
        (!curve.sourceSeriesInstanceUID ||
          curve.sourceSeriesInstanceUID === sourceDisplaySet?.SeriesInstanceUID)
      ) {
        candidates.push({
          curve,
          timestamp: `${instance.ContentDate ?? ''}${instance.ContentTime ?? ''}`,
        });
      }
    }
  }
  candidates.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return candidates[candidates.length - 1]?.curve ?? null;
}
