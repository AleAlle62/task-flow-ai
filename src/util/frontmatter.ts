/** The two halves of a markdown file that opens with a `---` block. */
export interface Frontmatter {
  header: string;
  body: string;
}

/**
 * Splits a markdown file into its frontmatter and its text. Returns undefined
 * when there is no frontmatter at all, which callers report as a real error
 * rather than guessing at defaults.
 */
export function splitFrontmatter(raw: string): Frontmatter | undefined {
  const text = stripBom(raw);
  if (!text.startsWith("---")) return undefined;

  const closing = text.indexOf("\n---", 3);
  if (closing === -1) return undefined;

  const firstLineEnd = text.indexOf("\n");
  const afterClosing = text.indexOf("\n", closing + 1);

  return {
    header: text.slice(firstLineEnd + 1, closing),
    body: afterClosing === -1 ? "" : text.slice(afterClosing + 1),
  };
}

function stripBom(text: string): string {
  return text.startsWith("﻿") ? text.slice(1) : text;
}
