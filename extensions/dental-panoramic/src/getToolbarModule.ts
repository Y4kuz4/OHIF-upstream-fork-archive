import PanoramicCurveTool from './tools/PanoramicCurveTool';
import ThicknessButton from './components/ThicknessButton';

export default function getToolbarModule({ servicesManager }: withAppTypes) {
  const { toolGroupService } = servicesManager.services;
  const toolName = PanoramicCurveTool.toolName;

  const getCurveModeState = () => {
    const ids = toolGroupService.getToolGroupIds?.() ?? [];
    let hasTool = false;
    for (const id of ids) {
      const toolGroup = toolGroupService.getToolGroup(id);
      if (!toolGroup?.hasTool(toolName)) {
        continue;
      }
      hasTool = true;
      if (toolGroup.getActivePrimaryMouseButtonTool() === toolName) {
        return {
          disabled: false,
          isPrimary: true,
          editMode: !!toolGroup.getToolConfiguration(toolName)?.editMode,
        };
      }
    }
    if (!hasTool) {
      return { disabled: true, disabledText: 'No disponible en este viewport' };
    }
    return { disabled: false, isPrimary: false, editMode: false };
  };

  return [
    {
      name: 'evaluate.dentalPanoramic.draw',
      evaluate: () => {
        const state = getCurveModeState();
        if (state.disabled) {
          return state;
        }
        return {
          disabled: false,
          isActive: state.isPrimary && !state.editMode,
        };
      },
    },
    {
      name: 'evaluate.dentalPanoramic.edit',
      evaluate: () => {
        const state = getCurveModeState();
        if (state.disabled) {
          return state;
        }
        return {
          disabled: false,
          isActive: state.isPrimary && state.editMode,
        };
      },
    },
    {
      name: 'dentalPanoramic.thicknessButton',
      defaultComponent: ThicknessButton,
    },
  ];
}
