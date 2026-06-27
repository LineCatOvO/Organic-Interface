/**
 * MCPClient Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPClient } from '../MCPClient.js';
import { MCPErrorCodes } from '../MCPTypes.js';
import type {
  MCPClientConfig,
  MCPToolDefinition,
  MCPResourceDefinition,
} from '../MCPTypes.js';

/** Create a mock HTTP server that responds to JSON-RPC requests */
function createMockServer() {
  const handlers: Record<string, (params?: Record<string, unknown>) => unknown> = {};
  const server = {
    handle: (method: string, fn: (params?: Record<string, unknown>) => unknown) => {
      handlers[method] = fn;
      return server;
    },
    process: (body: string): string => {
      const req = JSON.parse(body);
      const fn = handlers[req.method];
      if (!fn) {
        return JSON.stringify({
          jsonrpc: '2.0', id: req.id,
          error: { code: MCPErrorCodes.METHOD_NOT_FOUND, message: 'Not found' },
        });
      }
      try {
        return JSON.stringify({
          jsonrpc: '2.0', id: req.id, result: fn(req.params),
        });
      } catch (e) {
        return JSON.stringify({
          jsonrpc: '2.0', id: req.id,
          error: { code: MCPErrorCodes.INTERNAL_ERROR, message: (e as Error).message },
        });
      }
    },
  };
  return server;
}

/** Create a mock HTTP transport that uses the mock server */
function createMockTransport() {
  const server = createMockServer();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(
    async (input: string, init?: RequestInit) => {
      const body = init?.body as string;
      const result = server.process(body);
      return new Response(result, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  ) as unknown as typeof fetch;
  return {
    server,
    restore: () => { globalThis.fetch = originalFetch; },
  };
}

describe('MCPClient', () => {
  let client: MCPClient;
  let mock: ReturnType<typeof createMockTransport>;

  const httpConfig: MCPClientConfig = {
    transport: 'http',
    url: 'http://localhost:9999/mcp',
  };

  beforeEach(() => {
    mock = createMockTransport();
    client = new MCPClient(httpConfig);
  });

  afterEach(() => {
    client.disconnect();
    mock.restore();
  });

  describe('connect()', () => {
    it('should connect successfully', async () => {
      await expect(client.connect()).resolves.toBeUndefined();
    });

    it('should throw if already connected', async () => {
      await client.connect();
      await expect(client.connect()).rejects.toThrow('Already connected');
    });
  });

  describe('listTools()', () => {
    it('should return tool list', async () => {
      mock.server.handle('tools/list', () => ({
        tools: [{ name: 'echo', description: 'Echo back input',
          inputSchema: { type: 'object', properties: {
            message: { type: 'string' } }, required: ['message'] } }],
      }));
      await client.connect();
      const result = await client.listTools();
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('echo');
    });

    it('should return empty tools list', async () => {
      mock.server.handle('tools/list', () => ({ tools: [] }));
      await client.connect();
      const result = await client.listTools();
      expect(result.tools).toEqual([]);
    });
  });

  describe('callTool()', () => {
    it('should call a tool and return result', async () => {
      mock.server.handle('tools/call', () => ({
        content: [{ type: 'text', text: 'Hello' }],
      }));
      await client.connect();
      const result = await client.callTool('echo', { message: 'hi' });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should handle tool execution errors', async () => {
      mock.server.handle('tools/call', () => {
        throw new Error('Tool failed');
      });
      await client.connect();
      await expect(
        client.callTool('bad', {})
      ).rejects.toThrow('Tool failed');
    });
  });

  describe('listResources()', () => {
    it('should return resource list', async () => {
      mock.server.handle('resources/list', () => ({
        resources: [{ uri: 'file:///test.txt', name: 'test' }],
      }));
      await client.connect();
      const result = await client.listResources();
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].name).toBe('test');
    });
  });

  describe('readResource()', () => {
    it('should read a resource by URI', async () => {
      mock.server.handle('resources/read', () => ({
        contents: [{ uri: 'file:///test.txt', text: 'content' }],
      }));
      await client.connect();
      const result = await client.readResource('file:///test.txt');
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].text).toBe('content');
    });
  });

  describe('disconnect()', () => {
    it('should clear pending requests on disconnect', async () => {
      await client.connect();
      client.disconnect();
      await expect(client.listTools()).rejects.toThrow('Not connected');
    });
  });

  describe('error handling', () => {
    it('should throw when not connected', async () => {
      await expect(client.listTools()).rejects.toThrow('Not connected');
    });
  });
});