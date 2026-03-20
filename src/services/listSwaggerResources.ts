/*
 * @Author: ZTrainWilliams ztrian1224@163.com
 * @Date: 2026-03-19 16:12:01
 * @Description: 
 */
import axios from 'axios';

export interface ListSwaggerResourcesParams {
  baseUrl?: string;
  suffix?: string;
  headers?: Record<string, string>;
  gatewayHeader?: string;
  gatewayCode?: string;
}

export interface SwaggerResourceItem {
  name: string;
  header?: string;
  location: string;
  swaggerVersion?: string;
  fullUrl: string;
  recommendedHeaders?: Record<string, string>;
}

function getBaseUrl(params?: ListSwaggerResourcesParams): string {
  const provided = typeof params?.baseUrl === 'string' ? params.baseUrl : '';
  const candidate = provided.trim() || String(process.env.SWAGGER_URL_FROM_CLI || '').trim();
  if (!candidate) {
    throw new Error('baseUrl is required unless server is started with --swagger-url');
  }
  const u = new URL(candidate);
  return u.origin;
}


export async function listSwaggerResources(params: ListSwaggerResourcesParams): Promise<SwaggerResourceItem[]> {
  const base = getBaseUrl(params).replace(/\/+$/, '');
  const suf = (params.suffix ?? '/swagger-resources').replace(/^\/?/, '/');
  const url = base + suf;

  const res = await axios.get(url);
  console.log('listSwaggerResources response:', res);
  const data = Array.isArray(res.data) ? res.data : [];
  const items: SwaggerResourceItem[] = data.map((it: any) => {
    const loc = String(it.location || '');
    const fullUrl = base + (loc.startsWith('/') ? loc : '/' + loc);
    const rec: Record<string, string> = {};
    if (typeof it.header === 'string' && it.header) {
      rec['knfie4j-gateway-request'] = it.header;
      rec['knfie4j-gateway-code'] = 'ROOT';
    }
    return {
      name: String(it.name || ''),
      header: typeof it.header === 'string' ? it.header : undefined,
      location: loc,
      swaggerVersion: typeof it.swaggerVersion === 'string' ? it.swaggerVersion : undefined,
      fullUrl,
      recommendedHeaders: Object.keys(rec).length ? rec : undefined
    };
  });
  return items;
}

export default {
  listSwaggerResources
};
