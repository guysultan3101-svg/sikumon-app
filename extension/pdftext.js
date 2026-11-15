// מוציא את הטקסט של כל עמוד ב-PDF (מקומית, בתוך התוסף, בלי AI ובלי לשלוח את הקובץ לשום מקום).
// משמש לחיפוש בתוך חומרי הקורס: "באיזה עמוד במצגת המרצה הסביר את X".
// pdf.js (Mozilla, Apache-2.0) נמצא בתיקייה pdfjs/.
import * as pdfjs from "./pdfjs/pdf.min.mjs";

const MAX_PAGES = 600;          // מעבר לזה (ספר שלם) – רק 600 העמודים הראשונים
const MAX_CHARS = 600000;       // תקרה לקובץ אחד, כדי שהאינדקס יישאר קטן

export function setWorker(src) { pdfjs.GlobalWorkerOptions.workerSrc = src; }

// מחבר את קטעי הטקסט של עמוד לשורות. pdf.js מחזיר כבר בסדר קריאה (גם עברית מימין לשמאל)
function pageText(items) {
  let out = "", lastY = null;
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    const y = it.transform ? Math.round(it.transform[5]) : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
    else if (out && !out.endsWith(" ") && !out.endsWith("\n") && it.str && !it.str.startsWith(" ")) out += " ";
    out += it.str;
    if (it.hasEOL) out += "\n";
    if (y !== null) lastY = y;
  }
  return out.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
}

// data: Uint8Array של קובץ ה-PDF. מחזיר מערך: טקסט לכל עמוד (עמוד 1 = מקום 0)
export async function pdfPages(data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false }).promise;
  const pages = [];
  let total = 0;
  try {
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
      let t = "";
      try { const p = await doc.getPage(i); t = pageText((await p.getTextContent()).items); p.cleanup(); } catch { /* עמוד פגום – ממשיכים */ }
      if (total + t.length > MAX_CHARS) t = t.slice(0, Math.max(0, MAX_CHARS - total));
      pages.push(t); total += t.length;
      if (total >= MAX_CHARS) break;
    }
  } finally { await doc.destroy(); }
  return pages;
}
