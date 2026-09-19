import { useEffect, useState, memo, useCallback } from 'react';

const ActiveViewportBehavior = memo(
  ({ servicesManager, viewportId }: withAppTypes<{ viewportId: string }>) => {
    const {
      displaySetService,
      cineService,
      viewportGridService,
      customizationService,
      cornerstoneViewportService,
    } = servicesManager.services;

    const [activeViewportId, setActiveViewportId] = useState(viewportId);

    const handleCineEnable = useCallback(() => {
      if (cineService.isViewportCineClosed(activeViewportId)) {
        return;
      }

      const displaySetInstanceUIDs =
        viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId);

      if (!displaySetInstanceUIDs) {
        return;
      }

      const displaySets = displaySetInstanceUIDs.map(uid =>
        displaySetService.getDisplaySetByUID(uid)
      );

      if (!displaySets.length) {
        return;
      }

      const isDynamicVolume = displaySets.some(displaySet => displaySet?.isDynamicVolume);

      const sourceModalities = customizationService.getCustomization('autoCineModalities');

      const requiresCine = displaySets.some(displaySet => {
        if (!sourceModalities.includes(displaySet?.Modality)) {
          return false;
        }

        // Modality alone is not enough to justify cine controls.  For example,
        // a derived single-frame Secondary Capture commonly uses OT, as does
        // the dental panoramic reconstruction.  Only auto-enable cine when
        // there is actually more than one image/frame to play.
        return (
          Number(displaySet?.numImageFrames) > 1 ||
          displaySet?.imageIds?.length > 1 ||
          displaySet?.images?.length > 1 ||
          displaySet?.instances?.length > 1 ||
          Boolean(displaySet?.FrameRate)
        );
      });

      if ((requiresCine || isDynamicVolume) && !cineService.getState().isCineEnabled) {
        cineService.setIsCineEnabled(true);
      }
    }, [
      activeViewportId,
      cineService,
      viewportGridService,
      displaySetService,
      customizationService,
    ]);

    useEffect(() => {
      const subscription = viewportGridService.subscribe(
        viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
        ({ viewportId }) => setActiveViewportId(viewportId)
      );

      return () => subscription.unsubscribe();
    }, [viewportId, viewportGridService]);

    useEffect(() => {
      const subscription = cornerstoneViewportService.subscribe(
        cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
        () => {
          const activeViewportId = viewportGridService.getActiveViewportId();
          setActiveViewportId(activeViewportId);
          handleCineEnable();
        }
      );

      return () => subscription.unsubscribe();
    }, [viewportId, cornerstoneViewportService, viewportGridService, handleCineEnable]);

    useEffect(() => {
      handleCineEnable();
    }, [handleCineEnable]);

    return null;
  },
  arePropsEqual
);

ActiveViewportBehavior.displayName = 'ActiveViewportBehavior';

function arePropsEqual(prevProps, nextProps) {
  return (
    prevProps.viewportId === nextProps.viewportId &&
    prevProps.servicesManager === nextProps.servicesManager
  );
}

export default ActiveViewportBehavior;
