import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * E2E Test: Docker Compose Scripts Configuration
 * Source: active-task-p1-001-organic-dev-config
 * Purpose: Verify Docker Compose scripts and warnings are correctly configured in package.json
 */

describe('Docker Compose Scripts Configuration', () => {
  const pkgPath = resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const scripts = pkg.scripts;

  describe('dev:docker script', () => {
    it('should define dev:docker script', () => {
      expect(scripts['dev:docker']).toBeDefined();
    });

    it('should use docker-compose.dev.yml with dev profile', () => {
      expect(scripts['dev:docker']).toContain('docker-compose.dev.yml');
      expect(scripts['dev:docker']).toContain('--profile dev');
      expect(scripts['dev:docker']).toContain('up --build');
    });

    it('should not use detached mode', () => {
      expect(scripts['dev:docker']).not.toContain('-d');
      expect(scripts['dev:docker']).not.toContain('--detach');
    });
  });

  describe('test:docker script', () => {
    it('should define test:docker script', () => {
      expect(scripts['test:docker']).toBeDefined();
    });

    it('should use docker-compose.dev.yml with test profile', () => {
      expect(scripts['test:docker']).toContain('docker-compose.dev.yml');
      expect(scripts['test:docker']).toContain('--profile test');
      expect(scripts['test:docker']).toContain('up --build');
    });

    it('should not use detached mode', () => {
      expect(scripts['test:docker']).not.toContain('-d');
      expect(scripts['test:docker']).not.toContain('--detach');
    });
  });

  describe('docker:down script', () => {
    it('should define docker:down script', () => {
      expect(scripts['docker:down']).toBeDefined();
    });

    it('should use docker-compose.dev.yml down', () => {
      expect(scripts['docker:down']).toContain('docker-compose.dev.yml');
      expect(scripts['docker:down']).toContain('down');
    });
  });

  describe('host-machine warning comments', () => {
    it('should have build warning comment', () => {
      expect(scripts['//build-warning']).toBeDefined();
      expect(scripts['//build-warning']).toContain('dev:docker');
    });

    it('should have dev warning comment', () => {
      expect(scripts['//dev-warning']).toBeDefined();
      expect(scripts['//dev-warning']).toContain('dev:docker');
    });

    it('should have test warning comment', () => {
      expect(scripts['//test-warning']).toBeDefined();
      expect(scripts['//test-warning']).toContain('test:docker');
    });

    it('should have test:watch warning comment', () => {
      expect(scripts['//test:watch-warning']).toBeDefined();
      expect(scripts['//test:watch-warning']).toContain('test:docker');
    });

    it('should have test:coverage warning comment', () => {
      expect(scripts['//test:coverage-warning']).toBeDefined();
      expect(scripts['//test:coverage-warning']).toContain('test:docker');
    });
  });
});