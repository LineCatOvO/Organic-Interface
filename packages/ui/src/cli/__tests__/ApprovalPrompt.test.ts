import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalPrompt } from '../ApprovalPrompt.js';
import type { ApprovalRequest } from '../ApprovalPrompt.js';

let mockAnswer = 'y';

vi.mock('readline', () => ({
  createInterface: () => ({
    question: (_q: string, cb: (a: string) => void) => cb(mockAnswer),
    close: vi.fn(),
  }),
}));

const mockReq: ApprovalRequest = {
  toolId: 'tool-1',
  toolName: 'TestTool',
  operation: 'read',
  parameters: { path: '/tmp/test.txt' },
  riskLevel: 'L2',
};

describe('ApprovalPrompt', () => {
  let prompt: ApprovalPrompt;

  beforeEach(() => {
    mockAnswer = 'y';
    prompt = new ApprovalPrompt();
  });

  describe('formatRequest', () => {
    it('should include tool name', () => {
      const result = prompt.formatRequest(mockReq);
      expect(result).toContain('TestTool');
    });

    it('should include tool id', () => {
      const result = prompt.formatRequest(mockReq);
      expect(result).toContain('tool-1');
    });

    it('should include operation', () => {
      const result = prompt.formatRequest(mockReq);
      expect(result).toContain('read');
    });

    it('should include risk level', () => {
      const result = prompt.formatRequest(mockReq);
      expect(result).toContain('L2');
    });

    it('should include parameters', () => {
      const result = prompt.formatRequest(mockReq);
      expect(result).toContain('/tmp/test.txt');
    });

    it('should handle empty parameters', () => {
      const req: ApprovalRequest = {
        toolId: 't1', toolName: 'T', operation: 'op',
        parameters: {}, riskLevel: 'L1',
      };
      const result = prompt.formatRequest(req);
      expect(result).toContain('{}');
    });
  });

  describe('requestApproval', () => {
    it('should return allow for y', async () => {
      mockAnswer = 'y';
      const result = await prompt.requestApproval(mockReq);
      expect(result).toBe('allow');
    });

    it('should return allow for yes', async () => {
      mockAnswer = 'yes';
      const result = await prompt.requestApproval(mockReq);
      expect(result).toBe('allow');
    });

    it('should return deny for n', async () => {
      mockAnswer = 'n';
      const result = await prompt.requestApproval(mockReq);
      expect(result).toBe('deny');
    });

    it('should return deny for no', async () => {
      mockAnswer = 'no';
      const result = await prompt.requestApproval(mockReq);
      expect(result).toBe('deny');
    });

    it('should return deny for random input', async () => {
      mockAnswer = 'xyz';
      const result = await prompt.requestApproval(mockReq);
      expect(result).toBe('deny');
    });

    it('should return always_allow for a', async () => {
      mockAnswer = 'a';
      const result = await prompt.requestApproval(mockReq);
      expect(result).toBe('always_allow');
    });

    it('should return always_allow for always', async () => {
      mockAnswer = 'always';
      const result = await prompt.requestApproval(mockReq);
      expect(result).toBe('always_allow');
    });
  });
});