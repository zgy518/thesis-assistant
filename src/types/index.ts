// ========== 论文项目 ==========

export interface Paper {
  id: string;
  title: string;
  topicKeywords: string;
  language: "en" | "zh" | "bilingual";
  thesisType: "business-english" | "general";
  status: "draft" | "writing" | "completed";
  studentName?: string;
  studentId?: string;
  advisor?: string;
  department?: string;
  targetWords?: number;
  createdAt: number;
  updatedAt: number;
}

// ========== 版本快照 ==========

export interface VersionSnapshot {
  id: string;
  paperId: string;
  chapterId?: string;
  label: string;
  chapters: Chapter[];
  createdAt: number;
}

// ========== 句式分析 ==========

export interface SentencePattern {
  text: string;
  issue: string;
  suggestion: string;
}

// ========== 章节 ==========

export interface Chapter {
  id: string;
  paperId: string;
  parentId: string | null;
  title: string;
  titleZh?: string;
  content: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

// ========== 参考文献 ==========

export type ReferenceType =
  | "book"
  | "article"
  | "website"
  | "thesis"
  | "other";

export interface Reference {
  id: string;
  paperId: string;
  type: ReferenceType;
  author: string;
  title: string;
  year?: number;
  journal?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  citationKey: string;
  createdAt: number;
}

// ========== 术语 ==========

export interface Term {
  id: string;
  paperId: string;
  source: string;
  target: string;
  sourceLang: "zh" | "en";
  targetLang: "zh" | "en";
  domain?: string;
  note?: string;
  createdAt: number;
}

// ========== AI 操作历史 ==========

export type AiOperationType =
  | "write"
  | "polish"
  | "paraphrase"
  | "expand"
  | "condense"
  | "translate"
  | "grammar";

export interface AiHistory {
  id: string;
  paperId: string;
  chapterId?: string;
  type: AiOperationType;
  input: string;
  output: string;
  createdAt: number;
}

// ========== 应用设置 ==========

export type CitationStyle = "APA" | "MLA" | "Harvard";
export type AppTheme = "light" | "dark" | "system";

export interface AppSettings {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  citationStyle: CitationStyle;
  theme: AppTheme;
  studentName?: string;
  studentId?: string;
  advisor?: string;
  department?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  apiBaseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
  citationStyle: "APA",
  theme: "system",
};

// ========== AI 请求/响应类型 ==========

export interface Topic {
  title: string;
  researchQuestions: string[];
  justification: string;
}

export interface OutlineNode {
  id: string;
  title: string;
  titleZh?: string;
  children: OutlineNode[];
}

export interface GrammarIssue {
  text: string;
  suggestion: string;
  severity: "error" | "warning" | "style";
  explanation: string;
}

export type PolishMode = "grammar" | "academic" | "coherence" | "vocabulary" | "humanize";
export type RewriteMode = "paraphrase" | "expand" | "condense";
export type TranslateDirection = "zh2en" | "en2zh";

export interface AiRequestOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}
