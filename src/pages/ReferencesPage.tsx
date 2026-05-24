import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/services/db";
import { formatCitation, formatInTextCitation, generateCitationKey } from "@/lib/citations";
import { useSettings } from "@/hooks/useSettings";
import { lookupDOI } from "@/services/doi";
import { toast } from "sonner";
import type { Paper, Reference, ReferenceType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Copy,
  BookOpen,
  Globe,
  FileText,
  GraduationCap,
  HelpCircle,
  AlertTriangle,
  Loader2,
  Quote,
} from "lucide-react";

const REF_TYPES: { value: ReferenceType; label: string; icon: React.ReactNode }[] = [
  { value: "book", label: "书籍", icon: <BookOpen className="h-4 w-4" /> },
  { value: "article", label: "期刊文章", icon: <FileText className="h-4 w-4" /> },
  { value: "website", label: "网页", icon: <Globe className="h-4 w-4" /> },
  { value: "thesis", label: "学位论文", icon: <GraduationCap className="h-4 w-4" /> },
  { value: "other", label: "其他", icon: <HelpCircle className="h-4 w-4" /> },
];

const emptyForm = (paperId: string): Omit<Reference, "id" | "createdAt"> => ({
  paperId,
  type: "article",
  author: "",
  title: "",
  year: undefined,
  journal: "",
  publisher: "",
  doi: "",
  url: "",
  citationKey: "",
});

export default function ReferencesPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [refs, setRefs] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm(paperId!));
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingRef, setDeletingRef] = useState<Reference | null>(null);

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!paperId) return;
    const [p, r] = await Promise.all([
      db.getPaper(paperId),
      db.getReferencesByPaper(paperId),
    ]);
    if (!p) { navigate("/"); return; }
    setPaper(p);
    setRefs(r);
    setLoading(false);
  }, [paperId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ===== Form =====
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(paperId!));
    setShowForm(true);
  };

  const openEdit = (ref: Reference) => {
    setEditingId(ref.id);
    setForm({ ...ref });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.author.trim() || !form.title.trim()) return;
    setSaving(true);
    try {
      const key = generateCitationKey(form as Reference);
      if (editingId) {
        await db.updateReference(editingId, { ...form, citationKey: key });
      } else {
        await db.createReference({ id: crypto.randomUUID(), ...form, citationKey: key });
      }
      setShowForm(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRef) return;
    await db.deleteReference(deletingRef.id);
    setDeletingRef(null);
    setRefs((prev) => prev.filter((r) => r.id !== deletingRef.id));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (loading) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/paper/${paperId}/write`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">参考文献</h1>
            <p className="text-sm text-slate-500">
              {paper.title} · 当前引用格式：{settings.citationStyle}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            添加文献
          </Button>
        </div>
      </div>

      {/* DOI Quick Lookup */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const doi = (e.target as HTMLFormElement).doi?.value?.trim();
          if (!doi) return;
          toast.loading("查询 DOI...");
          const data = await lookupDOI(doi);
          if (!data) {
            toast.error("DOI 查询失败，请检查格式");
            return;
          }
          toast.dismiss();
          await db.createReference({
            id: crypto.randomUUID(),
            paperId: paperId!,
            type: data.type,
            author: data.author,
            title: data.title,
            year: data.year,
            journal: data.journal,
            publisher: data.publisher,
            doi: data.doi,
            url: data.url,
            citationKey: data.author.split(";")[0]?.trim()?.split(",")[0] + (data.year ?? "nd") + data.title.split(" ")[0],
          });
          toast.success(`已添加: ${data.title.slice(0, 50)}...`);
          await loadData();
        }}
        className="flex gap-2"
      >
        <Input name="doi" placeholder="输入 DOI，如 10.1234/example" className="flex-1 font-mono text-xs" />
        <Button type="submit" variant="outline" size="sm">DOI 查询</Button>
      </form>

      {/* Empty state */}
      {refs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <BookOpen className="mb-4 h-12 w-12" />
          <p className="text-lg">还没有参考文献</p>
          <p className="text-sm">点击"添加文献"开始录入</p>
        </div>
      )}

      {/* Reference list */}
      <div className="space-y-3">
        {refs.map((ref) => {
          const fullCite = formatCitation(ref, settings.citationStyle);
          const inText = formatInTextCitation(ref, settings.citationStyle);
          return (
            <Card key={ref.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">
                      {ref.citationKey}
                    </span>
                    <span className="text-xs text-slate-400">{ref.type}</span>
                  </div>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(inText, `intext-${ref.id}`)}
                    >
                      {copiedId === `intext-${ref.id}` ? (
                        <span className="text-xs text-green-600">已复制</span>
                      ) : (
                        <Quote className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(ref)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={() => setDeletingRef(ref)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-slate-700">{fullCite}</p>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                    文中引用：{inText}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleCopy(inText, `cite-${ref.id}`)}
                  >
                    {copiedId === `cite-${ref.id}` ? (
                      <span className="text-green-600">已复制</span>
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ===== Add/Edit Dialog ===== */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑文献" : "添加文献"}</DialogTitle>
            <DialogDescription>
              填写文献信息，系统将自动生成{settings.citationStyle}格式引用。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type */}
            <div className="space-y-2">
              <Label>文献类型</Label>
              <div className="flex flex-wrap gap-1.5">
                {REF_TYPES.map((t) => (
                  <Button
                    key={t.value}
                    type="button"
                    variant={form.type === t.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm({ ...form, type: t.value })}
                  >
                    {t.icon}
                    <span className="ml-1">{t.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Author */}
            <div className="space-y-2">
              <Label htmlFor="author">作者 *</Label>
              <Input
                id="author"
                placeholder="例如：Smith, J. 或 张三"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                placeholder="文献标题"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label htmlFor="year">年份</Label>
              <Input
                id="year"
                type="number"
                placeholder="2024"
                value={form.year ?? ""}
                onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>

            {/* Conditional fields */}
            {(form.type === "article" || form.type === "thesis") && (
              <div className="space-y-2">
                <Label htmlFor="journal">期刊/学校</Label>
                <Input
                  id="journal"
                  placeholder={form.type === "article" ? "期刊名称" : "大学名称"}
                  value={form.journal ?? ""}
                  onChange={(e) => setForm({ ...form, journal: e.target.value })}
                />
              </div>
            )}

            {(form.type === "book") && (
              <div className="space-y-2">
                <Label htmlFor="publisher">出版社</Label>
                <Input
                  id="publisher"
                  placeholder="出版社名称"
                  value={form.publisher ?? ""}
                  onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                />
              </div>
            )}

            {(form.type === "article" || form.type === "thesis") && (
              <div className="space-y-2">
                <Label htmlFor="doi">DOI</Label>
                <Input
                  id="doi"
                  placeholder="10.xxxx/xxxxx"
                  value={form.doi ?? ""}
                  onChange={(e) => setForm({ ...form, doi: e.target.value })}
                />
              </div>
            )}

            {(form.type === "website") && (
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  placeholder="https://..."
                  value={form.url ?? ""}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!form.author.trim() || !form.title.trim() || saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {editingId ? "保存修改" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirm ===== */}
      <Dialog open={!!deletingRef} onOpenChange={() => setDeletingRef(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              删除后不可恢复。
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">{deletingRef?.title}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRef(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
