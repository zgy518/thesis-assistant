import type { Reference, CitationStyle } from "@/types";

export function formatCitation(ref: Reference, style: CitationStyle): string {
  switch (style) {
    case "APA":
      return formatAPA(ref);
    case "MLA":
      return formatMLA(ref);
    case "Harvard":
      return formatHarvard(ref);
  }
}

function formatAPA(ref: Reference): string {
  const author = ref.author || "Unknown Author";
  const year = ref.year ? ` (${ref.year})` : " (n.d.)";
  const title = ref.title ? italicize(ref.title) : "[No title]";

  switch (ref.type) {
    case "book":
      return `${author}${year}. ${title}. ${ref.publisher || "[Publisher unknown]"}.`;
    case "article":
      return `${author}${year}. ${ref.title}. ${italicize(ref.journal || "[Journal unknown]")}. ${ref.doi ? `https://doi.org/${ref.doi}` : ref.url ?? ""}`.trim();
    case "thesis":
      return `${author}${year}. ${italicize(ref.title)} [Unpublished undergraduate thesis]. Heilongjiang University.`;
    case "website":
      return `${author}${year}. ${ref.title}. Retrieved from ${ref.url || "[URL unknown]"}`;
    default:
      return `${author}${year}. ${ref.title}.`;
  }
}

function formatMLA(ref: Reference): string {
  const author = ref.author || "Unknown Author";
  const title = ref.type === "article" ? `"${ref.title}"` : italicize(ref.title || "[No title]");
  const year = ref.year ? `${ref.year}` : "n.d.";

  switch (ref.type) {
    case "book":
      return `${author}. ${title}. ${ref.publisher || ""}, ${year}.`.replace(/, ,/, ",").replace(/,\s*$/, ".");
    case "article":
      return `${author}. ${title}. ${italicize(ref.journal || "[Journal unknown]")}, ${year}${ref.doi ? `, doi:${ref.doi}` : ""}.`;
    case "thesis":
      return `${author}. ${title}. Heilongjiang University, ${year}. Undergraduate thesis.`;
    case "website":
      return `${author}. "${ref.title || "[No title]"}." ${italicize(ref.url || "[URL unknown]")}. Accessed ${new Date().toLocaleDateString("en-US")}.`;
    default:
      return `${author}. ${title}, ${year}.`;
  }
}

function formatHarvard(ref: Reference): string {
  const author = ref.author || "Unknown Author";
  const year = ref.year ? `${ref.year}` : "n.d.";

  switch (ref.type) {
    case "book":
      return `${author} (${year}) ${italicize(ref.title || "[No title]")}. ${ref.publisher || "[Publisher unknown]"}.`;
    case "article":
      return `${author} (${year}) '${ref.title}', ${italicize(ref.journal || "[Journal unknown]")}. ${ref.doi ? `doi:${ref.doi}` : ""}`.trim();
    case "thesis":
      return `${author} (${year}) ${italicize(ref.title || "[No title]")}. Unpublished undergraduate thesis. Heilongjiang University.`;
    case "website":
      return `${author} (${year}) ${ref.title || "[No title]"}. Available at: ${ref.url || "[URL unknown]"} (Accessed: ${new Date().toLocaleDateString("en-US")}).`;
    default:
      return `${author} (${year}) ${ref.title || "[No title]"}.`;
  }
}

function italicize(text: string): string {
  return `*${text}*`;
}

export function generateCitationKey(ref: Reference): string {
  const surname = ref.author?.split(",")[0]?.trim() || ref.author?.split(" ").pop() || "Unknown";
  const year = ref.year?.toString() ?? "nd";
  const shortTitle = (ref.title || "").split(" ").slice(0, 2).join("");
  return `${surname}${year}${shortTitle}`.replace(/\s+/g, "");
}

export function formatInTextCitation(ref: Reference, style: CitationStyle): string {
  const surname = ref.author?.split(",")[0]?.trim() || ref.author?.split(" ").pop() || "Unknown";
  const year = ref.year?.toString() ?? "n.d.";

  switch (style) {
    case "APA":
      return `(${surname}, ${year})`;
    case "MLA":
      return `(${surname})`;
    case "Harvard":
      return `(${surname}, ${year})`;
  }
}
