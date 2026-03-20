/**
 * Tools index file
 * Exports all tool definitions and implementations
 */

import { getSwaggerDefinition } from './getSwaggerDefinition.js';
import { listEndpoints } from './listEndpoints.js';
import { listEndpointModels } from './listEndpointModels.js';
import { generateModelCode } from './generateModelCode.js';
import { generateEndpointToolCode } from './generateEndpointToolCode.js';
import { listSwaggerResources, saveSwaggerResources } from './listSwaggerResources.js';
import { version } from './version.js';

// Tool definitions array
export const toolDefinitions = [
  listSwaggerResources,
  saveSwaggerResources,
  generateEndpointToolCode,
  generateModelCode,
  listEndpointModels,
  listEndpoints,
  getSwaggerDefinition,
  version
];

// Export all tool handlers
export { handleGetSwaggerDefinition } from './getSwaggerDefinition.js';
export { handleListEndpoints } from './listEndpoints.js';
export { handleListEndpointModels } from './listEndpointModels.js';
export { handleGenerateModelCode } from './generateModelCode.js';
export { handleGenerateEndpointToolCode } from './generateEndpointToolCode.js';
export { handleVersion } from './version.js';
export { handleListSwaggerResources } from './listSwaggerResources.js';
export { handleSaveSwaggerResources } from './listSwaggerResources.js';
