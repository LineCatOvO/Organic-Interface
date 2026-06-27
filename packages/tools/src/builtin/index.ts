/**
 * Built-in tools
 */

export { FileTool, createFileTool } from './FileTool.js';
export { ShellTool, createShellTool } from './ShellTool.js';
export { SearchTool, createSearchTool } from './SearchTool.js';
export { CodeAnalysisTool, createCodeAnalysisTool } from './CodeAnalysisTool.js';
export { GitTool, createGitTool } from './GitTool.js';

/**
 * Register all built-in tools
 */
import { type ToolService } from '../services/ToolService.js';
import { FileTool, ShellTool, SearchTool, CodeAnalysisTool, GitTool } from './index.js';

export function registerBuiltinTools(service: ToolService): void {
  service.registerTool(new FileTool());
  service.registerTool(new ShellTool());
  service.registerTool(new SearchTool());
  service.registerTool(new CodeAnalysisTool());
  service.registerTool(new GitTool());
}
