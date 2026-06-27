import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager } from '../PermissionManager.js';
import type { PermissionManagerConfig } from '../PermissionManager.js';

describe('PermissionManager', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  describe('constructor', () => {
    it('should set default level to L1', () => {
      expect(pm.getDefaultLevel()).toBe('L1');
    });

    it('should accept custom config', () => {
      const config: Partial<PermissionManagerConfig> = {
        defaultLevel: 'L3', whitelist: new Set(['toolA']),
      };
      const pm2 = new PermissionManager(config);
      expect(pm2.getDefaultLevel()).toBe('L3');
    });
  });

  describe('blacklist', () => {
    it('should deny blacklisted tool', () => {
      pm.addToBlacklist('toolB');
      pm.setDefaultLevel('L4');
      expect(pm.checkPermission('toolB', 'L1')).toBe(false);
    });

    it('should deny blacklisted tool even at L1', () => {
      pm.addToBlacklist('toolB');
      expect(pm.checkPermission('toolB', 'L1')).toBe(false);
    });

    it('should allow removing from blacklist', () => {
      pm.addToBlacklist('toolB');
      pm.removeFromBlacklist('toolB');
      expect(pm.checkPermission('toolB', 'L1')).toBe(true);
    });
  });

  describe('alwaysAllow', () => {
    it('should allow alwaysAllow tool', () => {
      pm.addAlwaysAllow('toolC');
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolC', 'L4')).toBe(true);
    });

    it('should deny when blacklist overrides alwaysAllow', () => {
      pm.addToBlacklist('toolD');
      pm.addAlwaysAllow('toolD');
      expect(pm.checkPermission('toolD', 'L4')).toBe(false);
    });

    it('should allow removing alwaysAllow', () => {
      pm.addAlwaysAllow('toolC');
      pm.removeAlwaysAllow('toolC');
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolC', 'L4')).toBe(false);
    });
  });

  describe('whitelist', () => {
    it('should allow whitelisted tool at L1', () => {
      pm.addToWhitelist('toolE');
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolE', 'L1')).toBe(true);
    });

    it('should deny whitelisted tool above level', () => {
      pm.addToWhitelist('toolE');
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolE', 'L2')).toBe(false);
    });

    it('should allow whitelisted tool at L4', () => {
      pm.addToWhitelist('toolE');
      pm.setDefaultLevel('L4');
      expect(pm.checkPermission('toolE', 'L4')).toBe(true);
    });

    it('should allow removing from whitelist', () => {
      pm.addToWhitelist('toolE');
      pm.removeFromWhitelist('toolE');
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolE', 'L1')).toBe(true);
    });
  });

  describe('default level', () => {
    it('should allow non-whitelisted tool at L1', () => {
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolF', 'L1')).toBe(true);
    });

    it('should deny non-whitelisted tool above L1', () => {
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolF', 'L2')).toBe(false);
    });

    it('should allow non-whitelisted tool at L4', () => {
      pm.setDefaultLevel('L4');
      expect(pm.checkPermission('toolF', 'L4')).toBe(true);
    });

    it('should update level dynamically', () => {
      pm.setDefaultLevel('L1');
      expect(pm.checkPermission('toolF', 'L2')).toBe(false);
      pm.setDefaultLevel('L3');
      expect(pm.checkPermission('toolF', 'L2')).toBe(true);
    });
  });

  describe('getDefaultLevel', () => {
    it('should return L1 for default', () => {
      expect(pm.getDefaultLevel()).toBe('L1');
    });

    it('should return L3 after set', () => {
      pm.setDefaultLevel('L3');
      expect(pm.getDefaultLevel()).toBe('L3');
    });
  });
});