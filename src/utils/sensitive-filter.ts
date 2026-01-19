/**
 * G2.2.6 敏感信息过滤
 * 过滤 API Key、密码、连接字符串等敏感数据
 */

interface SensitivePattern {
  pattern: RegExp;
  replacement: string;
}

const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // API Keys
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /api[_-]?key["\s:=]+["']?[\w-]{20,}["']?/gi, replacement: '[REDACTED_API_KEY]' },
  { pattern: /OPENAI_API_KEY["\s:=]+["']?[^\s"',]+["']?/gi, replacement: 'OPENAI_API_KEY=[REDACTED]' },
  { pattern: /ANTHROPIC_API_KEY["\s:=]+["']?[^\s"',]+["']?/gi, replacement: 'ANTHROPIC_API_KEY=[REDACTED]' },

  // Passwords
  { pattern: /password["\s:=]+["']?[^\s"',]{8,}["']?/gi, replacement: 'password: [REDACTED]' },
  { pattern: /passwd["\s:=]+["']?[^\s"',]{8,}["']?/gi, replacement: 'passwd: [REDACTED]' },
  { pattern: /pwd["\s:=]+["']?[^\s"',]{8,}["']?/gi, replacement: 'pwd: [REDACTED]' },

  // Connection strings
  { pattern: /(postgres|mysql|mongodb|redis):\/\/[^\s]+/gi, replacement: '[REDACTED_CONNECTION_STRING]' },

  // JWT tokens
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[REDACTED_JWT]' },

  // Generic secrets
  {
    pattern: /[A-Z_]+(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)["\s:=]+["']?[^\s"',]+["']?/gi,
    replacement: '[REDACTED_ENV]',
  },

  // AWS credentials
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_ACCESS_KEY]' },
  { pattern: /aws_secret_access_key["\s:=]+["']?[^\s"',]+["']?/gi, replacement: 'aws_secret_access_key=[REDACTED]' },

  // Private keys
  { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },

  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: 'Bearer [REDACTED_TOKEN]' },
  { pattern: /Authorization["\s:=]+["']?Bearer\s+[^\s"',]+["']?/gi, replacement: 'Authorization: Bearer [REDACTED]' },
];

/**
 * 过滤敏感数据
 * @param content 原始内容
 * @returns 过滤后的内容
 */
export function filterSensitiveData(content: string): string {
  let result = content;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * 检查内容是否包含敏感数据
 */
export function containsSensitiveData(content: string): boolean {
  for (const { pattern } of SENSITIVE_PATTERNS) {
    // 重置正则表达式状态
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * 获取所有敏感模式（用于测试）
 */
export function getSensitivePatterns(): SensitivePattern[] {
  return [...SENSITIVE_PATTERNS];
}
