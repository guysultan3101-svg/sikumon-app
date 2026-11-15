// חיפוש חכם בעברית: מוצא מילה גם עם תחיליות (ו/ה/ב/ל/מ/כ/ש: "והעלות", "בעלות", "שהעלות"),
// בלי קשר לאותיות סופיות (ם/מ, ן/נ…), לניקוד ולגרש, וגם כשה-PDF "שבר" מילה ברווח ("ח שבון").
// כמה מילים = כולן צריכות להופיע; ביטוי צמוד מקבל עדיפות. בלי AI ובלי שרת – רץ במכשיר.

const FIN = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const PAIR = { "כ": "[כך]", "מ": "[מם]", "נ": "[נן]", "פ": "[פף]", "צ": "[צץ]" };
const MARKS = "[\\u0591-\\u05C7]*";          // ניקוד וטעמים
const PREFIX = "(?:ו?(?:כש|ש)?(?:מה|[הבלכמ])?)";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const QUOTE = "[\"'׳״`]";   // גרש וגרשיים (אג"ח, עו"ש, ש"ח, מע״מ) – כל הצורות שלהם נחשבות אותו דבר
// מילה אחת -> תבנית: כל אות (כולל צורה סופית), ניקוד אופציונלי, ורווח אופציונלי בין אותיות (במילים של 4+ אותיות).
// גרשיים בשאילתה ("אג"ח") = חובה בטקסט; בלי גרשיים ("אגח") = מוצא גם את "אג"ח"
function tokenPattern(t) {
  const letters = t.replace(/["'׳״`]/g, "").length;
  const gap = MARKS + (letters >= 4 ? " ?" : "");
  let out = "";
  const ch = [...t];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (/["'׳״`]/.test(c)) { out += QUOTE; continue; }
    if (out && !/["'׳״`]/.test(ch[i - 1])) out += gap + QUOTE + "?";
    out += PAIR[c] || esc(c);
  }
  return out;
}
export function makeQuery(q) {
  const clean = String(q || "").replace(/[֑-ׇ]/g, "").toLowerCase().replace(/[ךםןףץ]/g, (c) => FIN[c]);
  // גרשיים בתוך מילה נשארים חלק ממנה; בקצוות – יורדים
  const tokens = [...new Set(clean.split(/[^\p{L}\p{N}"'׳״`]+/u).map((t) => t.replace(/^["'׳״`]+|["'׳״`]+$/g, "")).filter((t) => t.replace(/["'׳״`]/g, "").length >= 2))];
  const pats = tokens.map((t) => (/^[א-ת]/.test(t) ? PREFIX : "") + "(" + tokenPattern(t) + ")");
  // הגבול לפני המילה: תחילת טקסט או תו שאינו אות/ספרה (בלי lookbehind – עובד גם בספארי ישן)
  const rxs = pats.map((p) => new RegExp("(^|[^\\p{L}\\p{N}])" + p, "giu"));
  const phrase = tokens.length > 1 ? new RegExp("(^|[^\\p{L}\\p{N}])" + pats.join("[^\\p{L}\\p{N}]{1,3}"), "iu") : null;
  return { q: String(q || "").trim(), tokens, rxs, phrase, ok: tokens.length > 0 };
}

// מפתח לשם קורס: אותו קורס בשמות שונים ("10126 - מבוא למאקרו כלכלה - 2026א", "מבוא לכלכלה מאקרו") -> אותו מפתח.
// מחמיר בכוונה: רק אותן מילים בדיוק (בלי מספר קורס, שנה/סמסטר, ו/ה/ל בתחילת מילה, וכתיב מאקרו/מקרו).
// "מבוא למיקרו כלכלה" ו"מבוא למקרו כלכלה" – מפתחות שונים.
export function courseKey(name) {
  const words = String(name || "").replace(/[֑-ׇ]/g, "").replace(/[ךםןףץ]/g, (c) => FIN[c]).toLowerCase()
    // (27א), (תשפ"ז), (2026), (סמ 1), (סמסטר א) בסוגריים. לא (סמינר) – סמינר הוא קורס נפרד
    .replace(/\(\s*(?:\d{1,2}[א-ת]|תש[א-ת]["'׳״]?[א-ת]?|(?:19|20)\d\d[א-ת]?|(?:סמסטר|סמ['׳]?)\s*(?:[אבגק]['׳]?|\d{1,2}))\s*\)/g, " ")
    .replace(/(^|\s)(סמסטר|סמ['׳]?)\s*(?:[אבגק]['׳]?|\d{1,2})(?=\s|$)/g, " ")   // "סמסטר א" / "סמ 1" (בן-גוריון) = מתי, לא איזה קורס
    .replace(/(^|\s)קבוצה\s*\d+(?=\s|$)/g, " ")                        // "קבוצה 03" = איזו קבוצה, לא איזה קורס
    .replace(/(^|\s)\d+(?:\.\d+){2,}(?=\s|$)/g, " ")                  // 201.1.9711 (שתי נקודות ומעלה) = מספר קורס. "1.5" נשאר
    .replace(/(^|[\s\-–])תש[א-ת]["'׳״]?[א-ת]?(?=\s|$|[-–])/g, " ")    // שנה עברית כמילה שלמה (תשפ"ז, גם תשפ"ו-תשפ"ז)
    .replace(/(^|[\s\-–])תש[א-ת]["'׳״]?[א-ת]?(?=\s|$|[-–])/g, " ")
    .replace(/(\d)-(\d)/g, "$1§$2")                                   // 201-1-2051 (מקף בלי רווחים) = מילה אחת, מספר קורס
    .replace(/["'׳״`()[\]{}.,:;\-–—_/\\|]+/g, " ")
    .split(/\s+/).filter(Boolean)
    // יורדים רק מילים שלמות: מספר קורס (3+ ספרות, או עם מקפים), שנה (2026, 2026א). מספר קטן נשאר: 1 ≠ 2. גם "א'"/"ב'" נשארים
    .filter((w) => !w.includes("§") && !/^\d{3,}$/.test(w) && !/^(19|20)\d\d[א-ת]?$/.test(w) && !/^(סמסטר|קבוצה|שנה)$/.test(w))
    .map((w) => (w.length > 3 ? w.replace(/^(ו|ה|ל|וה|ול)(?=[א-ת]{3})/, "") : w))
    .map((w) => w.replace(/^מאקרו/, "מקרו"));
  const key = [...new Set(words)].sort().join(" ");
  return key || "#" + String(name || "").trim();   // שם בלי מילים (רק מספר קורס) – לא מאחדים עם אף אחד אחר
}

// כל המופעים של כל המילים בטקסט: [{s, e}] (מיקום בטקסט המקורי, בלי התחילית)
export function ranges(Q, text) {
  const out = [];
  for (const rx of Q.rxs) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const word = m[m.length - 1];
      const e = m.index + m[0].length, s = e - word.length;
      out.push({ s, e });
      if (out.length > 400) break;
      if (rx.lastIndex === m.index) rx.lastIndex++;
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

// ציון להתאמה: null אם לא כל המילים נמצאו
export function score(Q, title, body) {
  if (!Q.ok) return null;
  const t = title || "", b = body || "";
  let sc = 0, first = -1;
  for (const rx of Q.rxs) {
    rx.lastIndex = 0; const inT = rx.test(t);
    rx.lastIndex = 0; const mb = rx.exec(b);
    if (!inT && !mb) return null;
    if (inT) sc += 30;
    if (mb) { sc += 3; if (first < 0 || mb.index < first) first = mb.index; }
  }
  if (Q.phrase && (Q.phrase.test(t) || Q.phrase.test(b))) sc += 25;
  const n = ranges(Q, b).length; sc += Math.min(n, 12);
  return { score: sc, first, count: n };
}

// קטע קצר סביב ההתאמה הראשונה (ביטוי צמוד אם יש), עם <mark> על המילים. escFn – בריחה ל-HTML
export function snippet(Q, text, escFn, before = 60, after = 140) {
  const b = String(text || "").replace(/\s+/g, " ");
  const rs = ranges(Q, b);
  if (!rs.length) return "";
  let at = rs[0].s;
  if (Q.phrase) { const m = Q.phrase.exec(b); if (m) at = m.index + m[1].length; }
  const s = Math.max(0, at - before), e = Math.min(b.length, at + after);
  let html = s ? "…" : "", p = s;
  for (const r of rs) {
    if (r.e <= s || r.s >= e || r.s < p) continue;
    html += escFn(b.slice(p, r.s)) + "<mark>" + escFn(b.slice(r.s, r.e)) + "</mark>"; p = r.e;
  }
  return html + escFn(b.slice(p, e)) + (e < b.length ? "…" : "");
}

// טקסט מלא (עמוד מקובץ) כ-HTML, עם <mark> על כל ההתאמות
export function markHtml(Q, text, escFn) {
  const b = String(text || "");
  let html = "", p = 0;
  for (const r of ranges(Q, b)) { if (r.s < p) continue; html += escFn(b.slice(p, r.s)) + '<mark class="hl">' + escFn(b.slice(r.s, r.e)) + "</mark>"; p = r.e; }
  return html + escFn(b.slice(p));
}

// מסמן בתוך דף (סיכום): עוטף כל מופע ב-<mark class="hl">. מחזיר את הסימון הראשון (כדי לגלול אליו)
export function markDom(root, Q) {
  if (!root || !Q?.ok) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest("script,style,mark,button,select,textarea") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  let first = null;
  for (const n of nodes) {
    const rs = ranges(Q, n.data); if (!rs.length) continue;
    const frag = document.createDocumentFragment(); let p = 0;
    for (const r of rs) {
      if (r.s < p) continue;
      frag.append(n.data.slice(p, r.s));
      const m = document.createElement("mark"); m.className = "hl"; m.textContent = n.data.slice(r.s, r.e); frag.append(m);
      first = first || m; p = r.e;
    }
    frag.append(n.data.slice(p)); n.replaceWith(frag);
  }
  return first;
}
