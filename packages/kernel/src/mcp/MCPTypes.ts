/**
 * MCP Protocol Types - JSON-RPC 2.0, Tool/Resource definitions
 */

/** JSON-RPC 2.0 request */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: JSONRPCError;
}

/** JSON-RPC 2.0 error object */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/** JSON-RPC 2.0 notification (no id) */
export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/** MCP tool input schema (JSON Schema subset) */
export interface MCPToolInputSchema {
  type: 'object';
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
  }>;
  required?: string[];
}

/** MCP tool definition */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchema;
}

/** MCP resource definition */
export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** MCP transport type */
export type MCPTransportType = 'stdio' | 'http';

/** MCP client configuration */
export interface MCPClientConfig {
  transport: MCPTransportType;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
}

/** MCP call tool result */
export interface MCPCallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/** MCP list tools result */
export interface MCPListToolsResult {
  tools: MCPToolDefinition[];
}

/** MCP list resources result */
export interface MCPListResourcesResult {
  resources: MCPResourceDefinition[];
}

/** MCP read resource result */
export interface MCPReadResourceResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

/** Standard JSON-RPC error codes */
export const MCPErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;