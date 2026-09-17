import { addTool } from '@cornerstonejs/tools';
import PanoramicCurveTool from './tools/PanoramicCurveTool';

export default function init() {
  PanoramicCurveTool.isAnnotation = false;
  addTool(PanoramicCurveTool);
}
