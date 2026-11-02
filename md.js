// Markdown -> HTML בטוח לסיכומים שמגיעים מהשרת: כותרות, רשימות, טבלאות, מודגש, ציטוטים, קו מפריד.
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");

// נוסחאות שה-AI כותב בפורמט LaTeX ($...$, \times) -> טקסט פשוט וקריא
export function cleanMath(s) {
  return String(s || "")
    .replace(/\$\$([^$]+)\$\$/g, "$1").replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)").replace(/\\sqrt\{([^}]*)\}/g, "√($1)").replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\\div/g, "÷").replace(/\\pm/g, "±")
    .replace(/\\(leq|le)\b/g, "≤").replace(/\\(geq|ge)\b/g, "≥").replace(/\\neq/g, "≠").replace(/\\approx/g, "≈")
    .replace(/\\Delta/g, "Δ").replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\sigma/g, "σ").replace(/\\mu/g, "μ").replace(/\\sum/g, "Σ")
    .replace(/\\%/g, "%").replace(/\\(left|right)/g, "").replace(/\\,/g, " ");
}

export function mdToHtml(md) {
  const lines = cleanMath(md).replace(/\r/g, "").split("\n");
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // טבלה: שורה עם | ואחריה שורת ---
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
      closeList();
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      out.push(`<table><thead><tr>${cells(line).map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>`);
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { out.push(`<tr>${cells(lines[i]).map((c) => `<td>${c}</td>`).join("")}</tr>`); i++; }
      i--; out.push("</tbody></table>"); continue;
    }
    const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) { const t = /^\s*\d/.test(line) ? "ol" : "ul"; if (list !== t) { closeList(); list = t; out.push(`<${t}>`); } out.push(`<li>${inline(li[1])}</li>`); continue; }
    closeList();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const n = Math.min(Math.max(h[1].length, 2), 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    if (/^\s*>\s?/.test(line)) { out.push(`<blockquote><p>${inline(line.replace(/^\s*>\s?/, ""))}</p></blockquote>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr>"); continue; }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}
