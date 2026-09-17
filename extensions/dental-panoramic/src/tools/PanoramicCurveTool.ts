import { getEnabledElement } from '@cornerstonejs/core';
import {
  AnnotationTool,
  Enums,
  annotation,
  drawing,
  utilities as toolUtilities,
} from '@cornerstonejs/tools';
import {
  DEFAULT_PROXIMITY_PX,
  deletePoint,
  insertPoint,
  interpolateSpline,
  resolveCurveClick,
  translatePoints,
} from '../curve/geometry';
import type { CurveMode, Point2, Point3 } from '../curve/types';

const { MouseBindings } = Enums;
const { addAnnotation, getAnnotations, removeAnnotations } = annotation.state;
const { drawHandles, drawPolyline } = drawing;

const GREEN = 'rgb(0, 200, 80)';
const CURVE_EVENT = 'dentalpanoramiccurve';

type CurveCallback = (detail: {
  points: Point3[];
  reason: 'finish' | 'edit' | 'drawing' | 'need-two-points';
  element: HTMLDivElement;
}) => void;

function getNativeEvent(evt): MouseEvent {
  return evt.detail?.event ?? evt.detail?.currentPoints?.event ?? evt;
}

class PanoramicCurveTool extends AnnotationTool {
  static toolName = 'PanoramicCurve';
  static isAnnotation = false;

  constructor(toolProps = {}, defaultToolProps = {}) {
    super(
      toolProps,
      AnnotationTool.mergeDefaultProps(
        {
          supportedInteractionTypes: ['Mouse'],
          configuration: {
            editMode: false,
            proximity: DEFAULT_PROXIMITY_PX,
            onCurveChanged: undefined as CurveCallback | undefined,
          },
        },
        defaultToolProps
      )
    );
  }

  get curveMode(): CurveMode {
    return this.configuration.editMode ? 'edit' : 'draw';
  }

  addNewAnnotation = () => {
    return null;
  };

  cancel = () => {
    return null;
  };

  handleSelectedCallback = () => {
    // Gestures go through preMouseDownCallback (Romexis, not measurement handles).
  };

  toolSelectedCallback = () => {
    // Same as handleSelectedCallback.
  };

  isPointNearTool = (element, annotationRecord, canvasCoords, proximity) => {
    const points = annotationRecord?.data?.handles?.points;
    if (!points?.length) {
      return false;
    }
    const viewport = getEnabledElement(element)?.viewport;
    if (!viewport) {
      return false;
    }
    const canvasPoints = points.map(p => viewport.worldToCanvas(p) as Point2);
    const click: Point2 = [canvasCoords[0], canvasCoords[1]];
    const action = resolveCurveClick({
      mode: 'edit',
      canvasPoints,
      clickCanvas: click,
      modifiers: { ctrl: false, shift: false, secondary: false },
      proximity,
    });
    return action.type === 'moveHandle' || action.type === 'moveCurve';
  };

  preMouseDownCallback = evt => {
    const { element, currentPoints } = evt.detail;
    const native = getNativeEvent(evt);
    const button = native?.button ?? 0;
    const isSecondary = button === 2 || evt.detail.event?.buttons === MouseBindings.Secondary;
    const isCtrl = !!(native?.ctrlKey || native?.metaKey);
    const isShift = !!native?.shiftKey;

    if (isSecondary) {
      native?.preventDefault?.();
      evt.preventDefault?.();
    }

    const enabledElement = getEnabledElement(element);
    if (!enabledElement) {
      return false;
    }
    const { viewport } = enabledElement;
    const world = currentPoints.world as Point3;
    const clickCanvas = currentPoints.canvas as Point2;

    const annotationRecord = this._ensureAnnotation(viewport, element);
    const points: Point3[] = annotationRecord.data.handles.points;
    const canvasPoints = points.map(p => viewport.worldToCanvas(p) as Point2);

    const action = resolveCurveClick({
      mode: this.curveMode,
      canvasPoints,
      clickCanvas,
      modifiers: { ctrl: isCtrl, shift: isShift, secondary: isSecondary },
      proximity: this.configuration.proximity,
    });

    if (action.type === 'ignore') {
      if (action.reason === 'need-two-points') {
        this.configuration.onCurveChanged?.({
          points,
          reason: 'need-two-points',
          element,
        });
      }
      return true;
    }

    if (action.type === 'finish') {
      annotationRecord.data.completed = true;
      this._emit(element, points, 'finish');
      triggerRender(element);
      return true;
    }

    if (action.type === 'add') {
      points.push([...world]);
      this._emit(element, points, 'drawing');
      triggerRender(element);
      return true;
    }

    if (action.type === 'insert') {
      annotationRecord.data.handles.points = insertPoint(points, action.index, [...world]);
      this._emit(
        element,
        annotationRecord.data.handles.points,
        this.curveMode === 'edit' ? 'edit' : 'drawing'
      );
      triggerRender(element);
      return true;
    }

    if (action.type === 'delete') {
      if (points.length <= 1) {
        return true;
      }
      annotationRecord.data.handles.points = deletePoint(points, action.index);
      this._emit(
        element,
        annotationRecord.data.handles.points,
        this.curveMode === 'edit' ? 'edit' : 'drawing'
      );
      triggerRender(element);
      return true;
    }

    if (action.type === 'moveHandle' || action.type === 'moveCurve') {
      this.editData = {
        annotation: annotationRecord,
        handleIndex: action.type === 'moveHandle' ? action.index : -1,
        viewportIdsToRender: [viewport.id],
        lastWorld: [...world],
      };
      this._activateModify(element);
      evt.preventDefault?.();
      return true;
    }

    return true;
  };

  _dragCallback = evt => {
    if (!this.editData?.annotation) {
      return;
    }
    const { element, currentPoints } = evt.detail;
    const world = currentPoints.world as Point3;
    const annotationRecord = this.editData.annotation;
    const points: Point3[] = annotationRecord.data.handles.points;
    const handleIndex = this.editData.handleIndex;

    if (handleIndex >= 0 && handleIndex < points.length) {
      points[handleIndex] = [...world];
    } else {
      const last = this.editData.lastWorld as Point3;
      const delta: Point3 = [world[0] - last[0], world[1] - last[1], world[2] - last[2]];
      annotationRecord.data.handles.points = translatePoints(points, delta);
    }
    this.editData.lastWorld = [...world];
    this._emit(
      element,
      annotationRecord.data.handles.points,
      this.curveMode === 'edit' ? 'edit' : 'drawing'
    );
    triggerRender(element);
  };

  _endCallback = evt => {
    const { element } = evt.detail;
    this._deactivateModify(element);
    const points = this.editData?.annotation?.data?.handles?.points;
    this.editData = null;
    this.isDrawing = false;
    if (points && this.curveMode === 'edit') {
      this._emit(element, points, 'edit');
    }
    triggerRender(element);
  };

  renderAnnotation = (enabledElement, svgDrawingHelper) => {
    const { viewport } = enabledElement;
    const annotations = getAnnotations(this.getToolName(), viewport.element) || [];
    if (!annotations.length) {
      return false;
    }

    for (const annotationRecord of annotations) {
      const points: Point3[] = annotationRecord.data?.handles?.points || [];
      if (!points.length) {
        continue;
      }
      const canvasHandles = points.map(p => viewport.worldToCanvas(p));
      const spline = interpolateSpline(points, 12);
      const canvasSpline = spline.map(p => viewport.worldToCanvas(p));

      if (canvasSpline.length >= 2) {
        drawPolyline(svgDrawingHelper, annotationRecord.annotationUID, 'curve', canvasSpline, {
          color: GREEN,
          width: 1.5,
          closePath: false,
        });
      }

      drawHandles(svgDrawingHelper, annotationRecord.annotationUID, 'handles', canvasHandles, {
        color: GREEN,
        handleRadius: 6,
        fill: GREEN,
      });
    }

    return true;
  };

  _ensureAnnotation(viewport, element) {
    const existing = getAnnotations(this.getToolName(), element) || [];
    if (existing.length) {
      return existing[0];
    }
    const annotationRecord = PanoramicCurveTool.createAnnotationForViewport(viewport, {
      data: {
        handles: { points: [] },
        completed: false,
      },
    });
    addAnnotation(annotationRecord, element);
    return annotationRecord;
  }

  _emit(
    element: HTMLDivElement,
    points: Point3[],
    reason: 'finish' | 'edit' | 'drawing' | 'need-two-points'
  ) {
    this.configuration.onCurveChanged?.({ points: points.map(p => [...p] as Point3), reason, element });
    element.dispatchEvent(
      new CustomEvent(CURVE_EVENT, {
        detail: { points, reason },
        bubbles: true,
      })
    );
  }
}

function triggerRender(element) {
  const enabled = getEnabledElement(element);
  if (!enabled) {
    return;
  }
  toolUtilities.triggerAnnotationRenderForViewportIds([enabled.viewport.id]);
}

export function clearPanoramicCurves(element: HTMLDivElement) {
  removeAnnotations(PanoramicCurveTool.toolName, element);
}

export { CURVE_EVENT };
export default PanoramicCurveTool;
