import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePapers } from "@/hooks/usePapers";
import { useSettings } from "@/hooks/useSettings";
import { db } from "@/services/db";
import { toast } from "sonner";
import { importAndSaveDocx } from "@/services/import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Paper } from "@/types";
import {
  Plus,
  FileText,
  Trash2,
  Pencil,
  Clock,
  AlertTriangle,
  Key,
  ArrowRight,
  Upload,
} from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { papers, loading, createPaper, deletePaper, renamePaper } = usePapers();
  const { settings } = useSettings();

  const [deletingPaper, setDeletingPaper] = useState<Paper | null>(null);
  const [renamingPaper, setRenamingPaper] = useState<Paper | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [paperStats, setPaperStats] = useState<Record<string, { words: number; chapters: number }>>({});

  // Load word stats for all papers
  useEffect(() => {
    (async () => {
      const stats: Record<string, { words: number; chapters: number }> = {};
      for (const p of papers) {
        const chs = await db.getChaptersByPaper(p.id);
        const words = chs.reduce((sum, c) => sum + (c.content || "").trim().split(/\s+/).filter((w: string) => w.length > 0).length, 0);
        stats[p.id] = { words, chapters: chs.length };
      }
      setPaperStats(stats);
    })();
  }, [papers]);

  const handleCreate = async () => {
    const paper = await createPaper({
      title: "",
      topicKeywords: "",
      language: "bilingual",
      thesisType: "business-english",
    });
    navigate(`/paper/${paper.id}/topic`);
  };

  const handleOpenPaper = useCallback(
    async (paperId: string) => {
      const chs = await db.getChaptersByPaper(paperId);
      if (chs.length > 0) {
        navigate(`/paper/${paperId}/write`);
      } else {
        navigate(`/paper/${paperId}/topic`);
      }
    },
    [navigate],
  );

  const handleDelete = async () => {
    if (!deletingPaper) return;
    const title = deletingPaper.title;
    await deletePaper(deletingPaper.id);
    setDeletingPaper(null);
    toast.success(`"${title}" 已删除`);
  };

  const handleRename = async () => {
    if (!renamingPaper || !renameTitle.trim()) return;
    await renamePaper(renamingPaper.id, renameTitle.trim());
    setRenamingPaper(null);
    setRenameTitle("");
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusLabel: Record<Paper["status"], string> = {
    draft: "草稿",
    writing: "写作中",
    completed: "已完成",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">我的论文</h1>
          <p className="text-slate-500">管理你的商务英语毕业论文项目</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const input = document.createElement("input");
            input.type = "file"; input.accept = ".docx,.doc";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              toast.loading("正在解析论文结构...");
              try {
                const paper = await importAndSaveDocx(file);
                toast.dismiss();
                toast.success(`已导入: ${paper.title}`);
                navigate(`/paper/${paper.id}/write`);
              } catch (err) {
                toast.dismiss();
                toast.error("导入失败");
              }
            };
            input.click();
          }}>
            <Upload className="mr-1 h-4 w-4" />导入论文
          </Button>
          <Button onClick={handleCreate} disabled={!settings.apiKey}>
            <Plus className="mr-1 h-4 w-4" />新建论文
          </Button>
        </div>
      </div>

      {/* API Key Warning */}
      {!settings.apiKey && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <Key className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>请先配置 Claude API Key 才能使用 AI 功能。</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
              前往设置
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Paper List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Clock className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : papers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FileText className="mb-4 h-12 w-12" />
          <p className="text-lg">还没有论文</p>
          <p className="text-sm">点击"新建论文"开始你的论文写作之旅</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {papers.map((paper) => (
            <Card
              key={paper.id}
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => handleOpenPaper(paper.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="line-clamp-2 text-lg">{paper.title}</CardTitle>
                  <div className="flex gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded-lg p-2.5 min-h-[44px] min-w-[44px] text-slate-500 hover:bg-slate-100 active:bg-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingPaper(paper);
                        setRenameTitle(paper.title);
                      }}
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2.5 min-h-[44px] min-w-[44px] text-red-400 hover:bg-red-50 active:bg-red-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPaper(paper);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {paper.topicKeywords && (
                  <CardDescription>{paper.topicKeywords}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Progress */}
                {paperStats[paper.id] && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{paperStats[paper.id].words.toLocaleString()} 词 · {paperStats[paper.id].chapters} 章</span>
                      {paper.targetWords && (
                        <span>{Math.round(paperStats[paper.id].words / paper.targetWords * 100)}%</span>
                      )}
                    </div>
                    {paper.targetWords && (
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(100, Math.round(paperStats[paper.id].words / paper.targetWords * 100))}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      paper.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : paper.status === "writing"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {statusLabel[paper.status]}
                  </span>
                  <span>{formatDate(paper.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirm */}
      <Dialog open={!!deletingPaper} onOpenChange={() => setDeletingPaper(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              删除后将同时清除该论文的所有章节、参考文献和术语数据，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium text-slate-700">
            "{deletingPaper?.title}"
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPaper(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renamingPaper} onOpenChange={() => setRenamingPaper(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名论文</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingPaper(null)}>
              取消
            </Button>
            <Button onClick={handleRename} disabled={!renameTitle.trim()}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
