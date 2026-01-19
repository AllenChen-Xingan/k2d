/**
 * G2.2 对话数据采集
 * 从 transcript 解析对话内容和工具调用
 */

import * as fs from 'fs/promises';
import { filterSensitiveData } from '../utils/sensitive-filter';

export interface ToolCall {
  tool_name: string;
  tool_type: string | null;
  parameters: Record<string, unknown>;
  result_status: 'success' | 'failure';
  result_summary: string | null;
  execution_time_ms: number | null;
}

export interface SkillUsage {
  skill_name: string;
  trigger_type: 'user' | 'auto';
  context: string | null;
  outcome: 'success' | 'partial' | 'failed' | null;
}

export interface McpCall {
  server_name: string;
  tool_name: string;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
}

export interface TurnData {
  user_message: string;
  assistant_response: string;
  tool_calls: ToolCall[];
  skill_usages: SkillUsage[];
  mcp_calls: McpCall[];
}

interface TranscriptEntry {
  type?: string;
  role?: string;
  content?: string | ContentBlock[];
  message?: {
    role: string;
    content: ContentBlock[];
  };
  tool_calls?: RawToolCall[];
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface RawToolCall {
  name: string;
  parameters?: Record<string, unknown>;
  input?: Record<string, unknown>;
  status?: string;
  result?: string;
  duration_ms?: number;
}

/**
 * 分类工具类型
 */
function classifyToolType(toolName: string): string {
  const fileTools = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];
  const codeTools = ['Bash', 'NotebookEdit'];
  const searchTools = ['WebSearch', 'WebFetch'];

  if (fileTools.includes(toolName)) return 'file';
  if (codeTools.includes(toolName)) return 'code';
  if (searchTools.includes(toolName)) return 'search';
  if (toolName.startsWith('mcp__')) return 'mcp';

  return 'other';
}

/**
 * 从 assistant entry 提取工具调用
 */
export function extractToolCalls(entry: TranscriptEntry): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  // 从 tool_calls 字段提取
  if (entry.tool_calls) {
    for (const tc of entry.tool_calls) {
      toolCalls.push({
        tool_name: tc.name,
        tool_type: classifyToolType(tc.name),
        parameters: tc.parameters || tc.input || {},
        result_status: tc.status === 'success' ? 'success' : 'failure',
        result_summary: tc.result || null,
        execution_time_ms: tc.duration_ms || null,
      });
    }
  }

  // 从 content 中提取 tool_use blocks
  const content = entry.message?.content || entry.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use' && block.name) {
        // 检查是否已经存在（避免重复）
        if (!toolCalls.some((tc) => tc.tool_name === block.name)) {
          toolCalls.push({
            tool_name: block.name,
            tool_type: classifyToolType(block.name),
            parameters: block.input || {},
            result_status: 'success',
            result_summary: null,
            execution_time_ms: null,
          });
        }
      }
    }
  }

  return toolCalls;
}

/**
 * 从 assistant entry 提取 skill 使用
 */
export function extractSkillUsages(entry: TranscriptEntry): SkillUsage[] {
  const skillUsages: SkillUsage[] = [];

  // 从工具调用中找 Skill 调用
  const toolCalls = extractToolCalls(entry);
  for (const tc of toolCalls) {
    if (tc.tool_name === 'Skill') {
      const params = tc.parameters as { skill?: string; args?: string };
      if (params.skill) {
        skillUsages.push({
          skill_name: params.skill,
          trigger_type: 'user',
          context: params.args || null,
          outcome: tc.result_status === 'success' ? 'success' : 'failed',
        });
      }
    }
  }

  return skillUsages;
}

/**
 * 从 assistant entry 提取 MCP 调用
 */
export function extractMcpCalls(entry: TranscriptEntry): McpCall[] {
  const mcpCalls: McpCall[] = [];

  const toolCalls = extractToolCalls(entry);
  for (const tc of toolCalls) {
    if (tc.tool_name.startsWith('mcp__')) {
      // mcp__server__tool 格式
      const parts = tc.tool_name.split('__');
      if (parts.length >= 3) {
        mcpCalls.push({
          server_name: parts[1],
          tool_name: parts.slice(2).join('__'),
          request: tc.parameters,
          response: null,
        });
      }
    }
  }

  return mcpCalls;
}

/**
 * 从 transcript 解析最新的 turn
 */
export async function parseLatestTurn(transcriptPath: string): Promise<TurnData> {
  const content = await fs.readFile(transcriptPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  let latestUser: TranscriptEntry | null = null;
  let latestAssistant: TranscriptEntry | null = null;

  // 从后往前找最新的 user-assistant 对
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]) as TranscriptEntry;
      const role = entry.role || entry.message?.role || entry.type;

      if (!latestAssistant && role === 'assistant') {
        latestAssistant = entry;
      }
      if (latestAssistant && !latestUser && role === 'user') {
        latestUser = entry;
        break;
      }
    } catch {
      // 跳过无效 JSON
      continue;
    }
  }

  // 提取用户消息
  let userMessage = '';
  if (latestUser) {
    const userContent = latestUser.content || latestUser.message?.content;
    if (typeof userContent === 'string') {
      userMessage = userContent;
    } else if (Array.isArray(userContent)) {
      userMessage = userContent
        .filter((b) => b.type === 'text')
        .map((b) => b.text || '')
        .join('\n');
    }
  }

  // 提取助手响应
  let assistantResponse = '';
  if (latestAssistant) {
    const assistantContent = latestAssistant.content || latestAssistant.message?.content;
    if (typeof assistantContent === 'string') {
      assistantResponse = assistantContent;
    } else if (Array.isArray(assistantContent)) {
      assistantResponse = assistantContent
        .filter((b) => b.type === 'text')
        .map((b) => b.text || '')
        .join('\n');
    }
  }

  return {
    user_message: filterSensitiveData(userMessage),
    assistant_response: filterSensitiveData(assistantResponse),
    tool_calls: latestAssistant ? extractToolCalls(latestAssistant) : [],
    skill_usages: latestAssistant ? extractSkillUsages(latestAssistant) : [],
    mcp_calls: latestAssistant ? extractMcpCalls(latestAssistant) : [],
  };
}

/**
 * 解析完整的 transcript
 */
export async function parseFullTranscript(transcriptPath: string): Promise<TurnData[]> {
  const content = await fs.readFile(transcriptPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const turns: TurnData[] = [];
  let currentUser: TranscriptEntry | null = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as TranscriptEntry;
      const role = entry.role || entry.message?.role || entry.type;

      if (role === 'user') {
        currentUser = entry;
      } else if (role === 'assistant' && currentUser) {
        // 提取用户消息
        let userMessage = '';
        const userContent = currentUser.content || currentUser.message?.content;
        if (typeof userContent === 'string') {
          userMessage = userContent;
        } else if (Array.isArray(userContent)) {
          userMessage = userContent
            .filter((b) => b.type === 'text')
            .map((b) => b.text || '')
            .join('\n');
        }

        // 提取助手响应
        let assistantResponse = '';
        const assistantContent = entry.content || entry.message?.content;
        if (typeof assistantContent === 'string') {
          assistantResponse = assistantContent;
        } else if (Array.isArray(assistantContent)) {
          assistantResponse = assistantContent
            .filter((b) => b.type === 'text')
            .map((b) => b.text || '')
            .join('\n');
        }

        turns.push({
          user_message: filterSensitiveData(userMessage),
          assistant_response: filterSensitiveData(assistantResponse),
          tool_calls: extractToolCalls(entry),
          skill_usages: extractSkillUsages(entry),
          mcp_calls: extractMcpCalls(entry),
        });

        currentUser = null;
      }
    } catch {
      // 跳过无效 JSON
      continue;
    }
  }

  return turns;
}
