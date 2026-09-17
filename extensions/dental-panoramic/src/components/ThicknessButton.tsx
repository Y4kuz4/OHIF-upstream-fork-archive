import React, { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, Slider, ToolButton } from '@ohif/ui-next';
import {
  getPanoramicThicknessMm,
  MAX_THICKNESS_MM,
  MIN_THICKNESS_MM,
  subscribePanoramicThickness,
} from '../sampler/thickness';

export default function ThicknessButton(props) {
  const { onInteraction, disabled } = props;
  const [mm, setMm] = useState(getPanoramicThicknessMm);

  useEffect(() => subscribePanoramicThickness(setMm), []);

  const handleThicknessChange = ([value]) => {
    setMm(value);
    onInteraction?.({
      itemId: props.id,
      value,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div>
          <ToolButton
            id={props.id}
            icon={props.icon || 'tool-stack-scroll'}
            label={props.label}
            tooltip={`${props.tooltip || 'Espesor de la capa panorámica'}: ${mm} mm`}
            disabled={disabled}
            size="default"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="w-56 p-3"
      >
        <div className="text-foreground mb-2 flex items-center justify-between text-xs">
          <span>Espesor</span>
          <span className="tabular-nums">{mm} mm</span>
        </div>
        <Slider
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
      </PopoverContent>
    </Popover>
  );
}
