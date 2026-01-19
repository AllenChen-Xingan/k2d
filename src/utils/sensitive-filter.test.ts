/**
 * G2.2.6 敏感信息过滤测试
 */

import { describe, it, expect } from 'bun:test';
import { filterSensitiveData, containsSensitiveData } from './sensitive-filter';

describe('G2.2.6 敏感信息过滤', () => {
  describe('filterSensitiveData', () => {
    it('should redact API key', () => {
      const input = 'key: sk-1234567890abcdefghij';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED');
      expect(filtered).not.toContain('sk-1234567890abcdefghij');
    });

    it('should redact password', () => {
      const input = 'password: MySecret123';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED');
      expect(filtered).not.toContain('MySecret123');
    });

    it('should redact connection string', () => {
      const input = 'postgres://user:pass@host/db';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED_CONNECTION_STRING]');
      expect(filtered).not.toContain('postgres://user:pass@host/db');
    });

    it('should redact JWT', () => {
      const input = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED_JWT]');
      expect(filtered).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should redact environment variables with KEY suffix', () => {
      const input = 'DATABASE_KEY="secret123456789012345"';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED');
    });

    it('should redact environment variables with SECRET suffix', () => {
      const input = 'APP_SECRET=verysecretvalue12345';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED');
    });

    it('should redact MongoDB connection string', () => {
      const input = 'mongodb://admin:password@localhost:27017/mydb';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED_CONNECTION_STRING]');
    });

    it('should redact MySQL connection string', () => {
      const input = 'mysql://root:secret@localhost:3306/testdb';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED_CONNECTION_STRING]');
    });

    it('should redact AWS access key', () => {
      const input = 'aws_key AKIAIOSFODNN7EXAMPLE';
      const filtered = filterSensitiveData(input);
      expect(filtered).toContain('[REDACTED');
      expect(filtered).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('should preserve non-sensitive content', () => {
      const input = 'This is a normal message with no secrets';
      const filtered = filterSensitiveData(input);
      expect(filtered).toBe(input);
    });

    it('should handle multiple sensitive values', () => {
      const input = `
        API_KEY=sk-1234567890abcdefghij
        password: secretpassword
        postgres://user:pass@host/db
      `;
      const filtered = filterSensitiveData(input);
      expect(filtered).not.toContain('sk-1234567890abcdefghij');
      expect(filtered).not.toContain('secretpassword');
      expect(filtered).not.toContain('postgres://user:pass@host/db');
    });
  });

  describe('containsSensitiveData', () => {
    it('should return true for content with API key', () => {
      expect(containsSensitiveData('sk-1234567890abcdefghij')).toBe(true);
    });

    it('should return true for content with password', () => {
      expect(containsSensitiveData('password: secret123')).toBe(true);
    });

    it('should return false for safe content', () => {
      expect(containsSensitiveData('This is safe content')).toBe(false);
    });
  });
});
