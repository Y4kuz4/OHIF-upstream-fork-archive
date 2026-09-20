import React, { useEffect, useState } from 'react';
import { useToolbar } from '@ohif/core';
import {
  Slider,
  Switch,
  ToolButton,
  ToolButtonList,
  ToolButtonListDefault,
  ToolButtonListDivider,
  ToolButtonListDropDown,
  ToolButtonListItem,
} from '@ohif/ui-next';
import {
  getPanoramicThicknessMm,
  MAX_THICKNESS_MM,
  MIN_THICKNESS_MM,
  subscribePanoramicThickness,
} from '../sampler/thickness';
import {
  getPanoramicPostProcessing,
  PANORAMIC_POST_PROCESSING_ORIGINAL,
  PANORAMIC_POST_PROCESSING_SOFT,
  setPanoramicPostProcessing,
  subscribePanoramicPostProcessing,
} from '../sampler/postProcessing';

const THICKNESS_BUTTON_ID = 'PanoramicThickness';
const POST_PROCESSING_BUTTON_ID = 'PanoramicPostProcessing';

export default function PanoramicToolsButton({ id, buttonSection = id }) {
  const { onInteraction, toolbarButtons } = useToolbar({ buttonSection });
  const [mm, setMm] = useState(getPanoramicThicknessMm);
  const [postProcessing, setPostProcessingState] = useState(getPanoramicPostProcessing);

  useEffect(() => subscribePanoramicThickness(setMm), []);
  useEffect(() => subscribePanoramicPostProcessing(setPostProcessingState), []);

  if (!toolbarButtons?.length) {
    return null;
  }

  const actionableButtons = toolbarButtons.filter(
    button => button.id !== THICKNESS_BUTTON_ID && button.id !== POST_PROCESSING_BUTTON_ID
  );
  const primaryButton =
    actionableButtons.find(button => button.componentProps.isActive) ?? actionableButtons[0];
  const primary = primaryButton?.componentProps;

  if (!primary) {
    return null;
  }

  const handleThicknessChange = ([value]) => {
    setMm(value);
    onInteraction?.({ itemId: THICKNESS_BUTTON_ID, value });
  };

  const applyPostProcessing = next => {
    const settings = setPanoramicPostProcessing(next);
    onInteraction?.({ itemId: POST_PROCESSING_BUTTON_ID, settings });
  };

  const previewPostProcessing = (key, [value]) => {
    setPostProcessingState(current => ({ ...current, [key]: value }));
  };

  return (
    <ToolButtonList data-cy={id}>
      <ToolButtonListDefault>
        <div
          data-cy={`${id}-split-button-primary`}
          data-tool={primary.id}
          data-active={primary.isActive}
        >
          <ToolButton
            {...primary}
            onInteraction={({ itemId }) =>
              onInteraction?.({ id, itemId, commands: primary.commands })
            }
            className={primary.className}
          />
        </div>
      </ToolButtonListDefault>
      <ToolButtonListDivider className={primary.isActive ? 'opacity-0' : 'opacity-100'} />
      <div data-cy={`${id}-split-button-secondary`}>
        <ToolButtonListDropDown>
          {actionableButtons.map(button => {
            const item = button.componentProps;
            return (
              <ToolButtonListItem
                key={item.id}
                icon={item.icon}
                tooltip={item.tooltip}
                disabled={item.disabled}
                disabledText={item.disabledText}
                className={item.className}
                data-cy={item.id}
                data-tool={item.id}
                data-active={item.isActive}
                onSelect={() => onInteraction?.({ id, itemId: item.id, commands: item.commands })}
              >
                <span className="pl-1">{item.label || item.tooltip || item.id}</span>
              </ToolButtonListItem>
            );
          })}
          <div
            className="border-border w-60 border-t px-3 py-3"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}
          >
            <div className="text-foreground mb-2 flex items-center justify-between text-xs">
              <span>Espesor</span>
              <span className="tabular-nums">{mm} mm</span>
            </div>
            <Slider
              aria-label="Espesor panorámico"
              min={MIN_THICKNESS_MM}
              max={MAX_THICKNESS_MM}
              step={1}
              value={[mm]}
              onValueChange={handleThicknessChange}
              onValueCommit={handleThicknessChange}
            />
            <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
              <span>{MIN_THICKNESS_MM} mm</span>
              <span>{MAX_THICKNESS_MM} mm</span>
            </div>
          </div>
          <div
            className="border-border w-60 border-t px-3 py-3"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-foreground text-xs">Postprocesado</div>
                <div className="text-muted-foreground text-[10px]">Solo visualización</div>
              </div>
              <Switch
                aria-label="Activar postprocesado panorámico"
                checked={postProcessing.enabled}
                onCheckedChange={enabled => applyPostProcessing({ enabled })}
              />
            </div>
            {[
              ['denoise', 'Denoise'],
              ['contrast', 'Contraste'],
              ['sharpen', 'Nitidez'],
            ].map(([key, label]) => (
              <div
                key={key}
                className="mb-3 last:mb-0"
              >
                <div className="text-foreground mb-1 flex justify-between text-[11px]">
                  <span>{label}</span>
                  <span className="tabular-nums">{postProcessing[key]} %</span>
                </div>
                <Slider
                  aria-label={`${label} panorámico`}
                  min={0}
                  max={100}
                  step={1}
                  value={[postProcessing[key]]}
                  disabled={!postProcessing.enabled}
                  onValueChange={value => previewPostProcessing(key, value)}
                  onValueCommit={([value]) => applyPostProcessing({ [key]: value })}
                />
              </div>
            ))}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="border-border text-foreground hover:bg-muted flex-1 rounded border px-2 py-1 text-[10px]"
                onClick={() => applyPostProcessing(PANORAMIC_POST_PROCESSING_ORIGINAL)}
              >
                Original
              </button>
              <button
                type="button"
                className="bg-primary text-primary-foreground flex-1 rounded px-2 py-1 text-[10px]"
                onClick={() => applyPostProcessing(PANORAMIC_POST_PROCESSING_SOFT)}
              >
                Enhance / Suave
              </button>
            </div>
          </div>
        </ToolButtonListDropDown>
      </div>
    </ToolButtonList>
  );
}
