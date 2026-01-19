/**
 * G3.1 Skill 引入时机推断
 * 从对话上下文推断"为什么引入这个 Skill"
 */

export interface InferenceResult {
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  keywords: string[];
}

/**
 * Skill 关键词映射表
 */
const SKILL_KEYWORDS: Record<string, string[]> = {
  'meta-42cog': ['新项目', '开始', '初始化', 'init', '约束', '规范', '框架'],
  'pm-product-requirements': ['需求', '功能', '用户', 'PRD', 'requirement', '产品', '特性', 'feature'],
  'pm-user-story': ['用户故事', 'user story', '故事', '场景', 'scenario'],
  'dev-system-architecture': ['架构', '设计', '技术方案', 'architecture', '系统设计', '模块'],
  'dev-database-design': ['数据库', '表', 'schema', 'database', 'model', '模型', 'DB', 'SQL'],
  'dev-coding': ['实现', '开发', '写代码', 'implement', 'code', '编码', '编写'],
  'dev-ui-design': ['UI', '界面', '前端', '组件', '样式', 'design', 'frontend'],
  'dev-quality-assurance': ['测试', 'bug', '修复', 'test', 'fix', 'QA', '质量', '单测'],
  'dev-deployment-v1': ['部署', '上线', '发布', 'deploy', 'release', '上传', '生产'],
  'skill-creator': ['技能', 'skill', '创建技能', '新技能'],
  'creative-intelligence': ['头脑风暴', '创意', '构思', '研究', 'SCAMPER', 'brainstorm'],
  'deep-reading-analyst': ['分析', '理解', '阅读', '文章', '论文', '深入'],
};

/**
 * 推断 Skill 引入原因
 */
export function inferSkillIntroductionReason(context: string, skillName: string): InferenceResult {
  const keywords = SKILL_KEYWORDS[skillName] || [];
  const contextLower = context.toLowerCase();

  const matchedKeywords: string[] = [];
  for (const keyword of keywords) {
    if (contextLower.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  if (matchedKeywords.length >= 2) {
    return {
      reason: `用户请求与"${matchedKeywords.join('、')}"相关，触发 ${skillName} 使用`,
      confidence: 'high',
      keywords: matchedKeywords,
    };
  } else if (matchedKeywords.length === 1) {
    return {
      reason: `用户提及"${matchedKeywords[0]}"，可能需要 ${skillName}`,
      confidence: 'medium',
      keywords: matchedKeywords,
    };
  }

  return {
    reason: `上下文中未找到明确的触发关键词`,
    confidence: 'low',
    keywords: [],
  };
}

/**
 * 从多个 skills 中推断最可能的引入原因
 */
export function inferMultipleSkillReasons(
  context: string,
  skillNames: string[]
): Record<string, InferenceResult> {
  const results: Record<string, InferenceResult> = {};

  for (const skillName of skillNames) {
    results[skillName] = inferSkillIntroductionReason(context, skillName);
  }

  return results;
}

/**
 * 获取所有已知的 skill 名称
 */
export function getKnownSkillNames(): string[] {
  return Object.keys(SKILL_KEYWORDS);
}

/**
 * 添加自定义 skill 关键词（用于扩展）
 */
export function addSkillKeywords(skillName: string, keywords: string[]): void {
  if (!SKILL_KEYWORDS[skillName]) {
    SKILL_KEYWORDS[skillName] = [];
  }
  SKILL_KEYWORDS[skillName].push(...keywords);
}

/**
 * 分析上下文，推荐可能需要的 skills
 */
export function recommendSkills(context: string): Array<{ skill: string; confidence: 'high' | 'medium' | 'low' }> {
  const recommendations: Array<{ skill: string; confidence: 'high' | 'medium' | 'low'; score: number }> = [];
  const contextLower = context.toLowerCase();

  for (const [skillName, keywords] of Object.entries(SKILL_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (contextLower.includes(keyword.toLowerCase())) {
        score++;
      }
    }

    if (score >= 2) {
      recommendations.push({ skill: skillName, confidence: 'high', score });
    } else if (score === 1) {
      recommendations.push({ skill: skillName, confidence: 'medium', score });
    }
  }

  // 按分数降序排序
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations.map(({ skill, confidence }) => ({ skill, confidence }));
}
