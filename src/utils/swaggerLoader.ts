/**
 * Swagger Loader Utility
 * Loads Swagger definition from SWAGGER_URL environment variable
 * Downloads and caches the file if needed
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import crypto from 'crypto';
import yaml from 'js-yaml';
import logger from './logger.js';

// Load environment variables
dotenv.config();

export interface SwaggerBasicAuth {
    username: string;
    password: string;
}

export interface SwaggerRequestOptions {
    headers?: Record<string, string>;
    query?: Record<string, any>;
    bearerToken?: string;
    cookie?: string;
    basicAuth?: SwaggerBasicAuth;
    gatewayHeader?: string;
    gatewayCode?: string;
    timeoutMs?: number;
}

export function pickSwaggerRequestOptions(input: unknown): SwaggerRequestOptions {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {};
    }
    const obj = input as Record<string, unknown>;
    const out: SwaggerRequestOptions = {};

    if (obj.headers && typeof obj.headers === 'object' && !Array.isArray(obj.headers)) {
        out.headers = obj.headers as Record<string, string>;
    }
    if (obj.query && typeof obj.query === 'object' && !Array.isArray(obj.query)) {
        out.query = obj.query as Record<string, any>;
    }
    if (typeof obj.bearerToken === 'string' && obj.bearerToken) {
        out.bearerToken = obj.bearerToken;
    }
    if (typeof obj.cookie === 'string' && obj.cookie) {
        out.cookie = obj.cookie;
    }
    if (obj.basicAuth && typeof obj.basicAuth === 'object' && !Array.isArray(obj.basicAuth)) {
        const a = obj.basicAuth as Record<string, unknown>;
        if (typeof a.username === 'string' && typeof a.password === 'string' && a.username && a.password) {
            out.basicAuth = { username: a.username, password: a.password };
        }
    }
    if (typeof obj.gatewayHeader === 'string' && obj.gatewayHeader) {
        out.gatewayHeader = obj.gatewayHeader;
    }
    if (typeof obj.gatewayCode === 'string' && obj.gatewayCode) {
        out.gatewayCode = obj.gatewayCode;
    }
    if (typeof obj.timeoutMs === 'number' && Number.isFinite(obj.timeoutMs) && obj.timeoutMs > 0) {
        out.timeoutMs = obj.timeoutMs;
    }

    return out;
}

// Cache directory for swagger files
const SWAGGER_CACHE_DIR = path.join(process.cwd(), 'swagger-cache');

// Ensure cache directory exists (handle race conditions safely)
try {
    fs.mkdirSync(SWAGGER_CACHE_DIR, { recursive: true });
} catch (err: any) {
    if (err.code !== 'EEXIST') {
        throw err;
    }
}

/**
 * Gets the Swagger URL from CLI argument (highest priority)
 * @returns The Swagger URL or null if not set
 */
export function getSwaggerUrlFromCLI(): string | null {
    const url = process.env.SWAGGER_URL_FROM_CLI;
    if (!url) {
        return null;
    }
    return url.trim();
}

function parseJsonObject(value: unknown): Record<string, any> | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim();
    if (!text) {
        return null;
    }
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        return parsed as Record<string, any>;
    } catch {
        return null;
    }
}

function coerceStringRecord(input: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return out;
    }
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        if (typeof v === 'string') {
            out[k] = v;
        } else if (typeof v === 'number' || typeof v === 'boolean') {
            out[k] = String(v);
        }
    }
    return out;
}

function readEnvTimeoutMs(): number | undefined {
    const raw = process.env.SWAGGER_FETCH_TIMEOUT_MS;
    if (!raw) {
        return undefined;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}

function readEnvBasicAuth(): SwaggerBasicAuth | undefined {
    const username = process.env.SWAGGER_FETCH_BASIC_USER;
    const password = process.env.SWAGGER_FETCH_BASIC_PASS;
    if (typeof username !== 'string' || typeof password !== 'string') {
        return undefined;
    }
    if (!username.trim() || !password.trim()) {
        return undefined;
    }
    return { username, password };
}

export function buildSwaggerRequestConfig(options?: SwaggerRequestOptions): {
    headers: Record<string, string>;
    params?: Record<string, any>;
    timeout?: number;
    auth?: SwaggerBasicAuth;
} {
    const headers: Record<string, string> = {
        Accept: 'application/json, application/yaml, text/yaml, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Swagger-MCP/1.0'
    };

    const envHeaders = parseJsonObject(process.env.SWAGGER_FETCH_HEADERS);
    Object.assign(headers, coerceStringRecord(envHeaders));

    const knifeHeader = process.env.KNIFE4J_GATEWAY_REQUEST;
    const knifeCode = process.env.KNIFE4J_GATEWAY_CODE || 'ROOT';
    if (typeof knifeHeader === 'string' && knifeHeader) {
        headers['knfie4j-gateway-request'] = knifeHeader;
        headers['knfie4j-gateway-code'] = String(knifeCode);
    }

    const bearerFromEnv = process.env.SWAGGER_FETCH_BEARER_TOKEN;
    if (typeof bearerFromEnv === 'string' && bearerFromEnv.trim() && !headers.Authorization) {
        headers.Authorization = bearerFromEnv.startsWith('Bearer ') ? bearerFromEnv : `Bearer ${bearerFromEnv}`;
    }

    const cookieFromEnv = process.env.SWAGGER_FETCH_COOKIE;
    if (typeof cookieFromEnv === 'string' && cookieFromEnv.trim() && !headers.Cookie) {
        headers.Cookie = cookieFromEnv;
    }

    if (options?.bearerToken && !headers.Authorization) {
        headers.Authorization = options.bearerToken.startsWith('Bearer ') ? options.bearerToken : `Bearer ${options.bearerToken}`;
    }

    if (options?.cookie && !headers.Cookie) {
        headers.Cookie = options.cookie;
    }

    if (options?.headers) {
        Object.assign(headers, coerceStringRecord(options.headers));
    }

    if (typeof options?.gatewayHeader === 'string' && options.gatewayHeader) {
        headers['knfie4j-gateway-request'] = options.gatewayHeader;
        headers['knfie4j-gateway-code'] = String(options.gatewayCode || process.env.KNIFE4J_GATEWAY_CODE || 'ROOT');
    }

    const envQuery = parseJsonObject(process.env.SWAGGER_FETCH_QUERY);
    const params = {
        ...(envQuery || {}),
        ...(options?.query || {})
    };

    const timeout = typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? options.timeoutMs
        : readEnvTimeoutMs();

    const auth = options?.basicAuth ?? readEnvBasicAuth();

    const config: {
        headers: Record<string, string>;
        params?: Record<string, any>;
        timeout?: number;
        auth?: SwaggerBasicAuth;
    } = { headers };

    if (Object.keys(params).length) {
        config.params = params;
    }
    if (timeout) {
        config.timeout = timeout;
    }
    if (auth) {
        config.auth = auth;
    }

    return config;
}

/**
 * Gets the cached Swagger file path for a given URL if it exists
 * @param swaggerUrl The Swagger URL
 * @returns The cached file path or null if not cached
 */
function getCachedSwaggerFilePath(swaggerUrl: string): string | null {
    const urlObj = new URL(swaggerUrl);
    const filename = crypto.createHash('sha256').update(urlObj.toString()).digest('hex');
    const cacheFilePath = path.join(SWAGGER_CACHE_DIR, `${filename}.json`);
    const cacheFilePathYaml = path.join(SWAGGER_CACHE_DIR, `${filename}.yaml`);

    // Check if cached file exists
    if (fs.existsSync(cacheFilePath)) {
        return cacheFilePath;
    } else if (fs.existsSync(cacheFilePathYaml)) {
        return cacheFilePathYaml;
    }

    return null;
}


/**
 * Downloads and caches a Swagger file from URL
 * Handles both JSON and YAML formats
 * @param url The Swagger URL
 * @returns The path to the cached file
 */
async function downloadAndCacheSwagger(url: string): Promise<string> {
    try {
        logger.info(`Downloading Swagger definition from ${url}`);

        const requestConfig = buildSwaggerRequestConfig();
        const response = await axios.get(url, {
            ...requestConfig,
            responseType: 'text'
        });

        // Try to parse as JSON first, then YAML if JSON fails
        let swaggerData: any;
        let isYaml = false;
        try {
            swaggerData = JSON.parse(response.data);
        } catch (jsonErr) {
            try {
                swaggerData = yaml.load(response.data);
                isYaml = true;
            } catch (yamlErr) {
                throw new Error('Response is neither valid JSON nor valid YAML');
            }
        }
        if (!swaggerData.openapi && !swaggerData.swagger) {
            throw new Error('Invalid Swagger definition: missing required "openapi" or "swagger" field');
        }

        // Generate cache filename based on URL hash
        const urlObj = new URL(url);
        const filename = crypto.createHash('sha256').update(urlObj.toString()).digest('hex');
        const fileExtension = isYaml ? '.yaml' : '.json';
        const filePath = path.join(SWAGGER_CACHE_DIR, `${filename}${fileExtension}`);

        // Save the file
        if (isYaml) {
            fs.writeFileSync(filePath, response.data, 'utf8');
        } else {
            fs.writeFileSync(filePath, JSON.stringify(swaggerData, null, 2), 'utf8');
        }

        logger.info(`Swagger definition cached at ${filePath}`);
        return filePath;
    } catch (error: any) {
        logger.error(`Failed to download Swagger definition: ${error.message}`);
        throw new Error(`Failed to download Swagger definition from ${url}: ${error.message}`);
    }
}

/**
 * Loads Swagger definition from file path
 * @param swaggerFilePath Path to the Swagger file
 * @returns The Swagger definition object
 */
export async function loadSwaggerDefinitionFromFile(swaggerFilePath: string): Promise<any> {
    if (!fs.existsSync(swaggerFilePath)) {
        throw new Error(`Swagger file not found at ${swaggerFilePath}`);
    }

    logger.info(`Reading Swagger definition from ${swaggerFilePath}`);
    const swaggerContent = fs.readFileSync(swaggerFilePath, 'utf8');

    // Parse based on file extension
    if (swaggerFilePath.endsWith('.yml') || swaggerFilePath.endsWith('.yaml')) {
        return yaml.load(swaggerContent);
    } else {
        return JSON.parse(swaggerContent);
    }
}

/**
 * Loads Swagger definition content from URL or cache
 * Priority: CLI --swagger-url > swaggerFilePath parameter
 * @param swaggerFilePath Optional file path to Swagger file (used if no CLI arg)
 * @returns The Swagger definition object
 */
export async function loadSwaggerDefinition(swaggerFilePath?: string): Promise<any> {
    // Check CLI argument first (highest priority)
    const swaggerUrlFromCLI = getSwaggerUrlFromCLI();

    if (swaggerUrlFromCLI) {
        logger.info(`Using Swagger URL from CLI: ${swaggerUrlFromCLI}`);
        return await loadSwaggerDefinitionFromUrl(swaggerUrlFromCLI);
    }

    // Check swaggerFilePath parameter (fallback)
    if (swaggerFilePath) {
        logger.info(`Using Swagger file path: ${swaggerFilePath}`);
        return await loadSwaggerDefinitionFromFile(swaggerFilePath);
    }

    // If none provided, throw error
    throw new Error('Swagger URL or file path is required. Provide --swagger-url=<url> as CLI argument, or swaggerFilePath parameter.');
}

/**
 * Loads Swagger definition from URL (downloads and caches if needed)
 * @param swaggerUrl The Swagger URL
 * @returns The Swagger definition object
 */
async function loadSwaggerDefinitionFromUrl(swaggerUrl: string): Promise<any> {
    // Check if cached file exists using shared helper
    let cachedFilePath = getCachedSwaggerFilePath(swaggerUrl);
    // If not cached, download it
    if (!cachedFilePath) {
        logger.info(`Swagger definition not found in cache, downloading from ${swaggerUrl}`);
        cachedFilePath = await downloadAndCacheSwagger(swaggerUrl);
    } else {
        logger.info(`Using cached Swagger definition from ${cachedFilePath}`);
    }

    // Read and parse the file
    return await loadSwaggerDefinitionFromFile(cachedFilePath);
}

/**
 * Gets the cached file path for the Swagger definition
 * Downloads it if not cached
 * Priority: CLI --swagger-url > swaggerFilePath parameter
 * @param swaggerFilePath Optional file path to Swagger file (used if no CLI arg)
 * @returns The path to the Swagger file
 */
export async function getSwaggerFilePath(swaggerFilePath?: string): Promise<string> {
    // Check CLI argument first (highest priority)
    const swaggerUrlFromCLI = getSwaggerUrlFromCLI();

    if (swaggerUrlFromCLI) {
        // Generate cache filename based on URL hash
        const urlObj = new URL(swaggerUrlFromCLI);
        const filename = crypto.createHash('sha256').update(urlObj.toString()).digest('hex');
        const cacheFilePath = path.join(SWAGGER_CACHE_DIR, `${filename}.json`);
        const cacheFilePathYaml = path.join(SWAGGER_CACHE_DIR, `${filename}.yaml`);

        // Check if cached file exists
        if (fs.existsSync(cacheFilePath)) {
            return cacheFilePath;
        } else if (fs.existsSync(cacheFilePathYaml)) {
            return cacheFilePathYaml;
        }

        // If not cached, download it
        logger.info(`Swagger definition not found in cache, downloading from ${swaggerUrlFromCLI}`);
        return await downloadAndCacheSwagger(swaggerUrlFromCLI);
    }

    // Check swaggerFilePath parameter (fallback)
    if (swaggerFilePath) {
        if (!fs.existsSync(swaggerFilePath)) {
            throw new Error(`Swagger file not found at ${swaggerFilePath}`);
        }
        return swaggerFilePath;
    }

    // If none provided, throw error
    throw new Error('Swagger URL or file path is required. Provide --swagger-url=<url> as CLI argument, or swaggerFilePath parameter.');
}

