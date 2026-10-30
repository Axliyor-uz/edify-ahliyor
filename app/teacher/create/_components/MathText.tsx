"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

/** One language of a localized field ({uz,ru,en} or a plain string). */
export function pickText(value: unknown, lang: "uz" | "ru" | "en" = "uz"): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    const hit = v[lang] ?? v.uz ?? v.ru ?? v.en;
    if (typeof hit === "string") return hit;
    if (hit && typeof hit === "object") return pickText(hit, lang); // AI sometimes nests {uz:{uz:…}}
  }
  return "";
}

function renderMath(math: string, displayMode: boolean, key: number, raw: string) {
  try {
    const html = katex.renderToString(math, { displayMode, throwOnError: false, strict: false });
    return displayMode
      ? <span key={key} dangerouslySetInnerHTML={{ __html: html }} className="block my-2 overflow-x-auto text-center custom-scrollbar" />
      : <span key={key} dangerouslySetInnerHTML={{ __html: html }} className="inline-block px-0.5" />;
  } catch {
    return <span key={key} className="rounded-m3-xs bg-error-container px-1 font-mono text-xs text-on-error-container">{raw}</span>;
  }
}

/**
 * Text with inline `$…$` / display `$$…$$` math, as the AI creators return it.
 * Lenient on purpose (AI output): bare LaTeX is wrapped, `\(…\)` / `\[…\]` are
 * converted, doubled backslashes are collapsed, and newlines are kept.
 * Moved verbatim from the six AI pages' copies of `FormattedText`.
 */
export default function MathText({ text }: { text: unknown }) {
  if (!text) return null;
  let content = typeof text === "string" ? text : JSON.stringify(text);

  const hasMathCommands = /\\frac|\\pi|\\sin|\\cos|\\tan|\\ge|\\le|\\cup|\\cap|\\in|\\begin|\\sqrt|\\empty/.test(content);
  if (!content.includes("$") && hasMathCommands) content = `$${content}$`;

  content = content
    .replace(/\\\((.*?)\\\)/g, "$$$1$$")
    .replace(/\\\[(.*?)\\\]/g, "$$$$$1$$$$")
    .replace(/&nbsp;/g, " ")
    .replace(/\\\\/g, "\\");
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <span className="break-words leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$") && part.length > 3) return renderMath(part.slice(2, -2).trim(), true, index, part);
        if (part.startsWith("$") && part.endsWith("$") && part.length > 1) return renderMath(part.slice(1, -1).trim(), false, index, part);
        return (
          <span key={index}>
            {part.split("\n").map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
