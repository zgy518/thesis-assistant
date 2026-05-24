interface DOIData {
  author: string;
  title: string;
  year?: number;
  journal?: string;
  publisher?: string;
  doi: string;
  url?: string;
  type: "article" | "book" | "other";
}

export async function lookupDOI(doi: string): Promise<DOIData | null> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//, "").trim();
  if (!clean) return null;

  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const msg = json.message;
    if (!msg) return null;

    const authors = msg.author?.map((a: { family?: string; given?: string }) =>
      [a.family, a.given].filter(Boolean).join(", "),
    ) ?? [];

    return {
      author: authors.join("; ") || "Unknown",
      title: (msg.title?.[0] ?? "Unknown").replace(/<[^>]+>/g, ""),
      year: msg.created?.["date-parts"]?.[0]?.[0] ?? msg.issued?.["date-parts"]?.[0]?.[0],
      journal: msg["container-title"]?.[0],
      publisher: msg.publisher,
      doi: clean,
      url: msg.URL ?? `https://doi.org/${clean}`,
      type: msg.type === "journal-article" ? "article" : msg.type === "book" ? "book" : "other",
    };
  } catch {
    return null;
  }
}
