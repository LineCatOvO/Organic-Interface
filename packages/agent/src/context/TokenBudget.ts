/**
 * TokenBudget - Token counting and budget allocation
 */
import type { Message } from './Message.js';

export interface TokenBudgetConfig {
  charsPerToken?: number;
  overheadPerMessage?: number;
  modelMaxTokens?: number;
}

export interface BudgetAllocation {
  name: string;
  minTokens: number;
  maxTokens: number;
  priority: number;
}

export interface BudgetResult {
  allocations: Map<string, number>;
  totalUsed: number;
  remaining: number;
}

export const DEFAULT_TOKEN_BUDGET_CONFIG: TokenBudgetConfig = {
  charsPerToken: 4,
  overheadPerMessage: 5,
  modelMaxTokens: 4096,
};

export class TokenBudget {
  private config: TokenBudgetConfig;
  private usedTokens: number = 0;

  constructor(config: TokenBudgetConfig = {}) {
    this.config = { ...DEFAULT_TOKEN_BUDGET_CONFIG, ...config };
  }

  estimateTokens(text: string): number {
    const cpt = this.config.charsPerToken ?? 4;
    return Math.ceil(text.length / cpt);
  }

  estimateMessageTokens(message: Message): number {
    const text = message.content.text ?? '';
    const textTokens = this.estimateTokens(text);
    const overhead = this.config.overheadPerMessage ?? 5;
    return textTokens + overhead;
  }

  estimateMessagesTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0);
  }

  allocateBudget(totalBudget: number, allocations: BudgetAllocation[]): BudgetResult {
    const sorted = [...allocations].sort((a, b) => b.priority - a.priority);
    const result = new Map<string, number>();
    let remaining = totalBudget;

    for (const alloc of sorted) {
      const assigned = Math.min(alloc.maxTokens, remaining);
      result.set(alloc.name, Math.max(alloc.minTokens, assigned));
      remaining -= result.get(alloc.name) ?? 0;
    }

    return {
      allocations: result,
      totalUsed: totalBudget - remaining,
      remaining: Math.max(0, remaining),
    };
  }

  getMaxTokens(): number {
    return this.config.modelMaxTokens ?? 4096;
  }

  getRemainingBudget(messages: Message[]): number {
    const used = this.estimateMessagesTokens(messages);
    return Math.max(0, this.getMaxTokens() - used);
  }

  reset(): void {
    this.usedTokens = 0;
  }
}