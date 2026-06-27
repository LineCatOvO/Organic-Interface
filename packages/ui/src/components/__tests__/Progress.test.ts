import { describe, it, expect } from 'vitest';
import { Progress, createProgress, showProgress } from '../../components/Progress.js';

describe('Progress', () => {
  describe('constructor', () => {
    it('should create a progress instance', () => {
      const progress = new Progress({ total: 100 });
      expect(progress).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update progress', () => {
      const progress = new Progress({ total: 100 });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should not exceed total', () => {
      const progress = new Progress({ total: 100 });
      const state = progress.update(150);
      expect(state.current).toBeLessThanOrEqual(state.total);
    });

    it('should set completed and endTime when reaching total', () => {
      const progress = new Progress({ total: 100 });
      const state = progress.update(100);
      expect(state.completed).toBe(true);
      expect(state.endTime).toBeDefined();
    });

    it('should calculate remaining time (ETA)', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      const state = progress.getState();
      expect(state.remaining).toBeDefined();
    });
  });

  describe('increment', () => {
    it('should increment progress', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      const state = progress.increment(10);
      expect(state.current).toBe(60);
    });

    it('should increment by default value of 1', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      const state = progress.increment();
      expect(state.current).toBe(51);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      const state = progress.getState();
      expect(state.current).toBe(50);
      expect(state.completed).toBe(false);
    });

    it('should return completed true when progress reaches total', () => {
      const progress = new Progress({ total: 100 });
      progress.update(100);
      const state = progress.getState();
      expect(state.completed).toBe(true);
    });
  });

  describe('complete', () => {
    it('should mark progress as complete', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      progress.complete();
      const state = progress.getState();
      expect(state.completed).toBe(true);
      expect(state.percentage).toBe(100);
    });
  });

  describe('start', () => {
    it('should reset state and render when started', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      progress.start();
      const state = progress.getState();
      expect(state.current).toBe(0);
      expect(state.completed).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop the progress without marking complete', () => {
      const progress = new Progress({ total: 100, style: 'spinner' });
      progress.start();
      progress.update(50);
      progress.stop();
      const state = progress.getState();
      expect(state.completed).toBe(false);
    });
  });

  describe('different styles', () => {
    it('should render bar style', () => {
      const progress = new Progress({ total: 100, style: 'bar' });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should render spinner style', () => {
      const progress = new Progress({ total: 100, style: 'spinner' });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should render dots style', () => {
      const progress = new Progress({ total: 100, style: 'dots' });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should render percentage style', () => {
      const progress = new Progress({ total: 100, style: 'percentage' });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should render with showPercentage false', () => {
      const progress = new Progress({ total: 100, style: 'bar', showPercentage: false });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should render with showElapsed false', () => {
      const progress = new Progress({ total: 100, style: 'bar', showElapsed: false });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should render with custom label', () => {
      const progress = new Progress({ total: 100, label: 'Custom' });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should handle total of 0', () => {
      const progress = new Progress({ total: 0 });
      const state = progress.getState();
      expect(state.percentage).toBe(0);
    });
  });

  describe('createProgress', () => {
    it('should create Progress instance', () => {
      const progress = createProgress({ total: 100 });
      expect(progress).toBeDefined();
      expect(progress).toBeInstanceOf(Progress);
    });
  });

  describe('showProgress', () => {
    it('should execute without error', () => {
      expect(() => {
        showProgress('Test', 50, 100, 'bar');
      }).not.toThrow();
    });
  });
});
