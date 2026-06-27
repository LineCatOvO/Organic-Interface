/**
 * MCPClient - Model Context Protocol client implementation
 *
 * Supports stdio and HTTP transports for MCP server communication.
 */
import { spawn as spawnProc } from 'child_process';
import type {
  MCPClientConfig,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPCallToolResult,
  MCPListToolsResult,
  MCPListResourcesResult,
  MCPReadResourceResult,
} from './MCPTypes.js';

/** Transport interface for sending/receiving JSON-RPC messages */
interface MCPTransport {
  send(message: JSONRPCRequest): Promise<void>;
  onMessage(handler: (msg: JSONRPCResponse) => void): void;
  close(): void;
}

/** MCPClient - connects to MCP servers via stdio or HTTP */
export class MCPClient {
  private config: MCPClientConfig;
  private transport: MCPTransport | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number | string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  constructor(config: MCPClientConfig) {
    this.config = { ...config };
  }

  /** Connect to the MCP server */
  async connect(): Promise<void> {
    if (this.transport) {
      throw new Error('Already connected');
    }
    this.transport = this.createTransport(this.config);
    this.transport.onMessage(msg => this.handleResponse(msg));
  }

  /** List available tools from the MCP server */
  async listTools(): Promise<MCPListToolsResult> {
    return this.sendRequest('tools/list') as Promise<MCPListToolsResult>;
  }

  /** Call a tool on the MCP server */
  async callTool(
    name: string,
    args?: Record<string, unknown>
  ): Promise<MCPCallToolResult> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args ?? {},
    }) as Promise<MCPCallToolResult>;
  }

  /** List available resources from the MCP server */
  async listResources(): Promise<MCPListResourcesResult> {
    return this.sendRequest(
      'resources/list'
    ) as Promise<MCPListResourcesResult>;
  }

  /** Read a resource from the MCP server */
  async readResource(uri: string): Promise<MCPReadResourceResult> {
    return this.sendRequest('resources/read', {
      uri,
    }) as Promise<MCPReadResourceResult>;
  }

  /** Disconnect from the MCP server */
  disconnect(): void {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Client disconnected'));
    });
    this.pendingRequests.clear();
  }

  /** Send a JSON-RPC request and wait for response */
  private sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.transport) {
      return Promise.reject(new Error('Not connected'));
    }
    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params ? { params } : {}),
    };
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.transport!.send(request).catch(reject);
    });
  }

  /** Handle incoming JSON-RPC response */
  private handleResponse(msg: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;
    this.pendingRequests.delete(msg.id);
    if (msg.error) {
      pending.reject(
        new Error(`MCP Error ${msg.error.code}: ${msg.error.message}`)
      );
    } else {
      pending.resolve(msg.result);
    }
  }

  /** Create transport based on config */
  private createTransport(config: MCPClientConfig): MCPTransport {
    switch (config.transport) {
      case 'stdio':
        return this.createStdioTransport(config);
      case 'http':
        return this.createHttpTransport(config);
      default:
        throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }

  /** Create stdio-based transport using child process */
  private createStdioTransport(config: MCPClientConfig): MCPTransport {
    const child = spawnProc(config.command!, config.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const messageHandlers: Array<(msg: JSONRPCResponse) => void> = [];
    let buffer = '';
    child.stdout!.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as JSONRPCResponse;
        messageHandlers.forEach(h => h(msg));
      }
    });
    return {
      send: async (msg: JSONRPCRequest) => {
        child.stdin!.write(JSON.stringify(msg) + '\n');
      },
      onMessage: (handler: (msg: JSONRPCResponse) => void) => {
        messageHandlers.push(handler);
      },
      close: () => { child.kill(); },
    };
  }

  /** Create HTTP-based transport using fetch */
  private createHttpTransport(config: MCPClientConfig): MCPTransport {
    const url = config.url!;
    const messageHandlers: Array<(msg: JSONRPCResponse) => void> = [];
    return {
      send: async (msg: JSONRPCRequest) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
          },
          body: JSON.stringify(msg),
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        const json = (await resp.json()) as JSONRPCResponse;
        messageHandlers.forEach(h => h(json));
      },
      onMessage: (handler: (msg: JSONRPCResponse) => void) => {
        messageHandlers.push(handler);
      },
      close: () => { /* HTTP transport has no persistent connection */ },
    };
  }
}