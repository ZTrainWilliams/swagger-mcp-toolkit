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
import { buildSwaggerRequestConfig, pickSwaggerRequestOptions } from '../utils/swaggerLoader.js';

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
    const requestConfig = buildSwaggerRequestConfig(pickSwaggerRequestOptions(params));

    const response = await axios.get(params.url, {
      ...requestConfig,
      responseType: 'json',
      validateStatus: (s) => s >= 200 && s < 500
    });

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
