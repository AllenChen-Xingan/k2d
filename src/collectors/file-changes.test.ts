/**
 * G2.3 文件变更采集测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  parseGitStatus,
  createSnapshot,
  diffSnapshots,
  snapshotDiffToChanges,
} from './file-changes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('G2.3 文件变更采集', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `k2d-test-files-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseGitStatus', () => {
    it('should parse untracked files', () => {
      const output = '?? new.ts\n?? another.ts';
      const changes = parseGitStatus(output);
      expect(changes).toContainEqual({ path: 'new.ts', type: 'A' });
      expect(changes).toContainEqual({ path: 'another.ts', type: 'A' });
    });

    it('should parse modified files', () => {
      const output = ' M modified.ts';
      const changes = parseGitStatus(output);
      expect(changes).toContainEqual({ path: 'modified.ts', type: 'M' });
    });

    it('should parse deleted files', () => {
      const output = ' D deleted.ts';
      const changes = parseGitStatus(output);
      expect(changes).toContainEqual({ path: 'deleted.ts', type: 'D' });
    });

    it('should handle mixed status', () => {
      const output = `?? new.ts
 M modified.ts
 D deleted.ts`;
      const changes = parseGitStatus(output);
      expect(changes).toHaveLength(3);
      expect(changes).toContainEqual({ path: 'new.ts', type: 'A' });
      expect(changes).toContainEqual({ path: 'modified.ts', type: 'M' });
      expect(changes).toContainEqual({ path: 'deleted.ts', type: 'D' });
    });

    it('should handle renamed files', () => {
      const output = 'R  old.ts -> new.ts';
      const changes = parseGitStatus(output);
      expect(changes).toContainEqual({ path: 'new.ts', type: 'M' });
    });
  });

  describe('snapshot mode', () => {
    it('should create file tree snapshot', async () => {
      const projectDir = path.join(tempDir, 'project1');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'test.txt'), 'hello');
      fs.writeFileSync(path.join(projectDir, 'test2.txt'), 'world');

      const snapshot = await createSnapshot(projectDir);

      expect(snapshot.files).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(Object.keys(snapshot.files).length).toBe(2);
      expect(snapshot.files['test.txt']).toBeDefined();
      expect(snapshot.files['test.txt'].hash).toBeDefined();
    });

    it('should exclude node_modules and .git', async () => {
      const projectDir = path.join(tempDir, 'project2');
      fs.mkdirSync(path.join(projectDir, 'node_modules', 'pkg'), { recursive: true });
      fs.mkdirSync(path.join(projectDir, '.git', 'objects'), { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'src.ts'), 'code');
      fs.writeFileSync(path.join(projectDir, 'node_modules', 'pkg', 'index.js'), 'module');
      fs.writeFileSync(path.join(projectDir, '.git', 'config'), 'git');

      const snapshot = await createSnapshot(projectDir);
      const paths = Object.keys(snapshot.files);

      expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
      expect(paths.some((p) => p.includes('.git'))).toBe(false);
      expect(paths).toContain('src.ts');
    });
  });

  describe('diffSnapshots', () => {
    it('should detect added files', () => {
      const oldSnap = { files: { 'a.ts': { hash: 'h1', size: 10 } }, timestamp: '' };
      const newSnap = {
        files: {
          'a.ts': { hash: 'h1', size: 10 },
          'b.ts': { hash: 'h2', size: 20 },
        },
        timestamp: '',
      };

      const diff = diffSnapshots(oldSnap, newSnap);
      expect(diff.added).toContain('b.ts');
      expect(diff.modified).toHaveLength(0);
      expect(diff.deleted).toHaveLength(0);
    });

    it('should detect modified files', () => {
      const oldSnap = { files: { 'a.ts': { hash: 'h1', size: 10 } }, timestamp: '' };
      const newSnap = { files: { 'a.ts': { hash: 'h2', size: 15 } }, timestamp: '' };

      const diff = diffSnapshots(oldSnap, newSnap);
      expect(diff.modified).toContain('a.ts');
    });

    it('should detect deleted files', () => {
      const oldSnap = {
        files: {
          'a.ts': { hash: 'h1', size: 10 },
          'b.ts': { hash: 'h2', size: 20 },
        },
        timestamp: '',
      };
      const newSnap = { files: { 'a.ts': { hash: 'h1', size: 10 } }, timestamp: '' };

      const diff = diffSnapshots(oldSnap, newSnap);
      expect(diff.deleted).toContain('b.ts');
    });

    it('should handle null old snapshot', () => {
      const newSnap = {
        files: {
          'a.ts': { hash: 'h1', size: 10 },
          'b.ts': { hash: 'h2', size: 20 },
        },
        timestamp: '',
      };

      const diff = diffSnapshots(null, newSnap);
      expect(diff.added).toContain('a.ts');
      expect(diff.added).toContain('b.ts');
    });
  });

  describe('snapshotDiffToChanges', () => {
    it('should convert diff to FileChange list', () => {
      const oldSnap = { files: { 'a.ts': { hash: 'h1', size: 10 } }, timestamp: '' };
      const newSnap = {
        files: {
          'a.ts': { hash: 'h2', size: 15 },
          'b.ts': { hash: 'h3', size: 20 },
        },
        timestamp: '',
      };
      const diff = { added: ['b.ts'], modified: ['a.ts'], deleted: [] };

      const changes = snapshotDiffToChanges(diff, oldSnap, newSnap);

      expect(changes).toHaveLength(2);
      expect(changes.find((c) => c.file_path === 'b.ts')?.change_type).toBe('A');
      expect(changes.find((c) => c.file_path === 'a.ts')?.change_type).toBe('M');
    });
  });
});
