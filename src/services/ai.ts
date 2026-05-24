import OpenAI from "openai";
import { getApiKey, getApiBaseUrl, getSettings } from "./settings";
import {
  type Topic,
  type OutlineNode,
  type GrammarIssue,
  type PolishMode,
  type RewriteMode,
  type TranslateDirection,
  type Term,
  type AiRequestOptions,
} from "@/types";
import {
  SYSTEM_PROMPT,
  GENERAL_SYSTEM_PROMPT,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
} from "@/lib/constants";

// Lighter system prompt for fast tasks (grammar, polish, translate)
const LIGHT_SYSTEM = "You are an academic English editor. Output only the requested text, no commentary.";

// ========== API Error ==========

export class AiApiError extends Error {
  code: string;
  status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "AiApiError";
    this.code = code;
    this.status = status;
  }
}

// ========== Client ==========

function createClient(): OpenAI {
  const apiKey = getApiKey();
  if (!apiKey) throw new AiApiError("API Key 未配置，请在设置中添加 DeepSeek API Key", "NO_API_KEY");
  return new OpenAI({ apiKey, baseURL: getApiBaseUrl(), timeout: REQUEST_TIMEOUT_MS, dangerouslyAllowBrowser: true });
}

// ========== Chat (non-streaming, for JSON responses) ==========

async function chat(systemPrompt: string, userMessage: string, options?: AiRequestOptions): Promise<string> {
  const client = createClient();
  const model = getSettings().model;

  return retry(async () => {
    const r = await client.chat.completions.create({
      model,
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      top_p: DEFAULT_TOP_P,
      max_tokens: options?.maxTokens ?? 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    return r.choices[0]?.message?.content ?? "";
  });
}

// ========== Chat Stream (for text output, uses Flash for speed) ==========

export async function* chatStream(
  systemPrompt: string,
  userMessage: string,
  options?: AiRequestOptions,
): AsyncGenerator<string> {
  const client = createClient();
  // Use user's selected model - quality under user control
  const model = options?.model ?? getSettings().model;

  yield* retryStream(async function* () {
    const stream = await client.chat.completions.create({
      model,
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      top_p: DEFAULT_TOP_P,
      max_tokens: options?.maxTokens ?? 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  });
}

// ========== Retry Helpers ==========

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try { return await fn(); } catch (e: unknown) { last = e; if (!shouldRetry(e)) throw mapError(e); }
    await sleep(RETRY_DELAY_MS * Math.pow(2, i));
  }
  throw mapError(last);
}

async function* retryStream(fn: () => AsyncGenerator<string>): AsyncGenerator<string> {
  let last: unknown;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try { yield* fn(); return; } catch (e: unknown) { last = e; if (!shouldRetry(e)) throw mapError(e); }
    await sleep(RETRY_DELAY_MS * Math.pow(2, i));
  }
  throw mapError(last);
}

function shouldRetry(e: unknown): boolean {
  if (e instanceof OpenAI.APIError) {
    if (e.status === 401) return false;
    return e.status === 429 || (e.status != null && e.status >= 500);
  }
  return e instanceof Error && (e.message.includes("timeout") || e.message.includes("abort"));
}

function mapError(e: unknown): AiApiError {
  if (e instanceof AiApiError) return e;
  if (e instanceof OpenAI.APIError) {
    if (e.status === 401) return new AiApiError("API Key 无效，请检查设置", "INVALID_API_KEY", 401);
    if (e.status === 429) return new AiApiError("请求过于频繁，请稍后再试", "RATE_LIMIT", 429);
  }
  if (e instanceof Error && e.message.includes("timeout")) return new AiApiError("请求超时，请检查网络后重试", "TIMEOUT");
  return new AiApiError(`AI 请求失败: ${e instanceof Error ? e.message : "未知错误"}`, "UNKNOWN");
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ========== AI Functions ==========

// Heavy tasks — use user-selected model (V4 Pro recommended)

export async function generateTopics(keywords: string, lang?: string, thesisType?: string): Promise<Topic[]> {
  const system = thesisType === "general" ? GENERAL_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const isZh = lang === "zh" && thesisType === "general";
  const instruction = isZh
    ? `根据研究方向关键词生成5个论文题目。研究方向："${keywords}"\n返回JSON数组，每项：\"title\"(中文), \"researchQuestions\"(2-3个中文问题), \"justification\"(中文说明)。`
    : `Generate 5 thesis topics.\nResearch keywords: "${keywords}"\nReturn ONLY JSON array. Each: "title", "researchQuestions" (2-3 strings), "justification".`;
  const text = await chat(system, instruction, { temperature: 0.7, maxTokens: 2048 });
  return parseJson<Topic[]>(text);
}

export async function generateOutline(topic: string, lang?: string, thesisType?: string): Promise<OutlineNode[]> {
  const system = thesisType === "general" ? GENERAL_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const isZh = lang === "zh" && thesisType === "general";
  const instruction = isZh
    ? `为论文"${topic}"生成详细大纲。结构：引言→文献综述→研究方法→分析与讨论→结论。每章3-5个子标题。\n返回JSON数组，每项：\"id\", \"title\"(中文), \"titleZh\"(留空), \"children\"(递归)。`
    : `Create a detailed outline for thesis: "${topic}". Structure: Introduction → Literature Review → Methodology → Analysis & Discussion → Conclusion. Each chapter 3-5 subsections.\nReturn ONLY JSON. Each: "id", "title", "titleZh", "children" (recursive).`;
  const text = await chat(system, instruction, { temperature: 0.3, maxTokens: 4096 });
  return parseJson<OutlineNode[]>(text);
}

export async function writeSection(sectionName: string, keyPoints: string, glossary?: Term[]): Promise<string> {
  let system = SYSTEM_PROMPT;
  if (glossary?.length) system += `\nGlossary: ${glossary.map((t) => `${t.source}=${t.target}`).join(", ")}`;
  return chat(system,
    `Write academic paragraphs for "${sectionName}" of a Business English thesis.\nKey points: ${keyPoints}\nUse formal English, APA citations, 300-500 words. Return ONLY the text.`,
    { temperature: 0.3, maxTokens: 4096 },
  );
}

// Light tasks — streaming via Flash for speed

export function polishTextStream(text: string, mode: PolishMode): AsyncGenerator<string> {
  const map: Record<PolishMode, string> = {
    grammar: "Fix all grammar/spelling/punctuation errors.",
    academic: "Improve academic tone: replace informal expressions, use precise terminology.",
    coherence: "Improve coherence: logical flow, smooth transitions, clear topic sentences.",
    vocabulary: "Diversify vocabulary: reduce repetition, use sophisticated words. Keep meaning.",
    humanize: `Rewrite this text to sound more like a human student wrote it, not an AI. Follow these rules:

1. VARY sentence length: mix very short sentences (3-5 words) with medium and occasional long ones. Avoid the AI habit of making every sentence 15-25 words.
2. REPLACE these overused AI words/phrases with natural alternatives:
   - "delve into" → "look into" / "examine"
   - "furthermore" / "moreover" → "also" / "in addition" (use sparingly)
   - "it is noteworthy that" → remove entirely, just state the point
   - "in the context of" → "in" / "for"
   - "plays a crucial role" → "is important" / "matters because"
   - "a myriad of" → "many" / "various"
   - "underscores" → "highlights" / "shows"
   - "demonstrates" → "shows" (vary with "points to" / "suggests")
   - "fosters" → "encourages" / "helps develop"
   - "robust" (unless about software) → "strong" / "solid"
3. BREAK paragraph uniformity: some paragraphs 2 sentences, others 5-6. Not every paragraph should have a topic sentence.
4. USE occasional first person where appropriate: "I found that..." / "This paper argues..." / "In my view..."
5. PREFER concrete verbs over abstract nouns: "this shows" not "this is a demonstration of"
6. KEEP academic rigor: maintain citations, terminology, and logical argument. Just sound like a real human wrote it.

Return ONLY the rewritten text. No commentary.`,
  };

  const system = mode === "humanize"
    ? "You are a natural-sounding academic editor. Your job is to make AI-generated text sound like a real undergraduate student wrote it — slightly imperfect, varied in rhythm, free of AI clichés. Maintain academic standards but sound human."
    : LIGHT_SYSTEM;

  return chatStream(system,
    `Polish:\n${text}\n\n${map[mode]}\nReturn ONLY polished text.`,
  );
}

export function rewriteTextStream(text: string, mode: RewriteMode): AsyncGenerator<string> {
  const map: Record<RewriteMode, string> = {
    paraphrase: "Rewrite in different words. Same meaning, same academic tone.",
    expand: "Expand this text: add detail/examples. Target ~1.5x length.",
    condense: "Condense to essentials. Remove redundancy. Target ~0.6x length.",
  };
  return chatStream(LIGHT_SYSTEM,
    `${map[mode]}\n\n${text}\n\nReturn ONLY rewritten text.`,
  );
}

export function translateTextStream(text: string, direction: TranslateDirection, glossary?: Term[]): AsyncGenerator<string> {
  let system = LIGHT_SYSTEM;
  if (glossary?.length) system += `\nExact translations: ${glossary.map((t) => `${t.source}→${t.target}`).join("; ")}`;
  const sl = direction === "zh2en" ? "Chinese" : "English";
  const tl = direction === "zh2en" ? "English" : "Chinese";
  return chatStream(system, `Translate ${sl}→${tl}:\n${text}\nReturn ONLY translation.`);
}

export async function checkGrammar(text: string): Promise<GrammarIssue[]> {
  const result = await chat(SYSTEM_PROMPT + "\nYou are a grammar checker. Respond ONLY with valid JSON.",
    `Check this text for grammar/spelling/style issues. Return ONLY JSON array. Each: "text", "suggestion", "severity" ("error"|"warning"|"style"), "explanation".\n\n${text}`,
    { temperature: 0.1, maxTokens: 2048 },
  );
  return parseJson<GrammarIssue[]>(result);
}

// ========== Sentence Variety Check ==========

export async function checkVariety(text: string): Promise<{ patterns: { pattern: string; count: number; examples: string[] }[]; advice: string }> {
  const result = await chat(SYSTEM_PROMPT + "\nYou analyze sentence variety. Respond ONLY with valid JSON.",
    `Analyze the sentence patterns in this academic text. Focus on:\n`
    + `1. Repeated sentence starters (e.g. "The...", "It is...", "There are...", "This...", "However...", "In addition...", "Therefore...")\n`
    + `2. Overly uniform sentence lengths\n`
    + `3. Monotonous paragraph structures\n\n`
    + `Return ONLY a JSON object with:\n`
    + `- "patterns": array of { "pattern": string, "count": number, "examples": [max 3 example sentences] }\n`
    + `- "advice": brief improvement suggestions in English\n\n`
    + `Text:\n${text}`,
    { temperature: 0.2, maxTokens: 2048 },
  );
  return parseJson<{ patterns: { pattern: string; count: number; examples: string[] }[]; advice: string }>(result);
}

// ========== Literature Synthesis ==========

export async function synthesizeLiterature(notes: string, topic: string): Promise<string> {
  return chat(SYSTEM_PROMPT,
    `Organize these reading notes into a coherent mini literature review.\nTopic: ${topic}\n\n`
    + `Rules:\n1. Group papers by THEME or METHOD, not by author. Do NOT write "Zhang says... Li says..."\n`
    + `2. For each group: what scholars agree on → where they disagree → what's missing\n`
    + `3. End with the research gap your study fills\n4. Formal academic English, 400-600 words\n\n`
    + `Notes:\n${notes.slice(0, 8000)}`,
    { temperature: 0.3, maxTokens: 2048 },
  );
}

// ========== Argument Chain Check ==========

export async function checkArgumentChain(text: string): Promise<string> {
  return chat(SYSTEM_PROMPT + "\nYou are a logic reviewer.",
    `Analyze the argument chain in this text. Check each paragraph for:\n`
    + `- CLAIM: clear point? - EVIDENCE: supported? - ANALYSIS: explains WHY evidence supports claim?\n\n`
    + `Return: 1) Overall score (1-10) 2) Specific weak paragraphs 3) Logical gaps 4) Fix suggestions.\n`
    + `Concise, 200-300 words.\n\n${text.slice(0, 5000)}`,
    { temperature: 0.2, maxTokens: 2048 },
  );
}

// ========== Paper Health Check ==========

export async function paperHealthCheck(
  title: string, intro: string, bodySample: string
): Promise<string> {
  return chat(SYSTEM_PROMPT + "\nYou are a thesis examiner.",
    `Rate this undergraduate thesis (1-5 per dimension) and give one specific fix each:\n`
    + `1. Problem awareness 2. Literature use 3. Argument quality 4. Structure\n`
    + `5. Academic language 6. Citations 7. Contribution 8. Readability\n\n`
    + `Title: ${title}\nIntro: ${intro.slice(0, 800)}\nBody: ${bodySample.slice(0, 1200)}\n\n`
    + `Return: 8 scores + specific fix each + 2-sentence verdict.`,
    { temperature: 0.2, maxTokens: 2048 },
  );
}

// ========== Coherence Check ==========

export async function checkCoherence(text: string): Promise<string> {
  return chat(LIGHT_SYSTEM,
    `Analyze the paragraph transitions and argument flow in this academic text. Check:\n`
    + `1. Does each paragraph smoothly lead to the next?\n`
    + `2. Are there logical gaps between paragraphs?\n`
    + `3. Is the overall argument chain clear?\n\n`
    + `Return a brief analysis with specific suggestions (in English). Keep it concise, 150-250 words.\n\n`
    + `Text:\n${text.slice(0, 5000)}`,
    { temperature: 0.2, maxTokens: 1024 },
  );
}

// ========== Term Extraction ==========

interface TermPair { source: string; target: string; sourceLang: "zh" | "en"; targetLang: "zh" | "en"; }

export async function extractTerms(text: string): Promise<TermPair[]> {
  const result = await chat(SYSTEM_PROMPT,
    `Extract key academic/specialized terms from this text that would need consistent translation in a thesis glossary. Focus on:\n`
    + `- Cross-cultural communication terms\n- Business English terminology\n- AI/technology terms\n- Theoretical concepts\n`
    + `- Proper nouns with academic significance\n\n`
    + `Return ONLY a JSON array. Each object:\n`
    + `- "source": the original term\n`
    + `- "target": suggested Chinese translation (if source is English) or English translation (if source is Chinese)\n`
    + `- "sourceLang": "en" or "zh"\n`
    + `- "targetLang": "zh" or "en"\n`
    + `Text:\n${text.slice(0, 4000)}`,
    { temperature: 0.2, maxTokens: 2048 },
  );
  return parseJson<TermPair[]>(result);
}

function parseJson<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try { return JSON.parse(m[1].trim()) as T; } catch {}
  }
  throw new AiApiError("AI 返回格式异常，请重试", "PARSE_ERROR");
}
