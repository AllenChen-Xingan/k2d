/**
 * G3.2 项目阶段推断测试
 */

import { describe, it, expect } from 'bun:test';
import {
  inferPhaseFromSkills,
  inferPhaseFromFiles,
  inferPhaseFromContext,
  detectPhaseTransition,
  inferProjectPhase,
  getPhaseDescription,
  getPhaseOrder,
} from './phase-inference';

describe('G3.2 项目阶段推断', () => {
  describe('inferPhaseFromSkills', () => {
    it('should infer init phase', () => {
      const phase = inferPhaseFromSkills(['meta-42cog']);
      expect(phase).toBe('init');
    });

    it('should infer requirements phase', () => {
      const phase = inferPhaseFromSkills(['pm-product-requirements']);
      expect(phase).toBe('requirements');
    });

    it('should infer design phase', () => {
      const phase = inferPhaseFromSkills(['dev-system-architecture']);
      expect(phase).toBe('design');
    });

    it('should infer development phase', () => {
      const phase = inferPhaseFromSkills(['dev-coding']);
      expect(phase).toBe('development');
    });

    it('should infer testing phase', () => {
      const phase = inferPhaseFromSkills(['dev-quality-assurance']);
      expect(phase).toBe('testing');
    });

    it('should infer deployment phase', () => {
      const phase = inferPhaseFromSkills(['dev-deployment-v1']);
      expect(phase).toBe('deployment');
    });

    it('should return development for unknown skills', () => {
      const phase = inferPhaseFromSkills(['unknown-skill']);
      expect(phase).toBe('development');
    });

    it('should return earliest matching phase for multiple skills', () => {
      const phase = inferPhaseFromSkills(['dev-coding', 'dev-database-design']);
      expect(phase).toBe('design'); // database-design 在 design 阶段
    });
  });

  describe('inferPhaseFromFiles', () => {
    it('should infer init phase from config files', () => {
      const phase = inferPhaseFromFiles(['package.json', 'CLAUDE.md']);
      expect(phase).toBe('init');
    });

    it('should infer requirements phase from prd files', () => {
      const phase = inferPhaseFromFiles(['docs/prd.md', 'requirements.md']);
      expect(phase).toBe('requirements');
    });

    it('should infer design phase from architecture files', () => {
      const phase = inferPhaseFromFiles(['docs/architecture.md', 'schema.sql']);
      expect(phase).toBe('design');
    });

    it('should infer development phase from code files', () => {
      const phase = inferPhaseFromFiles(['src/index.ts', 'src/utils.tsx', 'lib/main.py']);
      expect(phase).toBe('development');
    });

    it('should infer testing phase from test files', () => {
      const phase = inferPhaseFromFiles(['src/index.test.ts', 'src/utils.spec.tsx']);
      expect(phase).toBe('testing');
    });

    it('should infer deployment phase from deployment files', () => {
      const phase = inferPhaseFromFiles(['Dockerfile', 'deploy.yml']);
      expect(phase).toBe('deployment');
    });
  });

  describe('inferPhaseFromContext', () => {
    it('should infer init phase from keywords', () => {
      const phase = inferPhaseFromContext('初始化新项目');
      expect(phase).toBe('init');
    });

    it('should infer requirements phase from keywords', () => {
      const phase = inferPhaseFromContext('整理产品需求');
      expect(phase).toBe('requirements');
    });

    it('should infer design phase from keywords', () => {
      const phase = inferPhaseFromContext('设计系统架构');
      expect(phase).toBe('design');
    });

    it('should infer development phase from keywords', () => {
      const phase = inferPhaseFromContext('开始实现代码');
      expect(phase).toBe('development');
    });

    it('should infer testing phase from keywords', () => {
      const phase = inferPhaseFromContext('编写测试用例');
      expect(phase).toBe('testing');
    });

    it('should infer deployment phase from keywords', () => {
      const phase = inferPhaseFromContext('准备部署上线');
      expect(phase).toBe('deployment');
    });
  });

  describe('detectPhaseTransition', () => {
    it('should detect transition from init to requirements', () => {
      const newPhase = detectPhaseTransition('init', ['pm-product-requirements 被引入']);
      expect(newPhase).toBe('requirements');
    });

    it('should detect transition based on keywords', () => {
      const newPhase = detectPhaseTransition('requirements', ['开始设计系统架构']);
      expect(newPhase).toBe('design');
    });

    it('should return null when no transition detected', () => {
      const newPhase = detectPhaseTransition('development', ['继续写代码']);
      expect(newPhase).toBeNull();
    });
  });

  describe('inferProjectPhase', () => {
    it('should combine multiple signals', () => {
      const phase = inferProjectPhase({
        skillNames: ['dev-coding'],
        filePaths: ['src/index.ts'],
        context: '开发实现功能',
      });
      expect(phase).toBe('development');
    });

    it('should use majority voting', () => {
      const phase = inferProjectPhase({
        skillNames: ['dev-coding'],
        filePaths: ['test.test.ts', 'spec.spec.ts'],
        context: '写测试',
      });
      expect(phase).toBe('testing');
    });

    it('should return development as default', () => {
      const phase = inferProjectPhase({});
      expect(phase).toBe('development');
    });
  });

  describe('getPhaseDescription', () => {
    it('should return description for each phase', () => {
      expect(getPhaseDescription('init')).toBe('项目初始化阶段');
      expect(getPhaseDescription('requirements')).toBe('需求分析阶段');
      expect(getPhaseDescription('design')).toBe('系统设计阶段');
      expect(getPhaseDescription('development')).toBe('开发实现阶段');
      expect(getPhaseDescription('testing')).toBe('测试验证阶段');
      expect(getPhaseDescription('deployment')).toBe('部署发布阶段');
      expect(getPhaseDescription('maintenance')).toBe('维护优化阶段');
    });
  });

  describe('getPhaseOrder', () => {
    it('should return phases in correct order', () => {
      const order = getPhaseOrder();
      expect(order[0]).toBe('init');
      expect(order[order.length - 1]).toBe('maintenance');
    });
  });
});
