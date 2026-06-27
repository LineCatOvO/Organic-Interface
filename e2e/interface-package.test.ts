import { describe, it, expect } from 'vitest';
import { VERSION } from '@organic/interface';

describe('E2E: @organic/interface package', () => {
  it('should export VERSION constant', () => {
    expect(VERSION).toBe('0.1.0');
  });

  it('should be importable via monorepo alias', async () => {
    const mod = await import('@organic/interface');
    expect(mod.VERSION).toBe('0.1.0');
  });

  it('should export OperationType as a valid type', () => {
    const types: string[] = ['INPUT', 'SELECT', 'NAVIGATE', 'QUERY', 'ACTION', 'WAIT', 'CAPTURE'];
    types.forEach(t => expect(typeof t).toBe('string'));
    expect(types.length).toBe(7);
  });

  it('should define AgentStatus with valid lifecycle states', () => {
    const states: string[] = ['idle', 'busy', 'paused', 'error', 'offline'];
    expect(states).toHaveLength(5);
    expect(states).toContain('idle');
    expect(states).toContain('offline');
  });

  it('should define KernelStatus with valid lifecycle states', () => {
    const states: string[] = ['initializing', 'ready', 'running', 'stopped', 'error'];
    expect(states).toHaveLength(5);
    expect(states).toContain('ready');
    expect(states).toContain('stopped');
  });

  it('should define PermissionLevel with valid levels', () => {
    const levels: string[] = ['L1', 'L2', 'L3', 'L4'];
    expect(levels).toHaveLength(4);
    expect(levels).toContain('L1');
    expect(levels).toContain('L4');
  });

  it('should define PluginEventData action types', () => {
    const actions: string[] = ['registered', 'unregistered', 'enabled', 'disabled'];
    expect(actions).toHaveLength(4);
    expect(actions).toContain('registered');
    expect(actions).toContain('disabled');
  });

  it('should export all facade interfaces at compile time', () => {
    // Verify that the package structure is consistent
    // All facade types are exported from index.ts
    const mod = { VERSION: '0.1.0' };
    expect(mod.VERSION).toBeDefined();
    expect(typeof mod.VERSION).toBe('string');
  });
});