/**
 * ProgressReporter
 *
 * Provides phased progress reporting with percentage,
 * step description, and estimated remaining time.
 */
import { EventEmitter } from 'events';

export interface ProgressStep {
  phase: string;
  description: string;
  percentage: number;
  timestamp: number;
}

export interface ProgressEstimate {
  elapsedMs: number;
  remainingMs: number;
  eta: number;
}

export interface ProgressEvent {
  id: string;
  step: ProgressStep;
  estimate: ProgressEstimate;
  totalSteps: number;
  completedSteps: number;
}

export interface ProgressReporterConfig {
  totalSteps: number;
  id?: string;
}

export class ProgressReporter extends EventEmitter {
  private config: { totalSteps: number; id: string };
  private steps: ProgressStep[] = [];
  private startedAt: number = 0;
  private completedAt: number = 0;

  constructor(config: ProgressReporterConfig) {
    super();
    this.config = {
      totalSteps: config.totalSteps,
      id: config.id ?? `progress-${Date.now()}`,
    };
  }

  get id(): string {
    return this.config.id;
  }

  get percentage(): number {
    if (this.steps.length === 0) return 0;
    return this.steps[this.steps.length - 1].percentage;
  }

  get elapsedMs(): number {
    if (this.startedAt === 0) return 0;
    const end = this.completedAt || Date.now();
    return end - this.startedAt;
  }

  start(phase: string, description: string): void {
    this.startedAt = Date.now();
    this.steps = [];
    this.report(phase, description, 0);
  }

  report(phase: string, description: string, percentage: number): void {
    const step: ProgressStep = {
      phase,
      description,
      percentage: Math.max(0, Math.min(100, percentage)),
      timestamp: Date.now(),
    };
    this.steps.push(step);
    const estimate = this.calculateEstimate();
    const event: ProgressEvent = {
      id: this.config.id,
      step,
      estimate,
      totalSteps: this.config.totalSteps,
      completedSteps: this.steps.length,
    };
    this.emit('progress', event);
  }

  complete(description: string): void {
    this.completedAt = Date.now();
    this.report('complete', description, 100);
    this.emit('complete', {
      id: this.config.id,
      steps: this.steps,
      totalMs: this.elapsedMs,
    });
  }

  fail(description: string, error?: Error): void {
    this.completedAt = Date.now();
    this.report('failed', description, this.percentage);
    this.emit('fail', {
      id: this.config.id,
      error: error?.message ?? description,
      steps: this.steps,
    });
  }

  getHistory(): ProgressStep[] {
    return [...this.steps];
  }

  private calculateEstimate(): ProgressEstimate {
    const elapsed = this.elapsedMs;
    const pct = this.percentage;
    if (pct <= 0) {
      return { elapsedMs: elapsed, remainingMs: 0, eta: 0 };
    }
    const totalEstimated = (elapsed / pct) * 100;
    const remaining = totalEstimated - elapsed;
    return {
      elapsedMs: elapsed,
      remainingMs: Math.max(0, remaining),
      eta: Date.now() + Math.max(0, remaining),
    };
  }
}