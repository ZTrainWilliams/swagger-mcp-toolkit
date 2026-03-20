export interface GetSwaggerParams {
    // String parameters
    url: string;
    saveLocation: string; // Required parameter for where to save the Swagger file
    headers?: Record<string, string>;
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
