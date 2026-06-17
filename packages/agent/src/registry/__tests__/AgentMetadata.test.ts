import { describe, it, expect } from 'vitest';
import type {
  AgentCapability,
  AgentMetadata,
  RegistryEntry,
  AgentSelector,
  RegistryStats,
} from '../AgentMetadata.js';
import {
  AgentType,
  AgentRegistryStatus,
  createAgentMetadata,
  createHealthCheckResult,
  isAgentHealthy,
  canAgentAcceptTasks,
  compareByLoad,
  compareByCapability,
  serializeEntry,
  deserializeEntry,
} from '../AgentMetadata.js';

describe('AgentMetadata', () => {
  describe('AgentType enum', () => {
    it('should have correct enum values', () => {
      expect(AgentType.ORCHESTRATOR).toBe('orchestrator');
      expect(AgentType.EXECUTOR).toBe('executor');
      expect(AgentType.PLANNER).toBe('planner');
      expect(AgentType.MONITOR).toBe('monitor');
      expect(AgentType.CUSTOM).toBe('custom');
    });
  });

  describe('AgentRegistryStatus enum', () => {
    it('should have correct status values', () => {
      expect(AgentRegistryStatus.ONLINE).toBe('online');
      expect(AgentRegistryStatus.BUSY).toBe('busy');
      expect(AgentRegistryStatus.UNAVAILABLE).toBe('unavailable');
      expect(AgentRegistryStatus.OFFLINE).toBe('offline');
    });
  });

  describe('createAgentMetadata', () => {
    it('should create metadata with required fields', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);

      expect(metadata.id).toBe('agent-1');
      expect(metadata.name).toBe('TestAgent');
      expect(metadata.type).toBe(AgentType.EXECUTOR);
    });

    it('should set default version', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      expect(metadata.version).toBe('0.1.0');
    });

    it('should set default values', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);

      expect(metadata.status).toBe(AgentRegistryStatus.ONLINE);
      expect(metadata.load).toBe(0);
      expect(metadata.childIds).toEqual([]);
      expect(metadata.maxConcurrentTasks).toBe(10);
      expect(metadata.activeTaskCount).toBe(0);
      expect(metadata.tags).toEqual([]);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR);
      const after = Date.now();

      expect(metadata.registeredAt).toBeGreaterThanOrEqual(before);
      expect(metadata.registeredAt).toBeLessThanOrEqual(after);
      expect(metadata.lastHeartbeatAt).toBeGreaterThanOrEqual(before);
      expect(metadata.lastHeartbeatAt).toBeLessThanOrEqual(after);
    });

    it('should accept options', () => {
      const metadata = createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR, {
        version: '2.0.0',
        capabilities: [{ id: 'cap1', description: 'Capability 1' }],
        maxConcurrentTasks: 20,
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
      });

      expect(metadata.version).toBe('2.0.0');
      expect(metadata.capabilities).toHaveLength(1);
      expect(metadata.maxConcurrentTasks).toBe(20);
      expect(metadata.tags).toEqual(['tag1', 'tag2']);
      expect(metadata.metadata).toEqual({ key: 'value' });
    });
  });

  describe('createHealthCheckResult', () => {
    it('should create healthy result', () => {
      const result = createHealthCheckResult(true, 100);
      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBe(100);
      expect(result.checkedAt).toBeDefined();
    });

    it('should create unhealthy result with error', () => {
      const result = createHealthCheckResult(false, undefined, 'Service unavailable');
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });

    it('should accept details', () => {
      const result = createHealthCheckResult(true, 50, undefined, { details: 'info' });
      expect(result.details).toEqual({ details: 'info' });
    });
  });

  describe('isAgentHealthy', () => {
    it('should return true for healthy agent', () => {
      const agent: AgentMetadata = {
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

      expect(isAgentHealthy(agent)).toBe(true);
    });

    it('should return false for offline agent', () => {
      const agent: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.OFFLINE,
        load: 0,
        maxConcurrentTasks: 10,
        activeTaskCount: 0,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(isAgentHealthy(agent)).toBe(false);
    });

    it('should return false for stale heartbeat', () => {
      const agent: AgentMetadata = {
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
        lastHeartbeatAt: Date.now() - 60000,
        childIds: [],
      };

      expect(isAgentHealthy(agent, 30000)).toBe(false);
    });

    it('should return false for unhealthy health check', () => {
      const agent: AgentMetadata = {
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
        healthCheck: { healthy: false, checkedAt: Date.now(), error: 'Unhealthy' },
        childIds: [],
      };

      expect(isAgentHealthy(agent)).toBe(false);
    });
  });

  describe('canAgentAcceptTasks', () => {
    it('should return true for healthy agent with capacity', () => {
      const agent: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.5,
        maxConcurrentTasks: 10,
        activeTaskCount: 5,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(canAgentAcceptTasks(agent)).toBe(true);
    });

    it('should return false when load is 1', () => {
      const agent: AgentMetadata = {
        id: 'agent-1',
        name: 'TestAgent',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 1,
        maxConcurrentTasks: 10,
        activeTaskCount: 10,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(canAgentAcceptTasks(agent)).toBe(false);
    });
  });

  describe('compareByLoad', () => {
    it('should sort by load ascending', () => {
      const a: AgentMetadata = {
        id: 'a',
        name: 'Agent A',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.8,
        maxConcurrentTasks: 10,
        activeTaskCount: 8,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      const b: AgentMetadata = {
        id: 'b',
        name: 'Agent B',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.3,
        maxConcurrentTasks: 10,
        activeTaskCount: 3,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(compareByLoad(a, b)).toBeGreaterThan(0);
      expect(compareByLoad(b, a)).toBeLessThan(0);
    });

    // Traceability: ST-05 covers compareByLoad equal-load branch
    it('should return 0 for equal loads', () => {
      const a: AgentMetadata = {
        id: 'a',
        name: 'Agent A',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.5,
        maxConcurrentTasks: 10,
        activeTaskCount: 5,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      const b: AgentMetadata = {
        id: 'b',
        name: 'Agent B',
        type: AgentType.EXECUTOR,
        version: '1.0.0',
        capabilities: [],
        status: AgentRegistryStatus.ONLINE,
        load: 0.5,
        maxConcurrentTasks: 10,
        activeTaskCount: 5,
        tags: [],
        registeredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        childIds: [],
      };

      expect(compareByLoad(a, b)).toBe(0);
    });
  });

  // Traceability: ST-05 covers compareByCapability all branches
  describe('compareByCapability', () => {
    const baseAgent = (id: string, load = 0.3): AgentMetadata => ({
      id,
      name: `Agent ${id}`,
      type: AgentType.EXECUTOR,
      version: '1.0.0',
      capabilities: [],
      status: AgentRegistryStatus.ONLINE,
      load,
      maxConcurrentTasks: 10,
      activeTaskCount: 3,
      tags: [],
      registeredAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      childIds: [],
    });

    it('should return -1 when only agent a has the capability', () => {
      const a: AgentMetadata = {
        ...baseAgent('a'),
        capabilities: [{ id: 'cap1', description: 'Capability 1' }],
      };
      const b = baseAgent('b');

      expect(compareByCapability(a, b, 'cap1')).toBe(-1);
    });

    it('should return 1 when only agent b has the capability', () => {
      const a = baseAgent('a');
      const b: AgentMetadata = {
        ...baseAgent('b'),
        capabilities: [{ id: 'cap1', description: 'Capability 1' }],
      };

      expect(compareByCapability(a, b, 'cap1')).toBe(1);
    });

    it('should compare by load when both agents have the capability', () => {
      const a: AgentMetadata = {
        ...baseAgent('a', 0.7),
        capabilities: [{ id: 'cap1' }],
      };
      const b: AgentMetadata = {
        ...baseAgent('b', 0.2),
        capabilities: [{ id: 'cap1' }],
      };

      // a.load - b.load = 0.7 - 0.2 = 0.5 > 0
      expect(compareByCapability(a, b, 'cap1')).toBeGreaterThan(0);
      expect(compareByCapability(b, a, 'cap1')).toBeLessThan(0);
    });

    it('should compare by load when neither agent has the capability', () => {
      const a = baseAgent('a', 0.4);
      const b = baseAgent('b', 0.6);

      // Falls through to compareByLoad
      expect(compareByCapability(a, b, 'cap1')).toBeLessThan(0);
      expect(compareByCapability(b, a, 'cap1')).toBeGreaterThan(0);
    });

    it('should return 0 when both agents have capability and equal load', () => {
      const a: AgentMetadata = {
        ...baseAgent('a', 0.5),
        capabilities: [{ id: 'cap1' }],
      };
      const b: AgentMetadata = {
        ...baseAgent('b', 0.5),
        capabilities: [{ id: 'cap1' }],
      };

      expect(compareByCapability(a, b, 'cap1')).toBe(0);
    });
  });

  // Traceability: ST-05 covers canAgentAcceptTasks additional branches
  describe('canAgentAcceptTasks edge cases', () => {
    const baseAgent = (overrides: Partial<AgentMetadata> = {}): AgentMetadata => ({
      id: 'agent-1',
      name: 'TestAgent',
      type: AgentType.EXECUTOR,
      version: '1.0.0',
      capabilities: [],
      status: AgentRegistryStatus.ONLINE,
      load: 0.5,
      maxConcurrentTasks: 10,
      activeTaskCount: 5,
      tags: [],
      registeredAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      childIds: [],
      ...overrides,
    });

    it('should return false when activeTaskCount equals maxConcurrentTasks', () => {
      const agent = baseAgent({ activeTaskCount: 10, maxConcurrentTasks: 10 });
      expect(canAgentAcceptTasks(agent)).toBe(false);
    });

    it('should return false when activeTaskCount exceeds maxConcurrentTasks', () => {
      const agent = baseAgent({ activeTaskCount: 15, maxConcurrentTasks: 10 });
      expect(canAgentAcceptTasks(agent)).toBe(false);
    });

    it('should return false when status is UNAVAILABLE', () => {
      const agent = baseAgent({ status: AgentRegistryStatus.UNAVAILABLE });
      expect(canAgentAcceptTasks(agent)).toBe(false);
    });

    it('should return false when status is BUSY', () => {
      const agent = baseAgent({ status: AgentRegistryStatus.BUSY });
      expect(canAgentAcceptTasks(agent)).toBe(false);
    });

    it('should return false when status is OFFLINE', () => {
      const agent = baseAgent({ status: AgentRegistryStatus.OFFLINE });
      expect(canAgentAcceptTasks(agent)).toBe(false);
    });

    it('should return false when load is exactly 1', () => {
      const agent = baseAgent({ load: 1, activeTaskCount: 5 });
      expect(canAgentAcceptTasks(agent)).toBe(false);
    });

    it('should return false when load exceeds 1', () => {
      const agent = baseAgent({ load: 1.5, activeTaskCount: 5 });
      expect(canAgentAcceptTasks(agent)).toBe(false);
    });

    it('should return true when load is just below 1 with capacity', () => {
      const agent = baseAgent({ load: 0.99, activeTaskCount: 9, maxConcurrentTasks: 10 });
      expect(canAgentAcceptTasks(agent)).toBe(true);
    });
  });

  // Traceability: ST-05 covers isAgentHealthy additional branches
  describe('isAgentHealthy edge cases', () => {
    const baseAgent = (overrides: Partial<AgentMetadata> = {}): AgentMetadata => ({
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
      ...overrides,
    });

    it('should return false for UNAVAILABLE status', () => {
      const agent = baseAgent({ status: AgentRegistryStatus.UNAVAILABLE });
      expect(isAgentHealthy(agent)).toBe(false);
    });

    it('should return false for BUSY status', () => {
      const agent = baseAgent({ status: AgentRegistryStatus.BUSY });
      expect(isAgentHealthy(agent)).toBe(false);
    });

    it('should return true with default heartbeat timeout', () => {
      const agent = baseAgent({ lastHeartbeatAt: Date.now() - 5000 });
      expect(isAgentHealthy(agent)).toBe(true);
    });

    it('should return true when healthCheck is healthy', () => {
      const agent = baseAgent({
        healthCheck: { healthy: true, checkedAt: Date.now() },
      });
      expect(isAgentHealthy(agent)).toBe(true);
    });

    it('should return true when healthCheck is undefined (default healthy)', () => {
      const agent = baseAgent();
      expect(isAgentHealthy(agent)).toBe(true);
    });

    it('should return false when heartbeat is exactly at boundary', () => {
      // lastHeartbeatAt - now = heartbeatTimeout (>= boundary)
      const agent = baseAgent({ lastHeartbeatAt: Date.now() - 30000 });
      // 30000 < 30000 is false, so should be unhealthy
      expect(isAgentHealthy(agent, 30000)).toBe(false);
    });
  });

  // Traceability: ST-05 covers createHealthCheckResult full param coverage
  describe('createHealthCheckResult full coverage', () => {
    it('should create healthy result with all params', () => {
      const before = Date.now();
      const result = createHealthCheckResult(true, 200, undefined, { region: 'us-east' });
      const after = Date.now();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBe(200);
      expect(result.error).toBeUndefined();
      expect(result.details).toEqual({ region: 'us-east' });
      expect(result.checkedAt).toBeGreaterThanOrEqual(before);
      expect(result.checkedAt).toBeLessThanOrEqual(after);
    });

    it('should create unhealthy result without response time or details', () => {
      const result = createHealthCheckResult(false, undefined, 'Connection refused');
      expect(result.healthy).toBe(false);
      expect(result.responseTime).toBeUndefined();
      expect(result.error).toBe('Connection refused');
      expect(result.details).toBeUndefined();
    });
  });

  // Traceability: ST-05 covers serializeEntry/deserializeEntry with healthCheck
  describe('serializeEntry/deserializeEntry edge cases', () => {
    it('should preserve healthCheck in round-trip', () => {
      const entry: RegistryEntry = {
        agent: {
          ...createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR),
          healthCheck: {
            healthy: false,
            checkedAt: 12345,
            responseTime: 500,
            error: 'Timeout',
            details: { reason: 'slow' },
          },
        },
        leaseExpiresAt: 99999,
        version: 3,
      };

      const serialized = serializeEntry(entry);
      expect(typeof serialized).toBe('string');

      const deserialized = deserializeEntry(serialized);
      expect(deserialized.agent.healthCheck?.healthy).toBe(false);
      expect(deserialized.agent.healthCheck?.error).toBe('Timeout');
      expect(deserialized.agent.healthCheck?.details).toEqual({ reason: 'slow' });
      expect(deserialized.leaseExpiresAt).toBe(99999);
      expect(deserialized.version).toBe(3);
    });

    it('should preserve capabilities and tags in round-trip', () => {
      const entry: RegistryEntry = {
        agent: createAgentMetadata('agent-2', 'CapAgent', AgentType.PLANNER, {
          version: '3.1.4',
          capabilities: [
            { id: 'cap1', description: 'First', version: '1.0' },
            { id: 'cap2', description: 'Second' },
          ],
          tags: ['production', 'critical'],
          metadata: { region: 'eu-west' },
        }),
        leaseExpiresAt: 55555,
        version: 7,
      };

      const deserialized = deserializeEntry(serializeEntry(entry));
      expect(deserialized.agent.capabilities).toHaveLength(2);
      expect(deserialized.agent.capabilities[0].id).toBe('cap1');
      expect(deserialized.agent.tags).toEqual(['production', 'critical']);
      expect(deserialized.agent.metadata).toEqual({ region: 'eu-west' });
      expect(deserialized.agent.version).toBe('3.1.4');
    });
  });

  // Traceability: ST-05 covers createAgentMetadata with all options
  describe('createAgentMetadata full options', () => {
    it('should set all option fields', () => {
      const metadata = createAgentMetadata('agent-x', 'FullAgent', AgentType.ORCHESTRATOR, {
        version: '5.0.0',
        capabilities: [{ id: 'cap1' }, { id: 'cap2' }],
        maxConcurrentTasks: 50,
        tags: ['a', 'b', 'c'],
        metadata: { custom: 'data', nested: { value: 42 } },
      });

      expect(metadata.id).toBe('agent-x');
      expect(metadata.name).toBe('FullAgent');
      expect(metadata.type).toBe(AgentType.ORCHESTRATOR);
      expect(metadata.version).toBe('5.0.0');
      expect(metadata.capabilities).toHaveLength(2);
      expect(metadata.maxConcurrentTasks).toBe(50);
      expect(metadata.tags).toEqual(['a', 'b', 'c']);
      expect(metadata.metadata).toEqual({ custom: 'data', nested: { value: 42 } });
    });

    it('should default capabilities to empty array when not provided', () => {
      const metadata = createAgentMetadata('a', 'A', AgentType.MONITOR);
      expect(metadata.capabilities).toEqual([]);
      expect(metadata.tags).toEqual([]);
      expect(metadata.childIds).toEqual([]);
    });
  });

  describe('serializeEntry/deserializeEntry', () => {
    it('should serialize and deserialize entry', () => {
      const entry: RegistryEntry = {
        agent: createAgentMetadata('agent-1', 'TestAgent', AgentType.EXECUTOR),
        leaseExpiresAt: Date.now() + 60000,
        version: 1,
      };

      const serialized = serializeEntry(entry);
      const deserialized = deserializeEntry(serialized);

      expect(deserialized.agent.id).toBe('agent-1');
      expect(deserialized.leaseExpiresAt).toBe(entry.leaseExpiresAt);
      expect(deserialized.version).toBe(1);
    });
  });

  describe('AgentCapability interface', () => {
    it('should accept capability with all fields', () => {
      const capability: AgentCapability = {
        id: 'cap1',
        description: 'Test capability',
        version: '1.0.0',
      };
      expect(capability.id).toBe('cap1');
    });
  });

  describe('AgentSelector interface', () => {
    it('should accept selector with type filter', () => {
      const selector: AgentSelector = { type: AgentType.EXECUTOR };
      expect(selector.type).toBe(AgentType.EXECUTOR);
    });

    it('should accept selector with custom filter', () => {
      const selector: AgentSelector = {
        filter: agent => agent.load < 0.5,
      };
      expect(selector.filter).toBeDefined();
    });
  });

  describe('RegistryStats interface', () => {
    it('should accept all required properties', () => {
      const stats: RegistryStats = {
        totalAgents: 10,
        onlineAgents: 5,
        busyAgents: 3,
        offlineAgents: 2,
        totalCapabilities: 15,
        averageLoad: 0.45,
      };

      expect(stats.totalAgents).toBe(10);
      expect(stats.averageLoad).toBe(0.45);
    });
  });
});
