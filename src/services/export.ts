// @ts-nocheck
import type { Paper, Chapter, Reference, CitationStyle, AppSettings } from "@/types";
import { formatCitation } from "@/lib/citations";
import { getSettings } from "./settings";

// 黑龙江大学商务英语论文格式 (2026届, 依据格式样本+批注)
//
// 字号对照: 小二号=18pt(36), 小三号=15pt(30), 四号=14pt(28), 小四号=12pt(24), 五号=10.5pt(21)
// 行距: 1.5倍=360 twips，中文段首缩进2汉字=480 twips，英文段首缩进4字符=480 twips
// 标题层级:
//   L1: Times New Roman 小二号 bold, 左顶格 (如 "1. Introduction")
//   L2: Times New Roman 小三号 bold, 左空2格 (如 "2.1 Xxx")
//   L3: Times New Roman 四号 bold,   左空2格
//   L4+: Times New Roman 小四号 bold, 左空2格
// 摘要标题: 英文 Times New Roman 小二号 bold 居中 / 中文 黑体 小二号 居中
// 结论/参考文献/致谢标题: Times New Roman 小二号 bold 居中, 单独成页

const LINE = 360;
const BODY = 24;      // 12pt
const SMALL = 21;     // 10.5pt
const LARGE = 28;     // 14pt (四号)
const L2 = 30;        // 15pt (小三号)
const H1 = 36;        // 18pt (小二号)
const INDENT = 480;   // 4-char indent (twips)
const EN = "Times New Roman";
const CN = "SimSun";
const H_CN = "SimHei";

let _d: typeof import("docx") | null = null;
function D(): typeof import("docx") { return _d!; }

// text helpers
function en(t: string, size = BODY, bold = false): ReturnType<typeof import("docx").TextRun> {
  return new (D().TextRun)({ text: t, font: EN, size, bold });
}
function cn(t: string, size = BODY, bold = false): ReturnType<typeof import("docx").TextRun> {
  return new (D().TextRun)({ text: t, font: CN, size, bold });
}
function h1(t: string): ReturnType<typeof import("docx").TextRun> {
  return new (D().TextRun)({ text: t, font: H_CN, size: H1 });
}

function headingP(text: string, size: number, left = 0): Paragraph {
  const indent = left > 0 ? { left } : undefined;
  return new (D().Paragraph)({
    children: [en(text, size, true)],
    spacing: { before: 240, after: 120, line: LINE },
    indent,
  });
}
function bodyP(text: string): Paragraph {
  return new (D().Paragraph)({
    children: [en(text)],
    spacing: { after: 120, line: LINE },
    indent: { firstLine: INDENT },
  });
}
function makeParas(content: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const para of content.split(/\n\n+/)) {
    if (!para.trim()) continue;
    const hm = para.trim().match(/^(#{1,3})\s+(.+)/);
    if (hm) {
      out.push(new (D().Paragraph)({
        children: [en(hm[2], BODY, true)],
        spacing: { before: 200, after: 100, line: LINE },
      }));
      continue;
    }
    const runs: ReturnType<typeof import("docx").TextRun>[] = [];
    let m: RegExpExecArray | null; const r = /(\*\*(.+?)\*\*|\*(.+?)\*|[^*]+)/g;
    while ((m = r.exec(para)) !== null) {
      if (m[2]) runs.push(en(m[2], BODY, true));
      else if (m[3]) runs.push(en(m[3], BODY, false));
      else runs.push(en(m[1]));
    }
    if (runs.length === 0) runs.push(en(para));
    out.push(new (D().Paragraph)({ children: runs, spacing: { after: 120, line: LINE }, indent: { firstLine: INDENT } }));
  }
  return out;
}

// ===== Word Export =====

export async function exportToWord(
  paper: Paper, chapters: Chapter[], references: Reference[], citationStyle: CitationStyle,
): Promise<void> {
  _d = await import("docx");
  const { Document, Packer, Paragraph, AlignmentType, PageBreak, Table, TableRow, TableCell, WidthType, Header, Footer, SectionType } = _d;

  const tops = chapters.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
  const kids = (pid: string) => chapters.filter((c) => c.parentId === pid).sort((a, b) => a.order - b.order);

  // ── Title Page ──
  const isBE = paper.thesisType !== "general";
  const titleSection: (Paragraph | Table)[] = isBE
    ? [ // 商务英语本科封面
        new Paragraph({ spacing: { after: 400 } }),
        new Paragraph({ children: [cn("本科学生毕业论文")], alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
        new Paragraph({ children: [h1("论文题目：")], alignment: AlignmentType.LEFT, spacing: { after: 200 } }),
        new Paragraph({ children: [h1(paper.title)], alignment: AlignmentType.LEFT, spacing: { after: 400 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            ["学    院：", paper.department || "外国语言文学学院（区域国别学院）"],
            ["年    级：", "2022级"], ["专    业：", "商务英语"],
            ["姓    名：", paper.studentName || "（你的姓名）"],
            ["学    号：", paper.studentId || "（你的学号）"],
            ["指导教师：", paper.advisor || "（导师姓名）"],
          ].map(([l, v]) => new TableRow({
            children: [
              new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [cn(l)], spacing: { line: LINE } })] }),
              new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [cn(v)], spacing: { line: LINE } })] }),
            ],
          })),
        }),
        new Paragraph({ spacing: { after: 200 } }),
        new Paragraph({ children: [cn("2026年5月")], spacing: { before: 200 } }),
      ]
    : [ // 通用学术封面
        new Paragraph({ spacing: { after: 400 } }),
        new Paragraph({ children: [h1(paper.title)], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
        new Paragraph({ children: [cn(paper.studentName || "")], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ children: [cn(paper.department || "")], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ children: [cn(new Date().getFullYear() + "年")], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
      ];

  // ── English Abstract (separate page, no header) ──
  const abstractEN: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ children: [en("Abstract", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }),
    new Paragraph({ spacing: { after: 200 } }), // blank line after title
    new Paragraph({ children: [en("Your English abstract here (200-400 words)", BODY)], indent: { firstLine: INDENT }, spacing: { line: LINE } }),
    new Paragraph({ spacing: { after: 400 } }),
    new Paragraph({ children: [en("Key Words", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }),
    new Paragraph({ spacing: { after: 200 } }),
    new Paragraph({ children: [en("keyword1; keyword2; keyword3", BODY)], indent: { firstLine: INDENT }, spacing: { line: LINE } }),
  ];

  // ── Chinese Abstract (separate page, no header) ──
  const abstractCN: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ children: [cn("摘要", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }),
    new Paragraph({ spacing: { after: 200 } }),
    new Paragraph({ children: [cn("（中文摘要：200-400字，宋体小四号，段首空两汉字）", BODY)], indent: { firstLine: INDENT }, spacing: { line: LINE } }),
    new Paragraph({ spacing: { after: 400 } }),
    new Paragraph({ children: [cn("关键词", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }),
    new Paragraph({ spacing: { after: 200 } }),
    new Paragraph({ children: [cn("关键词1；关键词2；关键词3", BODY)], indent: { firstLine: INDENT }, spacing: { line: LINE } }),
  ];

  // ── Contents ──
  const contents: Paragraph[] = [new Paragraph({ children: [new PageBreak()] })];
  contents.push(new Paragraph({ children: [en("Contents", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }));
  contents.push(new Paragraph({ spacing: { after: 200 } }));
  // Abstract entries
  contents.push(new Paragraph({ children: [en("Abstract", BODY)], spacing: { after: 80, line: LINE } }));
  contents.push(new Paragraph({ children: [cn("摘要", BODY)], spacing: { after: 80, line: LINE } }));

  let cn_u = 0;
  for (const ch of tops) {
    cn_u++;
    contents.push(new Paragraph({ children: [en(`${cn_u}. ${ch.title}`, BODY)], spacing: { after: 80, line: LINE } }));
    let sn = 0;
    for (const sub of kids(ch.id)) {
      sn++;
      contents.push(new Paragraph({ children: [en(`  ${cn_u}.${sn} ${sub.title}`, BODY)], spacing: { after: 60, line: LINE } }));
    }
  }
  contents.push(new Paragraph({ children: [en("References", BODY)], spacing: { after: 80, line: LINE } }));
  contents.push(new Paragraph({ children: [en("Acknowledgements", BODY)], spacing: { after: 80, line: LINE } }));

  // ── Body (from Introduction onwards: has header) ──
  const bodyKids: (Paragraph | Table)[] = [new Paragraph({ children: [new PageBreak()] })];

  let num = 0;
  function addChapter(ch: Chapter, depth = 0) {
    if (!ch.parentId) num++;

    let title: string;
    let size: number;
    let indent = 0;
    if (!ch.parentId) {
      title = `${num}. ${ch.title}`;
      size = H1; // 小二号
      indent = 0;
    } else if (!chapters.some((c) => c.parentId === ch.id)) {
      title = findNum(chapters, ch) + ` ${ch.title}`;
      size = LARGE; // 四号 (或更小)
      indent = 240; // ~2 spaces
    } else {
      title = findNum(chapters, ch) + ` ${ch.title}`;
      size = L2; // 小三号
      indent = 240;
    }

    bodyKids.push(headingP(title, size, indent));

    if (ch.content.trim()) {
      bodyKids.push(...makeParas(ch.content));
    }
    kids(ch.id).forEach((s) => addChapter(s, depth + 1));
  }
  tops.forEach((c) => addChapter(c));

  // ── Conclusion (separate page) ──
  const conclusion: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ children: [en("Conclusion", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }),
    new Paragraph({ spacing: { after: 200 } }),
    new Paragraph({ children: [en("(Your conclusion here — 1-2 paragraphs recommended)", BODY)], indent: { firstLine: INDENT }, spacing: { line: LINE } }),
  ];

  // ── References (separate page) ──
  const refSection: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ children: [en("References", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }),
    new Paragraph({ spacing: { after: 200 } }),
  ];
  if (references.length > 0) {
    for (const ref of references) {
      refSection.push(new Paragraph({
        children: [en(formatCitation(ref, citationStyle), SMALL)],
        spacing: { after: 100, line: LINE },
        indent: { left: 720, hanging: 360 },
      }));
    }
  } else {
    refSection.push(new Paragraph({ children: [en("(At least 10 references, ≥6 English, ≥1 English monograph)", SMALL)], indent: { firstLine: INDENT }, spacing: { line: LINE } }));
  }

  // ── Acknowledgements (separate page) ──
  const ackSection: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ children: [en("Acknowledgements", H1, true)], alignment: AlignmentType.CENTER, spacing: { after: LINE } }),
    new Paragraph({ spacing: { after: 200 } }),
    new Paragraph({ children: [en("(Your acknowledgements — preferably one paragraph)", BODY)], indent: { firstLine: INDENT }, spacing: { line: LINE } }),
  ];

  // Assemble document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: EN, size: BODY },
          paragraph: { spacing: { line: LINE } },
        },
      },
    },
    sections: [
      // Title page + Abstract pages — no headers
      { properties: { page: { margin: { top: 1440, bottom: 1440, left: 1800, right: 1440 } } }, children: [...titleSection, ...abstractEN, ...abstractCN, ...contents] },
      // Body + Conclusion + References + Ack — with page header
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1800, right: 1440 } },
        },
        headers: {
          default: new Header({ children: [new Paragraph({ children: [en(paper.title, SMALL)], alignment: AlignmentType.CENTER })] }),
        },
        children: [...bodyKids, ...conclusion, ...refSection, ...ackSection],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${sanitize(paper.title)}.docx`);
  _d = null;
}

// ===== PDF =====

export function exportToPDF(
  paper: Paper, chapters: Chapter[], references: Reference[], citationStyle: CitationStyle,
): void {
  const tops = chapters.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
  const kids = (pid: string) => chapters.filter((c) => c.parentId === pid).sort((a, b) => a.order - b.order);
  const refsHtml = references.map((r) => `<p>${e(formatCitation(r, citationStyle))}</p>`).join("\n");

  let bodyChapters = "";
  let cn = 0;
  function render(ch: Chapter) {
    if (!ch.parentId) { cn++; bodyChapters += `<h2>${cn}. ${e(ch.title)}</h2>`; }
    else bodyChapters += `<h3>${e(ch.title)}</h3>`;
    if (ch.content.trim()) {
      const c = ch.content
        .replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h2>$1</h2>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
      bodyChapters += `<p>${c}</p>`;
    }
    kids(ch.id).forEach(render);
  }
  tops.forEach(render);

  const infoRows = [
    ["学    院：", paper.department || "外国语言文学学院（区域国别学院）"],
    ["年    级：", "2022级"], ["专    业：", "商务英语"],
    ["姓    名：", paper.studentName || "（你的姓名）"], ["学    号：", paper.studentId || "（你的学号）"],
    ["指导教师：", paper.advisor || "（导师姓名）"],
  ];
  const th = infoRows.map(([l, v]) => `<tr><td>${e(l)}</td><td>${e(v)}</td></tr>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${e(paper.title)}</title>
<style>
body{font-family:'Times New Roman','SimSun',serif;font-size:12pt;line-height:1.5;max-width:700px;margin:0 auto;padding:40px;color:#000}
h1{font-size:18pt;}h2{font-size:15pt;margin-top:20px}h3{font-size:14pt;margin-top:16px}
.title-page{text-align:left}p{text-indent:2em;margin-bottom:6px}
table{border-collapse:collapse;width:100%;margin:20px 0}td{padding:4px 12px;font-size:12pt}
.refs p{font-size:10.5pt;padding-left:36px;text-indent:-36px}
@media print{body{padding:0}}
</style></head><body>
<div class="title-page">
${paper.thesisType !== "general"
  ? `<h1>本科学生毕业论文</h1><h1>${e(paper.title)}</h1><table>${th}</table><p>2026年5月</p>`
  : `<h1>${e(paper.title)}</h1><p>${e(paper.studentName || "")} · ${e(paper.department || "")}</p><p>${new Date().getFullYear()}年</p>`
}
</div>
<div style="break-after:page"></div>
<h1>Abstract</h1><p>Your abstract here.</p><h1>Key Words</h1><p>keyword1; keyword2; keyword3</p>
<div style="break-after:page"></div>
<h1>摘要</h1><p>摘要内容</p><h1>关键词</h1><p>关键词1；关键词2；关键词3</p>
<div style="break-after:page"></div>
<h1>Contents</h1>
${bodyChapters}
<h1>References</h1><div class="refs">${refsHtml}</div>
<h1>Acknowledgements</h1>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) { win.document.write(html); win.document.close(); win.onload = () => win.print(); }
}

// Helpers
function findNum(all: Chapter[], ch: Chapter): string {
  if (!ch.parentId) {
    const tops = all.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
    return `${tops.findIndex((c) => c.id === ch.id) + 1}.`;
  }
  const parent = all.find((c) => c.id === ch.parentId);
  const prefix = parent ? findNum(all, parent) : "";
  const sibs = all.filter((c) => c.parentId === ch.parentId).sort((a, b) => a.order - b.order);
  return `${prefix}${sibs.findIndex((c) => c.id === ch.id) + 1}.`;
}
function sanitize(s: string) { return s.replace(/[<>:"/\\|?*]/g, "").slice(0, 80) || "thesis"; }
function e(t: string) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function downloadBlob(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u);
}
