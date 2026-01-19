/**
 * G3.1 Skill 引入时机推断测试
 */

import { describe, it, expect } from 'bun:test';
import {
  inferSkillIntroductionReason,
  inferMultipleSkillReasons,
  recommendSkills,
  getKnownSkillNames,
} from './skill-inference';

describe('G3.1 Skill 引入时机推断', () => {
  describe('inferSkillIntroductionReason', () => {
    it('should infer reason with high confidence', () => {
      const context = '帮我设计一下系统架构和模块';
      const result = inferSkillIntroductionReason(context, 'dev-system-architecture');

      expect(result.confidence).toBe('high');
      expect(result.keywords.length).toBeGreaterThanOrEqual(2);
    });

    it('should infer reason with medium confidence', () => {
      const context = '帮我写架构';
      const result = inferSkillIntroductionReason(context, 'dev-system-architecture');

      expect(result.confidence).toBe('medium');
      expect(result.keywords.length).toBe(1);
    });

    it('should return low confidence for unknown context', () => {
      const result = inferSkillIntroductionReason('hello world', 'dev-system-architecture');

      expect(result.confidence).toBe('low');
      expect(result.keywords).toHaveLength(0);
    });

    it('should infer database design skill', () => {
      const context = '设计数据库表结构和 schema';
      const result = inferSkillIntroductionReason(context, 'dev-database-design');

      expect(result.confidence).toBe('high');
    });

    it('should infer coding skill', () => {
      const context = '帮我实现这个功能，开发代码';
      const result = inferSkillIntroductionReason(context, 'dev-coding');

      expect(result.confidence).toBe('high');
    });

    it('should infer testing skill', () => {
      const context = '帮我写测试并修复 bug';
      const result = inferSkillIntroductionReason(context, 'dev-quality-assurance');

      expect(result.confidence).toBe('high');
    });

    it('should infer deployment skill', () => {
      const context = '准备部署上线发布';
      const result = inferSkillIntroductionReason(context, 'dev-deployment-v1');

      expect(result.confidence).toBe('high');
    });

    it('should infer PRD skill', () => {
      const context = '整理产品需求和功能特性';
      const result = inferSkillIntroductionReason(context, 'pm-product-requirements');

      expect(result.confidence).toBe('high');
    });
  });

  describe('inferMultipleSkillReasons', () => {
    it('should infer reasons for multiple skills', () => {
      const context = '设计架构并实现代码';
      const results = inferMultipleSkillReasons(context, ['dev-system-architecture', 'dev-coding']);

      expect(Object.keys(results)).toHaveLength(2);
      expect(results['dev-system-architecture']).toBeDefined();
      expect(results['dev-coding']).toBeDefined();
    });
  });

  describe('recommendSkills', () => {
    it('should recommend skills based on context', () => {
      const context = '帮我设计系统架构和模块结构';
      const recommendations = recommendSkills(context);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].skill).toBe('dev-system-architecture');
    });

    it('should return empty for unrelated context', () => {
      const context = 'hello how are you today';
      const recommendations = recommendSkills(context);

      expect(recommendations).toHaveLength(0);
    });

    it('should sort by confidence', () => {
      const context = '设计数据库架构和表结构';
      const recommendations = recommendSkills(context);

      // 第一个应该是 high confidence
      if (recommendations.length > 0) {
        expect(recommendations[0].confidence).toBe('high');
      }
    });
  });

  describe('getKnownSkillNames', () => {
    it('should return list of known skills', () => {
      const skills = getKnownSkillNames();

      expect(skills).toContain('dev-system-architecture');
      expect(skills).toContain('dev-coding');
      expect(skills).toContain('dev-database-design');
    });
  });
});
