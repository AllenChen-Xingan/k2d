/**
 * G3.2 项目阶段推断
 * 根据 Skill 使用和文件创建推断项目所处阶段
 */

export type ProjectPhase =
  | 'init'
  | 'requirements'
  | 'design'
  | 'development'
  | 'testing'
  | 'deployment'
  | 'maintenance';

export interface PhaseSignal {
  skills: string[];
  filePatterns: RegExp[];
  keywords: string[];
}

/**
 * 阶段识别信号
 */
const PHASE_SIGNALS: Record<ProjectPhase, PhaseSignal> = {
  init: {
    skills: ['meta-42cog', 'skill-creator'],
    filePatterns: [/\.42cog\//, /CLAUDE\.md$/i, /package\.json$/],
    keywords: ['初始化', '新项目', 'init', '开始', '创建'],
  },
  requirements: {
    skills: ['pm-product-requirements', 'pm-user-story'],
    filePatterns: [/prd\.md$/i, /requirements?\.md$/i, /\.42cog\/spec\/.*prd/i],
    keywords: ['需求', 'PRD', '功能', '用户故事', 'requirement'],
  },
  design: {
    skills: ['dev-system-architecture', 'dev-database-design', 'dev-ui-design'],
    filePatterns: [/architecture\.md$/i, /schema\.sql$/i, /design\.md$/i, /\.42cog\/spec\//],
    keywords: ['架构', '设计', 'schema', '数据库设计', 'UI设计'],
  },
  development: {
    skills: ['dev-coding'],
    // 排除测试文件的代码文件
    filePatterns: [/(?<!\.test|\.spec)\.tsx?$/, /(?<!\.test|\.spec)\.jsx?$/, /\.py$/, /\.go$/, /\.rs$/],
    keywords: ['实现', '开发', '编码', 'implement', '代码'],
  },
  testing: {
    skills: ['dev-quality-assurance'],
    // 测试文件优先匹配
    filePatterns: [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /__tests__\//, /test.*\.[jt]sx?$/i, /spec.*\.[jt]sx?$/i],
    keywords: ['测试', 'test', 'bug', '修复', 'QA'],
  },
  deployment: {
    skills: ['dev-deployment-v1'],
    filePatterns: [/dockerfile$/i, /\.yml$/, /\.yaml$/, /deploy/, /ci\/cd/i],
    keywords: ['部署', '上线', '发布', 'deploy', 'release'],
  },
  maintenance: {
    skills: [],
    filePatterns: [],
    keywords: ['维护', '优化', '重构', 'refactor', '修复'],
  },
};

/**
 * 阶段优先级（用于判断阶段转换）
 */
const PHASE_ORDER: ProjectPhase[] = [
  'init',
  'requirements',
  'design',
  'development',
  'testing',
  'deployment',
  'maintenance',
];

/**
 * 从 skills 推断项目阶段
 */
export function inferPhaseFromSkills(skillNames: string[]): ProjectPhase {
  const skillSet = new Set(skillNames);

  // 按阶段顺序检查
  for (const phase of PHASE_ORDER) {
    const signal = PHASE_SIGNALS[phase];
    for (const skill of signal.skills) {
      if (skillSet.has(skill)) {
        return phase;
      }
    }
  }

  // 默认返回 development（最常见的阶段）
  return 'development';
}

/**
 * 从文件路径推断项目阶段
 */
export function inferPhaseFromFiles(filePaths: string[]): ProjectPhase {
  const phaseScores: Record<ProjectPhase, number> = {
    init: 0,
    requirements: 0,
    design: 0,
    development: 0,
    testing: 0,
    deployment: 0,
    maintenance: 0,
  };

  for (const filePath of filePaths) {
    for (const [phase, signal] of Object.entries(PHASE_SIGNALS)) {
      for (const pattern of signal.filePatterns) {
        if (pattern.test(filePath)) {
          phaseScores[phase as ProjectPhase]++;
        }
      }
    }
  }

  // 找到得分最高的阶段
  let maxPhase: ProjectPhase = 'development';
  let maxScore = 0;

  for (const [phase, score] of Object.entries(phaseScores)) {
    if (score > maxScore) {
      maxScore = score;
      maxPhase = phase as ProjectPhase;
    }
  }

  return maxPhase;
}

/**
 * 从上下文文本推断项目阶段
 */
export function inferPhaseFromContext(context: string): ProjectPhase {
  const contextLower = context.toLowerCase();
  const phaseScores: Record<ProjectPhase, number> = {
    init: 0,
    requirements: 0,
    design: 0,
    development: 0,
    testing: 0,
    deployment: 0,
    maintenance: 0,
  };

  for (const [phase, signal] of Object.entries(PHASE_SIGNALS)) {
    for (const keyword of signal.keywords) {
      if (contextLower.includes(keyword.toLowerCase())) {
        phaseScores[phase as ProjectPhase]++;
      }
    }
  }

  // 找到得分最高的阶段
  let maxPhase: ProjectPhase = 'development';
  let maxScore = 0;

  for (const [phase, score] of Object.entries(phaseScores)) {
    if (score > maxScore) {
      maxScore = score;
      maxPhase = phase as ProjectPhase;
    }
  }

  return maxPhase;
}

/**
 * 检测阶段转换
 */
export function detectPhaseTransition(
  currentPhase: ProjectPhase,
  signals: string[]
): ProjectPhase | null {
  const signalText = signals.join(' ').toLowerCase();

  // 检查是否有明确的转换信号
  for (const phase of PHASE_ORDER) {
    if (phase === currentPhase) continue;

    const phaseSignal = PHASE_SIGNALS[phase];

    // 检查 skill 引入
    for (const skill of phaseSignal.skills) {
      if (signalText.includes(skill.toLowerCase()) && signalText.includes('引入')) {
        return phase;
      }
    }

    // 检查关键词
    let keywordMatches = 0;
    for (const keyword of phaseSignal.keywords) {
      if (signalText.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    }

    if (keywordMatches >= 2) {
      return phase;
    }
  }

  return null;
}

/**
 * 综合推断项目阶段
 */
export function inferProjectPhase(params: {
  skillNames?: string[];
  filePaths?: string[];
  context?: string;
}): ProjectPhase {
  const phases: ProjectPhase[] = [];

  if (params.skillNames && params.skillNames.length > 0) {
    phases.push(inferPhaseFromSkills(params.skillNames));
  }

  if (params.filePaths && params.filePaths.length > 0) {
    phases.push(inferPhaseFromFiles(params.filePaths));
  }

  if (params.context) {
    phases.push(inferPhaseFromContext(params.context));
  }

  if (phases.length === 0) {
    return 'development';
  }

  // 返回出现次数最多的阶段，如果平局则返回最早的
  const phaseCount: Record<string, number> = {};
  for (const phase of phases) {
    phaseCount[phase] = (phaseCount[phase] || 0) + 1;
  }

  let maxPhase = phases[0];
  let maxCount = 1;

  for (const [phase, count] of Object.entries(phaseCount)) {
    if (count > maxCount) {
      maxCount = count;
      maxPhase = phase as ProjectPhase;
    }
  }

  return maxPhase;
}

/**
 * 获取阶段描述
 */
export function getPhaseDescription(phase: ProjectPhase): string {
  const descriptions: Record<ProjectPhase, string> = {
    init: '项目初始化阶段',
    requirements: '需求分析阶段',
    design: '系统设计阶段',
    development: '开发实现阶段',
    testing: '测试验证阶段',
    deployment: '部署发布阶段',
    maintenance: '维护优化阶段',
  };

  return descriptions[phase];
}

/**
 * 获取阶段顺序
 */
export function getPhaseOrder(): ProjectPhase[] {
  return [...PHASE_ORDER];
}
