import type { Button } from '@ohif/core/types';
import { ToolbarService } from '@ohif/core';

const { TOOLBAR_SECTIONS } = ToolbarService;

const toolbarButtons: Button[] = [
  {
    id: 'PanoramicCurve',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'icon-tool-spline-roi',
      label: 'Dibujar curva',
      tooltip: 'Trazar curva panorámica: clic izquierdo añade puntos, clic derecho termina. Clic de nuevo para salir.',
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
      tooltip: 'Editar la curva: arrastra puntos o la línea; Ctrl añade/borra. Clic de nuevo o Esc para salir.',
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
    'PanoramicCurve',
    'EditPanoramicCurve',
    'PanoramicThickness',
    'MoreTools',
  ],
};

const customization = {
  'dentalPanoramic.toolbarButtons': toolbarButtons,
  'dentalPanoramic.toolbarSections': toolbarSections,
};

export { toolbarButtons, toolbarSections };
export default customization;
