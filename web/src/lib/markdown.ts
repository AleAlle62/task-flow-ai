/**
 * A small markdown renderer for the artifacts phases produce.
 *
 * It escapes everything first and only then introduces its own tags, so no
 * markup in the text can survive into the page. That matters more here than
 * usual: this text is written by a model, and it is displayed on a page whose
 * buttons let an agent write to your code. A general-purpose renderer plus a
 * sanitiser would be two dependencies to trust; this is forty lines to read.
 */

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).split("\n");
  const html: string[] = [];

  let list: "ul" | "ol" | undefined;
  let inCode = false;

  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = undefined;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      closeList();
      html.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      html.push(line);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(heading[1]!.length + 1, 5);
      html.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${inline(bullet[1]!)}</li>`);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (list !== "ol") {
        closeList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${inline(numbered[1]!)}</li>`);
      continue;
    }

    if (line.trim() === "") {
      closeList();
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  if (inCode) html.push("</code></pre>");

  return html.join("\n");
}

/** Bold, italics and inline code, applied to already-escaped text. */
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
