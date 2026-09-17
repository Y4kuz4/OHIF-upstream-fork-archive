import { id } from './id';
import init from './init';
import getCommandsModule from './getCommandsModule';
import getToolbarModule from './getToolbarModule';
import dentalPanoramicCustomization from './getCustomizationModule';

export default {
  id,
  preRegistration: init,
  getCommandsModule,
  getToolbarModule,
  getCustomizationModule() {
    return [
      {
        name: 'default',
        value: dentalPanoramicCustomization,
      },
    ];
  },
};

export { id };
