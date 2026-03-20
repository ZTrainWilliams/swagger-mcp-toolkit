/*
 * @Author: ZTrainWilliams ztrian1224@163.com
 * @Date: 2026-03-18 11:27:18
 * @Description: Fetch and persist a Swagger/OpenAPI definition
 */
import logger from '../utils/logger.js';
import axios from 'axios';
import { GetSwaggerParams , SavedSwaggerDefinition } from './core/interfaces.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function buildRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json, application/yaml, text/yaml, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Swagger-MCP/1.0'
  };
  const extra = process.env.SWAGGER_FETCH_HEADERS;
  if (extra) {
    try {
      const parsed = JSON.parse(extra);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') headers[k] = v;
        }
      }
    } catch {}
  }
  const knifeHeader = process.env.KNIFE4J_GATEWAY_REQUEST;
  const knifeCode = process.env.KNIFE4J_GATEWAY_CODE || 'ROOT';
  if (typeof knifeHeader === 'string') {
    headers['knfie4j-gateway-request'] = knifeHeader;
    headers['knfie4j-gateway-code'] = String(knifeCode);
  }
  return headers;
}

function sanitizeFileBaseName(input: string): string {
  const cleaned = input
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'swagger';
  }
  return cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned;
}

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

/**
 * Fetches Swagger definition
 * @param params Parameters including URL and save location
 * @returns The saved Swagger definition information
 */
export const getSwaggerDefinition = async (params: GetSwaggerParams) => {
  try {
    logger.info('Fetching Swagger definition from ' + params.url);
    if (!params.url) {
      throw new Error('URL is required');
    }
    if (!params.saveLocation) {
      throw new Error('Save location is required');
    }
    const mergedHeaders = buildRequestHeaders();
    if (params.headers) {
      for (const [k, v] of Object.entries(params.headers)) {
        if (typeof v === 'string') mergedHeaders[k] = v;
      }
    }
    if (typeof params.gatewayHeader === 'string') {
      mergedHeaders['knfie4j-gateway-request'] = params.gatewayHeader;
      mergedHeaders['knfie4j-gateway-code'] = String(params.gatewayCode || process.env.KNIFE4J_GATEWAY_CODE || 'ROOT');
    }

    const response = await axios.get(params.url, {
      headers: mergedHeaders,
      responseType: 'json',
      validateStatus: (s) => s >= 200 && s < 500
    });
    console.log('getSwaggerDefinition-Response:', response);

    // If the response is not a valid Swagger definition, throw an error
    if (!response.data.openapi && !response.data.swagger) {
      logger.error('Invalid Swagger definition');
      throw new Error('Invalid Swagger definition');
    }

    // If the response is a valid Swagger definition, save it as a hashed filename of the URL
    const url = new URL(params.url);
    const shortHash = crypto.createHash('sha256').update(url.toString()).digest('hex').slice(0, 10);
    const moduleBaseName = typeof params.moduleName === 'string' ? sanitizeFileBaseName(params.moduleName) : '';
    const filenameBase = moduleBaseName ? moduleBaseName : `swagger-${shortHash}`;
    const filename = `${filenameBase}.json`;
    
    // Use the provided save location
    const saveDir = resolveSaveDir(params.saveLocation, params.saveSubFolder);
    const filePath = path.join(saveDir, filename);
    
    // Ensure the directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));

    const savedSwaggerDefinition: SavedSwaggerDefinition = {
      filePath: filePath, // Full path to the saved file
      url: params.url,
      type: response.data.openapi ? 'openapi' : 'swagger'
    };
    // Return the Swagger definition
    return savedSwaggerDefinition;
  } catch (error: any) {
    logger.error(`Swagger API error: ${error.message}`);
    throw new Error(`Failed to fetch Swagger definition from ${params.url}. Swagger API error: ${error.message}`);
  }
};

export default getSwaggerDefinition; 
