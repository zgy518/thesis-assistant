import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/services/db";
import type { Paper, Chapter } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import AIPanel from "@/components/features/AIPanel";
import { exportToWord, exportToPDF } from "@/services/export";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { Target, Camera, History } from "lucide-react";
import type { VersionSnapshot } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  Edit3,
  Loader2,
  Save,
  BookOpen,
  Globe,
  Menu,
  FileText,
  Sparkles,
  X,
} from "lucide-react";

export default function WritingPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handleExport = async (format: "word" | "pdf") => {
    if (!paperId || !paper) return;
    if (activeChapterId && editorContent !== activeChapter?.content) {
      await db.updateChapter(activeChapterId, { content: editorContent });
    }
    const [chs, refs] = await Promise.all([
      db.getChaptersByPaper(paperId),
      db.getReferencesByPaper(paperId),
    ]);
    if (format === "word") {
      toast.promise(exportToWord(paper, chs, refs, settings.citationStyle), {
        loading: "正在生成 Word 文档...",
        success: "Word 文档已下载",
        error: "导出失败",
      });
    } else {
      exportToPDF(paper, chs, refs, settings.citationStyle);
      toast.success("PDF 已在浏览器中打开");
    }
  };

  // Data
  const [paper, setPaper] = useState<Paper | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected chapter
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const activeChapter = chapters.find((c) => c.id === activeChapterId);

  // Editor
  const [editorContent, setEditorContent] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshots
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadSnapshots = async () => {
    if (!paperId) return;
    setSnapshots(await db.getSnapshots(paperId));
  };

  const [showChapters, setShowChapters] = useState(true);
  const [showAI, setShowAI] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"chapters" | "editor" | "ai" | null>(null);

  // Word count
  const wordCount = editorContent
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  // Load data
  useEffect(() => {
    if (!paperId) return;
    (async () => {
      const p = await db.getPaper(paperId);
      if (!p) {
        navigate("/");
        return;
      }
      setPaper(p);
      const chs = await db.getChaptersByPaper(paperId);
      setChapters(chs);
      if (chs.length > 0 && !activeChapterId) {
        setActiveChapterId(chs[0].id);
        setEditorContent(chs[0].content);
      }
      setLoading(false);
    })();
  }, [paperId, navigate]);

  // Switch chapter
  const switchChapter = useCallback(
    async (ch: Chapter) => {
      // Save current first
      if (activeChapterId && editorContent !== activeChapter?.content) {
        await db.updateChapter(activeChapterId, { content: editorContent });
      }
      setActiveChapterId(ch.id);
      setEditorContent(ch.content);
      setPreviewMode(false);
      setTimeout(() => editorRef.current?.focus(), 0);
    },
    [activeChapterId, activeChapter, editorContent],
  );

  // Auto-save
  const save = useCallback(
    async (content: string) => {
      if (!activeChapterId) return;
      setSaveStatus("saving");
      await db.updateChapter(activeChapterId, { content });
      setSaveStatus("saved");
    },
    [activeChapterId],
  );

  const handleContentChange = (value: string) => {
    setEditorContent(value);
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(value), 2000);
  };

  // Manual save (Ctrl+S)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (saveStatus === "unsaved") save(editorContent);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveStatus, editorContent, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Build chapter tree
  const topChapters = chapters.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
  const getChildren = (parentId: string) =>
    chapters.filter((c) => c.parentId === parentId).sort((a, b) => a.order - b.order);

  const renderChapterNav = (nodes: Chapter[], level = 0) =>
    nodes.map((ch) => (
      <div key={ch.id}>
        <button
          type="button"
          onClick={() => switchChapter(ch)}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
            activeChapterId === ch.id
              ? "bg-blue-100 text-blue-800 font-medium"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${
              activeChapterId === ch.id ? "rotate-90" : ""
            }`}
          />
          <span className="truncate">{ch.title}</span>
        </button>
        {getChildren(ch.id).length > 0 && renderChapterNav(getChildren(ch.id), level + 1)}
      </div>
    ));

  // ===== Render =====
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!paper) return null;

  return (
    <div className="flex h-[calc(100vh-56px)] -mx-4">
      {/* Mobile toolbar — sticky */}
      <div className="sticky top-0 z-30 flex w-full flex-col border-b bg-background lg:hidden">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="flex-1 truncate text-xs font-medium">{activeChapter?.title || ""}</span>
          <span className="text-xs text-muted-foreground">{wordCount.toLocaleString()}词</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 px-1 pb-1">
          <Button variant="outline" size="sm" onClick={() => setMobilePanel("chapters")}><Menu className="h-3 w-3"/>章节</Button>
          <Button variant="outline" size="sm" onClick={() => setMobilePanel("ai")}><Sparkles className="h-3 w-3"/>AI</Button>
          <Button variant="outline" size="sm" disabled={saveStatus!=="unsaved"} onClick={() => save(editorContent)}><Save className="h-3 w-3"/>保存</Button>
          <Button variant={previewMode?"default":"outline"} size="sm" onClick={() => setPreviewMode(!previewMode)}>{previewMode?"编辑":"预览"}</Button>
          <Button variant="outline" size="sm" onClick={()=>handleExport("word")}>Word</Button>
          <Button variant="outline" size="sm" onClick={()=>handleExport("pdf")}>PDF</Button>
          <Button variant="ghost" size="sm" onClick={()=>navigate("/paper/"+paperId+"/references")}>文献</Button>
          <Button variant="ghost" size="sm" onClick={()=>navigate("/paper/"+paperId+"/terms")}>术语</Button>
          <Button variant="ghost" size="sm" onClick={async()=>{await loadSnapshots();setShowSnapshots(true)}}>快照</Button>
        </div>
      </div>

      {/* Mobile panel overlays */}
      {mobilePanel === "chapters" && (
        <div className="fixed inset-0 z-40 bg-background lg:hidden">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">章节导航</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobilePanel(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-48px)]">
            <div className="space-y-0.5 p-2">
              {topChapters.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">暂无章节</p>
              ) : (
                renderChapterNav(topChapters)
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      {mobilePanel === "ai" && (
        <div className="fixed inset-0 z-40 bg-background lg:hidden">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">AI 助手</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobilePanel(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-[calc(100vh-48px)]">
            <AIPanel
              chapterTitle={activeChapter?.title ?? ""}
              editorContent={editorContent}
              paperId={paperId!}
              chapterId={activeChapterId ?? ""}
              onReplace={(text) => {
                setEditorContent(text);
                setSaveStatus("unsaved");
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                saveTimerRef.current = setTimeout(() => save(text), 2000);
              }}
            />
          </div>
        </div>
      )}

      {/* LEFT: Chapter Navigation */}
      {showChapters ? (
        <aside className="hidden w-44 flex-shrink-0 flex-col border-r bg-card lg:flex">
          <div className="flex items-center gap-1 border-b px-2 py-2">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate("/")}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="truncate text-xs font-medium">{paper?.title}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setShowChapters(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-0.5 p-1">
              {topChapters.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">暂无章节</p>
              ) : (
                renderChapterNav(topChapters)
              )}
            </div>
          </ScrollArea>
        </aside>
      ) : (
        <div className="hidden lg:block">
          <Button variant="outline" size="sm" className="ml-2 mt-2 h-7 text-xs" onClick={() => setShowChapters(true)}>
            章节
          </Button>
        </div>
      )}

      {/* CENTER: Editor */}
      <section className="flex flex-1 flex-col">
        {/* Editor Toolbar — two rows */}
        <div className="border-b bg-white">
          {/* Row 1: Chapter + stats */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-sm font-medium text-slate-700 truncate pr-4">
              {activeChapter?.title ?? "选择章节"}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-slate-400">
                {wordCount.toLocaleString()} 词
              </span>
              {paper?.targetWords && (
                <span className="text-xs text-slate-400">
                  / {paper.targetWords.toLocaleString()} ({Math.round(wordCount / paper.targetWords * 100)}%)
                </span>
              )}
              <Button
                variant="ghost" size="sm" className="h-6 text-xs"
                onClick={() => {
                  const w = prompt("目标词数：", paper?.targetWords?.toString() || "8000");
                  if (w && paperId && !isNaN(Number(w))) {
                    db.updatePaper(paperId, { targetWords: Number(w) });
                    setPaper((prev) => prev ? { ...prev, targetWords: Number(w) } : prev);
                  }
                }}
              >
                <Target className="mr-1 h-3 w-3" />
                目标
              </Button>
              <span className={`text-xs ${saveStatus==="saved"?"text-green-600":saveStatus==="saving"?"text-slate-400":"text-amber-500"}`}>
                {saveStatus==="saved"?"已保存":saveStatus==="saving"?"保存中":"未保存"}
              </span>
            </div>
          </div>
          {/* Row 2: Action buttons */}
          <div className="flex items-center gap-1.5 px-4 pb-1.5 flex-wrap">
            <Button variant="outline" size="sm" disabled={saveStatus !== "unsaved"} onClick={() => save(editorContent)}>
              <Save className="mr-1 h-3.5 w-3.5" />保存
            </Button>
            <Button variant={previewMode?"default":"outline"} size="sm" onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? "编辑" : "预览"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("word")}>Word</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>PDF</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/paper/${paperId}/references`)}>
              <BookOpen className="mr-1 h-3.5 w-3.5" />文献
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/paper/${paperId}/terms`)}>
              <Globe className="mr-1 h-3.5 w-3.5" />术语
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await loadSnapshots(); setShowSnapshots(true); }}>
              <History className="mr-1 h-3.5 w-3.5" />快照
            </Button>
          </div>
        </div>

        {/* Snapshot Dialog */}
        <Dialog open={showSnapshots} onOpenChange={setShowSnapshots}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>版本快照</DialogTitle>
              <DialogDescription>保存当前全文状态，可随时恢复。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Button
                size="sm"
                onClick={async () => {
                  const label = prompt("快照名称（如：初稿、修改前）：", new Date().toLocaleString("zh-CN"));
                  if (!label || !paperId) return;
                  await db.createSnapshot(paperId, label);
                  toast.success(`快照"${label}"已保存`);
                  await loadSnapshots();
                }}
              >
                <Camera className="mr-1 h-4 w-4" />新建快照
              </Button>

              {snapshots.length === 0 ? (
                <p className="text-xs text-slate-400">暂无快照</p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {snapshots.map((snap) => (
                    <div key={snap.id} className="flex items-center justify-between rounded-lg border p-2">
                      <div>
                        <p className="text-sm font-medium">{snap.label}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(snap.createdAt).toLocaleString("zh-CN")} · {snap.chapters.length} 章
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={restoringId === snap.id}
                          onClick={async () => {
                            setRestoringId(snap.id);
                            await db.restoreSnapshot(snap.id);
                            toast.success("已恢复快照");
                            setRestoringId(null);
                            setShowSnapshots(false);
                            window.location.reload();
                          }}
                        >
                          {restoringId === snap.id ? "恢复中..." : "恢复"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-400"
                          onClick={async () => {
                            await db.deleteSnapshot(snap.id);
                            toast.success("快照已删除");
                            await loadSnapshots();
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Editor / Preview Area */}
        <div className="flex-1 overflow-hidden">
          {previewMode ? (
            <ScrollArea className="h-full">
              <div className="prose prose-slate mx-auto max-w-3xl p-8">
                <MarkdownPreview content={editorContent} />
              </div>
            </ScrollArea>
          ) : (
            <textarea
              ref={editorRef}
              value={editorContent}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="在此输入正文内容...&#10;&#10;支持 Markdown 语法：&#10;# 一级标题&#10;## 二级标题&#10;**加粗** *斜体*&#10;> 引用"
              className="h-full w-full resize-none border-0 bg-slate-50 p-8 font-serif text-lg leading-relaxed text-slate-800 placeholder:text-slate-300 focus:outline-none"
            />
          )}
        </div>
      </section>

      {/* RIGHT: AI Panel */}
      {showAI ? (
        <aside className="flex w-72 flex-shrink-0 flex-col border-l bg-card">
          <div className="flex items-center justify-between border-b px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">AI 助手</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAI(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIPanel
              chapterTitle={activeChapter?.title ?? ""}
              editorContent={editorContent}
              paperId={paperId!}
              chapterId={activeChapterId ?? ""}
              onReplace={(text) => {
                setEditorContent(text);
                setSaveStatus("unsaved");
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                saveTimerRef.current = setTimeout(() => save(text), 2000);
              }}
            />
          </div>
        </aside>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="fixed right-4 top-20 z-10"
          onClick={() => setShowAI(true)}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />AI 面板
        </Button>
      )}
    </div>
  );
}

// ===== Simple Markdown Preview =====
function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="italic text-slate-400">暂无内容</p>;
  }

  // Simple markdown → HTML
  const html = content
    // Headings
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Blockquote
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Paragraphs (double newline)
    .replace(/\n\n/g, "</p><p>")
    // Single newline → <br>
    .replace(/\n/g, "<br>");

  return (
    <div
      className="space-y-4 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-500 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-medium [&_h4]:text-lg [&_h4]:font-medium"
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  );
}
