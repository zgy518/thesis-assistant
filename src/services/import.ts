import JSZip from "jszip";
import { db } from "./db";
import type { Paper, Chapter } from "@/types";

interface ParsedChapter {
  id: string;
  title: string;
  level: number;
  content: string;
  parentId: string | null;
}

export async function importDocx(file: File): Promise<{
  paper: Paper;
  chapters: ParsedChapter[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file("word/document.xml")?.async("text");
  if (!docXml) throw new Error("无法读取 document.xml");

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "text/xml");
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  // Extract all paragraphs
  const paras: string[] = [];
  for (const p of xmlDoc.getElementsByTagNameNS(ns, "p")) {
    const texts: string[] = [];
    for (const t of p.getElementsByTagNameNS(ns, "t")) {
      if (t.textContent) texts.push(t.textContent);
    }
    if (texts.length) paras.push(texts.join("").trim());
  }

  // Phase 1: Find Contents/TOC section
  const tocPattern = /^(Contents|Table\s+of\s+Contents|目录)\b/i;
  let tocStart = -1;
  let tocEnd = -1;

  for (let i = 0; i < paras.length; i++) {
    if (tocPattern.test(paras[i])) {
      tocStart = i + 1;
      // Find end of TOC: first occurrence of "Introduction" after Contents
      for (let j = i + 1; j < paras.length; j++) {
        if (/^Introduction\b/i.test(paras[j])) {
          tocEnd = j;
          break;
        }
      }
      break;
    }
  }

  // Phase 2: Parse TOC entries to get chapter structure
  interface TocEntry {
    title: string;
    level: number;
    numPrefix: string;
  }
  const tocEntries: TocEntry[] = [];

  if (tocStart >= 0 && tocEnd > tocStart) {
    for (let i = tocStart; i < tocEnd; i++) {
      const text = paras[i];
      if (!text || text.length > 120) continue;

      // Determine level from numbering prefix
      let level = 1;
      let cleanTitle = text;
      const numMatch = text.match(/^(\d+(?:\.\d+)*)\s+/);
      if (numMatch) {
        const dots = (numMatch[1].match(/\./g) || []).length;
        level = dots + 1; // 1 → L1, 1.1 → L2, 1.1.1 → L3
        cleanTitle = text.slice(numMatch[0].length);
      }
      // Remove trailing page numbers
      cleanTitle = cleanTitle.replace(/\s+\d+$/, "").trim();
      if (cleanTitle.length < 3) continue;

      tocEntries.push({
        title: cleanTitle,
        level,
        numPrefix: numMatch ? numMatch[1] : "",
      });
    }
  }

  // Also detect non-numbered chapters (Introduction, Conclusion, etc.)
  const specialChapters = ["Introduction", "Literature Review", "Theoretical Framework",
    "Conclusion", "References", "Acknowledgements"];

  // Phase 3: Find body paragraphs and match to TOC entries
  // Body starts after the first Introduction in the actual body (not TOC)
  let bodyStart = tocEnd > 0 ? tocEnd : 0;

  // Collect all headings that appear in body (with their content)
  const bodyHeadings: { title: string; content: string[] }[] = [];
  let currentContent: string[] = [];

  for (let i = bodyStart; i < paras.length; i++) {
    const text = paras[i];
    if (!text) continue;

    // Check if this is a heading
    let isHeading = false;
    const cleanText = text.replace(/\s+\d+$/, "").trim();

    // Match against TOC entries
    for (const entry of tocEntries) {
      if (cleanText.startsWith(entry.title) || text.startsWith(entry.title)) {
        isHeading = true;
        break;
      }
    }
    // Match special chapters
    if (!isHeading && specialChapters.some((s) => cleanText === s || text.startsWith(s))) {
      isHeading = true;
    }

    if (isHeading && text.length < 150) {
      if (currentContent.length > 0) {
        if (bodyHeadings.length > 0) {
          bodyHeadings[bodyHeadings.length - 1].content = [...currentContent];
        }
        currentContent = [];
      }
      bodyHeadings.push({ title: cleanText, content: [] });
    } else {
      currentContent.push(text);
    }
  }
  // Save last
  if (currentContent.length > 0 && bodyHeadings.length > 0) {
    bodyHeadings[bodyHeadings.length - 1].content = [...currentContent];
  }

  if (bodyHeadings.length === 0) {
    warnings.push("未能识别章节结构，将以纯文本导入。");
    // Fallback: everything as one chapter
    const fallbackContent = paras.slice(tocEnd > 0 ? tocEnd : 0).join("\n\n");
    const paperId = crypto.randomUUID();
    const paper: Paper = {
      id: paperId, title: file.name.replace(/\.docx?$/i, ""),
      topicKeywords: "", language: "bilingual", thesisType: "business-english" as const, status: "draft",
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const chId = crypto.randomUUID();
    return {
      paper,
      chapters: [{ id: chId, title: "全文", level: 1, content: fallbackContent, parentId: null }],
      warnings,
    };
  }

  // Phase 4: Build chapter hierarchy using TOC
  // First, deduplicate: keep only the LAST occurrence of each heading
  const seen = new Map<string, number>();
  const uniqueHeadings: typeof bodyHeadings = [];
  for (let i = bodyHeadings.length - 1; i >= 0; i--) {
    const key = bodyHeadings[i].title.toLowerCase().slice(0, 20);
    if (!seen.has(key)) {
      seen.set(key, i);
      uniqueHeadings.unshift(bodyHeadings[i]);
    }
  }

  // Build chapters from TOC structure, matching content from body
  const chapters: ParsedChapter[] = [];
  const idMap = new Map<string, string>(); // numPrefix → id

  for (const entry of tocEntries) {
    const id = crypto.randomUUID();
    const bodyMatch = uniqueHeadings.find((h) =>
      h.title.toLowerCase().startsWith(entry.title.toLowerCase().slice(0, 15))
    );
    const content = bodyMatch?.content.join("\n\n") ?? "";

    let parentId: string | null = null;
    if (entry.level > 1) {
      // Find parent by prefix
      const prefixParts = entry.numPrefix.split(".");
      prefixParts.pop();
      const parentPrefix = prefixParts.join(".");
      parentId = idMap.get(parentPrefix) ?? null;
    }

    chapters.push({ id, title: entry.title, level: entry.level, content, parentId });
    if (entry.numPrefix) {
      idMap.set(entry.numPrefix, id);
    }
  }

  // Add special chapters after numbered ones
  for (const sc of specialChapters) {
    const bodyMatch = uniqueHeadings.find((h) => h.title === sc);
    if (bodyMatch) {
      chapters.push({
        id: crypto.randomUUID(), title: sc, level: 1,
        content: bodyMatch.content.join("\n\n"), parentId: null,
      });
    }
  }

  // Detect title from first page
  const titleMatch = paras.slice(0, 30).find((p) =>
    p.length > 10 && p.length < 200 &&
    /[A-Z]/.test(p) && !/^(Abstract|Contents|Table|目录|摘要|Introduction)/i.test(p)
  );
  const paperTitle = titleMatch || file.name.replace(/\.docx?$/i, "");

  const paperId = crypto.randomUUID();
  const now = Date.now();
  const paper: Paper = {
    id: paperId, title: paperTitle.trim(),
    topicKeywords: "", language: "bilingual", thesisType: "business-english" as const, status: "writing",
    createdAt: now, updatedAt: now,
  };

  return { paper, chapters, warnings };
}

export async function importAndSaveDocx(file: File): Promise<Paper> {
  const { paper, chapters, warnings } = await importDocx(file);

  await db.createPaper(paper);

  const dbChapters: Chapter[] = chapters.map((ch, i) => ({
    id: ch.id,
    paperId: paper.id,
    parentId: ch.parentId,
    title: ch.title,
    content: ch.content,
    order: i,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  for (const ch of dbChapters) {
    await db.createChapter(ch);
  }

  return paper;
}
