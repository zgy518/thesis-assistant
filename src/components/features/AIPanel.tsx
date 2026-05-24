import { useState, useEffect } from "react";
import { writeSection, polishTextStream, rewriteTextStream, translateTextStream, checkGrammar, checkVariety, checkCoherence, checkArgumentChain, synthesizeLiterature, paperHealthCheck, extractTerms, AiApiError } from "@/services/ai";
import { stripMarkdown } from "@/lib/utils";
import { db } from "@/services/db";
import { toast } from "sonner";
import type { AiOperationType, PolishMode, RewriteMode, TranslateDirection, Term, GrammarIssue } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Edit3,
  Languages,
  Loader2,
  AlertTriangle,
  Copy,
  RotateCcw,
  ArrowLeftRight,
  ListRestart,
  Shrink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface AIPanelProps {
  chapterTitle: string;
  editorContent: string;
  paperId: string;
  chapterId: string;
  onReplace: (text: string) => void;
}

export default function AIPanel({
  chapterTitle,
  editorContent,
  paperId,
  chapterId,
  onReplace,
}: AIPanelProps) {
  // ===== Write mode =====
  const [writeInput, setWriteInput] = useState("");
  const [writeResult, setWriteResult] = useState("");
  const [writeLoading, setWriteLoading] = useState(false);

  // ===== Polish mode =====
  const [polishMode, setPolishMode] = useState<PolishMode>("academic");
  const [polishResult, setPolishResult] = useState("");
  const [polishLoading, setPolishLoading] = useState(false);

  // ===== Rewrite mode =====
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("paraphrase");
  const [rewriteResult, setRewriteResult] = useState("");
  const [rewriteLoading, setRewriteLoading] = useState(false);

  // ===== Translate mode =====
  const [translateDir, setTranslateDir] = useState<TranslateDirection>("zh2en");
  const [translateResult, setTranslateResult] = useState("");
  const [translateLoading, setTranslateLoading] = useState(false);

  // ===== Glossary =====
  const [glossary, setGlossary] = useState<Term[]>([]);

  useEffect(() => {
    db.getTermsByPaper(paperId).then(setGlossary).catch(() => {});
  }, [paperId]);

  // ===== Grammar mode =====
  const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[]>([]);
  const [grammarLoading, setGrammarLoading] = useState(false);

  // ===== Variety mode =====
  const [varietyResult, setVarietyResult] = useState<{ patterns: { pattern: string; count: number; examples: string[] }[]; advice: string } | null>(null);
  const [varietyLoading, setVarietyLoading] = useState(false);

  // ===== Term extraction =====
  const [extractedTerms, setExtractedTerms] = useState<{ source: string; target: string; sourceLang: "zh" | "en"; targetLang: "zh" | "en" }[]>([]);
  const [extractLoading, setExtractLoading] = useState(false);

  // ===== Coherence =====
  const [coherenceResult, setCoherenceResult] = useState("");
  const [coherenceLoading, setCoherenceLoading] = useState(false);

  // ===== Argument chain =====
  const [argumentResult, setArgumentResult] = useState("");
  const [argumentLoading, setArgumentLoading] = useState(false);

  // ===== Literature synthesis =====
  const [litInput, setLitInput] = useState("");
  const [litResult, setLitResult] = useState("");
  const [litLoading, setLitLoading] = useState(false);

  // ===== Paper health =====
  const [healthResult, setHealthResult] = useState("");
  const [healthLoading, setHealthLoading] = useState(false);

  // ===== Shared =====
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("write");

  const clearError = () => setError("");

  const handleError = (e: unknown) => {
    const msg = e instanceof AiApiError ? e.message : "AI 请求失败，请重试";
    setError(msg);
  };

  const saveHistory = (type: AiOperationType, input: string, output: string) => {
    db.createAiHistory({ paperId, chapterId, type, input, output }).catch(() => {});
  };

  // ===== Handlers =====

  const handleWrite = async () => {
    if (!writeInput.trim()) return;
    clearError();
    setWriteLoading(true);
    try {
      const result = await writeSection(chapterTitle, writeInput.trim(), glossary.length > 0 ? glossary : undefined);
      setWriteResult(result);
      saveHistory("write", writeInput.trim(), result);
    } catch (e) {
      handleError(e);
    } finally {
      setWriteLoading(false);
    }
  };

  const handlePolish = async () => {
    if (!editorContent.trim()) return;
    clearError();
    setPolishLoading(true);
    setPolishResult("");
    try {
      let full = "";
      for await (const chunk of polishTextStream(editorContent, polishMode)) {
        full += chunk;
        setPolishResult(full);
      }
      saveHistory("polish", `[${polishMode}] ${editorContent.slice(0, 100)}...`, full);
    } catch (e) {
      handleError(e);
    } finally {
      setPolishLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (!editorContent.trim()) return;
    clearError();
    setRewriteLoading(true);
    setRewriteResult("");
    try {
      let full = "";
      for await (const chunk of rewriteTextStream(editorContent, rewriteMode)) {
        full += chunk;
        setRewriteResult(full);
      }
      saveHistory("paraphrase", `[${rewriteMode}] ${editorContent.slice(0, 100)}...`, full);
    } catch (e) {
      handleError(e);
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleGrammar = async () => {
    const text = editorContent.trim();
    if (!text) return;
    clearError();
    setGrammarLoading(true);
    try {
      const issues = await checkGrammar(text);
      setGrammarIssues(issues);
      saveHistory("grammar", text.slice(0, 200), JSON.stringify(issues));
    } catch (e) {
      handleError(e);
    } finally {
      setGrammarLoading(false);
    }
  };

  const handleVariety = async () => {
    const text = editorContent.trim();
    if (!text) return;
    clearError();
    setVarietyLoading(true);
    try {
      const result = await checkVariety(text);
      setVarietyResult(result);
    } catch (e) {
      handleError(e);
    } finally {
      setVarietyLoading(false);
    }
  };

  const handleExtractTerms = async () => {
    const text = editorContent.trim();
    if (!text) return;
    clearError();
    setExtractLoading(true);
    try {
      const terms = await extractTerms(text);
      setExtractedTerms(terms);
    } catch (e) {
      handleError(e);
    } finally {
      setExtractLoading(false);
    }
  };

  const handleCoherence = async () => {
    const text = editorContent.trim();
    if (!text) return;
    clearError();
    setCoherenceLoading(true);
    setCoherenceResult("");
    try {
      const result = await checkCoherence(text);
      setCoherenceResult(result);
    } catch (e) {
      handleError(e);
    } finally {
      setCoherenceLoading(false);
    }
  };

  const handleArgument = async () => {
    const text = editorContent.trim();
    if (!text) return; clearError(); setArgumentLoading(true); setArgumentResult("");
    try { setArgumentResult(await checkArgumentChain(text)); } catch (e) { handleError(e); } finally { setArgumentLoading(false); }
  };

  const handleLitSynthesis = async () => {
    if (!litInput.trim()) return; clearError(); setLitLoading(true); setLitResult("");
    try { setLitResult(await synthesizeLiterature(litInput, chapterTitle)); } catch (e) { handleError(e); } finally { setLitLoading(false); }
  };

  const handleHealthCheck = async () => {
    const intro = editorContent.slice(0, 1500) || "None";
    clearError(); setHealthLoading(true); setHealthResult("");
    try { setHealthResult(await paperHealthCheck(chapterTitle, intro, editorContent.slice(0, 3000))); } catch (e) { handleError(e); } finally { setHealthLoading(false); }
  };

  const addExtractedTerm = async (t: { source: string; target: string; sourceLang: "zh" | "en"; targetLang: "zh" | "en" }) => {
    await db.createTerm({
      id: crypto.randomUUID(), paperId, source: t.source, target: t.target,
      sourceLang: t.sourceLang, targetLang: t.targetLang,
    });
    toast.success(`"${t.source}" → "${t.target}" 已加入术语表`);
    setExtractedTerms((prev) => prev.filter((x) => x.source !== t.source));
  };

  const handleTranslate = async () => {
    const text = editorContent.trim();
    if (!text) return;
    clearError();
    setTranslateLoading(true);
    setTranslateResult("");
    try {
      let full = "";
      for await (const chunk of translateTextStream(text, translateDir, glossary.length > 0 ? glossary : undefined)) {
        full += chunk;
        setTranslateResult(full);
      }
      saveHistory("translate", `[${translateDir}] ${text.slice(0, 100)}...`, full);
    } catch (e) {
      handleError(e);
    } finally {
      setTranslateLoading(false);
    }
  };

  const polishLabels: Record<PolishMode, string> = {
    grammar: "语法修正",
    academic: "学术化",
    coherence: "连贯性",
    vocabulary: "词汇优化",
    humanize: "降 AI 痕迹",
  };

  const rewriteLabels: Record<RewriteMode, string> = {
    paraphrase: "改写",
    expand: "扩写",
    condense: "精简",
  };

  const rewriteIcons: Record<RewriteMode, React.ReactNode> = {
    paraphrase: <ListRestart className="h-4 w-4" />,
    expand: <ArrowLeftRight className="h-4 w-4" />,
    condense: <Shrink className="h-4 w-4" />,
  };

  return (
    <div className="flex h-full flex-col">
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); clearError(); }} className="flex flex-1 flex-col">
        <div className="border-b px-3 py-2 space-y-1.5">
          <TabsList className="w-full">
            <TabsTrigger value="write" className="flex-1 text-xs">
              <Sparkles className="mr-1 h-3.5 w-3.5" />撰写
            </TabsTrigger>
            <TabsTrigger value="polish" className="flex-1 text-xs">
              <Edit3 className="mr-1 h-3.5 w-3.5" />润色
            </TabsTrigger>
            <TabsTrigger value="rewrite" className="flex-1 text-xs">
              <ListRestart className="mr-1 h-3.5 w-3.5" />改写
            </TabsTrigger>
          </TabsList>
          <TabsList className="w-full">
            <TabsTrigger value="translate" className="flex-1 text-xs">
              <Languages className="mr-1 h-3.5 w-3.5" />翻译
            </TabsTrigger>
            <TabsTrigger value="grammar" className="flex-1 text-xs">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />检查
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Error alert */}
        {error && (
          <Alert variant="destructive" className="m-3 mb-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3">

            {/* ===== Write Tab ===== */}
            <TabsContent value="write" className="m-0 space-y-3">
              <p className="text-xs text-slate-500">
                输入你想写的要点，AI 会根据当前章节标题扩写为学术段落。
              </p>
              <Textarea
                placeholder="例如：论述 Hofstede 文化维度理论在跨国企业沟通中的应用，引用 2020 年后的研究..."
                value={writeInput}
                onChange={(e) => setWriteInput(e.target.value)}
                className="min-h-[100px] resize-none text-sm"
              />
              <Button
                onClick={handleWrite}
                disabled={!writeInput.trim() || writeLoading}
                className="w-full"
                size="sm"
              >
                {writeLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                {writeLoading ? "正在生成..." : "AI 撰写"}
              </Button>

              {writeResult && <ResultCard text={writeResult} onReplace={(t) => onReplace(stripMarkdown(t))} />}

              {/* ── Literature Synthesis ── */}
              <div className="border-t pt-3">
                <p className="text-xs text-slate-500 mb-2">粘贴文献笔记，AI 按主题归类并写批判性综述。</p>
                <textarea
                  placeholder="粘贴你读过的文献摘要/笔记..."
                  value={litInput}
                  onChange={(e) => setLitInput(e.target.value)}
                  className="min-h-[60px] w-full resize-none rounded-md border px-2 py-1 text-xs"
                />
                <Button onClick={handleLitSynthesis} disabled={!litInput.trim() || litLoading} className="w-full mt-2" size="sm" variant="outline">
                  {litLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                  {litLoading ? "整理中..." : "整理文献综述"}
                </Button>
                {litResult && <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 whitespace-pre-wrap max-h-60 overflow-y-auto">{litResult}</div>}
              </div>

              {/* ── Term Extraction ── */}
              <div className="border-t pt-3">
                <p className="text-xs text-slate-500 mb-2">从当前章节自动识别高频术语，一键加入术语表。</p>
                <Button onClick={handleExtractTerms} disabled={!editorContent.trim() || extractLoading} className="w-full" size="sm" variant="outline">
                  {extractLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                  {extractLoading ? "提取中..." : "AI 提取术语"}
                </Button>
                {extractedTerms.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {extractedTerms.map((t, i) => (
                      <div key={i} className="flex items-center justify-between rounded border p-1.5 text-xs">
                        <span className="truncate">{t.source} <span className="text-slate-300">→</span> {t.target}</span>
                        <Button variant="ghost" size="sm" className="h-5 text-xs flex-shrink-0" onClick={() => addExtractedTerm(t)}>
                          + 加入
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ===== Polish Tab ===== */}
            <TabsContent value="polish" className="m-0 space-y-3">
              <p className="text-xs text-slate-500">
                润色当前章节内容（{editorContent.length} 字）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(polishLabels) as PolishMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={polishMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPolishMode(mode)}
                  >
                    {polishLabels[mode]}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handlePolish}
                disabled={!editorContent.trim() || polishLoading}
                className="w-full"
                size="sm"
              >
                {polishLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Edit3 className="mr-1 h-4 w-4" />
                )}
                {polishLoading ? "正在润色..." : `AI 润色 (${polishLabels[polishMode]})`}
              </Button>

              {polishMode === "humanize" && (
                <p className="text-xs text-amber-600">
                  提醒：此模式可降低 AI 文本特征，但不能保证通过任何 AIGC 检测。最终还需你自己通读修改。
                </p>
              )}

              {polishResult && <ResultCard text={polishResult} onReplace={(t) => onReplace(stripMarkdown(t))} />}
            </TabsContent>

            {/* ===== Rewrite Tab ===== */}
            <TabsContent value="rewrite" className="m-0 space-y-3">
              <p className="text-xs text-slate-500">
                改写当前章节（{editorContent.length} 字）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(rewriteLabels) as RewriteMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={rewriteMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRewriteMode(mode)}
                  >
                    {rewriteIcons[mode]}
                    <span className="ml-1">{rewriteLabels[mode]}</span>
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleRewrite}
                disabled={!editorContent.trim() || rewriteLoading}
                className="w-full"
                size="sm"
              >
                {rewriteLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  rewriteIcons[rewriteMode]
                )}
                <span className="ml-1">
                  {rewriteLoading ? "正在处理..." : `AI ${rewriteLabels[rewriteMode]}`}
                </span>
              </Button>

              {rewriteResult && <ResultCard text={rewriteResult} onReplace={(t) => onReplace(stripMarkdown(t))} />}
            </TabsContent>

            {/* ===== Translate Tab ===== */}
            <TabsContent value="translate" className="m-0 space-y-3">
              <p className="text-xs text-slate-500">
                翻译当前章节（{editorContent.length} 字）
              </p>
              {glossary.length > 0 && (
                <p className="text-xs text-blue-600">
                  已加载 {glossary.length} 个术语，翻译时将自动应用
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant={translateDir === "zh2en" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTranslateDir("zh2en")}
                >
                  中 → 英
                </Button>
                <Button
                  variant={translateDir === "en2zh" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTranslateDir("en2zh")}
                >
                  英 → 中
                </Button>
              </div>
              <Button
                onClick={handleTranslate}
                disabled={!editorContent.trim() || translateLoading}
                className="w-full"
                size="sm"
              >
                {translateLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="mr-1 h-4 w-4" />
                )}
                {translateLoading ? "正在翻译..." : `翻译 (${translateDir === "zh2en" ? "中→英" : "英→中"})`}
              </Button>

              {translateResult && <ResultCard text={translateResult} onReplace={(t) => onReplace(stripMarkdown(t))} />}
            </TabsContent>

            {/* ===== Grammar Check Tab ===== */}
            <TabsContent value="grammar" className="m-0 space-y-3">
              <p className="text-xs text-slate-500">
                检查当前章节的语法、拼写和学术风格问题（{editorContent.length} 字）
              </p>
              <Button
                onClick={handleGrammar}
                disabled={!editorContent.trim() || grammarLoading}
                className="w-full"
                size="sm"
              >
                {grammarLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                )}
                {grammarLoading ? "正在检查..." : "检查语法"}
              </Button>

              {grammarIssues.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">
                      {grammarIssues.filter((i) => i.severity === "error").length} 错误
                    </span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                      {grammarIssues.filter((i) => i.severity === "warning").length} 警告
                    </span>
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">
                      {grammarIssues.filter((i) => i.severity === "style").length} 风格建议
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grammarIssues.map((issue, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 ${
                          issue.severity === "error"
                            ? "border-red-200 bg-red-50/50"
                            : issue.severity === "warning"
                              ? "border-amber-200 bg-amber-50/50"
                              : "border-blue-100 bg-blue-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <p className="text-xs line-through text-slate-400">{issue.text}</p>
                            <p className="text-sm font-medium text-green-700">{issue.suggestion}</p>
                            <p className="text-xs text-slate-500">{issue.explanation}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 flex-shrink-0 text-xs"
                            onClick={() => {
                              const replaced = editorContent.replace(issue.text, issue.suggestion);
                              onReplace(replaced);
                            }}
                          >
                            修正
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Coherence ── */}
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-medium text-slate-600">段落连贯性分析</p>
                <Button onClick={handleCoherence} disabled={!editorContent.trim() || coherenceLoading} className="w-full" size="sm" variant="outline">
                  {coherenceLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ListRestart className="mr-1 h-3.5 w-3.5" />}
                  {coherenceLoading ? "分析中..." : "检查连贯性"}
                </Button>
                {coherenceResult && (
                  <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 whitespace-pre-wrap">
                    {coherenceResult}
                  </div>
                )}
              </div>

              {/* ── Argument Chain ── */}
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-medium text-slate-600">论证链检查</p>
                <p className="text-xs text-slate-500 mb-2">检查每个段落的 观点→论据→分析 闭环。</p>
                <Button onClick={handleArgument} disabled={!editorContent.trim() || argumentLoading} className="w-full" size="sm" variant="outline">
                  {argumentLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ListRestart className="mr-1 h-3.5 w-3.5" />}
                  {argumentLoading ? "分析中..." : "检查论证链"}
                </Button>
                {argumentResult && (
                  <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {argumentResult}
                  </div>
                )}
              </div>

              {/* ── Paper Health ── */}
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-medium text-slate-600">论文体检</p>
                <p className="text-xs text-slate-500 mb-2">从 8 个维度综合评估论文质量。</p>
                <Button onClick={handleHealthCheck} disabled={healthLoading} className="w-full" size="sm" variant="outline">
                  {healthLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                  {healthLoading ? "评估中..." : "论文体检"}
                </Button>
                {healthResult && (
                  <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {healthResult}
                  </div>
                )}
              </div>

              {/* ── Sentence Variety ── */}
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-medium text-slate-600">句式多样性检测</p>
                <Button onClick={handleVariety} disabled={!editorContent.trim() || varietyLoading} className="w-full" size="sm" variant="outline">
                  {varietyLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ListRestart className="mr-1 h-3.5 w-3.5" />}
                  {varietyLoading ? "分析中..." : "检测句式重复"}
                </Button>

                {varietyResult && (
                  <div className="mt-3 space-y-2">
                    {varietyResult.patterns.filter(p => p.count >= 3).map((p, i) => (
                      <div key={i} className="rounded-lg border bg-amber-50/50 p-2">
                        <p className="text-xs font-medium text-amber-800">"{p.pattern}" 出现 {p.count} 次</p>
                        <p className="mt-1 text-xs text-slate-500">
                          例：{p.examples.slice(0, 2).join("；")}
                        </p>
                      </div>
                    ))}
                    {varietyResult.advice && (
                      <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
                        <strong>建议：</strong>{varietyResult.advice}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!grammarLoading && grammarIssues.length === 0 && !varietyResult && (
                <div className="flex flex-col items-center py-8 text-center">
                  <AlertCircle className="mb-2 h-6 w-6 text-slate-300" />
                  <p className="text-xs text-slate-400">点击"检查语法"或"检测句式重复"开始审查</p>
                </div>
              )}
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ===== Result Card =====
function ResultCard({ text, onReplace }: { text: string; onReplace: (t: string) => void }) {
  return (
    <div className="rounded-lg border bg-slate-50">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-slate-500">AI 结果</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigator.clipboard.writeText(text)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onReplace(text)}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            替换
          </Button>
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto p-3 text-sm text-slate-700 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}
