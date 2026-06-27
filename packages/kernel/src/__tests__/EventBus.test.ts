/**
 * EventBus Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, KernelEvents } from '../kernel/EventBus.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({ async: false });
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('on() - Subscribe to events', () => {
    it('should subscribe to an event and receive emissions', () => {
      const listener = vi.fn();
      eventBus.on('testEvent', listener);

      eventBus.emit('testEvent', { message: 'hello' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testEvent',
          data: { message: 'hello' },
        })
      );
    });

    it('should allow multiple listeners for the same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('testEvent', listener1);
      eventBus.on('testEvent', listener2);

      eventBus.emit('testEvent', { data: 'test' });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should return an unsubscribe function', () => {
      const listener = vi.fn();
      const subscription = eventBus.on('testEvent', listener);

      subscription.unsubscribe();

      eventBus.emit('testEvent', { data: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('once() - Single subscription', () => {
    it('should only call listener once', () => {
      const listener = vi.fn();
      eventBus.once('testEvent', listener);

      eventBus.emit('testEvent', { data: 'first' });
      eventBus.emit('testEvent', { data: 'second' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ data: { data: 'first' } }));
    });

    it('should return an unsubscribe function that removes the listener', () => {
      const listener = vi.fn();
      const subscription = eventBus.once('testEvent', listener);

      subscription.unsubscribe();

      eventBus.emit('testEvent', { data: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('off() - Unsubscribe from events', () => {
    it('should unsubscribe a specific listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('testEvent', listener1);
      eventBus.on('testEvent', listener2);

      eventBus.off('testEvent', listener1);

      eventBus.emit('testEvent', { data: 'test' });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle unsubscribing a non-existent listener', () => {
      const listener = vi.fn();
      // Should not throw
      eventBus.off('testEvent', listener);

      eventBus.emit('testEvent', { data: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('emit() - Trigger events', () => {
    it('should emit events with data', () => {
      const listener = vi.fn();
      eventBus.on('testEvent', listener);

      const testData = { value: 123, name: 'test' };
      eventBus.emit('testEvent', testData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'testEvent',
          data: testData,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should include source in emitted event', () => {
      const listener = vi.fn();
      eventBus.on('testEvent', listener);

      eventBus.emit('testEvent', { data: 'test' }, 'source-plugin');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'source-plugin',
        })
      );
    });

    it('should not throw if no listeners are subscribed', () => {
      expect(() => {
        eventBus.emit('noListeners', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('removeAllListeners() - Remove all listeners', () => {
    it('should remove all listeners for a specific event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('event1', listener1);
      eventBus.on('event2', listener2);

      eventBus.removeAllListeners('event1');

      eventBus.emit('event1', {});
      eventBus.emit('event2', {});

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners when no event type is specified', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('event1', listener1);
      eventBus.on('event2', listener2);

      eventBus.removeAllListeners();

      eventBus.emit('event1', {});
      eventBus.emit('event2', {});

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount() - Get listener count', () => {
    it('should return the correct number of listeners', () => {
      expect(eventBus.listenerCount('testEvent')).toBe(0);

      eventBus.on('testEvent', vi.fn());
      expect(eventBus.listenerCount('testEvent')).toBe(1);

      eventBus.on('testEvent', vi.fn());
      expect(eventBus.listenerCount('testEvent')).toBe(2);
    });

    it('should return 0 for non-existent events', () => {
      expect(eventBus.listenerCount('nonExistent')).toBe(0);
    });
  });

  describe('eventTypes() - Get registered event types', () => {
    it('should return list of registered event types', () => {
      eventBus.on('event1', vi.fn());
      eventBus.on('event2', vi.fn());
      eventBus.on('event3', vi.fn());

      const types = eventBus.eventTypes();

      expect(types).toContain('event1');
      expect(types).toContain('event2');
      expect(types).toContain('event3');
      expect(types.length).toBe(3);
    });

    it('should return empty array when no events are registered', () => {
      expect(eventBus.eventTypes()).toEqual([]);
    });
  });

  describe('KernelEvents constants', () => {
    it('should have all required event constants', () => {
      expect(KernelEvents.KERNEL_INIT).toBe('kernel:init');
      expect(KernelEvents.KERNEL_START).toBe('kernel:start');
      expect(KernelEvents.KERNEL_STOP).toBe('kernel:stop');
      expect(KernelEvents.PLUGIN_REGISTER).toBe('plugin:register');
      expect(KernelEvents.PLUGIN_UNREGISTER).toBe('plugin:unregister');
      expect(KernelEvents.PLUGIN_ERROR).toBe('plugin:error');
      expect(KernelEvents.CONFIG_UPDATE).toBe('config:update');
    });
  });

  describe('Error handling in listeners', () => {
    it('should catch errors in sync listeners without crashing', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      eventBus.on('errorEvent', errorListener);
      eventBus.on('errorEvent', normalListener);

      // Should not throw
      expect(() => {
        eventBus.emit('errorEvent', {});
      }).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Async dispatch mode', () => {
    it('should dispatch events asynchronously by default', async () => {
      // Create a sync EventBus for this specific test
      const asyncEventBus = new EventBus({ async: true });
      const listener = vi.fn();
      asyncEventBus.on('asyncEvent', listener);

      asyncEventBus.emit('asyncEvent', { data: 'test' });

      // Listener should not be called immediately
      expect(listener).not.toHaveBeenCalled();

      // Wait for async dispatch
      await new Promise(resolve => setImmediate(resolve));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should dispatch events synchronously when async is false', () => {
      const syncEventBus = new EventBus({ async: false });
      const listener = vi.fn();
      syncEventBus.on('syncEvent', listener);

      syncEventBus.emit('syncEvent', { data: 'test' });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Wildcard subscription', () => {
    it('should subscribe to multiple events using wildcard pattern user:*', () => {
      const syncEventBus = new EventBus({ async: false });
      const listener = vi.fn();

      syncEventBus.onWildcard('user:*', listener);

      syncEventBus.emit('user:created', { id: 1 });
      syncEventBus.emit('user:updated', { id: 1 });
      syncEventBus.emit('user:deleted', { id: 1 });

      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ type: 'user:created', data: { id: 1 } })
      );
      expect(listener).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: 'user:updated', data: { id: 1 } })
      );
      expect(listener).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ type: 'user:deleted', data: { id: 1 } })
      );
    });

    it('should not match events that do not match the pattern', () => {
      const syncEventBus = new EventBus({ async: false });
      const listener = vi.fn();

      syncEventBus.onWildcard('user:*', listener);

      syncEventBus.emit('user:created', { id: 1 });
      syncEventBus.emit('post:created', { id: 1 });
      syncEventBus.emit('admin:login', { id: 1 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'user:created' }));
    });

    it('should return unsubscribe function for wildcard subscription', () => {
      const syncEventBus = new EventBus({ async: false });
      const listener = vi.fn();

      const subscription = syncEventBus.onWildcard('user:*', listener);
      subscription.unsubscribe();

      syncEventBus.emit('user:created', { id: 1 });
      syncEventBus.emit('user:updated', { id: 1 });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle offWildcard to remove specific wildcard listener', () => {
      const syncEventBus = new EventBus({ async: false });
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      syncEventBus.onWildcard('user:*', listener1);
      syncEventBus.onWildcard('user:*', listener2);

      syncEventBus.emit('user:created', { id: 1 });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      syncEventBus.offWildcard('user:*', listener1);

      syncEventBus.emit('user:updated', { id: 1 });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);
    });

    it('should work with async dispatch mode', async () => {
      const asyncEventBus = new EventBus({ async: true });
      const listener = vi.fn();

      asyncEventBus.onWildcard('user:*', listener);

      asyncEventBus.emit('user:created', { id: 1 });
      asyncEventBus.emit('user:updated', { id: 1 });

      expect(listener).not.toHaveBeenCalled();

      await new Promise(resolve => setImmediate(resolve));

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple wildcard patterns', () => {
      const syncEventBus = new EventBus({ async: false });
      const userListener = vi.fn();
      const orderListener = vi.fn();

      syncEventBus.onWildcard('user:*', userListener);
      syncEventBus.onWildcard('order:*', orderListener);

      syncEventBus.emit('user:created', { id: 1 });
      syncEventBus.emit('order:placed', { id: 101 });
      syncEventBus.emit('user:updated', { id: 2 });

      expect(userListener).toHaveBeenCalledTimes(2);
      expect(orderListener).toHaveBeenCalledTimes(1);
    });

    it('should match suffix wildcard pattern *:created', () => {
      const syncEventBus = new EventBus({ async: false });
      const listener = vi.fn();

      syncEventBus.onWildcard('*:created', listener);

      syncEventBus.emit('user:created', { id: 1 });
      syncEventBus.emit('order:created', { id: 2 });
      syncEventBus.emit('user:updated', { id: 3 });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should match wildcard pattern with middle asterisk', () => {
      const syncEventBus = new EventBus({ async: false });
      const listener = vi.fn();

      syncEventBus.onWildcard('user:*:done', listener);

      syncEventBus.emit('user:task:done', { id: 1 });
      syncEventBus.emit('user:action:done', { id: 2 });
      syncEventBus.emit('user:created', { id: 3 });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should catch errors in async wildcard listeners', async () => {
      const asyncEventBus = new EventBus({ async: true });
      const errorListener = vi.fn(() => {
        throw new Error('Wildcard error');
      });
      const normalListener = vi.fn();

      asyncEventBus.onWildcard('user:*', errorListener);
      asyncEventBus.onWildcard('user:*', normalListener);

      asyncEventBus.emit('user:created', { id: 1 });

      await new Promise(resolve => setImmediate(resolve));

      expect(normalListener).toHaveBeenCalledTimes(1);
    });

    it('should catch errors in sync wildcard listeners', () => {
      const syncEventBus = new EventBus({ async: false });
      const errorListener = vi.fn(() => {
        throw new Error('Wildcard error');
      });
      const normalListener = vi.fn();

      syncEventBus.onWildcard('user:*', errorListener);
      syncEventBus.onWildcard('user:*', normalListener);

      expect(() => {
        syncEventBus.emit('user:created', { id: 1 });
      }).not.toThrow();

      expect(normalListener).toHaveBeenCalledTimes(1);
    });
  });
});
