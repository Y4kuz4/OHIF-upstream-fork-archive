import dcmjs from 'dcmjs';
import { TextDecoder, TextEncoder } from 'util';
import {
  PANORAMIC_SC_SOP_CLASS_UID,
  PANORAMIC_SR_SOP_CLASS_UID,
  copySourceMetadata,
  createPanoramicCurveDataset,
  createPanoramicImageDataset,
  findPanoramicCurve,
  readPanoramicCurve,
} from './panoramicDicom';

if (typeof global.TextEncoder === 'undefined') {
  Object.assign(global, { TextEncoder, TextDecoder });
}

const sourceDisplaySet = {
  displaySetInstanceUID: 'source-display-set',
  SeriesInstanceUID: '1.2.3.series',
  StudyInstanceUID: '1.2.3.study',
  PatientName: 'Display^Set',
  instances: [
    {
      SOPClassUID: '1.2.840.ct',
      SOPInstanceUID: '1.2.3.instance',
      PatientName: 'Paciente^Original',
      PatientID: 'PID-42',
      PatientBirthDate: '19800101',
      PatientSex: 'F',
      StudyInstanceUID: '1.2.3.study',
      StudyDate: '20260917',
      AccessionNumber: 'ACC-7',
      FrameOfReferenceUID: '1.2.3.for',
    },
  ],
};

const result = {
  pixels: new Float32Array([-40000, -10.4, 20.6, 40000]),
  rows: 2,
  columns: 2,
  rowSpacing: 0.5,
  columnSpacing: 0.25,
  min: -10,
  max: 21,
};

function writeDataset(dataset) {
  const meta = dcmjs.data.DicomMetaDictionary.denaturalizeDataset({
    FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
    MediaStorageSOPClassUID: dataset.SOPClassUID,
    MediaStorageSOPInstanceUID: dataset.SOPInstanceUID,
    TransferSyntaxUID: '1.2.840.10008.1.2.1',
    ImplementationClassUID: '2.25.1',
    ImplementationVersionName: 'OHIF_TEST',
  });
  const dict = new dcmjs.data.DicomDict(meta);
  dict.dict = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(dataset);
  return dict.write();
}

describe('panoramic DICOM persistence', () => {
  it('copies patient, study and frame-of-reference metadata from the original volume', () => {
    expect(copySourceMetadata(sourceDisplaySet)).toMatchObject({
      PatientName: 'Paciente^Original',
      PatientID: 'PID-42',
      PatientBirthDate: '19800101',
      PatientSex: 'F',
      StudyInstanceUID: '1.2.3.study',
      StudyDate: '20260917',
      AccessionNumber: 'ACC-7',
      FrameOfReferenceUID: '1.2.3.for',
    });
  });

  it('creates a signed 16-bit derived image referencing the source series', () => {
    const dataset = createPanoramicImageDataset({
      sourceDisplaySet,
      result,
      seriesInstanceUID: '1.2.3.pan',
      sopInstanceUID: '1.2.3.pan.1',
      now: new Date(2026, 8, 17, 12, 34, 56, 789),
    });

    expect(dataset).toMatchObject({
      SOPClassUID: PANORAMIC_SC_SOP_CLASS_UID,
      StudyInstanceUID: '1.2.3.study',
      PatientID: 'PID-42',
      Rows: 2,
      Columns: 2,
      PixelRepresentation: 1,
      PixelSpacing: [0.5, 0.25],
    });
    expect(Array.from(new Int16Array(dataset.PixelData))).toEqual([-32768, -10, 21, 32767]);
    expect(dataset.ReferencedSeriesSequence[0].ReferencedInstanceSequence[0]).toEqual({
      ReferencedSOPClassUID: '1.2.840.ct',
      ReferencedSOPInstanceUID: '1.2.3.instance',
    });
  });

  it('round-trips the editable curve through the SR private text item', () => {
    const points: [number, number, number][] = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const image = createPanoramicImageDataset({
      sourceDisplaySet,
      result,
      seriesInstanceUID: '1.2.3.pan',
      sopInstanceUID: '1.2.3.pan.1',
    });
    const sr = createPanoramicCurveDataset({
      sourceDisplaySet,
      points,
      thicknessMm: 12,
      sourceDisplaySetUID: 'source-display-set',
      panoramicImage: image,
      seriesInstanceUID: '1.2.3.sr',
      sopInstanceUID: '1.2.3.sr.1',
    });

    expect(sr.SOPClassUID).toBe(PANORAMIC_SR_SOP_CLASS_UID);
    expect(sr.ContentSequence[0]).toMatchObject({
      ValueType: 'SCOORD3D',
      GraphicType: 'POLYLINE',
      GraphicData: [1, 2, 3, 4, 5, 6],
      ReferencedFrameOfReferenceUID: '1.2.3.for',
    });
    expect(readPanoramicCurve(sr)).toMatchObject({ points, thicknessMm: 12 });
    expect(
      findPanoramicCurve([{ StudyInstanceUID: '1.2.3.study', instances: [sr] }], sourceDisplaySet)
    ).toMatchObject({ points, sourceSeriesInstanceUID: '1.2.3.series' });

    expect(() => writeDataset(image)).not.toThrow();
    expect(() => writeDataset(sr)).not.toThrow();
  });
});
