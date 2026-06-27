import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProgressReporter } from '../ProgressReporter.js';

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;

  afterEach(() => {
    reporter.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create with custom id', () => {
      reporter = new ProgressReporter({ totalSteps: 5, id: 'custom-id' });
      expect(reporter.id).toBe('custom-id');
    });

    it('should generate default id when not provided', () => {
      reporter = new ProgressReporter({ totalSteps: 5 });
      expect(reporter.id).toMatch(/^progress-/);
    });
  });

  describe('start', () => {
    it('should initialize startedAt and emit first step', () => {
      const before = Date.now();
      reporter = new ProgressReporter({ totalSteps: 3 });
      const listener = vi.fn();
      reporter.on('progress', listener);
      reporter.start('init', 'Starting task');
      const after = Date.now();
      expect(listener).toHaveBeenCalledOnce();
      const event = listener.mock.calls[0][0];
      expect(event.step.phase).toBe('init');
      expect(event.step.percentage).toBe(0);
      expect(event.step.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.step.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('report', () => {
    it('should emit progress event with correct step data', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      const listener = vi.fn();
      reporter.on('progress', listener);
      reporter.report('build', 'Building project', 50);
      expect(listener).toHaveBeenCalledOnce();
      const event = listener.mock.calls[0][0];
      expect(event.step.phase).toBe('build');
      expect(event.step.description).toBe('Building project');
      expect(event.step.percentage).toBe(50);
      expect(event.completedSteps).toBe(1);
      expect(event.totalSteps).toBe(3);
    });
  });

  describe('percentage', () => {
    it('should return 0 when no steps reported', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      expect(reporter.percentage).toBe(0);
    });

    it('should clamp to [0, 100] range', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      const listener = vi.fn();
      reporter.on('progress', listener);
      reporter.report('t1', 'desc', -10);
      expect(listener.mock.calls[0][0].step.percentage).toBe(0);
      reporter.report('t2', 'desc', 150);
      expect(listener.mock.calls[1][0].step.percentage).toBe(100);
    });
  });

  describe('complete', () => {
    it('should emit complete event with 100% and totalMs', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      const completeListener = vi.fn();
      reporter.on('complete', completeListener);
      reporter.complete('Task finished');
      expect(completeListener).toHaveBeenCalledOnce();
      const data = completeListener.mock.calls[0][0];
      expect(data.id).toBe(reporter.id);
      expect(data.steps.length).toBe(1);
      expect(data.totalMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fail', () => {
    it('should emit fail event with error message', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      const failListener = vi.fn();
      reporter.on('fail', failListener);
      const err = new Error('Something broke');
      reporter.fail('Build failed', err);
      expect(failListener).toHaveBeenCalledOnce();
      const data = failListener.mock.calls[0][0];
      expect(data.error).toBe('Something broke');
      expect(data.steps.length).toBe(1);
    });
  });

  describe('getHistory', () => {
    it('should return a copy of steps array', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      reporter.report('p1', 'step1', 30);
      reporter.report('p2', 'step2', 60);
      const history = reporter.getHistory();
      expect(history).toHaveLength(2);
      history.push({ phase: 'x', description: 'x', percentage: 0, timestamp: 0 });
      expect(reporter.getHistory()).toHaveLength(2);
    });
  });

  describe('estimate calculation', () => {
    it('should calculate ETA based on elapsed time and percentage', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      const listener = vi.fn();
      reporter.on('progress', listener);
      reporter.report('p1', 'step1', 50);
      const event = listener.mock.calls[0][0];
      expect(event.estimate.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(event.estimate.remainingMs).toBeGreaterThanOrEqual(0);
      expect(event.estimate.eta).toBeGreaterThan(0);
    });

    it('should return zero remaining when percentage is 0', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      const listener = vi.fn();
      reporter.on('progress', listener);
      reporter.report('p1', 'step1', 0);
      const event = listener.mock.calls[0][0];
      expect(event.estimate.remainingMs).toBe(0);
      expect(event.estimate.eta).toBe(0);
    });
  });

  describe('elapsedMs', () => {
    it('should return 0 before start', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      expect(reporter.elapsedMs).toBe(0);
    });

    it('should return elapsed time after start', () => {
      reporter = new ProgressReporter({ totalSteps: 3 });
      reporter.start('init', 'begin');
      expect(reporter.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });
});