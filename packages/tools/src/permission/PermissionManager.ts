/**
 * PermissionManager - Controls tool execution based on PermissionLevel (L1-L4)
 */
import type { PermissionLevel } from '../types/index.js';

export type ApprovalResponse = 'allow' | 'deny' | 'always_allow';

export interface PermissionManagerConfig {
  defaultLevel: PermissionLevel;
  whitelist: Set<string>;
  blacklist: Set<string>;
  alwaysAllow: Set<string>;
}

const LEVEL_HIERARCHY: Record<PermissionLevel, number> = {
  L1: 1, L2: 2, L3: 3, L4: 4,
};

export class PermissionManager {
  private config: PermissionManagerConfig;

  /**
   * Create a new PermissionManager instance
   */
  constructor(config?: Partial<PermissionManagerConfig>) {
    this.config = {
      defaultLevel: config?.defaultLevel ?? 'L1',
      whitelist: config?.whitelist ?? new Set(),
      blacklist: config?.blacklist ?? new Set(),
      alwaysAllow: config?.alwaysAllow ?? new Set(),
    };
  }

  /**
   * Check if a tool is permitted at the given level
   */
  checkPermission(toolId: string, requiredLevel: PermissionLevel): boolean {
    if (this.config.blacklist.has(toolId)) return false;
    if (this.config.alwaysAllow.has(toolId)) return true;
    if (this.config.whitelist.has(toolId)) {
      return LEVEL_HIERARCHY[this.config.defaultLevel] >= LEVEL_HIERARCHY[requiredLevel];
    }
    return LEVEL_HIERARCHY[this.config.defaultLevel] >= LEVEL_HIERARCHY[requiredLevel];
  }

  addToWhitelist(toolId: string): void { this.config.whitelist.add(toolId); }
  removeFromWhitelist(toolId: string): void { this.config.whitelist.delete(toolId); }
  addToBlacklist(toolId: string): void { this.config.blacklist.add(toolId); }
  removeFromBlacklist(toolId: string): void { this.config.blacklist.delete(toolId); }
  addAlwaysAllow(toolId: string): void { this.config.alwaysAllow.add(toolId); }
  removeAlwaysAllow(toolId: string): void { this.config.alwaysAllow.delete(toolId); }
  setDefaultLevel(level: PermissionLevel): void { this.config.defaultLevel = level; }
  getDefaultLevel(): PermissionLevel { return this.config.defaultLevel; }
}