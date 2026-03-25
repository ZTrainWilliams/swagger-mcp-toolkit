/*
 * @Author: ZTrianWilliams ztrain1224@163.com
 * @Date: 2026-03-18 11:27:18
 * @Description: 
 */
export interface GetSwaggerParams {
    // String parameters
    url: string;
    saveLocation: string; // Required parameter for where to save the Swagger file
    headers?: Record<string, string>;
    query?: Record<string, any>;
    bearerToken?: string;
    cookie?: string;
    basicAuth?: { username: string; password: string };
    timeoutMs?: number;
    gatewayHeader?: string;
    gatewayCode?: string;
    moduleName?: string;
    saveSubFolder?: string;
}

export interface SavedSwaggerDefinition {
    filePath: string; // Full path to the saved file
    url: string;
    type: string;
}
