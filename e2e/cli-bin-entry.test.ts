/**
 * CLI Bin Entry Point E2E Tests
 *
 * Tests the actual compiled CLI entry point (cli.ts)
 * via node child_process execution.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const CLI_PATH = path.resolve(__dirname, '../packages/ui/dist/cli.js');
const NODE = process.execPath;

function runCLI(args: string): string {
  return execSync(`${NODE} ${CLI_PATH} ${args}`, {
    encoding: 'utf-8',
    timeout: 5000,
  });
}

describe('CLI Bin Entry Point', () => {
  describe('--help', () => {
    it('should output help with available commands', () => {
      const output = runCLI('--help');
      expect(output).toContain('organic-interface');
      expect(output).toContain('Available commands');
    });
  });

  describe('--version', () => {
    it('should output version string', () => {
      const output = runCLI('--version');
      expect(output).toContain('organic-interface');
      expect(output).toContain('v0.1.0');
    });
  });

  describe('help command', () => {
    it('should list available commands', () => {
      const output = runCLI('help');
      expect(output).toContain('Available commands');
    });
  });

  describe('history command', () => {
    it('should execute history without error', () => {
      const output = runCLI('history');
      expect(output).toBeDefined();
    });
  });

  describe('log command', () => {
    it('should execute log without error', () => {
      const output = runCLI('log');
      expect(output).toBeDefined();
    });
  });

  describe('unknown command', () => {
    it('should handle unknown command gracefully', () => {
      expect(() => runCLI('nonexistent-cmd')).toThrow();
    });
  });
});