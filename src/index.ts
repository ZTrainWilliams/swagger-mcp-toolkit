import dotenv from 'dotenv';
import minimist from 'minimist';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// Load environment variables from .env file
dotenv.config();

import logger from "./utils/logger.js";

// Helper to sanitize log output (removes newlines and control chars)
function sanitizeForLog(input: string): string {
  return input.replace(/[\r\n\x00-\x1F\x7F]+/g, '');
}

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const swaggerUrlFromCLI = argv['swagger-url'] || argv.swaggerUrl || null;
const swaggerHeadersFromCLI = argv['swagger-headers'] || argv.swaggerHeaders || null;
const gatewayHeaderFromCLI = argv['gateway-header'] || argv.gatewayHeader || argv['knfie4j-header'] || argv.knfie4jHeader || null;
const gatewayCodeFromCLI = argv['gateway-code'] || argv.gatewayCode || null;

// Store swagger URL in a way accessible to other modules
if (swaggerUrlFromCLI) {
  let isValidUrl = false;
  try {
    // Throws if not a valid URL
    new URL(swaggerUrlFromCLI);
    isValidUrl = true;
  } catch (e) {
    logger.warn(`Invalid swagger-url provided via CLI: ${sanitizeForLog(swaggerUrlFromCLI)}`);
  }
  if (isValidUrl) {
    process.env.SWAGGER_URL_FROM_CLI = swaggerUrlFromCLI;
    logger.info(`Swagger URL from CLI: ${sanitizeForLog(swaggerUrlFromCLI)}`);
  }
}

// Store swagger headers for downstream fetch
if (swaggerHeadersFromCLI) {
  let stored = false;
  const text = String(swaggerHeadersFromCLI).trim();
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        process.env.SWAGGER_FETCH_HEADERS = JSON.stringify(parsed);
        const keys = Object.keys(parsed).join(',');
        logger.info(`Swagger headers from CLI keys: ${sanitizeForLog(keys)}`);
        stored = true;
      }
    } catch {}
  }
  if (!stored) {
    const obj: Record<string, string> = {};
    obj['knfie4j-gateway-request'] = text;
    obj['knfie4j-gateway-code'] = 'ROOT';
    process.env.SWAGGER_FETCH_HEADERS = JSON.stringify(obj);
    logger.info(`Swagger headers from CLI keys: knfie4j-gateway-request,knfie4j-gateway-code`);
    process.env.KNIFE4J_GATEWAY_REQUEST = text;
    process.env.KNIFE4J_GATEWAY_CODE = 'ROOT';
  }
}

// Store gateway headers for downstream fetch
if (gatewayHeaderFromCLI) {
  const codeVal = String(gatewayCodeFromCLI ?? 'ROOT');
  const obj: Record<string, string> = {};
  obj['knfie4j-gateway-request'] = String(gatewayHeaderFromCLI);
  obj['knfie4j-gateway-code'] = codeVal;
  process.env.SWAGGER_FETCH_HEADERS = JSON.stringify(obj);
  logger.info(`Gateway headers from CLI keys: knfie4j-gateway-request,knfie4j-gateway-code`);
  process.env.KNIFE4J_GATEWAY_REQUEST = String(gatewayHeaderFromCLI);
  process.env.KNIFE4J_GATEWAY_CODE = codeVal;
}

// Import tool definitions and handlers
import {
  toolDefinitions,
  handleGetSwaggerDefinition,
  handleListEndpoints,
  handleListEndpointModels,
  handleGenerateModelCode,
  handleGenerateEndpointToolCode,
  handleVersion,
  handleListSwaggerResources,
  handleSaveSwaggerResources
} from "./tools/index.js";

// Import prompt definitions and handlers
import { promptDefinitions, promptHandlers } from "./prompts/index.js";

// Create MCP server
const server = new Server(
  {
    name: 'Swagger MCP Server',
    description: 'A server that helps you build a MCP wrapper around your Swagger API',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {}
    },
  }
);

/**
 * Handler that lists available tools.
 * Exposes tools for interacting with Swagger API.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefinitions
  };
});

/**
 * Handler that lists available prompts.
 * Exposes prompts for guiding through common workflows.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: promptDefinitions
  };
});

/**
 * Handler for getting a specific prompt.
 * Returns the prompt template with messages.
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  try {
    const promptName = request.params.name;
    const promptArgs = request.params.arguments || {};

    logger.info(`Prompt request received: ${promptName}`);
    logger.info(`Prompt arguments: ${JSON.stringify(promptArgs)}`);

    const promptHandler = promptHandlers[promptName];

    if (!promptHandler) {
      return {
        error: {
          code: -32601,
          message: `Unknown prompt: ${promptName}`
        }
      };
    }

    // Validate arguments against schema
    const validationResult = promptHandler.schema.safeParse(promptArgs);
    if (!validationResult.success) {
      return {
        error: {
          code: -32602,
          message: `Invalid arguments: ${validationResult.error.message}`
        }
      };
    }

    // Call the prompt handler
    const result = await promptHandler.handler(promptArgs);
    return result;
  } catch (error: any) {
    logger.error(`MCP prompt error: ${error.message}`);
    throw new Error(`Prompt execution failed: ${error.message}`);
  }
});

/**
 * Handler for tool calls.
 * Processes requests to call Swagger API tools.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    logger.info(`Tool call received: ${request.params.name}`);
    logger.info(`Tool arguments: ${JSON.stringify(request.params.arguments || {})}`);

    const name = request.params.name;
    const input = request.params.arguments;
    console.log('CallToolRequestSchema', request, input);

    switch (name) {
      case "getSwaggerDefinition":
        return await handleGetSwaggerDefinition(input);

      case "listSwaggerResources":
        return await handleListSwaggerResources(input);

      case "saveSwaggerResources":
        return await handleSaveSwaggerResources(input);

      case "listEndpoints":
        return await handleListEndpoints(input);

      case "listEndpointModels":
        return await handleListEndpointModels(input);

      case "generateModelCode":
        return await handleGenerateModelCode(input);

      case "generateEndpointToolCode":
        return await handleGenerateEndpointToolCode(input);

      case "version":
        return await handleVersion(input);

      default:
        return {
          content: [{
            type: "text",
            text: `Unknown tool: ${name}`
          }]
        };
    }
  } catch (error: any) {
    logger.error(`MCP tool error: ${error.message}`);
    throw new Error(`Tool execution failed: ${error.message}`);
  }
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  // Connect using stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Server error:", error);
  process.exit(1);
});
