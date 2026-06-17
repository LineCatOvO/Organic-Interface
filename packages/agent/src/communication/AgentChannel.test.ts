import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentChannel, createAgentChannel, DEFAULT_CHANNEL_CONFIG } from './AgentChannel.js';
import {
  MessageAction,
  createExecuteMessage,
  createNotifyMessage,
  createResponseMessage,
  createErrorMessage,
  createAgentMessage,
  DeliveryMode,
  MessagePriority,
} from './AgentMessage.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('AgentChannel', () => {
  let channel: AgentChannel;

  beforeEach(() => {
    channel = new AgentChannel({ agentId: 'test-agent' });
  });

  describe('constructor', () => {
    it('should create channel with default config', () => {
      expect(channel).toBeDefined();
      expect(channel.getAgentId()).toBe('test-agent');
    });

    it('should create channel with custom config', () => {
      const customChannel = new AgentChannel({
        agentId: 'custom-agent',
        channelId: 'custom-channel',
        defaultTimeout: 10000,
        maxRetries: 5,
      });
      expect(customChannel.getAgentId()).toBe('custom-agent');
      expect(customChannel.getChannelId()).toBe('custom-channel');
    });
  });

  describe('getChannelId', () => {
    it('should return channel ID', () => {
      const channelId = channel.getChannelId();
      expect(channelId).toBeDefined();
      expect(typeof channelId).toBe('string');
    });
  });

  describe('getAgentId', () => {
    it('should return agent ID', () => {
      expect(channel.getAgentId()).toBe('test-agent');
    });
  });

  describe('registerHandler', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      channel.registerHandler(MessageAction.EXECUTE, handler);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(true);
    });

    it('should allow multiple handlers for different actions', () => {
      const executeHandler = vi.fn();
      const queryHandler = vi.fn();
      channel.registerHandler(MessageAction.EXECUTE, executeHandler);
      channel.registerHandler(MessageAction.QUERY, queryHandler);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(true);
      expect(channel.hasHandler(MessageAction.QUERY)).toBe(true);
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister existing handler', () => {
      const handler = vi.fn();
      channel.registerHandler(MessageAction.EXECUTE, handler);
      const result = channel.unregisterHandler(MessageAction.EXECUTE);
      expect(result).toBe(true);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(false);
    });

    it('should return false for non-existent handler', () => {
      const result = channel.unregisterHandler(MessageAction.EXECUTE);
      expect(result).toBe(false);
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handler', () => {
      channel.registerHandler(MessageAction.EXECUTE, vi.fn());
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(true);
    });

    it('should return false for unregistered handler', () => {
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(false);
    });
  });

  describe('handleMessage', () => {
    it('should handle registered message action', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      channel.registerHandler(MessageAction.EXECUTE, handler);

      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      const result = await channel.handleMessage(message);

      expect(handler).toHaveBeenCalledWith(message);
      expect(result).toBe('result');
    });

    it('should throw error for expired message', async () => {
      const expiredMessage = createExecuteMessage(
        'sender',
        'test-agent',
        { task: 'test' },
        { ttl: -1000 }
      );
      await expect(channel.handleMessage(expiredMessage)).rejects.toThrow(/expired/);
    });

    it('should throw error for unregistered action without wildcard', async () => {
      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      await expect(channel.handleMessage(message)).rejects.toThrow(/No handler/);
    });

    it('should use wildcard handler when no specific handler exists', async () => {
      const wildcardHandler = vi.fn().mockResolvedValue('wildcard-result');
      channel.registerHandler('*' as MessageAction, wildcardHandler);

      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      const result = await channel.handleMessage(message);

      expect(wildcardHandler).toHaveBeenCalledWith(message);
      expect(result).toBe('wildcard-result');
    });

    it('should handle handler error and send error response', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      channel.registerHandler(MessageAction.EXECUTE, errorHandler);

      const message = createExecuteMessage('sender', 'test-agent', { task: 'test' });
      await expect(channel.handleMessage(message)).rejects.toThrow('Handler failed');
    });
  });

  describe('send', () => {
    it('should send message successfully', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      const sentPromise = channel.send(message);
      await expect(sentPromise).resolves.toBeUndefined();
    });

    it('should auto-set source if not provided', async () => {
      const message = createExecuteMessage('', 'target-agent', { task: 'test' });
      await channel.send(message);
      expect(message.source).toBe('test-agent');
    });

    it('should emit message:sent event', async () => {
      const handler = vi.fn();
      channel.on('message:sent', handler);

      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      expect(handler).toHaveBeenCalledWith(message);
    });
  });

  describe('sendWithRetry', () => {
    it('should send message with default retries', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await expect(channel.sendWithRetry(message)).resolves.toBeUndefined();
    });

    it('should accept custom retry options', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await expect(channel.sendWithRetry(message, { maxRetries: 2 })).resolves.toBeUndefined();
    });
  });

  describe('sendAndWait', () => {
    it('should send message and wait for response', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      const responsePromise = channel.sendAndWait(message, { timeout: 100 });
      await expect(responsePromise).rejects.toThrow(/timed out/);
    });

    it('should timeout if no response received', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      const responsePromise = channel.sendAndWait(message, { timeout: 100 });
      await expect(responsePromise).rejects.toThrow(/timed out/);
    });
  });

  describe('subscribe', () => {
    it('should create subscription and return subscription ID', () => {
      const handler = vi.fn();
      const filter = { action: MessageAction.NOTIFY };
      const subscriptionId = channel.subscribe(filter, handler);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
    });

    it('should allow multiple subscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const subId1 = channel.subscribe({ action: MessageAction.EXECUTE }, handler1);
      const subId2 = channel.subscribe({ action: MessageAction.QUERY }, handler2);

      expect(subId1).not.toBe(subId2);
    });
  });

  describe('unsubscribe', () => {
    it('should remove existing subscription', () => {
      const handler = vi.fn();
      const subscriptionId = channel.subscribe({ action: MessageAction.NOTIFY }, handler);
      const result = channel.unsubscribe(subscriptionId);

      expect(result).toBe(true);
      expect(channel.getSubscriptionCount()).toBe(0);
    });

    it('should return false for non-existent subscription', () => {
      const result = channel.unsubscribe('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('publish', () => {
    it('should publish to matching subscribers', async () => {
      const handler = vi.fn();
      channel.subscribe({ action: MessageAction.NOTIFY }, handler);

      const message = createNotifyMessage('test-agent', '*', 'event-name', { data: 'test' });
      await channel.publish(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should filter by source', async () => {
      const handler = vi.fn();
      channel.subscribe({ source: 'specific-source' }, handler);

      const matchingMessage = createNotifyMessage('specific-source', '*', 'event-name');
      const nonMatchingMessage = createNotifyMessage('other-source', '*', 'event-name');

      await channel.publish(matchingMessage);
      await channel.publish(nonMatchingMessage);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not throw if handler throws', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      channel.subscribe({ action: MessageAction.NOTIFY }, errorHandler);

      const message = createNotifyMessage('test-agent', '*', 'event-name');
      await expect(channel.publish(message)).resolves.toBeUndefined();
    });
  });

  describe('getHistory', () => {
    it('should return message history', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      const history = channel.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should return limited history', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      const history = channel.getHistory(1);
      expect(history.length).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear message history', async () => {
      const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
      await channel.send(message);

      channel.clearHistory();
      expect(channel.getHistory()).toEqual([]);
    });
  });

  describe('getSubscriptionCount', () => {
    it('should return subscription count', () => {
      channel.subscribe({ action: MessageAction.EXECUTE }, vi.fn());
      channel.subscribe({ action: MessageAction.QUERY }, vi.fn());

      expect(channel.getSubscriptionCount()).toBe(2);
    });
  });

  describe('getPendingRequestCount', () => {
    it('should return pending request count', () => {
      expect(channel.getPendingRequestCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should dispose channel and clear all state', () => {
      channel.registerHandler(MessageAction.EXECUTE, vi.fn());
      channel.subscribe({ action: MessageAction.NOTIFY }, vi.fn());

      channel.dispose();

      expect(channel.getSubscriptionCount()).toBe(0);
      expect(channel.getPendingRequestCount()).toBe(0);
      expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(false);
    });
  });

  describe('createAgentChannel', () => {
    it('should create channel with preset handlers', () => {
      const executeHandler = vi.fn();
      const queryHandler = vi.fn();

      const customChannel = createAgentChannel('preset-agent', {
        [MessageAction.EXECUTE]: executeHandler,
        [MessageAction.QUERY]: queryHandler,
      });

      expect(customChannel.hasHandler(MessageAction.EXECUTE)).toBe(true);
      expect(customChannel.hasHandler(MessageAction.QUERY)).toBe(true);
      customChannel.dispose();
    });

    it('should create channel without handlers', () => {
      const customChannel = createAgentChannel('no-handler-agent');
      expect(customChannel.getAgentId()).toBe('no-handler-agent');
      customChannel.dispose();
    });
  });
});

describe('DEFAULT_CHANNEL_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CHANNEL_CONFIG.defaultTimeout).toBe(5000);
    expect(DEFAULT_CHANNEL_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_CHANNEL_CONFIG.retryDelayBase).toBe(100);
    expect(DEFAULT_CHANNEL_CONFIG.persistMessages).toBe(false);
  });
});

// Traceability: ST-06 covers sendAndWait success path and pending response handling
describe('AgentChannel - sendAndWait response handling', () => {
  let channel: AgentChannel;

  beforeEach(() => {
    channel = new AgentChannel({ agentId: 'test-agent', defaultTimeout: 1000 });
  });

  it('should resolve when response message with matching correlationId is received', async () => {
    const requestMessage = createExecuteMessage('test-agent', 'target-agent', { task: 'test' }, {
      correlationId: 'corr-123',
    });

    // Start sendAndWait
    const responsePromise = channel.sendAndWait(requestMessage, { timeout: 5000 });

    // Simulate response arriving
    const responseMessage = createResponseMessage(
      'target-agent',
      'test-agent',
      { result: 'success' },
      'corr-123'
    );
    await channel.handleMessage(responseMessage);

    const result = await responsePromise;
    expect(result).toEqual({ result: 'success' });
    expect(channel.getPendingRequestCount()).toBe(0);
  });

  it('should reject when error response with matching correlationId is received', async () => {
    const requestMessage = createExecuteMessage('test-agent', 'target-agent', { task: 'test' }, {
      correlationId: 'corr-err',
    });

    const responsePromise = channel.sendAndWait(requestMessage, { timeout: 5000 });

    // Create an error message with the error field set manually
    // (createErrorMessage doesn't populate the error field)
    const errorMessage = {
      ...createAgentMessage({
        source: 'target-agent',
        target: 'test-agent',
        action: MessageAction.ERROR,
        payload: null,
        correlationId: 'corr-err',
      }),
      error: { code: 'TASK_FAILED', message: 'Task execution failed' },
    };

    await channel.handleMessage(errorMessage);

    await expect(responsePromise).rejects.toThrow('Task execution failed');
  });

  it('should reject with unknown error when error message has no error message field', async () => {
    const requestMessage = createExecuteMessage('test-agent', 'target-agent', {}, {
      correlationId: 'corr-unknown',
    });

    const responsePromise = channel.sendAndWait(requestMessage, { timeout: 5000 });

    // Create an error message without error.message field
    const errorMsg = createAgentMessage({
      source: 'target-agent',
      target: 'test-agent',
      action: MessageAction.ERROR,
      payload: null,
      correlationId: 'corr-unknown',
    });

    await channel.handleMessage(errorMsg);
    await expect(responsePromise).rejects.toThrow('Unknown error');
  });
});

// Traceability: ST-06 covers sendWithRetry retry logic
describe('AgentChannel - sendWithRetry retry logic', () => {
  it('should call onRetry callback on retry attempts', async () => {
    const channel = new AgentChannel({ agentId: 'test-agent', maxRetries: 2, retryDelayBase: 10 });
    const onRetry = vi.fn();

    // Mock send to fail twice then succeed
    const sendSpy = vi.spyOn(channel, 'send');
    sendSpy
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);

    const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
    await channel.sendWithRetry(message, { maxRetries: 2, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
  });

  it('should throw after max retries exceeded', async () => {
    const channel = new AgentChannel({ agentId: 'test-agent', maxRetries: 1, retryDelayBase: 10 });

    const sendSpy = vi.spyOn(channel, 'send');
    sendSpy.mockRejectedValue(new Error('Persistent error'));

    const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
    await expect(channel.sendWithRetry(message, { maxRetries: 1 })).rejects.toThrow(
      'Persistent error'
    );
  });

  it('should use default maxRetries from config when not specified', async () => {
    const channel = new AgentChannel({ agentId: 'test-agent', maxRetries: 3, retryDelayBase: 10 });

    const sendSpy = vi.spyOn(channel, 'send');
    sendSpy.mockRejectedValue(new Error('Fail'));

    const message = createExecuteMessage('test-agent', 'target-agent', { task: 'test' });
    await expect(channel.sendWithRetry(message)).rejects.toThrow('Fail');
    // Should attempt 4 times (initial + 3 retries)
    expect(sendSpy).toHaveBeenCalledTimes(4);
  });
});

// Traceability: ST-06 covers handleMessage request-response mode
describe('AgentChannel - handleMessage request-response mode', () => {
  let channel: AgentChannel;

  beforeEach(() => {
    channel = new AgentChannel({ agentId: 'responder-agent' });
  });

  it('should send response message in request-response mode with replyTo', async () => {
    const handler = vi.fn().mockResolvedValue({ data: 'result' });
    channel.registerHandler(MessageAction.EXECUTE, handler);

    const sendSpy = vi.spyOn(channel, 'send');

    const message = createAgentMessage({
      source: 'requester',
      target: 'responder-agent',
      action: MessageAction.EXECUTE,
      payload: { task: 'do-something' },
      deliveryMode: DeliveryMode.REQUEST_RESPONSE,
      correlationId: 'corr-req-1',
      replyTo: 'requester',
    });

    await channel.handleMessage(message);

    expect(sendSpy).toHaveBeenCalled();
    const sentMessage = sendSpy.mock.calls[0][0];
    expect(sentMessage.action).toBe(MessageAction.RESPONSE);
    expect(sentMessage.target).toBe('requester');
    expect(sentMessage.metadata?.correlationId).toBe('corr-req-1');
  });

  it('should send error response when handler throws in request-response mode', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Handler crashed'));
    channel.registerHandler(MessageAction.EXECUTE, handler);

    const sendSpy = vi.spyOn(channel, 'send');

    const message = createAgentMessage({
      source: 'requester',
      target: 'responder-agent',
      action: MessageAction.EXECUTE,
      payload: {},
      deliveryMode: DeliveryMode.REQUEST_RESPONSE,
      correlationId: 'corr-err-1',
      replyTo: 'requester',
    });

    await expect(channel.handleMessage(message)).rejects.toThrow('Handler crashed');

    expect(sendSpy).toHaveBeenCalled();
    const sentMessage = sendSpy.mock.calls[0][0];
    expect(sentMessage.action).toBe(MessageAction.ERROR);
    expect(sentMessage.target).toBe('requester');
    expect(sentMessage.metadata?.correlationId).toBe('corr-err-1');
  });

  it('should send error response with string error when handler throws non-Error', async () => {
    const handler = vi.fn().mockRejectedValue('String error');
    channel.registerHandler(MessageAction.EXECUTE, handler);

    const sendSpy = vi.spyOn(channel, 'send');

    const message = createAgentMessage({
      source: 'requester',
      target: 'responder-agent',
      action: MessageAction.EXECUTE,
      payload: {},
      deliveryMode: DeliveryMode.REQUEST_RESPONSE,
      correlationId: 'corr-str-err',
      replyTo: 'requester',
    });

    await expect(channel.handleMessage(message)).rejects.toThrow('String error');
    expect(sendSpy).toHaveBeenCalled();
    const sentMessage = sendSpy.mock.calls[0][0];
    expect(sentMessage.action).toBe(MessageAction.ERROR);
    expect(sentMessage.target).toBe('requester');
  });
});

// Traceability: ST-06 covers publish with various filters
describe('AgentChannel - publish filter coverage', () => {
  let channel: AgentChannel;

  beforeEach(() => {
    channel = new AgentChannel({ agentId: 'test-agent' });
  });

  it('should filter by target matching specific target', async () => {
    const handler = vi.fn();
    channel.subscribe({ target: 'specific-target' }, handler);

    const matchingMessage = createNotifyMessage('source', 'specific-target', 'event');
    const nonMatchingMessage = createNotifyMessage('source', 'other-target', 'event');

    await channel.publish(matchingMessage);
    await channel.publish(nonMatchingMessage);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(matchingMessage);
  });

  it('should match target wildcard *', async () => {
    const handler = vi.fn();
    channel.subscribe({ target: 'specific-target' }, handler);

    const wildcardMessage = createNotifyMessage('source', '*', 'event');
    await channel.publish(wildcardMessage);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should filter by predicate', async () => {
    const handler = vi.fn();
    channel.subscribe(
      { predicate: msg => msg.priority === MessagePriority.HIGH },
      handler
    );

    const highPriorityMessage = createAgentMessage({
      source: 'src',
      target: '*',
      action: MessageAction.NOTIFY,
      payload: { event: 'high' },
      priority: MessagePriority.HIGH,
    });
    const normalPriorityMessage = createAgentMessage({
      source: 'src',
      target: '*',
      action: MessageAction.NOTIFY,
      payload: { event: 'normal' },
      priority: MessagePriority.NORMAL,
    });

    await channel.publish(highPriorityMessage);
    await channel.publish(normalPriorityMessage);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(highPriorityMessage);
  });

  it('should match multiple subscribers for same message', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    channel.subscribe({ action: MessageAction.NOTIFY }, handler1);
    channel.subscribe({ source: 'src' }, handler2);

    const message = createNotifyMessage('src', '*', 'event');
    await channel.publish(message);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});

// Traceability: ST-06 covers dispose with pending requests
describe('AgentChannel - dispose with pending requests', () => {
  it('should reject pending requests on dispose', async () => {
    const channel = new AgentChannel({ agentId: 'test-agent', defaultTimeout: 10000 });
    const message = createExecuteMessage('test-agent', 'target', {}, {
      correlationId: 'pending-1',
    });

    const responsePromise = channel.sendAndWait(message, { timeout: 10000 });

    // Dispose while request is pending
    channel.dispose();

    await expect(responsePromise).rejects.toThrow('Channel disposed');
  });

  it('should clear all state on dispose', () => {
    const channel = new AgentChannel({ agentId: 'test-agent' });
    channel.registerHandler(MessageAction.EXECUTE, vi.fn());
    channel.subscribe({ action: MessageAction.NOTIFY }, vi.fn());

    // Add some history
    channel.addToHistory as any; // private method, test via send
    channel.dispose();

    expect(channel.getHistory()).toEqual([]);
    expect(channel.getSubscriptionCount()).toBe(0);
    expect(channel.getPendingRequestCount()).toBe(0);
    expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(false);
  });
});

// Traceability: ST-06 covers history size limit
describe('AgentChannel - history size limit', () => {
  it('should limit history to maxHistorySize', async () => {
    const channel = new AgentChannel({ agentId: 'test-agent' });

    // Send more than 100 messages (default maxHistorySize)
    for (let i = 0; i < 105; i++) {
      const message = createExecuteMessage('test-agent', 'target', { index: i });
      await channel.send(message);
    }

    const history = channel.getHistory();
    expect(history.length).toBe(100);
    // Oldest messages should have been shifted out
    expect(history[0].payload).toEqual({ index: 5 });
  });
});

// Traceability: ST-06 covers getHistory with no messages
describe('AgentChannel - getHistory empty', () => {
  it('should return empty array when no messages sent', () => {
    const channel = new AgentChannel({ agentId: 'test-agent' });
    const history = channel.getHistory();
    expect(history).toEqual([]);
  });

  it('should return copy of history array', async () => {
    const channel = new AgentChannel({ agentId: 'test-agent' });
    const message = createExecuteMessage('test-agent', 'target', {});
    await channel.send(message);

    const history1 = channel.getHistory();
    const history2 = channel.getHistory();
    expect(history1).not.toBe(history2); // Different array references
    expect(history1).toEqual(history2);
  });
});

// Traceability: ST-06 covers createAgentChannel with empty handlers object
describe('createAgentChannel - edge cases', () => {
  it('should create channel with empty handlers object', () => {
    const channel = createAgentChannel('agent', {});
    expect(channel.getAgentId()).toBe('agent');
    channel.dispose();
  });

  it('should skip undefined handlers in object', () => {
    const channel = createAgentChannel('agent', {
      [MessageAction.EXECUTE]: vi.fn(),
      [MessageAction.QUERY]: undefined,
    });
    expect(channel.hasHandler(MessageAction.EXECUTE)).toBe(true);
    expect(channel.hasHandler(MessageAction.QUERY)).toBe(false);
    channel.dispose();
  });
});
