import { describe, it, expect, beforeEach } from 'vitest';
import { CodeAnalysisTool, createCodeAnalysisTool } from '../CodeAnalysisTool.js';
import type { ToolExecutionContext } from '../../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const mockContext: ToolExecutionContext = {
  toolId: 'builtin:code-analysis',
  executionId: 'exec-1',
  workingDirectory: '/tmp',
  environment: {},
  cancelled: false,
  permissionLevel: 'L2',
  metadata: {},
};

describe('CodeAnalysisTool', () => {
  let tool: CodeAnalysisTool;
  let tempDir: string;

  beforeEach(async () => {
    tool = new CodeAnalysisTool();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeanalysis-test-'));
  });

  describe('constructor', () => {
    it('should create CodeAnalysisTool instance', () => {
      expect(tool).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const def = tool.getDefinition();
      expect(def.id).toBe('builtin:code-analysis');
      expect(def.name).toBe('CodeAnalysisTool');
      expect(def.category).toBe('custom');
      expect(def.enabled).toBe(true);
    });

    it('should have valid input schema', () => {
      const def = tool.getDefinition();
      expect(def.inputSchema).toBeDefined();
      expect(def.inputSchema.type).toBe('object');
    });
  });

  describe('validate', () => {
    it('should return no errors for valid symbolSearch input', () => {
      const errors = tool.validate({ operation: 'symbolSearch', path: '/tmp/test.ts' });
      expect(errors).toHaveLength(0);
    });

    it('should require operation', () => {
      const errors = tool.validate({});
      expect(errors.some(e => e.path === 'operation')).toBe(true);
    });

    it('should reject invalid operation', () => {
      const errors = tool.validate({ operation: 'invalid' });
      expect(errors.some(e => e.message.includes('Invalid operation'))).toBe(true);
    });

    it('should require path for symbolSearch', () => {
      const errors = tool.validate({ operation: 'symbolSearch' });
      expect(errors.some(e => e.path === 'path')).toBe(true);
    });

    it('should require path for astParse', () => {
      const errors = tool.validate({ operation: 'astParse' });
      expect(errors.some(e => e.path === 'path')).toBe(true);
    });

    it('should not require path for projectStructure', () => {
      const errors = tool.validate({ operation: 'projectStructure' });
      expect(errors.some(e => e.path === 'path')).toBe(false);
    });
  });

  describe('execute - symbolSearch', () => {
    it('should extract symbols from a TypeScript file', async () => {
      const tsContent = `export function hello(): string { return "hi"; }
export class Greeter { greet() { return "hello"; } }
export interface IGreeter { greet(): string; }
const x = 1;`;
      const filePath = path.join(tempDir, 'sample.ts');
      await fs.writeFile(filePath, tsContent);

      const result = await tool.execute(
        { operation: 'symbolSearch', path: filePath },
        mockContext
      );
      expect(result.success).toBe(true);
      const symbols = (result.data as any).symbols as any[];
      expect(symbols.length).toBeGreaterThan(0);
      const names = symbols.map((s: any) => s.name);
      expect(names).toContain('hello');
      expect(names).toContain('Greeter');
      expect(names).toContain('IGreeter');
    });

    it('should filter symbols by kind', async () => {
      const tsContent = `export function foo() {}
export class Bar {}`;
      const filePath = path.join(tempDir, 'kind.ts');
      await fs.writeFile(filePath, tsContent);

      const result = await tool.execute(
        { operation: 'symbolSearch', path: filePath, symbolKind: 'class' },
        mockContext
      );
      expect(result.success).toBe(true);
      const symbols = (result.data as any).symbols as any[];
      const names = symbols.map((s: any) => s.name);
      expect(names).toContain('Bar');
      expect(names).not.toContain('foo');
    });

    it('should filter symbols by pattern', async () => {
      const tsContent = `export function apple() {}
export function banana() {}`;
      const filePath = path.join(tempDir, 'pattern.ts');
      await fs.writeFile(filePath, tsContent);

      const result = await tool.execute(
        { operation: 'symbolSearch', path: filePath, pattern: 'app' },
        mockContext
      );
      expect(result.success).toBe(true);
      const symbols = (result.data as any).symbols as any[];
      const names = symbols.map((s: any) => s.name);
      expect(names).toContain('apple');
      expect(names).not.toContain('banana');
    });

    it('should handle non-existent file', async () => {
      const result = await tool.execute(
        { operation: 'symbolSearch', path: '/nonexistent/file.ts' },
        mockContext
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('execute - astParse', () => {
    it('should parse a TypeScript file into AST', async () => {
      const tsContent = `const x: number = 42;
function hello() { return x; }`;
      const filePath = path.join(tempDir, 'ast.ts');
      await fs.writeFile(filePath, tsContent);

      const result = await tool.execute(
        { operation: 'astParse', path: filePath },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.root.kind).toBe('SourceFile');
      expect(data.root.children).toBeDefined();
      expect(data.root.children.length).toBeGreaterThan(0);
    });

    it('should handle non-existent file for astParse', async () => {
      const result = await tool.execute(
        { operation: 'astParse', path: '/nonexistent/file.ts' },
        mockContext
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('execute - projectStructure', () => {
    it('should analyze project directory structure', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      const result = await tool.execute(
        { operation: 'projectStructure', path: tempDir, maxDepth: 2 },
        mockContext
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.tree.type).toBe('directory');
      expect(data.tree.children).toBeDefined();
      expect(data.fileCount).toBeGreaterThan(0);
    });

    it('should work with default path', async () => {
      const result = await tool.execute(
        { operation: 'projectStructure', maxDepth: 1 },
        mockContext
      );
      expect(result.success).toBe(true);
      expect((result.data as any).tree.type).toBe('directory');
    });
  });

  describe('execute - error handling', () => {
    it('should return error for invalid operation', async () => {
      const result = await tool.execute(
        { operation: 'invalid' } as any,
        mockContext
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown operation');
    });
  });

  describe('createCodeAnalysisTool', () => {
    it('should create CodeAnalysisTool instance', () => {
      const instance = createCodeAnalysisTool();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(CodeAnalysisTool);
    });
  });
});