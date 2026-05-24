import Dexie, { type Table } from "dexie";
import type { Paper, Chapter, Reference, Term, AiHistory, VersionSnapshot } from "@/types";
import { DB_NAME } from "@/lib/constants";

class ThesisDatabase extends Dexie {
  papers!: Table<Paper, string>;
  chapters!: Table<Chapter, string>;
  references!: Table<Reference, string>;
  terms!: Table<Term, string>;
  aiHistory!: Table<AiHistory, string>;
  snapshots!: Table<VersionSnapshot, string>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      papers: "id, status, updatedAt",
      chapters: "id, paperId, parentId, order",
      references: "id, paperId",
      terms: "id, paperId",
      aiHistory: "id, paperId, createdAt",
    });

    this.version(2).stores({
      papers: "id, status, updatedAt",
      chapters: "id, paperId, parentId, order",
      references: "id, paperId",
      terms: "id, paperId",
      aiHistory: "id, paperId, createdAt",
      snapshots: "id, paperId, createdAt",
    });
  }

  // ========== Papers ==========

  async createPaper(
    paper: Omit<Paper, "createdAt" | "updatedAt">
  ): Promise<Paper> {
    const now = Date.now();
    const newPaper: Paper = { ...paper, createdAt: now, updatedAt: now };
    await this.papers.add(newPaper);
    return newPaper;
  }

  async getAllPapers(): Promise<Paper[]> {
    return this.papers.orderBy("updatedAt").reverse().toArray();
  }

  async getPaper(id: string): Promise<Paper | undefined> {
    return this.papers.get(id);
  }

  async updatePaper(
    id: string,
    updates: Partial<Omit<Paper, "id" | "createdAt">>
  ): Promise<void> {
    await this.papers.update(id, { ...updates, updatedAt: Date.now() });
  }

  async deletePaper(id: string): Promise<void> {
    await this.transaction(
      "rw",
      [this.papers, this.chapters, this.references, this.terms, this.aiHistory],
      async () => {
        await this.papers.delete(id);
        await this.chapters.where("paperId").equals(id).delete();
        await this.references.where("paperId").equals(id).delete();
        await this.terms.where("paperId").equals(id).delete();
        await this.aiHistory.where("paperId").equals(id).delete();
      }
    );
  }

  // ========== Chapters ==========

  async createChapter(
    chapter: Omit<Chapter, "createdAt" | "updatedAt">
  ): Promise<Chapter> {
    const now = Date.now();
    const newChapter: Chapter = { ...chapter, createdAt: now, updatedAt: now };
    await this.chapters.add(newChapter);
    return newChapter;
  }

  async getChaptersByPaper(paperId: string): Promise<Chapter[]> {
    return this.chapters
      .where("paperId")
      .equals(paperId)
      .sortBy("order");
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    return this.chapters.get(id);
  }

  async updateChapter(
    id: string,
    updates: Partial<Omit<Chapter, "id" | "paperId" | "createdAt">>
  ): Promise<void> {
    await this.chapters.update(id, { ...updates, updatedAt: Date.now() });
  }

  async updateChaptersOrder(
    items: { id: string; order: number; parentId?: string | null }[]
  ): Promise<void> {
    await this.transaction("rw", this.chapters, async () => {
      for (const item of items) {
        await this.chapters.update(item.id, {
          order: item.order,
          ...(item.parentId !== undefined ? { parentId: item.parentId } : {}),
          updatedAt: Date.now(),
        });
      }
    });
  }

  async deleteChapter(id: string): Promise<void> {
    await this.transaction("rw", this.chapters, async () => {
      const children = await this.chapters.where("parentId").equals(id).toArray();
      for (const child of children) {
        await this.chapters.delete(child.id);
      }
      await this.chapters.delete(id);
    });
  }

  // ========== References ==========

  async createReference(
    ref: Omit<Reference, "createdAt">
  ): Promise<Reference> {
    const newRef: Reference = { ...ref, createdAt: Date.now() };
    await this.references.add(newRef);
    return newRef;
  }

  async getReferencesByPaper(paperId: string): Promise<Reference[]> {
    return this.references.where("paperId").equals(paperId).toArray();
  }

  async updateReference(
    id: string,
    updates: Partial<Omit<Reference, "id" | "paperId" | "createdAt">>
  ): Promise<void> {
    await this.references.update(id, updates);
  }

  async deleteReference(id: string): Promise<void> {
    await this.references.delete(id);
  }

  // ========== Terms ==========

  async createTerm(term: Omit<Term, "createdAt">): Promise<Term> {
    const newTerm: Term = { ...term, createdAt: Date.now() };
    await this.terms.add(newTerm);
    return newTerm;
  }

  async getTermsByPaper(paperId: string): Promise<Term[]> {
    return this.terms.where("paperId").equals(paperId).toArray();
  }

  async updateTerm(
    id: string,
    updates: Partial<Omit<Term, "id" | "paperId" | "createdAt">>
  ): Promise<void> {
    await this.terms.update(id, updates);
  }

  async deleteTerm(id: string): Promise<void> {
    await this.terms.delete(id);
  }

  async bulkImportTerms(
    terms: Omit<Term, "createdAt">[]
  ): Promise<void> {
    const now = Date.now();
    await this.terms.bulkAdd(
      terms.map((t) => ({ ...t, createdAt: now }))
    );
  }

  // ========== AI History ==========

  async createAiHistory(
    entry: Omit<AiHistory, "id" | "createdAt">
  ): Promise<AiHistory> {
    const newEntry: AiHistory = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await this.aiHistory.add(newEntry);
    return newEntry;
  }

  async getAiHistoryByPaper(paperId: string): Promise<AiHistory[]> {
    return this.aiHistory
      .where("paperId")
      .equals(paperId)
      .reverse()
      .sortBy("createdAt");
  }

  // ========== Snapshots ==========

  async createSnapshot(paperId: string, label: string, chapterId?: string): Promise<VersionSnapshot> {
    const chapters = await this.chapters.where("paperId").equals(paperId).toArray();
    const snapshot: VersionSnapshot = {
      id: crypto.randomUUID(),
      paperId,
      chapterId,
      label,
      chapters: JSON.parse(JSON.stringify(chapters)),
      createdAt: Date.now(),
    };
    await this.snapshots.add(snapshot);
    return snapshot;
  }

  async getSnapshots(paperId: string): Promise<VersionSnapshot[]> {
    return this.snapshots.where("paperId").equals(paperId).reverse().sortBy("createdAt");
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snap = await this.snapshots.get(snapshotId);
    if (!snap) return;

    await this.transaction("rw", this.chapters, async () => {
      // Delete existing chapters
      const existing = await this.chapters.where("paperId").equals(snap.paperId).toArray();
      for (const ch of existing) {
        await this.chapters.delete(ch.id);
      }
      // Restore from snapshot
      for (const ch of snap.chapters) {
        await this.chapters.put(ch);
      }
    });
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this.snapshots.delete(id);
  }

  // ========== Export / Import ==========

  async exportPaperData(paperId: string) {
    const [paper, chapters, references, terms, aiHistory] = await Promise.all([
      this.papers.get(paperId),
      this.chapters.where("paperId").equals(paperId).toArray(),
      this.references.where("paperId").equals(paperId).toArray(),
      this.terms.where("paperId").equals(paperId).toArray(),
      this.aiHistory.where("paperId").equals(paperId).toArray(),
    ]);
    return { paper, chapters, references, terms, aiHistory };
  }

  async exportAllData() {
    const [papers, chapters, references, terms] = await Promise.all([
      this.papers.toArray(),
      this.chapters.toArray(),
      this.references.toArray(),
      this.terms.toArray(),
    ]);
    return {
      version: 1,
      exportedAt: Date.now(),
      papers,
      chapters,
      references,
      terms,
    };
  }

  async importAllData(data: {
    papers: Paper[];
    chapters: Chapter[];
    references: Reference[];
    terms: Term[];
  }) {
    await this.transaction("rw", [this.papers, this.chapters, this.references, this.terms], async () => {
      for (const p of data.papers) {
        await this.papers.put(p);
      }
      for (const c of data.chapters) {
        await this.chapters.put(c);
      }
      for (const r of data.references) {
        await this.references.put(r);
      }
      for (const t of data.terms) {
        await this.terms.put(t);
      }
    });
  }
}

export const db = new ThesisDatabase();
