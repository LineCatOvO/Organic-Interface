/**
 * CodeAnalysisTool - Built-in tool for code analysis and navigation
 */

import ts from 'typescript';
import { promises as fs } from 'fs';
import path from 'path';
import {
  type Tool,
  type ToolDefinition,
  type ToolResult,
  type ToolExecutionContext,
  type ToolValidationError,
} from '../types/index.js';

interface CodeAnalysisInput {
  operation: 'symbolSearch' | 'astParse' | 'projectStructure';
  path?: string;
  pattern?: string;
  symbolKind?: string;
  includeNodeModules?: boolean;
  maxDepth?: number;
  options?: CodeAnalysisOptions;
}

interface CodeAnalysisOptions {
  includeExports?: boolean;
  includePrivates?: boolean;
  includeComments?: boolean;
  includeImports?: boolean;
  maxResults?: number;
}

interface SymbolInfo {
  name: string;
  kind: string;
  file: string;
  line: number;
  column: number;
  exported: boolean;
  members?: SymbolInfo[];
}

interface ASTNode {
  kind: string;
  name?: string;
  text?: string;
  pos: number;
  end: number;
  children?: ASTNode[];
}

interface ProjectStructure {
  root: string;
  name?: string;
  type: 'file' | 'directory';
  children?: ProjectStructure[];
  size?: number;
  extension?: string;
}

export class CodeAnalysisTool implements Tool {
  private definition: ToolDefinition;

  constructor() {
    this.definition = {
      id: 'builtin:code-analysis',
      name: 'CodeAnalysisTool',
      description: 'Built-in tool for code analysis, AST parsing, and project structure analysis',
      category: 'custom',
      inputSchema: {
        type: 'object',
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['symbolSearch', 'astParse', 'projectStructure'],
            description: 'Code analysis operation to perform',
          },
          path: {
            type: 'string',
            description: 'File or directory path for analysis',
          },
          pattern: {
            type: 'string',
            description: 'Search pattern for symbolSearch (regex supported)',
          },
          symbolKind: {
            type: 'string',
            description: 'Filter by symbol kind (function, class, interface, etc.)',
          },
          includeNodeModules: {
            type: 'boolean',
            description: 'Include node_modules in analysis',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum directory depth for projectStructure',
          },
          options: {
            type: 'object',
            description: 'Additional analysis options',
            properties: {
              includeExports: { type: 'boolean' },
              includePrivates: { type: 'boolean' },
              includeComments: { type: 'boolean' },
              includeImports: { type: 'boolean' },
              maxResults: { type: 'number' },
            },
          },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'any' },
          error: { type: 'string' },
        },
      },
      enabled: true,
      timeout: 30000,
      permissions: [{ type: 'read', scope: 'filesystem', granted: true }],
    };
  }

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  validate(input: unknown): ToolValidationError[] {
    const errors: ToolValidationError[] = [];
    const data = input as Partial<CodeAnalysisInput>;
    const validOps = ['symbolSearch', 'astParse', 'projectStructure'];

    if (!data.operation) {
      errors.push({
        path: 'operation',
        message: 'Operation is required',
        expected: 'string',
        actual: data.operation,
      });
    } else if (!validOps.includes(data.operation)) {
      errors.push({
        path: 'operation',
        message: `Invalid operation: ${data.operation}`,
        expected: validOps.join('|'),
        actual: data.operation,
      });
    }

    if (['symbolSearch', 'astParse'].includes(data.operation as string) && !data.path) {
      errors.push({
        path: 'path',
        message: 'Path is required for this operation',
        expected: 'string',
        actual: data.path,
      });
    }

    return errors;
  }

  async execute(input: unknown, _context: ToolExecutionContext): Promise<ToolResult> {
    const data = input as CodeAnalysisInput;
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (data.operation) {
        case 'symbolSearch':
          result = await this.symbolSearch(data);
          break;
        case 'astParse':
          result = await this.astParse(data);
          break;
        case 'projectStructure':
          result = await this.projectStructure(data);
          break;
        default:
          throw new Error(`Unknown operation: ${data.operation}`);
      }

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async symbolSearch(
    data: CodeAnalysisInput
  ): Promise<{ symbols: SymbolInfo[]; count: number }> {
    const filePath = data.path!;
    const content = await fs.readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath, content, ts.ScriptTarget.Latest, true
    );

    const symbols: SymbolInfo[] = [];
    const maxResults = data.options?.maxResults ?? 500;

    const visit = (node: ts.Node) => {
      if (symbols.length >= maxResults) return;
      const symbol = this.extractSymbol(node, filePath, sourceFile);
      if (symbol) {
        if (this.matchesPattern(symbol, data.pattern, data.symbolKind)) {
          symbols.push(symbol);
        }
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return { symbols, count: symbols.length };
  }

  private extractSymbol(
    node: ts.Node, filePath: string, sourceFile: ts.SourceFile
  ): SymbolInfo | null {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const base = { file: filePath, line: line + 1, column: character + 1 };

    if (ts.isFunctionDeclaration(node) && node.name) {
      return { ...base, name: node.name.text, kind: 'function', exported: this.isExported(node) };
    }
    if (ts.isClassDeclaration(node) && node.name) {
      return { ...base, name: node.name.text, kind: 'class', exported: this.isExported(node) };
    }
    if (ts.isInterfaceDeclaration(node)) {
      return { ...base, name: node.name.text, kind: 'interface', exported: this.isExported(node) };
    }
    if (ts.isEnumDeclaration(node)) {
      return { ...base, name: node.name.text, kind: 'enum', exported: this.isExported(node) };
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return { ...base, name: node.name.text, kind: 'typeAlias', exported: this.isExported(node) };
    }
    if (ts.isVariableStatement(node)) {
      const decl = node.declarationList.declarations[0];
      if (decl && ts.isIdentifier(decl.name)) {
        return { ...base, name: decl.name.text, kind: 'variable', exported: this.isExported(node) };
      }
    }
    return null;
  }

  private isExported(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return modifiers ? modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword) : false;
  }

  private matchesPattern(symbol: SymbolInfo, pattern?: string, kind?: string): boolean {
    if (kind && symbol.kind !== kind) return false;
    if (pattern) {
      try {
        return new RegExp(pattern, 'i').test(symbol.name);
      } catch {
        return symbol.name.toLowerCase().includes(pattern.toLowerCase());
      }
    }
    return true;
  }

  private async astParse(data: CodeAnalysisInput): Promise<{ root: ASTNode; file: string }> {
    const filePath = data.path!;
    const content = await fs.readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath, content, ts.ScriptTarget.Latest, true
    );

    const root: ASTNode = {
      kind: 'SourceFile',
      name: path.basename(filePath),
      pos: 0,
      end: content.length,
      children: [],
    };

    const walk = (node: ts.Node, parent: ASTNode) => {
      const child: ASTNode = {
        kind: ts.SyntaxKind[node.kind],
        pos: node.getStart(sourceFile),
        end: node.getEnd(),
        children: [],
      };

      if (ts.isIdentifier(node)) {
        child.name = node.text;
      } else if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
        child.text = node.text;
      }

      parent.children!.push(child);
      ts.forEachChild(node, n => walk(n, child));
    };

    ts.forEachChild(sourceFile, n => walk(n, root));
    return { root, file: filePath };
  }

  private async projectStructure(
    data: CodeAnalysisInput
  ): Promise<{ tree: ProjectStructure; fileCount: number; dirCount: number }> {
    const dirPath = data.path || process.cwd();
    const maxDepth = data.maxDepth ?? 5;
    let fileCount = 0;
    let dirCount = 0;

    const buildTree = async (dir: string, depth: number): Promise<ProjectStructure> => {
      const name = path.basename(dir);
      const node: ProjectStructure = { root: dir, name, type: 'directory', children: [] };
      dirCount++;

      if (depth >= maxDepth) return node;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const excludeDirs = data.includeNodeModules ? [] : ['node_modules', '.git', 'dist'];

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue;
          if (entry.isSymbolicLink()) continue;

          if (entry.isDirectory()) {
            node.children!.push(await buildTree(path.join(dir, entry.name), depth + 1));
          } else {
            fileCount++;
            node.children!.push({
              root: path.join(dir, entry.name),
              name: entry.name,
              type: 'file',
              extension: path.extname(entry.name).slice(1) || undefined,
            });
          }
        }
      } catch {
        // skip inaccessible directories
      }
      return node;
    };

    const tree = await buildTree(dirPath, 0);
    return { tree, fileCount, dirCount };
  }
}

export function createCodeAnalysisTool(): CodeAnalysisTool {
  return new CodeAnalysisTool();
}