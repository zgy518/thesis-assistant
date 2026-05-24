import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/services/db";
import type { Paper, Term } from "@/types";
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
  Upload,
  Download,
  Search,
  Loader2,
  AlertTriangle,
  BookOpen,
  FileText,
} from "lucide-react";

const emptyTerm = (paperId: string): Omit<Term, "createdAt"> => ({
  id: crypto.randomUUID(),
  paperId,
  source: "",
  target: "",
  sourceLang: "zh" as const,
  targetLang: "en" as const,
  domain: "",
  note: "",
});

export default function TermsPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTerm(paperId!));
  const [saving, setSaving] = useState(false);

  // Delete
  const [deletingTerm, setDeletingTerm] = useState<Term | null>(null);

  const loadData = useCallback(async () => {
    if (!paperId) return;
    const [p, t] = await Promise.all([
      db.getPaper(paperId),
      db.getTermsByPaper(paperId),
    ]);
    if (!p) { navigate("/"); return; }
    setPaper(p);
    setTerms(t);
    setLoading(false);
  }, [paperId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = terms.filter((t) =>
    !search ||
    t.source.toLowerCase().includes(search.toLowerCase()) ||
    t.target.toLowerCase().includes(search.toLowerCase())
  );

  // ===== Form =====
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyTerm(paperId!));
    setShowForm(true);
  };

  const openEdit = (term: Term) => {
    setEditingId(term.id);
    setForm({ ...term });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.source.trim() || !form.target.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await db.updateTerm(editingId, form);
      } else {
        await db.createTerm(form);
      }
      setShowForm(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTerm) return;
    await db.deleteTerm(deletingTerm.id);
    setDeletingTerm(null);
    setTerms((prev) => prev.filter((t) => t.id !== deletingTerm.id));
  };

  // ===== Import / Export =====
  const handleExport = () => {
    const headers = "sourceLang,source,targetLang,target,domain,note";
    const rows = terms.map((t) =>
      [t.sourceLang, escapeCsv(t.source), t.targetLang, escapeCsv(t.target), t.domain ?? "", escapeCsv(t.note ?? "")].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terms-${paper?.title?.slice(0, 20) ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;
      const imported: Omit<Term, "createdAt">[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) continue;
        imported.push({
          id: crypto.randomUUID(),
          paperId: paperId!,
          sourceLang: (cols[0] || "zh") as "zh" | "en",
          source: cols[1] || "",
          targetLang: (cols[2] || "en") as "zh" | "en",
          target: cols[3] || "",
          domain: cols[4] || undefined,
          note: cols[5] || undefined,
        });
      }
      if (imported.length > 0) {
        await db.bulkImportTerms(imported);
        await loadData();
      }
    };
    input.click();
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
            <h1 className="text-2xl font-bold text-slate-800">术语管理</h1>
            <p className="text-sm text-slate-500">{paper.title} · {terms.length} 个术语</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="mr-1 h-4 w-4" />导入 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={terms.length === 0}>
            <Download className="mr-1 h-4 w-4" />导出 CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />添加术语
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="搜索术语..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty */}
      {terms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <BookOpen className="mb-4 h-12 w-12" />
          <p className="text-lg">还没有术语</p>
          <p className="text-sm">添加论文涉及的专业术语，翻译时会自动应用保证一致性</p>
        </div>
      )}

      {/* Term list */}
      <div className="space-y-2">
        {filtered.map((term) => (
          <Card key={term.id} className="group">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="w-48">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-500">
                      {term.sourceLang === "zh" ? "中" : "EN"}
                    </span>
                    <span className="font-medium text-slate-800">{term.source}</span>
                  </div>
                </div>
                <span className="text-slate-300">→</span>
                <div className="w-48">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-mono text-blue-600">
                      {term.targetLang === "en" ? "EN" : "中"}
                    </span>
                    <span className="font-medium text-slate-800">{term.target}</span>
                  </div>
                </div>
                {term.domain && (
                  <span className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-400">
                    {term.domain}
                  </span>
                )}
              </div>
              <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(term)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600"
                  onClick={() => setDeletingTerm(term)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {search && filtered.length === 0 && terms.length > 0 && (
          <p className="py-8 text-center text-sm text-slate-400">没有匹配的术语</p>
        )}
      </div>

      {/* ===== Form Dialog ===== */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑术语" : "添加术语"}</DialogTitle>
            <DialogDescription>
              术语会在翻译时自动应用，确保前后一致。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>源语言</Label>
                <div className="flex gap-1">
                  {(["zh", "en"] as const).map((lang) => (
                    <Button
                      key={lang}
                      type="button"
                      variant={form.sourceLang === lang ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setForm({
                          ...form,
                          sourceLang: lang,
                          targetLang: lang === "zh" ? "en" : "zh",
                        });
                      }}
                    >
                      {lang === "zh" ? "中文" : "English"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label>目标语言</Label>
                <div className="flex gap-1">
                  {(["en", "zh"] as const).map((lang) => (
                    <Button
                      key={lang}
                      type="button"
                      variant={form.targetLang === lang ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      disabled={lang === form.sourceLang}
                      onClick={() => setForm({ ...form, targetLang: lang })}
                    >
                      {lang === "zh" ? "中文" : "English"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">源术语 *</Label>
              <Input
                id="source"
                placeholder="例如：跨文化沟通"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">目标术语 *</Label>
              <Input
                id="target"
                placeholder="例如：cross-cultural communication"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">所属领域</Label>
              <Input
                id="domain"
                placeholder="例如：商务沟通 / 语言学"
                value={form.domain ?? ""}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">备注</Label>
              <Input
                id="note"
                placeholder="使用说明"
                value={form.note ?? ""}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!form.source.trim() || !form.target.trim() || saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {editingId ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirm ===== */}
      <Dialog open={!!deletingTerm} onOpenChange={() => setDeletingTerm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              确认删除
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            "{deletingTerm?.source}" → "{deletingTerm?.target}"
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTerm(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== CSV Helpers =====
function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
