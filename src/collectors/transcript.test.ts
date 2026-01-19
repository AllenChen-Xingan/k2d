/**
 * G2.2 对话数据采集测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { parseLatestTurn, parseFullTranscript, extractToolCalls, extractSkillUsages, extractMcpCalls } from './transcript';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('G2.2 对话数据采集', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `k2d-test-transcript-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseLatestTurn', () => {
    it('should extract latest user-assistant pair', async () => {
      const transcriptPath = path.join(tempDir, 'transcript1.jsonl');
      const transcript = [
        '{"role":"user","content":"Hello"}',
        '{"role":"assistant","content":"Hi"}',
        '{"role":"user","content":"Help me"}',
        '{"role":"assistant","content":"Sure"}',
      ].join('\n');

      fs.writeFileSync(transcriptPath, transcript);

      const turn = await parseLatestTurn(transcriptPath);
      expect(turn.user_message).toBe('Help me');
      expect(turn.assistant_response).toBe('Sure');
    });

    it('should handle message.content array format', async () => {
      const transcriptPath = path.join(tempDir, 'transcript2.jsonl');
      const transcript = [
        '{"message":{"role":"user","content":[{"type":"text","text":"Test question"}]}}',
        '{"message":{"role":"assistant","content":[{"type":"text","text":"Test answer"}]}}',
      ].join('\n');

      fs.writeFileSync(transcriptPath, transcript);

      const turn = await parseLatestTurn(transcriptPath);
      expect(turn.user_message).toBe('Test question');
      expect(turn.assistant_response).toBe('Test answer');
    });

    it('should filter sensitive data', async () => {
      const transcriptPath = path.join(tempDir, 'transcript3.jsonl');
      const transcript = [
        '{"role":"user","content":"My API key is sk-1234567890abcdefghij"}',
        '{"role":"assistant","content":"I see your key sk-1234567890abcdefghij"}',
      ].join('\n');

      fs.writeFileSync(transcriptPath, transcript);

      const turn = await parseLatestTurn(transcriptPath);
      expect(turn.user_message).not.toContain('sk-1234567890abcdefghij');
      expect(turn.assistant_response).not.toContain('sk-1234567890abcdefghij');
    });

    it('should aggregate multiple assistant messages (tool calls)', async () => {
      const transcriptPath = path.join(tempDir, 'transcript-multi-assistant.jsonl');
      // 模拟真实场景：一个用户消息后有多个 assistant 消息（每个包含不同的工具调用）
      const transcript = [
        '{"type":"user","message":{"role":"user","content":"Help me read files"}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Let me read"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{"file_path":"/a.ts"}}]}}',
        '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"123","content":"file content"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Now editing"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"/a.ts"}}]}}',
      ].join('\n');

      fs.writeFileSync(transcriptPath, transcript);

      const turn = await parseLatestTurn(transcriptPath);
      expect(turn.user_message).toBe('Help me read files');
      expect(turn.tool_calls).toHaveLength(2);
      expect(turn.tool_calls.map((t) => t.tool_name)).toContain('Read');
      expect(turn.tool_calls.map((t) => t.tool_name)).toContain('Edit');
    });

    it('should skip tool_result messages when finding user message', async () => {
      const transcriptPath = path.join(tempDir, 'transcript-tool-result.jsonl');
      const transcript = [
        '{"type":"user","message":{"role":"user","content":"First question"}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Bash","input":{}}]}}',
        '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"123","content":"output"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Done"}]}}',
      ].join('\n');

      fs.writeFileSync(transcriptPath, transcript);

      const turn = await parseLatestTurn(transcriptPath);
      // 应该找到真正的用户消息，而不是 tool_result
      expect(turn.user_message).toBe('First question');
    });
  });

  describe('parseFullTranscript', () => {
    it('should aggregate all tool calls within a turn', async () => {
      const transcriptPath = path.join(tempDir, 'transcript-full.jsonl');
      const transcript = [
        '{"type":"user","message":{"role":"user","content":"Do something"}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{"file":"/a.ts"}}]}}',
        '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"1","content":"data"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Edit","input":{"file":"/a.ts"}}]}}',
        '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"2","content":"ok"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Bash","input":{"cmd":"test"}}]}}',
        '{"type":"user","message":{"role":"user","content":"Next question"}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Answer"}]}}',
      ].join('\n');

      fs.writeFileSync(transcriptPath, transcript);

      const turns = await parseFullTranscript(transcriptPath);
      expect(turns).toHaveLength(2);

      // 第一个 turn 应该有 3 个工具调用
      expect(turns[0].user_message).toBe('Do something');
      expect(turns[0].tool_calls).toHaveLength(3);
      expect(turns[0].tool_calls.map((t) => t.tool_name)).toEqual(['Read', 'Edit', 'Bash']);

      // 第二个 turn 没有工具调用
      expect(turns[1].user_message).toBe('Next question');
      expect(turns[1].tool_calls).toHaveLength(0);
    });

    it('should filter out tool_result user messages', async () => {
      const transcriptPath = path.join(tempDir, 'transcript-filter-tool-result.jsonl');
      const transcript = [
        '{"type":"user","message":{"role":"user","content":"Question 1"}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{}}]}}',
        '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"1","content":"data"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Done 1"}]}}',
        '{"type":"user","message":{"role":"user","content":"Question 2"}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Done 2"}]}}',
      ].join('\n');

      fs.writeFileSync(transcriptPath, transcript);

      const turns = await parseFullTranscript(transcriptPath);
      // 应该只有 2 个 turn，tool_result 不算新的 turn
      expect(turns).toHaveLength(2);
      expect(turns[0].user_message).toBe('Question 1');
      expect(turns[1].user_message).toBe('Question 2');
    });

    it('should handle empty transcript', async () => {
      const transcriptPath = path.join(tempDir, 'transcript-empty.jsonl');
      fs.writeFileSync(transcriptPath, '');

      const turns = await parseFullTranscript(transcriptPath);
      expect(turns).toHaveLength(0);
    });
  });

  describe('extractToolCalls', () => {
    it('should extract tool calls from tool_calls array', () => {
      const entry = {
        role: 'assistant',
        tool_calls: [
          { name: 'Read', parameters: { file_path: '/a.ts' }, status: 'success' },
          { name: 'Edit', parameters: { file_path: '/a.ts' }, status: 'success' },
        ],
      };

      const tools = extractToolCalls(entry);
      expect(tools).toHaveLength(2);
      expect(tools[0].tool_name).toBe('Read');
      expect(tools[0].tool_type).toBe('file');
      expect(tools[1].tool_name).toBe('Edit');
    });

    it('should extract tool calls from content blocks', () => {
      const entry = {
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read the file' },
            { type: 'tool_use', name: 'Read', input: { file_path: '/test.ts' } },
          ],
        },
      };

      const tools = extractToolCalls(entry);
      expect(tools).toHaveLength(1);
      expect(tools[0].tool_name).toBe('Read');
    });

    it('should classify tool types correctly', () => {
      const entry = {
        tool_calls: [
          { name: 'Read', status: 'success' },
          { name: 'Bash', status: 'success' },
          { name: 'WebSearch', status: 'success' },
          { name: 'mcp__browser__click', status: 'success' },
        ],
      };

      const tools = extractToolCalls(entry);
      expect(tools[0].tool_type).toBe('file');
      expect(tools[1].tool_type).toBe('code');
      expect(tools[2].tool_type).toBe('search');
      expect(tools[3].tool_type).toBe('mcp');
    });
  });

  describe('extractSkillUsages', () => {
    it('should extract skill usages from Skill tool calls', () => {
      const entry = {
        tool_calls: [{ name: 'Skill', parameters: { skill: 'dev-coding', args: '--mode strict' }, status: 'success' }],
      };

      const skills = extractSkillUsages(entry);
      expect(skills).toHaveLength(1);
      expect(skills[0].skill_name).toBe('dev-coding');
      expect(skills[0].context).toBe('--mode strict');
      expect(skills[0].outcome).toBe('success');
    });
  });

  describe('extractMcpCalls', () => {
    it('should extract MCP calls', () => {
      const entry = {
        tool_calls: [
          { name: 'mcp__browser-mcp__browser_click', parameters: { ref: 'btn1' }, status: 'success' },
          { name: 'mcp__exa__web_search_exa', parameters: { query: 'test' }, status: 'success' },
        ],
      };

      const mcpCalls = extractMcpCalls(entry);
      expect(mcpCalls).toHaveLength(2);
      expect(mcpCalls[0].server_name).toBe('browser-mcp');
      expect(mcpCalls[0].tool_name).toBe('browser_click');
      expect(mcpCalls[1].server_name).toBe('exa');
      expect(mcpCalls[1].tool_name).toBe('web_search_exa');
    });
  });
});
