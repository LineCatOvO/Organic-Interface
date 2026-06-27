/**
 * ApprovalPrompt - CLI approval interaction for tool execution
 */
import { createLogger, type Logger } from '@organic/utils';
import type { ApprovalResponse } from '@organic/tools';

export interface ApprovalRequest {
  toolId: string;
  toolName: string;
  operation: string;
  parameters: Record<string, unknown>;
  riskLevel: string;
}

export class ApprovalPrompt {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'approval' });
  }

  /**
   * Format an approval request for display
   */
  formatRequest(req: ApprovalRequest): string {
    const params = JSON.stringify(req.parameters, null, 2);
    return [
      `\n=== Approval Required ===`,
      `Tool: ${req.toolName} (${req.toolId})`,
      `Operation: ${req.operation}`,
      `Risk Level: ${req.riskLevel}`,
      `Parameters: ${params}`,
      `==========================`,
    ].join('\n');
  }

  /**
   * Request user approval for an operation
   * Supports: allow, deny, always allow
   */
  async requestApproval(req: ApprovalRequest): Promise<ApprovalResponse> {
    const formatted = this.formatRequest(req);
    this.logger.info(formatted);

    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string): Promise<string> =>
      new Promise(resolve => rl.question(q, resolve));

    const answer = await question(
      'Approve? [y]es/[n]o/[a]lways: '
    );
    rl.close();

    const normalized = answer.trim().toLowerCase();
    if (normalized === 'a' || normalized === 'always') return 'always_allow';
    if (normalized === 'y' || normalized === 'yes') return 'allow';
    return 'deny';
  }
}