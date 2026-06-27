import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { DockerSandbox } from '../DockerSandbox.js';

vi.mock('child_process', () => ({ execFile: vi.fn() }));
const mockExecFile = vi.mocked(execFile);

function mockExecOk(stdout = '') {
  mockExecFile.mockImplementation(
    (_cmd: any, _args: any, _opts: any, cb: any) => cb(null, stdout, '')
  );
}

function mockExecFail(msg = 'mock error') {
  mockExecFile.mockImplementation(
    (_cmd: any, _args: any, _opts: any, cb: any) => cb(new Error(msg), '', '')
  );
}

describe('DockerSandbox', () => {
  const CID = 'abc123def456';

  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('should use default config and have initial state removed', () => {
    const s = new DockerSandbox();
    expect(s.getState()).toBe('removed');
    expect(s.getContainerId()).toBeNull();
    expect(s.getAge()).toBe(0);
  });

  it('should merge custom config with defaults', () => {
    const s = new DockerSandbox({ image: 'node:18-alpine', cpuLimit: '0.5' });
    expect(s.getState()).toBe('removed');
  });

  it('create should set containerId and state to stopped', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    expect(s.getState()).toBe('stopped');
    expect(s.getContainerId()).toBe(CID);
  });

  it('create should fail if already created', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    await expect(s.create()).rejects.toThrow(/Cannot create/);
  });

  it('create failure should set state to error', async () => {
    mockExecFail('docker error');
    const s = new DockerSandbox();
    await expect(s.create()).rejects.toThrow(/Failed to create/);
    expect(s.getState()).toBe('error');
  });

  it('start should set state to running', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    mockExecOk('');
    await s.start();
    expect(s.getState()).toBe('running');
  });

  it('start should be idempotent when already running', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    mockExecOk('');
    await s.start();
    mockExecOk('');
    await s.start();
    expect(s.getState()).toBe('running');
  });

  it('start should throw if no container', async () => {
    const s = new DockerSandbox();
    await expect(s.start()).rejects.toThrow(/No container/);
  });

  it('stop should set state to stopped', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    mockExecOk('');
    await s.start();
    mockExecOk('');
    await s.stop();
    expect(s.getState()).toBe('stopped');
  });

  it('stop should be no-op when no container', async () => {
    const s = new DockerSandbox();
    await s.stop();
    expect(s.getState()).toBe('removed');
  });

  it('remove should reset state and containerId', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    mockExecOk('');
    await s.remove();
    expect(s.getState()).toBe('removed');
    expect(s.getContainerId()).toBeNull();
  });

  it('execute should return success result', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    mockExecOk('');
    await s.start();
    mockExecOk('hello output');
    const r = await s.execute('echo hello');
    expect(r.success).toBe(true);
    expect(r.stdout).toBe('hello output');
    expect(r.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('execute should fail when not running', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    await expect(s.execute('ls')).rejects.toThrow(/not running/);
  });

  it('execute should handle command failure gracefully', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox();
    await s.create();
    mockExecOk('');
    await s.start();
    mockExecFail('command failed');
    const r = await s.execute('badcmd');
    expect(r.success).toBe(false);
    expect(r.exitCode).toBe(-1);
  });

  it('should include security options and volume mounts', async () => {
    mockExecOk(CID);
    const s = new DockerSandbox({
      volumes: ['/host:/container'],
      networkMode: 'none',
    });
    await s.create();
    const args = mockExecFile.mock.calls[0] as any[];
    expect(args[1]).toContain('--cap-drop');
    expect(args[1]).toContain('--security-opt');
    expect(args[1]).toContain('-v');
    expect(args[1]).toContain('/host:/container');
  });
});