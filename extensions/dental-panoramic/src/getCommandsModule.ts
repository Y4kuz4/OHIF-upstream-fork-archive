import { cache } from '@cornerstonejs/core';
import { Enums as csToolsEnums, annotation } from '@cornerstonejs/tools';
import type { Types as OhifTypes } from '@ohif/core';
import PanoramicCurveTool, {
  clearPanoramicCurves,
  renderPanoramicCurve,
} from './tools/PanoramicCurveTool';
import { PANORAMIC_DISPLAY_SET_UID, reconstructPanoramic } from './sampler/reconstruct';
import { getPanoramicThicknessMm, setPanoramicThicknessMm } from './sampler/thickness';
import type { Point3 } from './curve/types';
import { updatePanoramicViewportImage } from './viewport/updatePanoramicViewport';

const { MouseBindings, KeyboardBindings } = csToolsEnums;
const TOOL_NAME = PanoramicCurveTool.toolName;
const EDIT_RECONSTRUCTION_DEBOUNCE_MS = 800;

const CROSSHAIR_SHIFT_BINDING = {
  mouseButton: MouseBindings.Primary,
  modifierKey: KeyboardBindings.Shift,
};

const CURVE_BINDINGS = [
  { mouseButton: MouseBindings.Primary },
  { mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift },
  { mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Ctrl },
  { mouseButton: MouseBindings.Secondary },
];

let escapeHandler: ((evt: KeyboardEvent) => void) | null = null;
let contextMenuHandler: ((evt: Event) => void) | null = null;
let contextMenuElement: HTMLDivElement | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let reconstructionRequestId = 0;
const previousCrosshairsActive = new Map<string, boolean>();

type CurveContext = {
  points: Point3[];
  viewportId: string;
  sourceDisplaySetUID?: string;
};

function commandsModule({
  servicesManager,
  commandsManager,
  extensionManager,
}: OhifTypes.Extensions.ExtensionParams): OhifTypes.Extensions.CommandsModule {
  const {
    viewportGridService,
    toolGroupService,
    cornerstoneViewportService,
    displaySetService,
    uiNotificationService,
    toolbarService,
  } = servicesManager.services as AppTypes.Services;
  let lastCurveContext: CurveContext | null = null;
  let pendingEditContext: CurveContext | null = null;

  const actions = {
    getSourceViewport() {
      const viewportId = viewportGridService.getActiveViewportId();
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      return { viewportId, viewport };
    },

    getCurveToolGroupIds() {
      const ids = toolGroupService.getToolGroupIds?.() ?? [];
      if (ids.length) {
        return ids;
      }
      const activeId = viewportGridService.getActiveViewportId();
      const group = toolGroupService.getToolGroupForViewport?.(activeId);
      return group?.id ? [group.id] : ['default', 'mpr'];
    },

    getCurveMode() {
      const toolGroupIds = actions.getCurveToolGroupIds();
      for (const toolGroupId of toolGroupIds) {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        if (!toolGroup?.hasTool(TOOL_NAME)) {
          continue;
        }
        if (toolGroup.getActivePrimaryMouseButtonTool() === TOOL_NAME) {
          return {
            active: true,
            editMode: !!toolGroup.getToolConfiguration(TOOL_NAME)?.editMode,
          };
        }
      }
      return { active: false, editMode: false };
    },

    refreshCurveToolbar() {
      const viewportId = viewportGridService.getActiveViewportId();
      toolbarService?.refreshToolbarState?.({ viewportId });
    },

    renderCurveAnnotations() {
      const state = viewportGridService.getState();
      for (const viewportId of state.viewports.keys()) {
        const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
        if (!viewport?.element) {
          continue;
        }
        const curves = annotation.state.getAnnotations(TOOL_NAME, viewport.element) || [];
        if (curves.length) {
          renderPanoramicCurve(viewport.element);
        }
      }
    },

    scheduleReconstruction({ points, viewportId, sourceDisplaySetUID }: CurveContext) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      const pointSnapshot = points.map(point => [...point] as Point3);
      lastCurveContext = { points: pointSnapshot, viewportId, sourceDisplaySetUID };
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        actions.reconstructFromPoints({
          points: pointSnapshot,
          viewportId,
          sourceDisplaySetUID,
        });
      }, EDIT_RECONSTRUCTION_DEBOUNCE_MS);
    },

    deferEditReconstruction({ points, viewportId, sourceDisplaySetUID }: CurveContext) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      const pointSnapshot = points.map(point => [...point] as Point3);
      pendingEditContext = { points: pointSnapshot, viewportId, sourceDisplaySetUID };
      lastCurveContext = pendingEditContext;
    },

    bindCurveTool({ editMode }: { editMode: boolean }) {
      const { viewportId, viewport } = actions.getSourceViewport();
      if (!viewport) {
        return;
      }
      const sourceDisplaySetUID = viewportGridService
        .getDisplaySetsUIDsForViewport(viewportId)
        ?.find(uid => uid !== PANORAMIC_DISPLAY_SET_UID);

      const handler = ({ points, reason }) => {
        if (reason === 'need-two-points') {
          uiNotificationService.show({
            title: 'Curva panorámica',
            message: 'Haz al menos dos puntos y termina con clic derecho.',
            type: 'info',
          });
          return;
        }
        if (reason === 'drawing') {
          return;
        }
        if (reason === 'finish') {
          actions.deactivateCurveTool({ restore: true });
          actions.reconstructFromPoints({ points, viewportId, notify: true });
          return;
        }
        if (editMode) {
          actions.deferEditReconstruction({ points, viewportId, sourceDisplaySetUID });
          return;
        }
        actions.scheduleReconstruction({ points, viewportId, sourceDisplaySetUID });
      };

      const toolGroupIds = actions.getCurveToolGroupIds();
      toolGroupIds.forEach(toolGroupId => {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        if (!toolGroup?.hasTool(TOOL_NAME)) {
          return;
        }
        if (toolGroup.hasTool('Crosshairs')) {
          const options = toolGroup.getToolOptions?.('Crosshairs');
          previousCrosshairsActive.set(toolGroupId, options?.mode === 'Active');
          toolGroup.setToolDisabled('Crosshairs');
        }
        // Zoom owns Secondary in mode basic. setToolPassive does not demote it
        // because it is not the primary tool; disable until the curve is done.
        if (toolGroup.hasTool('Zoom')) {
          toolGroup.setToolDisabled('Zoom');
        }
        const primary = toolGroup.getActivePrimaryMouseButtonTool();
        if (primary && primary !== TOOL_NAME) {
          const primaryOptions = toolGroup.getToolConfiguration(primary);
          primaryOptions?.disableOnPassive
            ? toolGroup.setToolDisabled(primary)
            : toolGroup.setToolPassive(primary);
        }
        toolGroup.setToolConfiguration(TOOL_NAME, {
          editMode,
          onCurveChanged: handler,
        });
        toolGroup.setToolActive(TOOL_NAME, { bindings: CURVE_BINDINGS });
      });

      const element = viewport.element;
      if (contextMenuHandler) {
        contextMenuElement?.removeEventListener('contextmenu', contextMenuHandler);
      }
      contextMenuHandler = evt => {
        evt.preventDefault();
        evt.stopPropagation?.();
        if (editMode) {
          return;
        }
        const existing = annotation.state.getAnnotations(TOOL_NAME, element) || [];
        const record = existing[0];
        const points = record?.data?.handles?.points;
        if (!points || points.length < 2) {
          uiNotificationService.show({
            title: 'Curva panorámica',
            message: 'Haz al menos dos puntos y termina con clic derecho.',
            type: 'info',
          });
          return;
        }
        if (record.data.completed) {
          return;
        }
        record.data.completed = true;
        actions.deactivateCurveTool({ restore: true });
        actions.reconstructFromPoints({ points, viewportId, notify: true });
      };
      element.addEventListener('contextmenu', contextMenuHandler);
      contextMenuElement = element;

      if (escapeHandler) {
        window.removeEventListener('keydown', escapeHandler);
      }
      escapeHandler = evt => {
        if (evt.key === 'Escape') {
          actions.deactivateCurveTool({ restore: true });
        }
      };
      window.addEventListener('keydown', escapeHandler);
      actions.refreshCurveToolbar();
      actions.renderCurveAnnotations();
    },

    deactivateCurveTool(
      { restore = true, reconstructPending = true } = {
        restore: true,
        reconstructPending: true,
      }
    ) {
      const finalEditContext = reconstructPending ? pendingEditContext : null;
      pendingEditContext = null;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (contextMenuElement && contextMenuHandler) {
        contextMenuElement.removeEventListener('contextmenu', contextMenuHandler);
        contextMenuHandler = null;
        contextMenuElement = null;
      }
      if (escapeHandler) {
        window.removeEventListener('keydown', escapeHandler);
        escapeHandler = null;
      }

      const toolGroupIds = actions.getCurveToolGroupIds();
      toolGroupIds.forEach(toolGroupId => {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        if (!toolGroup?.hasTool(TOOL_NAME)) {
          return;
        }
        toolGroup.setToolPassive(TOOL_NAME);
        toolGroup.setToolConfiguration(TOOL_NAME, { editMode: false, onCurveChanged: undefined });
        if (!restore) {
          return;
        }
        if (toolGroup.hasTool('WindowLevel')) {
          toolGroup.setToolActive('WindowLevel', {
            bindings: [{ mouseButton: MouseBindings.Primary }],
          });
        }
        if (toolGroup.hasTool('Zoom')) {
          toolGroup.setToolActive('Zoom', {
            bindings: [{ mouseButton: MouseBindings.Secondary }, { numTouchPoints: 2 }],
          });
        }
        if (toolGroup.hasTool('Crosshairs')) {
          toolGroup.setToolActive('Crosshairs', { bindings: [CROSSHAIR_SHIFT_BINDING] });
          if (!previousCrosshairsActive.get(toolGroupId)) {
            toolGroup.setToolDisabled('Crosshairs');
          }
        }
      });
      actions.refreshCurveToolbar();
      actions.renderCurveAnnotations();
      if (finalEditContext) {
        actions.reconstructFromPoints(finalEditContext);
      }
    },

    drawPanoramicCurve() {
      const { viewport } = actions.getSourceViewport();
      if (!viewport) {
        uiNotificationService.show({
          title: 'Curva panorámica',
          message: 'Abre un volumen CT/CBCT en el visor.',
          type: 'warning',
        });
        return;
      }
      const mode = actions.getCurveMode();
      if (mode.active && !mode.editMode) {
        actions.deactivateCurveTool({ restore: true });
        return;
      }
      uiNotificationService.show({
        title: 'Curva panorámica',
        message:
          'Clic izquierdo: puntos. Clic derecho: terminar. Clic de nuevo en Dibujar para salir.',
        type: 'info',
        duration: 2500,
      });
      actions.bindCurveTool({ editMode: false });
    },

    findCurveHost() {
      const state = viewportGridService.getState();
      const ids = [...(state.viewports?.keys?.() ?? [])];
      const activeId = viewportGridService.getActiveViewportId();
      const ordered = [activeId, ...ids.filter(id => id !== activeId)];
      for (const viewportId of ordered) {
        const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
        if (!viewport?.element) {
          continue;
        }
        const existing = annotation.state.getAnnotations(TOOL_NAME, viewport.element) || [];
        const points = existing[0]?.data?.handles?.points;
        if (points?.length >= 2) {
          if (viewportId !== activeId) {
            viewportGridService.setActiveViewportId(viewportId);
          }
          const sourceDisplaySetUID = viewportGridService
            .getDisplaySetsUIDsForViewport(viewportId)
            ?.find(uid => uid !== PANORAMIC_DISPLAY_SET_UID);
          return { viewportId, viewport, points, sourceDisplaySetUID };
        }
      }
      return {
        viewportId: activeId,
        viewport: null,
        points: null,
        sourceDisplaySetUID: undefined,
      };
    },

    editPanoramicCurve() {
      const { viewport, points } = actions.findCurveHost();
      if (!viewport || !points || points.length < 2) {
        uiNotificationService.show({
          title: 'Curva panorámica',
          message: 'No hay una curva para editar. Trázala primero.',
          type: 'info',
        });
        return;
      }
      const mode = actions.getCurveMode();
      if (mode.active && mode.editMode) {
        actions.deactivateCurveTool({ restore: true });
        return;
      }
      pendingEditContext = null;
      uiNotificationService.show({
        title: 'Editar curva panorámica',
        message: 'Mueve todos los puntos que necesites. La panorámica se actualizará al salir.',
        type: 'info',
        duration: 3000,
      });
      actions.bindCurveTool({ editMode: true });
    },

    async clearPanoramicCurve() {
      reconstructionRequestId += 1;
      lastCurveContext = null;
      pendingEditContext = null;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      actions.deactivateCurveTool({ restore: true, reconstructPending: false });

      const state = viewportGridService.getState();
      const panoramicViewportIds: string[] = [];
      let clearedCurve = false;

      for (const [viewportId, viewportState] of state.viewports.entries()) {
        const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
        if (viewport?.element) {
          const curves = annotation.state.getAnnotations(TOOL_NAME, viewport.element) || [];
          if (curves.length) {
            clearPanoramicCurves(viewport.element);
            clearedCurve = true;
          }
        }
        if ((viewportState.displaySetInstanceUIDs || []).includes(PANORAMIC_DISPLAY_SET_UID)) {
          panoramicViewportIds.push(viewportId);
        }
      }

      if (panoramicViewportIds.length) {
        await viewportGridService.setDisplaySetsForViewports(
          panoramicViewportIds.map(viewportId => ({
            viewportId,
            displaySetInstanceUIDs: [],
          }))
        );
      }

      const panoramicDisplaySet = displaySetService.getDisplaySetByUID(PANORAMIC_DISPLAY_SET_UID);
      for (const imageId of panoramicDisplaySet?.imageIds || []) {
        if (cache.getImage(imageId)) {
          cache.removeImageLoadObject(imageId, { force: true });
        }
      }
      servicesManager.services.cornerstoneCacheService?.stackImageIds?.delete(
        PANORAMIC_DISPLAY_SET_UID
      );
      if (panoramicDisplaySet) {
        displaySetService.deleteDisplaySet(PANORAMIC_DISPLAY_SET_UID);
      }

      uiNotificationService.show({
        title: 'Curva panorámica',
        message:
          clearedCurve || panoramicDisplaySet
            ? 'Curva y reconstrucción panorámica eliminadas.'
            : 'No hay una curva panorámica para limpiar.',
        type: 'info',
        duration: 2000,
      });
      actions.refreshCurveToolbar();
    },

    setPanoramicThickness({ value }) {
      const mm = setPanoramicThicknessMm(Number(value));
      const host = actions.findCurveHost();
      if (host.viewport?.element) {
        renderPanoramicCurve(host.viewport.element);
      }
      const context =
        host.points?.length >= 2
          ? {
              points: host.points,
              viewportId: host.viewportId,
              sourceDisplaySetUID: host.sourceDisplaySetUID,
            }
          : lastCurveContext;
      if (!context?.points || context.points.length < 2) {
        return mm;
      }
      const mode = actions.getCurveMode();
      if (mode.active && mode.editMode) {
        actions.deferEditReconstruction(context);
        return mm;
      }
      actions.scheduleReconstruction(context);
      return mm;
    },

    async reconstructFromPoints({
      points,
      viewportId,
      sourceDisplaySetUID,
      notify = false,
    }: {
      points: Point3[];
      viewportId: string;
      sourceDisplaySetUID?: string;
      notify?: boolean;
    }) {
      const requestId = ++reconstructionRequestId;
      if (!points || points.length < 2) {
        uiNotificationService.show({
          title: 'Curva panorámica',
          message: 'Haz al menos dos puntos y termina con clic derecho.',
          type: 'info',
        });
        return;
      }

      const displaySetUIDs = viewportGridService.getDisplaySetsUIDsForViewport(viewportId);
      const sourceUid =
        sourceDisplaySetUID ??
        displaySetUIDs?.find(uid => uid !== PANORAMIC_DISPLAY_SET_UID) ??
        lastCurveContext?.sourceDisplaySetUID;
      if (!sourceUid) {
        return;
      }
      const displaySet = displaySetService.getDisplaySetByUID(sourceUid);
      if (!displaySet) {
        return;
      }

      const state = viewportGridService.getState();
      const currentSourceViewportId =
        [...state.viewports.entries()].find(([, viewportState]) =>
          (viewportState.displaySetInstanceUIDs || []).includes(sourceUid)
        )?.[0] ?? viewportId;
      const pointSnapshot = points.map(point => [...point] as Point3);
      lastCurveContext = {
        points: pointSnapshot,
        viewportId: currentSourceViewportId,
        sourceDisplaySetUID: sourceUid,
      };

      const dataSource = extensionManager.getActiveDataSource()[0];
      try {
        if (notify) {
          uiNotificationService.show({
            title: 'Curva panorámica',
            message: 'Reconstruyendo panorámica…',
            type: 'info',
            duration: 2000,
          });
        }
        const { panoramicDisplaySet, imageId } = await reconstructPanoramic({
          controlPoints: pointSnapshot,
          displaySet,
          dataSource,
          displaySetService,
          thicknessMm: getPanoramicThicknessMm(),
        });

        if (requestId !== reconstructionRequestId) {
          if (cache.getImage(imageId)) {
            cache.removeImageLoadObject(imageId, { force: true });
          }
          const currentPanoramicDisplaySet =
            displaySetService.getDisplaySetByUID(PANORAMIC_DISPLAY_SET_UID);
          if (currentPanoramicDisplaySet?.imageIds?.includes(imageId)) {
            displaySetService.deleteDisplaySet(PANORAMIC_DISPLAY_SET_UID);
          }
          return;
        }

        const cacheService = servicesManager.services.cornerstoneCacheService;
        cacheService?.stackImageIds?.delete(PANORAMIC_DISPLAY_SET_UID);

        await actions.showPanoramicViewport({
          sourceViewportId: currentSourceViewportId,
          sourceDisplaySetUID: sourceUid,
          panoramicDisplaySet,
          imageId,
        });
      } catch (error) {
        uiNotificationService.show({
          title: 'Curva panorámica',
          message: error?.message || 'No se pudo reconstruir la panorámica.',
          type: 'error',
        });
      }
    },

    async showPanoramicViewport({
      sourceViewportId,
      sourceDisplaySetUID,
      panoramicDisplaySet,
      imageId,
    }) {
      const state = viewportGridService.getState();
      if (state.layout.numRows * state.layout.numCols < 2) {
        commandsManager.run('setViewportGridLayout', { numRows: 2, numCols: 1 });
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      const next = viewportGridService.getState();
      const ids = [...next.viewports.keys()];
      const ctId =
        ids.find(id =>
          (next.viewports.get(id)?.displaySetInstanceUIDs || []).includes(sourceDisplaySetUID)
        ) || sourceViewportId;
      let panId = ids.find(id => {
        const uids = next.viewports.get(id)?.displaySetInstanceUIDs || [];
        return uids.includes(PANORAMIC_DISPLAY_SET_UID);
      });
      if (!panId) {
        panId = ids.find(id => id !== ctId) || ids[ids.length - 1];
      }
      if (!panId) {
        return;
      }

      await viewportGridService.setDisplaySetsForViewport({
        viewportId: panId,
        displaySetInstanceUIDs: [panoramicDisplaySet.displaySetInstanceUID],
        viewportOptions: { viewportType: 'stack' },
      });

      const panViewport = cornerstoneViewportService.getCornerstoneViewport(panId);
      await updatePanoramicViewportImage(panViewport, imageId);
    },
  };

  return {
    actions,
    definitions: {
      drawPanoramicCurve: { commandFn: actions.drawPanoramicCurve },
      editPanoramicCurve: { commandFn: actions.editPanoramicCurve },
      clearPanoramicCurve: { commandFn: actions.clearPanoramicCurve },
      deactivateCurveTool: { commandFn: actions.deactivateCurveTool },
      reconstructFromPoints: { commandFn: actions.reconstructFromPoints },
      setPanoramicThickness: { commandFn: actions.setPanoramicThickness },
    },
    defaultContext: 'DEFAULT',
  };
}

export default commandsModule;
