export interface Frontmatter {
  /** The YAML text between the two `---` markers. */
  header: string;
  /** Everything after them. */
  body: string;
}

/**
 * Splits a markdown file that opens with a `---` block. Returns undefined when
 * the file has no frontmatter at all, which callers report as a real error
 * rather than guessing at defaults.
 */
export function splitFrontmatter(raw: string): Frontmatter | undefined {
  const text = stripBom(raw);
  if (!text.startsWith("---")) return undefined;

  const closing = text.indexOf("\n---", 3);
  if (closing === -1) return undefined;

  const firstLineEnd = text.indexOf("\n");
  const header = text.slice(firstLineEnd + 1, closing);

  const afterClosing = text.indexOf("\n", closing + 1);
  const body = afterClosing === -1 ? "" : text.slice(afterClosing + 1);

  return { header, body };
}

function stripBom(text: string): string {
  return text.startsWith("﻿") ? text.slice(1) : text;
}
