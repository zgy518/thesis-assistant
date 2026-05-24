import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/services/db";
import { generateTopics, generateOutline } from "@/services/ai";
import type { Paper, Topic, OutlineNode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AiApiError } from "@/services/ai";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Check,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  FileText,
  AlertTriangle,
} from "lucide-react";

type Step = "mode" | "input" | "topics" | "outline";

export default function TopicOutlinePage() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();

  // Paper state
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loadingPaper, setLoadingPaper] = useState(true);

  // Step state
  const [step, setStep] = useState<Step>("mode");

  // Step 1: keyword input
  const [keywords, setKeywords] = useState("");
  // Direct title skip
  const [isDirectMode, setIsDirectMode] = useState(false);
  const [directTitle, setDirectTitle] = useState("");

  // Step 2: topic selection
  const [topics, setTopics] = useState<Topic[]>([]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [topicError, setTopicError] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Step 3: outline editing
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [outlineError, setOutlineError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load paper
  useEffect(() => {
    if (!paperId) return;
    db.getPaper(paperId).then((p) => {
      if (!p) {
        navigate("/");
        return;
      }
      setPaper(p);
      setKeywords(p.topicKeywords);
      setLoadingPaper(false);
    });
  }, [paperId, navigate]);

  // ===== Step 1: Generate Topics =====
  const handleGenerateTopics = async () => {
    if (!keywords.trim()) return;
    setGeneratingTopics(true);
    setTopicError("");
    try {
      const results = await generateTopics(keywords.trim(), paper?.language, paper?.thesisType);
      setTopics(results);
      setStep("topics");
    } catch (e) {
      const msg = e instanceof AiApiError ? e.message : "选题生成失败，请重试";
      setTopicError(msg);
    } finally {
      setGeneratingTopics(false);
    }
  };

  // ===== Step 2: Select Topic & Generate Outline =====
  const handleSelectTopic = async (topic: Topic) => {
    setSelectedTopic(topic);
    setGeneratingOutline(true);
    setOutlineError("");
    try {
      const nodes = await generateOutline(topic.title, paper?.language, paper?.thesisType);
      setOutline(nodes);
      if (paper) {
        await db.updatePaper(paper.id, { title: topic.title });
      }
      setStep("outline");
    } catch (e) {
      const msg = e instanceof AiApiError ? e.message : "大纲生成失败，请重试";
      setOutlineError(msg);
    } finally {
      setGeneratingOutline(false);
    }
  };

  const handleDirectOutline = async () => {
    if (!directTitle.trim() || !paper) return;
    setGeneratingOutline(true);
    setOutlineError("");
    try {
      const nodes = await generateOutline(directTitle.trim(), paper?.language, paper?.thesisType);
      setOutline(nodes);
      await db.updatePaper(paper.id, { title: directTitle.trim() });
      setStep("outline");
    } catch (e) {
      const msg = e instanceof AiApiError ? e.message : "大纲生成失败，请重试";
      setOutlineError(msg);
    } finally {
      setGeneratingOutline(false);
    }
  };

  // ===== Step 3: Outline Editing =====
  const updateNode = (nodes: OutlineNode[], targetId: string, updater: (n: OutlineNode) => OutlineNode): OutlineNode[] =>
    nodes.map((node) => {
      if (node.id === targetId) return updater(node);
      if (node.children.length > 0) {
        return { ...node, children: updateNode(node.children, targetId, updater) };
      }
      return node;
    });

  const deleteNode = (nodes: OutlineNode[], targetId: string): OutlineNode[] =>
    nodes
      .filter((node) => node.id !== targetId)
      .map((node) => ({
        ...node,
        children: node.children.length > 0 ? deleteNode(node.children, targetId) : node.children,
      }));

  const addChild = (nodes: OutlineNode[], parentId: string): OutlineNode[] =>
    updateNode(nodes, parentId, (node) => ({
      ...node,
      children: [
        ...node.children,
        { id: crypto.randomUUID(), title: "新章节", titleZh: "新章节", children: [] },
      ],
    }));

  const addTopLevel = () => {
    setOutline((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "新章节", titleZh: "新章节", children: [] },
    ]);
  };

  // Convert flat outline to DB chapters
  const flattenOutline = (
    nodes: OutlineNode[],
    paperId: string,
    parentId: string | null = null,
    orderStart = 0,
  ): { id: string; paperId: string; parentId: string | null; title: string; titleZh?: string; content: string; order: number }[] => {
    let order = orderStart;
    const result: ReturnType<typeof flattenOutline> = [];
    for (const node of nodes) {
      result.push({
        id: node.id,
        paperId,
        parentId,
        title: node.title,
        titleZh: node.titleZh,
        content: "",
        order,
      });
      order++;
      if (node.children.length > 0) {
        const children = flattenOutline(node.children, paperId, node.id, 0);
        result.push(...children);
        order += children.length;
      }
    }
    return result;
  };

  const handleSaveOutline = async () => {
    if (!paper) return;
    setSaving(true);
    try {
      // Delete existing chapters for this paper
      const existing = await db.getChaptersByPaper(paper.id);
      for (const ch of existing) {
        await db.deleteChapter(ch.id);
      }
      // Create new chapters from outline
      const chapters = flattenOutline(outline, paper.id);
      for (const ch of chapters) {
        await db.createChapter(ch);
      }
      await db.updatePaper(paper.id, { status: "writing" });
      navigate(`/paper/${paper.id}/write`);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  // ===== Render =====
  if (loadingPaper) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!paper) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">选题与大纲</h1>
          <p className="text-sm text-slate-500">{paper.title}</p>
        </div>
      </div>

      {/* Progress indicator (hidden on mode select) */}
      {step !== "mode" && (
        <div className="flex items-center gap-2 text-sm">
          {(["input", "topics", "outline"] as Exclude<Step, "mode">[]).map((s, i) => {
            const stepOrder: Record<string, number> = { input: 0, topics: 1, outline: 2 };
            const current = stepOrder[step] ?? -1;
            const idx = stepOrder[s];
            const done = current > idx;
            const active = current === idx;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    active ? "bg-blue-600 text-white" : done ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={active ? "font-medium text-slate-800" : "text-slate-400"}>
                  {s === "input" ? "研究方向" : s === "topics" ? "选择题目" : "大纲编辑"}
                </span>
                {i < 2 && <ChevronRight className="h-4 w-4 text-slate-300" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 0: Mode Selection */}
      {step === "mode" && (
        <>
          {/* Language + Type selector */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600 w-20">论文语言：</span>
                <div className="flex gap-2">
                  {(["bilingual", "en", "zh"] as const).map((l) => (
                    <Button
                      key={l}
                      variant={paper?.language === l ? "default" : "outline"}
                      size="sm"
                      onClick={async () => {
                        if (paper) {
                          await db.updatePaper(paper.id, { language: l });
                          setPaper({ ...paper, language: l });
                        }
                      }}
                    >
                      {l === "bilingual" ? "中英双语" : l === "en" ? "全英文" : "全中文"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600 w-20">论文类型：</span>
                <div className="flex gap-2">
                  {([
                    { id: "business-english" as const, label: "商务英语本科" },
                    { id: "general" as const, label: "通用学术" },
                  ]).map((t) => (
                    <Button
                      key={t.id}
                      variant={paper?.thesisType === t.id ? "default" : "outline"}
                      size="sm"
                      onClick={async () => {
                        if (paper) {
                          await db.updatePaper(paper.id, { thesisType: t.id });
                          setPaper({ ...paper, thesisType: t.id });
                        }
                      }}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-blue-300"
            onClick={() => setStep("input")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-blue-600" />
                AI 帮我选题
              </CardTitle>
              <CardDescription>
                输入研究方向关键词，AI 推荐多个可选题目，选定后自动生成大纲。
              </CardDescription>
            </CardHeader>
          </Card>
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md hover:border-blue-300"
            onClick={() => {
              setIsDirectMode(true);
              setDirectTitle(paper?.title ?? "");
              setStep("input");
            }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-green-600" />
                我已有题目
              </CardTitle>
              <CardDescription>
                直接使用当前论文标题，跳过选题推荐，AI 直接生成大纲。
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        </>
      )}

      {/* Step 1: Input (keywords or direct title) */}
      {step === "input" && !isDirectMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              输入研究方向
            </CardTitle>
            <CardDescription>
              描述你感兴趣的研究方向，AI 将为你推荐合适的论文题目。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keywords">研究关键词</Label>
              <Input
                id="keywords"
                placeholder="例如：跨文化沟通, AI 应用, 商务英语, 国际贸易"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerateTopics();
                }}
              />
              <p className="text-xs text-slate-400">用逗号分隔多个关键词，中英文均可</p>
            </div>
            {topicError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{topicError}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("mode")}>返回</Button>
              <Button onClick={handleGenerateTopics} disabled={!keywords.trim() || generatingTopics}>
                {generatingTopics ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {generatingTopics ? "正在生成选题..." : "AI 生成选题"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1b: Direct title input */}
      {step === "input" && isDirectMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              确认论文题目
            </CardTitle>
            <CardDescription>
              编辑论文标题，AI 将直接为你生成大纲。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="direct-title">论文标题</Label>
              <Input
                id="direct-title"
                placeholder="输入你的论文题目"
                value={directTitle}
                onChange={(e) => setDirectTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && directTitle.trim()) handleDirectOutline();
                }}
              />
            </div>
            {outlineError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{outlineError}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setIsDirectMode(false); setStep("mode"); }}>返回</Button>
              <Button onClick={handleDirectOutline} disabled={!directTitle.trim() || generatingOutline}>
                {generatingOutline ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {generatingOutline ? "正在生成大纲..." : "AI 生成大纲"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Topic Selection */}
      {step === "topics" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              共 {topics.length} 个选题建议
            </h2>
            <Button variant="outline" size="sm" onClick={() => setStep("input")}>
              返回修改关键词
            </Button>
          </div>
          {generatingOutline && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
              <span className="text-slate-600">正在生成大纲...</span>
            </div>
          )}
          {outlineError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{outlineError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-1">
            {topics.map((topic, idx) => (
              <Card
                key={idx}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTopic?.title === topic.title ? "border-blue-500 bg-blue-50/50" : ""
                }`}
                onClick={() => handleSelectTopic(topic)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{topic.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">研究问题：</p>
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                      {topic.researchQuestions.map((q, qi) => (
                        <li key={qi}>{q}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">选题说明：</p>
                    <p className="text-sm text-slate-600">{topic.justification}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Outline Editor */}
      {step === "outline" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">论文大纲</h2>
              <p className="text-sm text-slate-500">
                拖拽调整章节顺序，点击"添加章节"增补内容
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("topics")}>
                返回选题
              </Button>
              <Button onClick={addTopLevel} variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                添加章节
              </Button>
              <Button onClick={handleSaveOutline} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-1 h-4 w-4" />
                )}
                保存并开始写作
              </Button>
            </div>
          </div>

          {/* Outline tree */}
          <div className="space-y-2">
            {outline.map((node, idx) => (
              <OutlineTreeNode
                key={node.id}
                node={node}
                level={0}
                onChange={(updated) =>
                  setOutline(
                    outline.map((n, i) => (i === idx ? updated : n)),
                  )
                }
                onDelete={() => setOutline(outline.filter((_, i) => i !== idx))}
                onAddChild={() => setOutline(addChild(outline, node.id))}
              />
            ))}
          </div>

          {outline.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-slate-400">
              大纲为空，点击"添加章节"开始
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Recursive Outline Node Component =====
function OutlineTreeNode({
  node,
  level,
  onChange,
  onDelete,
  onAddChild,
}: {
  node: OutlineNode;
  level: number;
  onChange: (updated: OutlineNode) => void;
  onDelete: () => void;
  onAddChild: () => void;
}) {
  return (
    <div className={`${level > 0 ? "ml-6" : ""}`}>
      <div className="group flex items-center gap-2 rounded-lg border bg-white p-3 hover:border-slate-300">
        <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-slate-300" />
        <span className="text-xs font-mono text-slate-400 w-6">
          {level === 0 ? "Ch" : "§"}
        </span>
        <Input
          value={node.title}
          onChange={(e) => onChange({ ...node, title: e.target.value })}
          className="h-8 flex-1 border-0 bg-transparent focus-visible:ring-0"
        />
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onAddChild}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {node.children.map((child) => (
        <OutlineTreeNode
          key={child.id}
          node={child}
          level={level + 1}
          onChange={(updated) =>
            onChange({
              ...node,
              children: node.children.map((c) => (c.id === child.id ? updated : c)),
            })
          }
          onDelete={() =>
            onChange({
              ...node,
              children: node.children.filter((c) => c.id !== child.id),
            })
          }
          onAddChild={() =>
            onChange({
              ...node,
              children: [
                ...node.children,
                {
                  id: crypto.randomUUID(),
                  title: "新章节",
                  titleZh: "新章节",
                  children: [],
                },
              ],
            })
          }
        />
      ))}
    </div>
  );
}
