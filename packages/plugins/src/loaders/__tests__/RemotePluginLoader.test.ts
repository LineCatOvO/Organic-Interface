import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as path from 'path';
import { RemotePluginLoader } from '../RemotePluginLoader.js';
import type { RemotePluginSource } from '../../interfaces/PluginLoaderInterface.js';
import type { PluginMetadata } from '../../interfaces/PluginInterface.js';

/**
 * Mock http/https modules to simulate download scenarios without real network access.
 * Uses vi.hoisted() because vi.mock is hoisted to the top of the file
 * and needs access to pre-initialized mock variables.
 *
 * Coverage enhancement (ST-03): Added https mock, fs mock, and a configurable
 * response factory to exercise download success/redirect/error/timeout paths.
 */
const {
  mockHttpReq,
  mockHttpGet,
  mockHttpsGet,
  mockState,
  mockResponseEventCallbacks,
  mockRequestEventCallbacks,
  mockFs,
} = vi.hoisted(() => {
  const mockRequestEventCallbacks: Record<string, Function> = {};
  const mockResponseEventCallbacks: Record<string, Function> = {};

  // Mutable state object (avoids const reassignment issues with destructuring)
  const mockState = {
    status: 200,
    headers: {} as Record<string, string>,
    chunks: [] as Buffer[],
  };

  const mockHttpReq = {
    on: vi.fn((event: string, callback: Function) => {
      mockRequestEventCallbacks[event] = callback;
      return mockHttpReq;
    }),
    destroy: vi.fn(),
  };

  const createMockResponse = () => ({
    statusCode: mockState.status,
    headers: mockState.headers,
    on: vi.fn((event: string, callback: Function) => {
      mockResponseEventCallbacks[event] = callback;
      return createMockResponse();
    }),
  });

  const mockHttpGet = vi.fn((_url: string, _options: unknown, callback: Function) => {
    const response = createMockResponse();
    // Invoke callback with response asynchronously to simulate real behavior
    setImmediate(() => {
      callback(response);
      // Emit data chunks
      for (const chunk of mockState.chunks) {
        if (mockResponseEventCallbacks['data']) {
          mockResponseEventCallbacks['data'](chunk);
        }
      }
      // Emit end event
      if (mockResponseEventCallbacks['end']) {
        mockResponseEventCallbacks['end']();
      }
    });
    return mockHttpReq;
  });

  const mockHttpsGet = vi.fn((_url: string, _options: unknown, callback: Function) => {
    const response = createMockResponse();
    setImmediate(() => {
      callback(response);
      for (const chunk of mockState.chunks) {
        if (mockResponseEventCallbacks['data']) {
          mockResponseEventCallbacks['data'](chunk);
        }
      }
      if (mockResponseEventCallbacks['end']) {
        mockResponseEventCallbacks['end']();
      }
    });
    return mockHttpReq;
  });

  const mockFs = {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => false),
    readdirSync: vi.fn(() => []),
    readFileSync: vi.fn(() => ''),
  };

  return {
    mockHttpReq,
    mockHttpGet,
    mockHttpsGet,
    mockState,
    mockResponseEventCallbacks,
    mockRequestEventCallbacks,
    mockFs,
  };
});

vi.mock('http', () => ({
  get: mockHttpGet,
}));

vi.mock('https', () => ({
  get: mockHttpsGet,
}));

vi.mock('fs', () => mockFs);

describe('RemotePluginLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset configurable mock state
    mockState.status = 200;
    mockState.headers = {};
    mockState.chunks = [];
    // Clear callback registries
    for (const key of Object.keys(mockRequestEventCallbacks)) {
      delete mockRequestEventCallbacks[key];
    }
    for (const key of Object.keys(mockResponseEventCallbacks)) {
      delete mockResponseEventCallbacks[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create loader with default options', () => {
      const loader = new RemotePluginLoader();
      expect(loader).toBeDefined();
    });

    it('should merge custom options with defaults', () => {
      const loader = new RemotePluginLoader({
        installDir: '/custom/plugins',
        registryUrl: 'https://custom.registry.com',
        timeout: 60000,
        verifySsl: false,
      });
      expect(loader).toBeDefined();
    });
  });

  // ==================== registerSource / unregisterSource ====================

  describe('registerSource / unregisterSource', () => {
    it('should register a remote source and allow loading it', async () => {
      const loader = new RemotePluginLoader();
      const source: RemotePluginSource = {
        pluginId: 'test-plugin',
        url: 'npm:test-plugin',
        type: 'npm',
      };
      loader.registerSource('test-plugin', source);

      const result = await loader.load('test-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPM package installation not yet implemented');
    });

    it('should return error when source is unregistered', async () => {
      const loader = new RemotePluginLoader();
      const source: RemotePluginSource = {
        pluginId: 'test-plugin',
        url: 'npm:test-plugin',
        type: 'npm',
      };
      loader.registerSource('test-plugin', source);
      loader.unregisterSource('test-plugin');

      const result = await loader.load('test-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote source not found for plugin: test-plugin');
    });
  });

  // ==================== Delegation methods ====================

  describe('getStatus', () => {
    it('should return undefined for unknown plugin', () => {
      const loader = new RemotePluginLoader();
      expect(loader.getStatus('non-existent')).toBeUndefined();
    });
  });

  describe('isLoaded', () => {
    it('should return false for unknown plugin', () => {
      const loader = new RemotePluginLoader();
      expect(loader.isLoaded('non-existent')).toBe(false);
    });
  });

  describe('listLoaded', () => {
    it('should return empty array initially', () => {
      const loader = new RemotePluginLoader();
      expect(loader.listLoaded()).toEqual([]);
    });
  });

  describe('discover', () => {
    it('should return empty array', async () => {
      const loader = new RemotePluginLoader();
      const results = await loader.discover();
      expect(results).toEqual([]);
    });
  });

  describe('validateCompatibility', () => {
    it('should return compatible for valid metadata', async () => {
      const loader = new RemotePluginLoader();
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
      };

      const result = await loader.validateCompatibility(metadata);
      expect(result.compatible).toBe(true);
    });

    it('should report error for missing required dependency', async () => {
      const loader = new RemotePluginLoader();
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
        dependencies: [{ pluginName: 'missing-dep', versionRange: '1.0.0', optional: false }],
      };

      const result = await loader.validateCompatibility(metadata);
      expect(result.compatible).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          code: 'MISSING_DEPENDENCY',
        })
      );
    });
  });

  // ==================== load ====================

  describe('load', () => {
    it('should return error when source is not registered', async () => {
      const loader = new RemotePluginLoader();
      const result = await loader.load('unknown-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote source not found for plugin: unknown-plugin');
    });

    it('should return error for npm source type (not yet implemented)', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('npm-plugin', {
        pluginId: 'npm-plugin',
        url: 'npm:@scope/package',
        type: 'npm',
      });

      const result = await loader.load('npm-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPM package installation not yet implemented');
    });

    it('should return error for git source type (not yet implemented)', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('git-plugin', {
        pluginId: 'git-plugin',
        url: 'git:https://github.com/example/repo.git',
        type: 'git',
      });

      const result = await loader.load('git-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Git repository cloning not yet implemented');
    });

    it('should return error for unsupported source type', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('file-plugin', {
        pluginId: 'file-plugin',
        url: '/local/path/plugin.js',
        type: 'file',
      });

      const result = await loader.load('file-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported source type: file');
    });

    it('should handle HTTP download timeout', async () => {
      // Override mock to not emit a response, and trigger timeout callback
      // when the 'timeout' handler is registered on the request.
      // downloadPlugin calls req.on('error', ...) first, then req.on('timeout', ...)
      // So we need two mockImplementationOnce: first for 'error', second for 'timeout'
      mockHttpGet.mockImplementationOnce(() => mockHttpReq);

      // First on call (for 'error') - just return mockHttpReq without triggering
      mockHttpReq.on.mockImplementationOnce(() => mockHttpReq);
      // Second on call (for 'timeout') - trigger callback immediately
      mockHttpReq.on.mockImplementationOnce((event: string, callback: Function) => {
        if (event === 'timeout') {
          callback();
        }
        return mockHttpReq;
      });

      const loader = new RemotePluginLoader({ timeout: 1000 });
      loader.registerSource('http-plugin', {
        pluginId: 'http-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const result = await loader.load('http-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Download timed out');
      expect(mockHttpReq.destroy).toHaveBeenCalled();
    });
  });

  // ==================== unload ====================

  describe('unload', () => {
    it('should unload without throwing for unknown plugin', async () => {
      const loader = new RemotePluginLoader();
      await expect(loader.unload('non-existent')).resolves.not.toThrow();
    });

    it('should handle unload then load with unregistered source', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('test-plugin', {
        pluginId: 'test-plugin',
        url: 'git:https://example.com/repo',
        type: 'git',
      });

      await loader.unload('test-plugin');

      // After unload, the source is still registered but cache is cleared,
      // so load will attempt install again
      const result = await loader.load('test-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Git repository cloning not yet implemented');
    });
  });

  // ==================== reload ====================

  describe('reload', () => {
    it('should return error for unknown plugin', async () => {
      const loader = new RemotePluginLoader();
      const result = await loader.reload('unknown-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote source not found for plugin: unknown-plugin');
    });

    it('should reload and return install error for npm plugin', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('npm-plugin', {
        pluginId: 'npm-plugin',
        url: 'npm:package',
        type: 'npm',
      });

      const result = await loader.reload('npm-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPM package installation not yet implemented');
    });
  });

  // ==================== ST-03 覆盖率增强测试 ====================
  // 目标：覆盖 downloadPlugin 的成功/重定向/非200/错误/HTTPS 路径，
  // load 的 installCache 命中/安装成功/catch 分支，以及 getPluginInstallPath。

  describe('ST-03: downloadPlugin - HTTP 下载成功路径', () => {
    it('should successfully download and save plugin content via HTTP', async () => {
      // 正常路径：HTTP 200，数据写入文件
      mockState.status = 200;
      mockState.chunks = [Buffer.from('plugin content here')];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-http-success' });
      loader.registerSource('http-success-plugin', {
        pluginId: 'http-success-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      // Mock localLoader.load 以避免真实文件系统操作
      const localLoader = (loader as any).localLoader;
      vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'downloaded' },
        metadata: {
          id: 'http-success-plugin',
          name: 'downloaded',
          version: '1.0.0',
          apiVersion: '1.0.0',
        },
      });

      const result = await loader.load('http-success-plugin');
      expect(result.success).toBe(true);
      expect(mockHttpGet).toHaveBeenCalled();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join('/tmp/test-http-success', 'http-success-plugin'),
        { recursive: true }
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('/tmp/test-http-success', 'http-success-plugin', 'plugin.js'),
        expect.any(Buffer)
      );
    });

    it('should use HTTPS protocol for https:// URLs', async () => {
      // 边界情况：验证 https 模块被使用
      mockState.status = 200;
      mockState.chunks = [Buffer.from('secure plugin')];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-https' });
      loader.registerSource('https-plugin', {
        pluginId: 'https-plugin',
        url: 'https://secure.example.com/plugin.js',
        type: 'http',
      });

      const localLoader = (loader as any).localLoader;
      vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'secure' },
        metadata: { id: 'https-plugin', name: 'secure', version: '1.0.0', apiVersion: '1.0.0' },
      });

      const result = await loader.load('https-plugin');
      expect(result.success).toBe(true);
      expect(mockHttpsGet).toHaveBeenCalled();
      expect(mockHttpGet).not.toHaveBeenCalled();
    });
  });

  describe('ST-03: downloadPlugin - 重定向处理', () => {
    it('should follow 301 redirect to new location', async () => {
      // 边界情况：301 重定向
      mockState.status = 301;
      mockState.headers = { location: 'https://redirected.example.com/plugin.js' };
      // 第一次调用返回 301，第二次调用返回 200
      mockHttpsGet.mockImplementationOnce((_url: string, _opts: unknown, callback: Function) => {
        const response = {
          statusCode: 301,
          headers: { location: 'https://redirected.example.com/plugin.js' },
          on: vi.fn((_event: string, _cb: Function) => {
            // 重定向响应不发送 data/end
            return response;
          }),
        };
        setImmediate(() => callback(response));
        return mockHttpReq;
      });
      // 第二次调用（重定向后）返回 200
      mockState.status = 200;
      mockState.chunks = [Buffer.from('redirected content')];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-redirect' });
      loader.registerSource('redirect-plugin', {
        pluginId: 'redirect-plugin',
        url: 'https://example.com/plugin.js',
        type: 'http',
      });

      const localLoader = (loader as any).localLoader;
      vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'redirected' },
        metadata: {
          id: 'redirect-plugin',
          name: 'redirected',
          version: '1.0.0',
          apiVersion: '1.0.0',
        },
      });

      const result = await loader.load('redirect-plugin');
      expect(result.success).toBe(true);
      expect(mockHttpsGet).toHaveBeenCalledTimes(2);
    });

    it('should follow 302 redirect with location header', async () => {
      // 边界情况：302 重定向
      mockHttpsGet.mockImplementationOnce((_url: string, _opts: unknown, callback: Function) => {
        const response = {
          statusCode: 302,
          headers: { location: 'https://new-location.example.com/plugin.js' },
          on: vi.fn(() => response),
        };
        setImmediate(() => callback(response));
        return mockHttpReq;
      });
      // 重定向后的响应
      mockState.status = 200;
      mockState.chunks = [Buffer.from('final content')];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-302' });
      loader.registerSource('redirect-302', {
        pluginId: 'redirect-302',
        url: 'https://example.com/plugin.js',
        type: 'http',
      });

      const localLoader = (loader as any).localLoader;
      vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'final' },
        metadata: { id: 'redirect-302', name: 'final', version: '1.0.0', apiVersion: '1.0.0' },
      });

      const result = await loader.load('redirect-302');
      expect(result.success).toBe(true);
    });
  });

  describe('ST-03: downloadPlugin - 非 200 状态码', () => {
    it('should return error for 404 status code', async () => {
      // 异常路径：404 Not Found
      mockState.status = 404;
      mockState.chunks = [];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-404' });
      loader.registerSource('not-found-plugin', {
        pluginId: 'not-found-plugin',
        url: 'http://example.com/missing.js',
        type: 'http',
      });

      const result = await loader.load('not-found-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Download failed with status: 404');
    });

    it('should return error for 500 status code', async () => {
      // 异常路径：500 Internal Server Error
      mockState.status = 500;
      mockState.chunks = [];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-500' });
      loader.registerSource('server-error-plugin', {
        pluginId: 'server-error-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const result = await loader.load('server-error-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Download failed with status: 500');
    });
  });

  describe('ST-03: downloadPlugin - 请求错误事件', () => {
    it('should handle request error event', async () => {
      // 异常路径：网络错误
      mockHttpGet.mockImplementationOnce((_url: string, _opts: unknown, _callback: Function) => {
        // 触发 error 事件而不是响应回调
        setImmediate(() => {
          if (mockRequestEventCallbacks['error']) {
            mockRequestEventCallbacks['error'](new Error('Network connection refused'));
          }
        });
        return mockHttpReq;
      });

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-error' });
      loader.registerSource('error-plugin', {
        pluginId: 'error-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const result = await loader.load('error-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connection refused');
    });
  });

  describe('ST-03: downloadPlugin - 文件写入错误', () => {
    it('should handle file write error during download', async () => {
      // 异常路径：fs.writeFileSync 抛出错误
      mockState.status = 200;
      mockState.chunks = [Buffer.from('content')];
      mockFs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-write-error' });
      loader.registerSource('write-error-plugin', {
        pluginId: 'write-error-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const result = await loader.load('write-error-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should handle mkdir error during download', async () => {
      // 异常路径：fs.mkdirSync 抛出错误
      mockState.status = 200;
      mockState.chunks = [Buffer.from('content')];
      mockFs.mkdirSync.mockImplementationOnce(() => {
        throw new Error('Cannot create directory');
      });

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-mkdir-error' });
      loader.registerSource('mkdir-error-plugin', {
        pluginId: 'mkdir-error-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const result = await loader.load('mkdir-error-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot create directory');
    });
  });

  describe('ST-03: load - installCache 命中路径', () => {
    it('should load from local cache when installCache has entry', async () => {
      // 正常路径：installCache 命中，直接调用 localLoader.load
      const loader = new RemotePluginLoader({ installDir: '/tmp/test-cache-hit' });

      // 手动设置 installCache
      const installCache = (loader as any).installCache as Map<string, string>;
      installCache.set('cached-remote-plugin', 'http://example.com/plugin.js');

      const localLoader = (loader as any).localLoader;
      const loadSpy = vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'cached' },
        metadata: {
          id: 'cached-remote-plugin',
          name: 'cached',
          version: '1.0.0',
          apiVersion: '1.0.0',
        },
      });

      const result = await loader.load('cached-remote-plugin');
      expect(result.success).toBe(true);
      expect(loadSpy).toHaveBeenCalledWith('cached-remote-plugin', undefined);
      // 不应调用 http.get 因为直接从本地加载
      expect(mockHttpGet).not.toHaveBeenCalled();
    });
  });

  describe('ST-03: load - 安装失败返回安装结果', () => {
    it('should return install result when install fails', async () => {
      // 异常路径：installPlugin 返回失败
      const loader = new RemotePluginLoader({ installDir: '/tmp/test-install-fail' });
      loader.registerSource('install-fail-plugin', {
        pluginId: 'install-fail-plugin',
        url: 'npm:failing-package',
        type: 'npm',
      });

      const result = await loader.load('install-fail-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPM package installation not yet implemented');
    });
  });

  describe('ST-03: load - catch 异常处理', () => {
    it('should catch exceptions thrown during install and return error', async () => {
      // 异常路径：installPlugin 抛出异常
      const loader = new RemotePluginLoader({ installDir: '/tmp/test-catch' });
      loader.registerSource('throw-plugin', {
        pluginId: 'throw-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      // 让 http.get 抛出同步异常
      mockHttpGet.mockImplementationOnce(() => {
        throw new Error('Synchronous error in get');
      });

      const result = await loader.load('throw-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Synchronous error in get');
    });

    it('should handle non-Error thrown values in catch block', async () => {
      // 边界情况：抛出非 Error 值
      const loader = new RemotePluginLoader({ installDir: '/tmp/test-catch-non-error' });
      loader.registerSource('non-error-throw', {
        pluginId: 'non-error-throw',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      mockHttpGet.mockImplementationOnce(() => {
        throw 'string error'; // 非 Error 对象
      });

      const result = await loader.load('non-error-throw');
      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  describe('ST-03: load - 成功安装后更新缓存', () => {
    it('should update installCache after successful install', async () => {
      // 正常路径：安装成功后缓存被更新
      mockState.status = 200;
      mockState.chunks = [Buffer.from('plugin code')];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-cache-update' });
      loader.registerSource('cache-update-plugin', {
        pluginId: 'cache-update-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const localLoader = (loader as any).localLoader;
      vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'updated' },
        metadata: {
          id: 'cache-update-plugin',
          name: 'updated',
          version: '1.0.0',
          apiVersion: '1.0.0',
        },
      });

      const installCache = (loader as any).installCache as Map<string, string>;
      expect(installCache.has('cache-update-plugin')).toBe(false);

      await loader.load('cache-update-plugin');

      // 验证缓存已更新
      expect(installCache.has('cache-update-plugin')).toBe(true);
      expect(installCache.get('cache-update-plugin')).toBe('http://example.com/plugin.js');
    });
  });

  describe('ST-03: reload - 完整流程', () => {
    it('should unload then load during reload for HTTP plugin', async () => {
      // 正常路径：reload 调用 unload 后 load
      mockState.status = 200;
      mockState.chunks = [Buffer.from('reloaded content')];

      const loader = new RemotePluginLoader({ installDir: '/tmp/test-reload-http' });
      loader.registerSource('reload-http-plugin', {
        pluginId: 'reload-http-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const localLoader = (loader as any).localLoader;
      const unloadSpy = vi.spyOn(localLoader, 'unload').mockResolvedValue(undefined);
      vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'reloaded' },
        metadata: {
          id: 'reload-http-plugin',
          name: 'reloaded',
          version: '1.0.0',
          apiVersion: '1.0.0',
        },
      });

      const result = await loader.reload('reload-http-plugin');
      expect(result.success).toBe(true);
      expect(unloadSpy).toHaveBeenCalledWith('reload-http-plugin');
    });
  });

  describe('ST-03: unregisterSource - 清理缓存', () => {
    it('should clear installCache entry when unregistering source', async () => {
      // 正常路径：unregisterSource 清理 installCache
      const loader = new RemotePluginLoader();
      loader.registerSource('unregister-test', {
        pluginId: 'unregister-test',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      // 手动设置 installCache
      const installCache = (loader as any).installCache as Map<string, string>;
      installCache.set('unregister-test', 'http://example.com/plugin.js');
      expect(installCache.has('unregister-test')).toBe(true);

      loader.unregisterSource('unregister-test');

      expect(installCache.has('unregister-test')).toBe(false);
      // remoteSources 也应被清理
      const remoteSources = (loader as any).remoteSources as Map<string, RemotePluginSource>;
      expect(remoteSources.has('unregister-test')).toBe(false);
    });
  });

  describe('ST-03: getPluginInstallPath - 路径构建', () => {
    it('should construct install path using installDir and pluginId', async () => {
      // 边界情况：验证 getPluginInstallPath 返回正确路径
      mockState.status = 200;
      mockState.chunks = [Buffer.from('content')];

      const loader = new RemotePluginLoader({ installDir: '/custom/install/dir' });
      loader.registerSource('path-test-plugin', {
        pluginId: 'path-test-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const localLoader = (loader as any).localLoader;
      vi.spyOn(localLoader, 'load').mockResolvedValue({
        success: true,
        plugin: { name: 'test' },
        metadata: { id: 'path-test-plugin', name: 'test', version: '1.0.0', apiVersion: '1.0.0' },
      });

      await loader.load('path-test-plugin');

      // 验证 mkdirSync 使用了正确的路径
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join('/custom/install/dir', 'path-test-plugin'),
        { recursive: true }
      );
    });
  });
});
