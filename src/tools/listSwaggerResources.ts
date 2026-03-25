/*
 * @Author: ZTrainWilliams ztrian1224@163.com
 * @Date: 2026-03-19 16:12:27
 * @Description: List and persist Knife4j swagger-resources
 */
import logger from "../utils/logger.js";
import swaggerService from "../services/index.js";
import fs from "fs";
import path from "path";

const swaggerRequestProps = {
  headers: {
    type: "object",
    description: "Additional request headers"
  },
  query: {
    type: "object",
    description: "Optional query parameters appended to the URL when fetching swagger-resources"
  },
  bearerToken: {
    type: "string",
    description: "Optional bearer token. If provided, will send Authorization: Bearer <token> unless Authorization already exists in headers."
  },
  cookie: {
    type: "string",
    description: "Optional Cookie header value"
  },
  basicAuth: {
    type: "object",
    description: "Optional HTTP Basic Auth credentials",
    properties: {
      username: { type: "string", description: "Basic auth username" },
      password: { type: "string", description: "Basic auth password" }
    }
  },
  timeoutMs: {
    type: "number",
    description: "Optional request timeout in milliseconds"
  },
  gatewayHeader: {
    type: "string",
    description: "knfie4j-gateway-request header value (optional)"
  },
  gatewayCode: {
    type: "string",
    description: "knfie4j-gateway-code header value (default: ROOT)"
  }
};

const swaggerResourcesCommonProps = {
  baseUrl: {
    type: "string",
    description: "Optional base URL (origin), e.g. http://host:port. If omitted, uses the origin of CLI --swagger-url."
  },
  suffix: {
    type: "string",
    description: "swagger-resources path suffix (default: /swagger-resources)"
  },
  ...swaggerRequestProps
};

export const listSwaggerResources = {
  name: "listSwaggerResources",
  description: "Fetches Knife4j swagger-resources and returns selectable modules with headers and full docs URLs. If the user is asking for a 'directory/dropdown/first-level options', prefer using saveSwaggerResources instead to reduce follow-up questions by saving the list to a file. If baseUrl is omitted, uses the server CLI --swagger-url origin.",
  inputSchema: {
    type: "object",
    properties: {
      ...swaggerResourcesCommonProps
    },
    required: []
  }
};

export const saveSwaggerResources = {
  name: "saveSwaggerResources",
  description: "Fetches Knife4j swagger-resources and saves them as a JSON file for later selection. Use this tool when the user asks for a Swagger module directory/list, dropdown options, or first-level module selection. If baseUrl is omitted, uses the origin of CLI --swagger-url. Writes under saveLocation/(saveSubFolder or default swagger-mcp-toolkit). Returns the saved filePath and item count.",
  inputSchema: {
    type: "object",
    properties: {
      ...swaggerResourcesCommonProps,
      saveLocation: {
        type: "string",
        description: "Base directory to save the swagger-resources JSON file"
      },
      saveSubFolder: {
        type: "string",
        description: "Optional subfolder under saveLocation; created if missing (default: swagger-mcp-toolkit)"
      },
      fileName: {
        type: "string",
        description: "Output file name (default: swagger-resources.json)"
      }
    },
    required: ["saveLocation"]
  }
};

function resolveSaveDir(saveLocation: string, saveSubFolder?: string): string {
  const defaultFolder = 'swagger-mcp-toolkit';
  const effectiveSubFolder = typeof saveSubFolder === 'string' && saveSubFolder.trim() ? saveSubFolder : defaultFolder;
  const normalized = effectiveSubFolder.replace(/\\/g, '/').trim();
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return path.join(saveLocation, defaultFolder);
  }
  const parts = normalized.split('/').filter(Boolean);
  if (parts.some((p) => p === '..')) {
    return path.join(saveLocation, defaultFolder);
  }
  return path.join(saveLocation, ...parts);
}

export async function handleListSwaggerResources(input: any) {
  logger.info('Calling swaggerService.listSwaggerResources()');
  logger.info(`Input keys: ${Object.keys(input || {}).join(',')}`);
  try {
    const items = await swaggerService.listSwaggerResources(input);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(items, null, 2)
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error retrieving swagger-resources: ${error.message}`
      }]
    };
  }
}

export async function handleSaveSwaggerResources(input: any) {
  logger.info('Calling swaggerService.listSwaggerResources() for save');
  logger.info(`Input keys: ${Object.keys(input || {}).join(',')}`);
  try {
    const items = await swaggerService.listSwaggerResources(input);
    const fileName = typeof input.fileName === 'string' && input.fileName.trim() ? input.fileName.trim() : 'swagger-resources.json';
    const saveDir = resolveSaveDir(String(input.saveLocation), input.saveSubFolder);
    const filePath = path.join(saveDir, fileName);

    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ filePath, count: items.length }, null, 2)
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error saving swagger-resources: ${error.message}`
      }]
    };
  }
}
