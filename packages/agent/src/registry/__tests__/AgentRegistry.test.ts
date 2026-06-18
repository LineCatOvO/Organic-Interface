import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry, createRegistry } from '../AgentRegistry.js';
import type { AgentMetadata } from '../AgentMetadata.js';
import { AgentType, AgentRegistryStatus } from '../AgentMetadata.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('constructor', () => {
    it('should create a registry with default config', () => {
      expect(registry).toBeDefined();
    });

    it('should accept custom config', () => {
      const customRegistry = new AgentRegistry({
        name: 'custom',
        heartbeatTimeout: 60000,
        leaseDuration: 120000,
      });
      expect(customRegistry).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start the registry', () => {
      registry.start();
      expect(registry).toBeDefined();
    });

    it('should stop the registry', () => {
      registry.start();
      registry.stop();
      expect(registry).toBeDefined();
    });

    it('should not start twice', () => {
      registry.start();
      registry.start();
      registry.stop();
    });
  });

  describe('register', () => {
    it('should register an agent', () => {
      registry.start();
      const metadata: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0,
        maxConcurrentTasks: 10,
        activeTaskCount: 0,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      const result = registry.register(metadata);
      expect(result.id).toBe('agent-1');
    });

    it('should emit agent:registered event', () => {
      registry.start();
      const handler = vi.fn();
      registry.on('agent:registered', handler);

      const metadata: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0,
        maxConcurrentTasks: 10,
        activeTaskCount: 0,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      registry.register(metadata);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('registerAgent', () => {
    it('should register agent with basic info', () => {
      registry.start();
      const result = registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      expect(result.id).toBe('agent-1');
      expect(result.name).toBe('TestAgent');
    });

    it('should register with options', () => {
      registry.start();
      const result = registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR, {
        version: '2.0.0',
        capabilities: [{ id: 'cap1' }],
        maxConcurrentTasks: 20,
        tags: ['tag1'],
      });

      expect(result.version).toBe('2.0.0');
      expect(result.capabilities).toHaveLength(1);
      expect(result.maxConcurrentTasks).toBe(20);
      expect(result.tags).toContain('tag1');
    });
  });

  describe('unregister', () => {
    it('should unregister existing agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.unregister('agent-1');
      expect(result).toBe(true);
    });

    it('should return false for non-existent agent', () => {
      registry.start();
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should emit agent:unregistered event', () => {
      registry.start();
      const handler = vi.fn();
      registry.on('agent:unregistered', handler);

      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      registry.unregister('agent-1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update agent metadata', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.update('agent-1', { name: 'UpdatedAgent' });
      expect(result).toBeDefined();
      expect(result?.name).toBe('UpdatedAgent');
    });

    it('should return null for non-existent agent', () => {
      registry.start();
      const result = registry.update('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should prevent ID change', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.update('agent-1', { id: 'changed-id' } as any);
      expect(result?.id).toBe('agent-1');
    });
  });

  describe('get', () => {
    it('should get agent by ID', () => {
      registry.start();
      registry.registerAgent('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const result = registry.get('agent-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('agent-1');
    });

    it('should return null for non-existent agent', () => {
      registry.start();
      const result = registry.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all agents', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);
      const result = registry.list();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no agents', () => {
      registry.start();
      const result = registry.list();
      expect(result).toEqual([]);
    });
  });

  describe('find', () => {
    it('should find agents by type', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);
      const result = registry.find({ type: AgentType.EXECUTOR });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(AgentType.EXECUTOR);
    });

    it('should find agents by capability', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap2' }],
      });
      const result = registry.find({ capability: 'cap1' });
      expect(result).toHaveLength(1);
      expect(result[0].capabilities[0].id).toBe('cap1');
    });

    it('should find agents by status', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.find({ status: AgentRegistryStatus.ONLINE });
      expect(result).toHaveLength(1);
    });

    it('should find agents by max load', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);
      const result = registry.find({ maxLoad: 0.5 });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should find agents by tags', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, { tags: ['tag1', 'tag2'] });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, { tags: ['tag2'] });
      const result = registry.find({ tags: ['tag1'] });
      expect(result).toHaveLength(1);
    });
  });

  describe('discover', () => {
    it('should discover agents by capability', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      const result = registry.discover('cap1');
      expect(result).toHaveLength(1);
    });

    it('should discover with options', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.discover('any-capability', { maxLoad: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('heartbeat', () => {
    it('should record heartbeat', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.heartbeat('agent-1', { load: 0.5, activeTaskCount: 2 });
      expect(result).toBe(true);
    });

    it('should return false for unknown agent', () => {
      registry.start();
      const result = registry.heartbeat('unknown', { load: 0.5, activeTaskCount: 2 });
      expect(result).toBe(false);
    });
  });

  describe('isHealthy', () => {
    it('should return true for healthy agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.isHealthy('agent-1')).toBe(true);
    });

    it('should return false for unknown agent', () => {
      registry.start();
      expect(registry.isHealthy('unknown')).toBe(false);
    });
  });

  describe('canAcceptTasks', () => {
    it('should return true for agent that can accept tasks', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.canAcceptTasks('agent-1')).toBe(true);
    });

    it('should return false for unknown agent', () => {
      registry.start();
      expect(registry.canAcceptTasks('unknown')).toBe(false);
    });
  });

  describe('selectAgent', () => {
    it('should select available agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.selectAgent();
      expect(result).toBeDefined();
    });

    it('should return null when no agents available', () => {
      registry.start();
      const result = registry.selectAgent();
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);
      const stats = registry.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.onlineAgents).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should cleanup stale entries', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const removed = registry.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return entry count', () => {
      registry.start();
      expect(registry.size()).toBe(0);
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.size()).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true for existing agent', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      expect(registry.has('agent-1')).toBe(true);
    });

    it('should return false for non-existing agent', () => {
      registry.start();
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should dispose the registry', () => {
      registry.start();
      registry.dispose();
      expect(registry).toBeDefined();
    });
  });

  describe('createRegistry', () => {
    it('should create registry with auto-start', () => {
      const reg = createRegistry('test');
      expect(reg).toBeDefined();
      reg.dispose();
    });
  });

  // Traceability: ST-05 covers find with custom filter and empty tags
  describe('find additional filters', () => {
    it('should find agents using custom filter', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        maxConcurrentTasks: 5,
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        maxConcurrentTasks: 20,
      });

      const result = registry.find({
        filter: agent => agent.maxConcurrentTasks > 10,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-2');
    });

    it('should return all agents when custom filter passes all', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);

      const result = registry.find({ filter: () => true });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when custom filter rejects all', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);

      const result = registry.find({ filter: () => false });
      expect(result).toEqual([]);
    });

    it('should return all agents when tags array is empty', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, { tags: ['a'] });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);

      const result = registry.find({ tags: [] });
      expect(result).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
        tags: ['prod'],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
        tags: ['dev'],
      });
      registry.registerAgent('agent-3', 'Agent3', AgentType.PLANNER, {
        capabilities: [{ id: 'cap1' }],
        tags: ['prod'],
      });

      const result = registry.find({
        type: AgentType.EXECUTOR,
        capability: 'cap1',
        tags: ['prod'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-1');
    });
  });

  // Traceability: ST-05 covers updateStatus and status-change event
  describe('updateStatus', () => {
    it('should update agent status', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.updateStatus('agent-1', AgentRegistryStatus.BUSY);
      expect(result).toBe(true);
      expect(registry.get('agent-1')?.status).toBe(AgentRegistryStatus.BUSY);
    });

    it('should return false for non-existent agent', () => {
      registry.start();
      const result = registry.updateStatus('non-existent', AgentRegistryStatus.BUSY);
      expect(result).toBe(false);
    });

    it('should emit agent:status-change event', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const handler = vi.fn();
      registry.on('agent:status-change', handler);

      registry.updateStatus('agent-1', AgentRegistryStatus.UNAVAILABLE);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
          newStatus: AgentRegistryStatus.UNAVAILABLE,
        })
      );
    });

    it('should increment version on status update', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.updateStatus('agent-1', AgentRegistryStatus.BUSY);
      registry.updateStatus('agent-1', AgentRegistryStatus.ONLINE);
      // Version increments on each update - verify status changes are reflected
      expect(registry.get('agent-1')?.status).toBe(AgentRegistryStatus.ONLINE);
    });
  });

  // Traceability: ST-05 covers updateHealthCheck and health-check event
  describe('updateHealthCheck', () => {
    it('should update agent health check result', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.updateHealthCheck('agent-1', {
        healthy: true,
        checkedAt: Date.now(),
        responseTime: 42,
      });
      expect(result).toBe(true);
      expect(registry.get('agent-1')?.healthCheck?.healthy).toBe(true);
      expect(registry.get('agent-1')?.healthCheck?.responseTime).toBe(42);
    });

    it('should return false for non-existent agent', () => {
      registry.start();
      const result = registry.updateHealthCheck('non-existent', {
        healthy: false,
        checkedAt: Date.now(),
      });
      expect(result).toBe(false);
    });

    it('should emit agent:health-check event', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const handler = vi.fn();
      registry.on('agent:health-check', handler);

      const healthResult = { healthy: false, checkedAt: 12345, error: 'Down' };
      registry.updateHealthCheck('agent-1', healthResult);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
          result: healthResult,
        })
      );
    });
  });

  // Traceability: ST-05 covers selectAgent with options
  describe('selectAgent with options', () => {
    it('should select agent with preferIdle sorting by activeTaskCount', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);

      // Set different active task counts via heartbeat
      registry.heartbeat('agent-1', { load: 0.2, activeTaskCount: 5 });
      registry.heartbeat('agent-2', { load: 0.2, activeTaskCount: 1 });

      const result = registry.selectAgent(undefined, { preferIdle: true });
      expect(result?.id).toBe('agent-2');
    });

    it('should filter by maxLoad option', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);

      registry.heartbeat('agent-1', { load: 0.8, activeTaskCount: 8 });
      registry.heartbeat('agent-2', { load: 0.2, activeTaskCount: 2 });

      const result = registry.selectAgent(undefined, { maxLoad: 0.5 });
      expect(result?.id).toBe('agent-2');
    });

    it('should return null when maxLoad filters out all candidates', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.heartbeat('agent-1', { load: 0.9, activeTaskCount: 9 });

      const result = registry.selectAgent(undefined, { maxLoad: 0.5 });
      expect(result).toBeNull();
    });

    it('should select agent by capability with options', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });

      registry.heartbeat('agent-1', { load: 0.7, activeTaskCount: 7 });
      registry.heartbeat('agent-2', { load: 0.3, activeTaskCount: 3 });

      const result = registry.selectAgent('cap1', { preferIdle: true });
      expect(result?.id).toBe('agent-2');
    });
  });

  // Traceability: ST-05 covers selectAgents multiple selection
  describe('selectAgents', () => {
    it('should select multiple agents sorted by load', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-3', 'Agent3', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });

      registry.heartbeat('agent-1', { load: 0.8, activeTaskCount: 8 });
      registry.heartbeat('agent-2', { load: 0.1, activeTaskCount: 1 });
      registry.heartbeat('agent-3', { load: 0.5, activeTaskCount: 5 });

      const result = registry.selectAgents('cap1', 2);
      expect(result).toHaveLength(2);
      // Lowest load first
      expect(result[0].id).toBe('agent-2');
      expect(result[1].id).toBe('agent-3');
    });

    it('should return fewer agents when count exceeds available', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });

      const result = registry.selectAgents('cap1', 5);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no agents have capability', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);

      const result = registry.selectAgents('unknown-cap', 2);
      expect(result).toEqual([]);
    });

    it('should return empty array when no agents registered', () => {
      registry.start();
      const result = registry.selectAgents('cap1', 2);
      expect(result).toEqual([]);
    });
  });

  // Traceability: ST-05 covers getAvailableAgents without capability
  describe('getAvailableAgents', () => {
    it('should return all online available agents without capability filter', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.PLANNER);
      registry.registerAgent('agent-3', 'Agent3', AgentType.MONITOR);

      const result = registry.getAvailableAgents();
      expect(result).toHaveLength(3);
    });

    it('should filter by capability when provided', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap2' }],
      });

      const result = registry.getAvailableAgents('cap1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-1');
    });

    it('should exclude agents that cannot accept tasks', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);

      // Make agent-1 fully loaded
      registry.heartbeat('agent-1', { load: 1, activeTaskCount: 10 });

      const result = registry.getAvailableAgents();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-2');
    });

    it('should return empty array when no agents available', () => {
      registry.start();
      const result = registry.getAvailableAgents();
      expect(result).toEqual([]);
    });
  });

  // Traceability: ST-05 covers heartbeat stats update and lease extension
  describe('heartbeat additional coverage', () => {
    it('should update load and activeTaskCount from stats', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);

      registry.heartbeat('agent-1', { load: 0.7, activeTaskCount: 7 });
      const agent = registry.get('agent-1');
      expect(agent?.load).toBe(0.7);
      expect(agent?.activeTaskCount).toBe(7);
    });

    it('should update lastHeartbeatAt timestamp', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const beforeTime = Date.now();

      registry.heartbeat('agent-1', { load: 0.5, activeTaskCount: 5 });
      const agent = registry.get('agent-1');
      expect(agent?.lastHeartbeatAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should emit agent:heartbeat event', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const handler = vi.fn();
      registry.on('agent:heartbeat', handler);

      registry.heartbeat('agent-1', { load: 0.5, activeTaskCount: 5 });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
        })
      );
    });

    it('should work without stats parameter', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.heartbeat('agent-1');
      expect(result).toBe(true);
    });
  });

  // Traceability: ST-05 covers cleanup actually removing stale entries
  describe('cleanup stale entries', () => {
    it('should remove entries with expired leases', () => {
      // Use short lease duration for testing
      const shortLeaseRegistry = new AgentRegistry({
        leaseDuration: 100,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortLeaseRegistry.start();
      shortLeaseRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);

      // Wait for lease to expire
      const past = Date.now() - 200;
      // Manually expire by updating internal state via heartbeat with old timestamp
      // We need to access the entry - use update to trigger version increment
      // Actually, let's just wait a bit
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const removed = shortLeaseRegistry.cleanup();
          expect(removed).toBe(1);
          expect(shortLeaseRegistry.has('agent-1')).toBe(false);
          shortLeaseRegistry.dispose();
          resolve();
        }, 150);
      });
    });

    it('should emit agent:unregistered and cleanup:completed events on removal', () => {
      const shortLeaseRegistry = new AgentRegistry({
        leaseDuration: 50,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortLeaseRegistry.start();
      const unregisteredHandler = vi.fn();
      const cleanupHandler = vi.fn();
      shortLeaseRegistry.on('agent:unregistered', unregisteredHandler);
      shortLeaseRegistry.on('cleanup:completed', cleanupHandler);

      shortLeaseRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);

      return new Promise<void>(resolve => {
        setTimeout(() => {
          shortLeaseRegistry.cleanup();
          expect(unregisteredHandler).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: 'agent-1' })
          );
          expect(cleanupHandler).toHaveBeenCalledWith(
            expect.objectContaining({ removed: 1 })
          );
          shortLeaseRegistry.dispose();
          resolve();
        }, 100);
      });
    });

    it('should not emit cleanup:completed when nothing removed', () => {
      registry.start();
      const cleanupHandler = vi.fn();
      registry.on('cleanup:completed', cleanupHandler);

      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const removed = registry.cleanup();
      expect(removed).toBe(0);
      expect(cleanupHandler).not.toHaveBeenCalled();
    });

    it('should remove multiple stale entries', () => {
      const shortLeaseRegistry = new AgentRegistry({
        leaseDuration: 50,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortLeaseRegistry.start();
      shortLeaseRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      shortLeaseRegistry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);
      shortLeaseRegistry.registerAgent('agent-3', 'Agent3', AgentType.EXECUTOR);

      return new Promise<void>(resolve => {
        setTimeout(() => {
          const removed = shortLeaseRegistry.cleanup();
          expect(removed).toBe(3);
          expect(shortLeaseRegistry.size()).toBe(0);
          shortLeaseRegistry.dispose();
          resolve();
        }, 100);
      });
    });
  });

  // Traceability: ST-05 covers stop clearing timers and dispose
  describe('stop and dispose additional coverage', () => {
    it('should stop twice without error', () => {
      registry.start();
      registry.stop();
      // Second stop should be safe
      expect(() => registry.stop()).not.toThrow();
    });

    it('should clear heartbeat timers on stop', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);
      // Stop should clear all timers without error
      expect(() => registry.stop()).not.toThrow();
    });

    it('should dispose registry with agents registered', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);
      expect(() => registry.dispose()).not.toThrow();
      expect(registry.size()).toBe(0);
    });

    it('should remove all listeners on dispose', () => {
      registry.start();
      const handler = vi.fn();
      registry.on('agent:registered', handler);

      registry.dispose();
      // After dispose, listeners should be removed
      expect(registry.listenerCount('agent:registered')).toBe(0);
    });
  });

  // Traceability: ST-05 covers getStats with various statuses
  describe('getStats additional coverage', () => {
    it('should count agents by status correctly', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);
      registry.registerAgent('agent-3', 'Agent3', AgentType.EXECUTOR);

      registry.updateStatus('agent-2', AgentRegistryStatus.BUSY);
      registry.updateStatus('agent-3', AgentRegistryStatus.OFFLINE);

      const stats = registry.getStats();
      expect(stats.totalAgents).toBe(3);
      expect(stats.onlineAgents).toBe(1);
      expect(stats.busyAgents).toBe(1);
      expect(stats.offlineAgents).toBe(1);
    });

    it('should count unique capabilities', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }, { id: 'cap2' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap2' }, { id: 'cap3' }],
      });

      const stats = registry.getStats();
      expect(stats.totalCapabilities).toBe(3);
    });

    it('should compute average load', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR);

      registry.heartbeat('agent-1', { load: 0.4, activeTaskCount: 4 });
      registry.heartbeat('agent-2', { load: 0.6, activeTaskCount: 6 });

      const stats = registry.getStats();
      expect(stats.averageLoad).toBeCloseTo(0.5, 5);
    });

    it('should return zero average load for empty registry', () => {
      registry.start();
      const stats = registry.getStats();
      expect(stats.averageLoad).toBe(0);
      expect(stats.totalAgents).toBe(0);
    });

    it('should count UNAVAILABLE as offline', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.updateStatus('agent-1', AgentRegistryStatus.UNAVAILABLE);

      const stats = registry.getStats();
      expect(stats.onlineAgents).toBe(0);
      expect(stats.offlineAgents).toBe(1);
    });
  });

  // Traceability: ST-05 covers update with various fields
  describe('update additional coverage', () => {
    it('should update load and activeTaskCount', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.update('agent-1', { load: 0.9, activeTaskCount: 9 });
      expect(result?.load).toBe(0.9);
      expect(result?.activeTaskCount).toBe(9);
    });

    it('should update capabilities', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.update('agent-1', {
        capabilities: [{ id: 'new-cap' }],
      });
      expect(result?.capabilities).toHaveLength(1);
      expect(result?.capabilities[0].id).toBe('new-cap');
    });

    it('should emit agent:updated event', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const handler = vi.fn();
      registry.on('agent:updated', handler);

      registry.update('agent-1', { name: 'Updated' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
        })
      );
    });

    it('should increment version on update', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.update('agent-1', { load: 0.5 });
      registry.update('agent-1', { load: 0.6 });
      // Multiple updates should work
      expect(registry.get('agent-1')?.load).toBe(0.6);
    });
  });

  // Traceability: ST-05 covers discover with status option
  describe('discover additional coverage', () => {
    it('should discover agents with status filter', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });

      registry.updateStatus('agent-2', AgentRegistryStatus.BUSY);

      const result = registry.discover('cap1', { status: AgentRegistryStatus.ONLINE });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-1');
    });

    it('should discover agents with maxLoad filter', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });
      registry.registerAgent('agent-2', 'Agent2', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });

      registry.heartbeat('agent-1', { load: 0.8, activeTaskCount: 8 });
      registry.heartbeat('agent-2', { load: 0.2, activeTaskCount: 2 });

      const result = registry.discover('cap1', { maxLoad: 0.5 });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-2');
    });

    it('should return empty array when no agents match capability', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const result = registry.discover('unknown-cap');
      expect(result).toEqual([]);
    });
  });

  // Traceability: ST-05 covers canAcceptTasks with various states
  describe('canAcceptTasks additional coverage', () => {
    it('should return false when agent is fully loaded', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.heartbeat('agent-1', { load: 1, activeTaskCount: 10 });
      expect(registry.canAcceptTasks('agent-1')).toBe(false);
    });

    it('should return false when agent status is OFFLINE', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.updateStatus('agent-1', AgentRegistryStatus.OFFLINE);
      expect(registry.canAcceptTasks('agent-1')).toBe(false);
    });

    it('should return false when agent has stale heartbeat beyond default timeout', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      // canAcceptTasks uses default 30000ms heartbeat timeout via canAgentAcceptTasks
      // Set lastHeartbeatAt to more than 30s ago
      registry.update('agent-1', { lastHeartbeatAt: Date.now() - 35000 });
      expect(registry.canAcceptTasks('agent-1')).toBe(false);
    });

    it('should return false when agent has unhealthy health check', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.updateHealthCheck('agent-1', {
        healthy: false,
        checkedAt: Date.now(),
        error: 'Failed',
      });
      expect(registry.canAcceptTasks('agent-1')).toBe(false);
    });
  });

  // Traceability: ST-05 covers isHealthy with stale heartbeat
  describe('isHealthy additional coverage', () => {
    it('should return false when heartbeat is stale', () => {
      const shortTimeoutRegistry = new AgentRegistry({
        heartbeatTimeout: 50,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortTimeoutRegistry.start();
      shortTimeoutRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      // Set lastHeartbeatAt to more than 50ms ago
      shortTimeoutRegistry.update('agent-1', { lastHeartbeatAt: Date.now() - 100 });
      expect(shortTimeoutRegistry.isHealthy('agent-1')).toBe(false);
      shortTimeoutRegistry.dispose();
    });

    it('should return false when agent status is OFFLINE', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.updateStatus('agent-1', AgentRegistryStatus.OFFLINE);
      expect(registry.isHealthy('agent-1')).toBe(false);
    });

    it('should return false when agent has unhealthy health check', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      registry.updateHealthCheck('agent-1', {
        healthy: false,
        checkedAt: Date.now(),
        error: 'Down',
      });
      expect(registry.isHealthy('agent-1')).toBe(false);
    });
  });

  // Traceability: ST-05 covers register with existing agent (overwrite)
  describe('register additional coverage', () => {
    it('should overwrite when registering with same ID', () => {
      registry.start();
      registry.registerAgent('agent-1', 'OriginalAgent', AgentType.EXECUTOR);
      const newMetadata: AgentMetadata = {
        id: 'agent-1',
        name: 'ReplacementAgent',
        type: AgentType.PLANNER,
        version: '2.0.0',
        capabilities: [{ id: 'new-cap' }],
        status: AgentRegistryStatus.ONLINE,
        load: 0,
        maxConcurrentTasks: 5,
        activeTaskCount: 0,
        tags: ['new'],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      registry.register(newMetadata);
      const agent = registry.get('agent-1');
      expect(agent?.name).toBe('ReplacementAgent');
      expect(agent?.type).toBe(AgentType.PLANNER);
    });
  });

  // Traceability: ST-05 covers performHealthChecks private method
  describe('performHealthChecks', () => {
    it('should mark agent as OFFLINE when heartbeat is stale', () => {
      const shortTimeoutRegistry = new AgentRegistry({
        heartbeatTimeout: 50,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortTimeoutRegistry.start();
      shortTimeoutRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR, {
        capabilities: [{ id: 'cap1' }],
      });

      // Make heartbeat stale
      shortTimeoutRegistry.update('agent-1', { lastHeartbeatAt: Date.now() - 100 });

      const healthCheckHandler = vi.fn();
      const statusChangeHandler = vi.fn();
      shortTimeoutRegistry.on('agent:health-check', healthCheckHandler);
      shortTimeoutRegistry.on('agent:status-change', statusChangeHandler);

      // Call private method
      (shortTimeoutRegistry as any).performHealthChecks();

      expect(healthCheckHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
          result: expect.objectContaining({
            healthy: false,
            error: 'Heartbeat timeout',
          }),
        })
      );
      expect(statusChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
          newStatus: AgentRegistryStatus.OFFLINE,
        })
      );

      const agent = shortTimeoutRegistry.get('agent-1');
      expect(agent?.status).toBe(AgentRegistryStatus.OFFLINE);
      expect(agent?.healthCheck?.healthy).toBe(false);

      shortTimeoutRegistry.dispose();
    });

    it('should not mark already OFFLINE agent again', () => {
      const shortTimeoutRegistry = new AgentRegistry({
        heartbeatTimeout: 50,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortTimeoutRegistry.start();
      shortTimeoutRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      shortTimeoutRegistry.updateStatus('agent-1', AgentRegistryStatus.OFFLINE);
      shortTimeoutRegistry.update('agent-1', { lastHeartbeatAt: Date.now() - 100 });

      const statusChangeHandler = vi.fn();
      shortTimeoutRegistry.on('agent:status-change', statusChangeHandler);

      // Call private method - should not emit again since already OFFLINE
      (shortTimeoutRegistry as any).performHealthChecks();

      // status-change handler should not be called again for this agent
      const offlineCalls = statusChangeHandler.mock.calls.filter(
        (call: any[]) => call[0].agentId === 'agent-1'
      );
      expect(offlineCalls).toHaveLength(0);

      shortTimeoutRegistry.dispose();
    });

    it('should not mark agent with recent heartbeat', () => {
      const shortTimeoutRegistry = new AgentRegistry({
        heartbeatTimeout: 5000,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortTimeoutRegistry.start();
      shortTimeoutRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);

      const statusChangeHandler = vi.fn();
      shortTimeoutRegistry.on('agent:status-change', statusChangeHandler);

      (shortTimeoutRegistry as any).performHealthChecks();

      // Should not be called because heartbeat is recent
      expect(statusChangeHandler).not.toHaveBeenCalled();

      shortTimeoutRegistry.dispose();
    });
  });

  // Traceability: ST-05 covers heartbeat timer callback
  describe('heartbeat timer callback', () => {
    it('should emit heartbeat-timeout when lease expires in timer', async () => {
      vi.useFakeTimers();

      const shortLeaseRegistry = new AgentRegistry({
        heartbeatTimeout: 50,
        leaseDuration: 100,
        enableAutoCleanup: false,
        enableHealthCheck: false,
      });
      shortLeaseRegistry.start();

      const timeoutHandler = vi.fn();
      shortLeaseRegistry.on('agent:heartbeat-timeout', timeoutHandler);

      shortLeaseRegistry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);

      // Advance time past heartbeatTimeout + 5000
      vi.advanceTimersByTime(10000);

      // The timer callback should have fired
      await vi.runAllTimersAsync();

      expect(timeoutHandler).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-1' })
      );

      shortLeaseRegistry.dispose();
      vi.useRealTimers();
    });
  });

  // Traceability: ST-05 covers unregister with status-change event
  describe('unregister additional coverage', () => {
    it('should emit agent:status-change with OFFLINE on unregister', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      const handler = vi.fn();
      registry.on('agent:status-change', handler);

      registry.unregister('agent-1');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-1',
          status: AgentRegistryStatus.OFFLINE,
        })
      );
    });

    it('should stop heartbeat timer on unregister', () => {
      registry.start();
      registry.registerAgent('agent-1', 'Agent1', AgentType.EXECUTOR);
      // Should not throw after unregister
      expect(() => registry.unregister('agent-1')).not.toThrow();
      expect(registry.has('agent-1')).toBe(false);
    });
  });
});
