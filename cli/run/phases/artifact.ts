/**
 * Small repairs to what a phase hands back, before it is stored.
 *
 * Phases are asked for a document and usually give one. Now and then a model
 * wraps that document in a code fence out of habit — and then everything
 * downstream is wrong in the same way: the page shows a wall of monospace
 * instead of a plan, and the next phase reads a quotation instead of prose.
 *
 * The repair is deliberately narrow. Fencing is meaningful in these documents —
 * a plan quotes commands, a review quotes code — so only a fence that swallows
 * the document is treated as a mistake, and only when it carries no language.
 */

/** Below this, the fence is a quotation inside a document, not the document. */
const SWALLOWS = 0.6;

export function tidyArtifact(text: string): string {
  const lines = text.split("\n");
  const fences = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line.startsWith("```"));

  if (fences.length !== 2) return text;

  const [open, close] = fences as [{ line: string; index: number }, { index: number }];

  /* A language tag means the author meant it: ```css is a CSS block, always. */
  if (open.line !== "```") return text;

  const inside = close.index - open.index - 1;
  const content = lines.filter((line) => line.trim() !== "").length;

  if (content === 0 || inside / content < SWALLOWS) return text;

  return [...lines.slice(0, open.index), ...lines.slice(open.index + 1, close.index), ...lines.slice(close.index + 1)]
    .join("\n")
    .trim();
}
