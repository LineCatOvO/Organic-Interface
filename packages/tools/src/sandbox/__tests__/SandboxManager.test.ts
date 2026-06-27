import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SandboxManager } from '../SandboxManager.js';

const mockCreate = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockRemove = vi.fn();
const mockGetState = vi.fn(() => 'stopped');
const mockGetContainerId = vi.fn(() => 'mock-cid');
const mockGetAge = vi.fn(() => 0);

vi.mock('../DockerSandbox.js', () => ({
  DockerSandbox: vi.fn(function () {
    return {
      create: mockCreate,
      start: mockStart,
      stop: mockStop,
      remove: mockRemove,
      getState: mockGetState,
      getContainerId: mockGetContainerId,
      getAge: mockGetAge,
    };
  }),
}));

describe('SandboxManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(undefined);
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockGetState.mockReturnValue('stopped');
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('initialize should create minIdle sandboxes', async () => {
    const mgr = new SandboxManager({ minIdle: 2 });
    await mgr.initialize();
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const status = mgr.getPoolStatus();
    expect(status.total).toBe(2);
    expect(status.idle).toBe(2);
  });

  it('acquire should return an available sandbox', async () => {
    const mgr = new SandboxManager({ minIdle: 1 });
    await mgr.initialize();
    const sb = await mgr.acquire();
    expect(sb).toBeDefined();
    expect(mockStart).toHaveBeenCalled();
    const status = mgr.getPoolStatus();
    expect(status.inUse).toBe(1);
  });

  it('acquire should auto-initialize if not initialized', async () => {
    const mgr = new SandboxManager({ minIdle: 1 });
    const sb = await mgr.acquire();
    expect(sb).toBeDefined();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('release should return sandbox to pool', async () => {
    const mgr = new SandboxManager({ minIdle: 1 });
    await mgr.initialize();
    const sb = await mgr.acquire();
    await mgr.release(sb);
    const status = mgr.getPoolStatus();
    expect(status.inUse).toBe(0);
    expect(status.idle).toBe(1);
  });

  it('release should remove sandbox when maxReuse reached', async () => {
    const mgr = new SandboxManager({ minIdle: 1, maxReuse: 1 });
    await mgr.initialize();
    const sb = await mgr.acquire();
    await mgr.release(sb);
    expect(mockRemove).toHaveBeenCalled();
    const status = mgr.getPoolStatus();
    expect(status.total).toBe(0);
  });

  it('shutdown should clean up all sandboxes', async () => {
    const mgr = new SandboxManager({ minIdle: 2 });
    await mgr.initialize();
    await mgr.shutdown();
    expect(mockRemove).toHaveBeenCalledTimes(2);
    const status = mgr.getPoolStatus();
    expect(status.total).toBe(0);
  });

  it('acquire should throw when pool exhausted', async () => {
    const mgr = new SandboxManager({ maxPoolSize: 1, minIdle: 0 });
    await mgr.acquire();
    await expect(mgr.acquire()).rejects.toThrow(/Pool exhausted/);
  });

  it('should recycle stale idle sandboxes', async () => {
    vi.useFakeTimers();
    const mgr = new SandboxManager({ minIdle: 1, maxAge: 1000 });
    await mgr.initialize();
    vi.advanceTimersByTime(2000);
    await mgr.acquire();
    expect(mockRemove).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should reuse sandbox without restarting', async () => {
    mockGetState.mockReturnValue('running');
    const mgr = new SandboxManager({ minIdle: 1 });
    await mgr.initialize();
    mockStart.mockClear();
    await mgr.acquire();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('getPoolStatus should report correct counts', () => {
    const mgr = new SandboxManager({ maxPoolSize: 5 });
    const status = mgr.getPoolStatus();
    expect(status.total).toBe(0);
    expect(status.inUse).toBe(0);
    expect(status.idle).toBe(0);
    expect(status.maxPoolSize).toBe(5);
  });
});