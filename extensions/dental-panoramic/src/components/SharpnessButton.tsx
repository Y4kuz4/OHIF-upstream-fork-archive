import React, { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, Slider, ToolButton } from '@ohif/ui-next';
import {
  getPanoramicSharpness,
  MAX_SHARPNESS,
  MIN_SHARPNESS,
  subscribePanoramicSharpness,
} from '../sampler/sharpness';

export default function SharpnessButton(props) {
  const { onInteraction, disabled } = props;
  const [value, setValue] = useState(getPanoramicSharpness);

  useEffect(() => subscribePanoramicSharpness(setValue), []);

  const handleChange = ([next]) => {
    setValue(next);
    onInteraction?.({ itemId: props.id, value: next });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div>
          <ToolButton
            id={props.id}
            icon={props.icon || 'Threshold'}
            label={props.label}
            tooltip={`${props.tooltip || 'Nitidez panorámica'}: ${value}%`}
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
          <span>Nitidez</span>
          <span className="tabular-nums">{value}%</span>
        </div>
        <Slider
          aria-label="Nitidez panorámica"
          min={MIN_SHARPNESS}
          max={MAX_SHARPNESS}
          step={1}
          value={[value]}
          onValueChange={handleChange}
          onValueCommit={handleChange}
        />
        <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
          <span>{MIN_SHARPNESS}%</span>
          <span>{MAX_SHARPNESS}%</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
