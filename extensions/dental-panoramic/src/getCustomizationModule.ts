import type { Button } from '@ohif/core/types';
import { ToolbarService } from '@ohif/core';

const { TOOLBAR_SECTIONS } = ToolbarService;

const toolbarButtons: Button[] = [
  {
    id: 'PanoramicTools',
    uiType: 'dentalPanoramic.toolsButton',
    props: {
      buttonSection: true,
    },
  },
  {
    id: 'PanoramicCurve',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'icon-tool-spline-roi',
      label: 'Dibujar curva',
      tooltip:
        'Trazar curva panorámica: clic izquierdo añade puntos, Ctrl + clic inserta entre puntos y clic derecho termina.',
      commands: 'drawPanoramicCurve',
      evaluate: 'evaluate.dentalPanoramic.draw',
    },
  },
  {
    id: 'EditPanoramicCurve',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'tool-annotate',
      label: 'Editar curva',
      tooltip:
        'Editar sin pausas: mueve varios puntos; la panorámica se reconstruye al salir. Ctrl + clic inserta o borra puntos.',
      commands: 'editPanoramicCurve',
      evaluate: 'evaluate.dentalPanoramic.edit',
    },
  },
  {
    id: 'PanoramicThickness',
    uiType: 'dentalPanoramic.thicknessButton',
    props: {
      icon: 'tool-stack-scroll',
      label: 'Espesor',
      tooltip: 'Espesor de la capa panorámica (bucal–lingual)',
      commands: 'setPanoramicThickness',
      evaluate: 'evaluate.action',
    },
  },
  {
    id: 'PanoramicPostProcessing',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'tool-window-level',
      label: 'Postprocesado',
      tooltip: 'Realce panorámico no destructivo',
      commands: 'setPanoramicPostProcessing',
      evaluate: 'evaluate.action',
    },
  },
  {
    id: 'StorePanoramicInPacs',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'Export',
      label: 'Guardar en PACS',
      tooltip: 'Guardar la reconstrucción y la curva editable en el estudio DICOM',
      commands: 'storePanoramicInPacs',
      evaluate: 'evaluate.action',
    },
  },
  {
    id: 'ClearPanoramicCurve',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'icon-clear',
      label: 'Limpiar curva',
      tooltip: 'Eliminar la curva y la reconstrucción panorámica',
      commands: 'clearPanoramicCurve',
      evaluate: 'evaluate.action',
    },
  },
];

const toolbarSections = {
  [TOOLBAR_SECTIONS.primary]: [
    'MeasurementTools',
    'Zoom',
    'Pan',
    'TrackballRotate',
    'WindowLevel',
    'Capture',
    'Layout',
    'Crosshairs',
    'PanoramicTools',
    'MoreTools',
  ],
  PanoramicTools: [
    'PanoramicCurve',
    'EditPanoramicCurve',
    'PanoramicThickness',
    'PanoramicPostProcessing',
    'StorePanoramicInPacs',
    'ClearPanoramicCurve',
  ],
};

const customization = {
  'dentalPanoramic.toolbarButtons': toolbarButtons,
  'dentalPanoramic.toolbarSections': toolbarSections,
};

export { toolbarButtons, toolbarSections };
export default customization;
