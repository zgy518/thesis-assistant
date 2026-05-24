import { useState, useEffect, useCallback } from "react";
import { db } from "@/services/db";
import type { Paper } from "@/types";

export function usePapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPapers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.getAllPapers();
      setPapers(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  const createPaper = useCallback(
    async (data: { title: string; topicKeywords: string; language: Paper["language"]; thesisType?: Paper["thesisType"] }) => {
      const paper = await db.createPaper({
        id: crypto.randomUUID(),
        ...data,
        thesisType: data.thesisType ?? "business-english",
        status: "draft",
      });
      setPapers((prev) => [paper, ...prev]);
      return paper;
    },
    [],
  );

  const deletePaper = useCallback(async (id: string) => {
    await db.deletePaper(id);
    setPapers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renamePaper = useCallback(async (id: string, title: string) => {
    await db.updatePaper(id, { title });
    setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
  }, []);

  return { papers, loading, loadPapers, createPaper, deletePaper, renamePaper };
}
