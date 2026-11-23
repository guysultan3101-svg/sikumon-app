// מטלות ובחנים מהמודל: מועדים מלוח השנה של המודל (תצוגה חודשית, כולל מה שכבר הוגש או שאין בו "פעולה"),
// ופעילויות בקורס שאין להן מועד. פענוח בלבד (בלי רשת), כדי שאפשר יהיה לבדוק.
const cmidOf = (u) => String(u || "").match(/[?&]id=(\d+)/)?.[1] || "";

// core_calendar_get_calendar_monthly_view -> רשימה שטוחה של אירועים
export function flattenMonthly(data) {
  const out = [];
  for (const w of data?.weeks || []) for (const d of w.days || []) for (const e of d.events || []) out.push(e);
  return out;
}

// שם האירוע במודל: "יש להגיש את 'תרגיל 1'" / "תרגיל 1 חייב להסתיים" / "בוחן 1 נסגר" -> "תרגיל 1"
export function cleanName(n) {
  let t = String(n || "").trim();
  t = t.replace(/^יש להגיש את\s*/, "").replace(/^(?:יש לבצע|יש להשלים) את\s*/, "");
  t = t.replace(/\s*(?:חייב להסתיים|חייבת להסתיים|נסגר|ייסגר|is due|closes)\s*$/i, "");
  t = t.replace(/^['"׳"]+|['"׳"]+$/g, "").trim();
  return t || String(n || "").trim();
}

// רק מועדי הגשה של מטלות (due) ומועדי סגירה של בחנים (close). לא פתיחה, לא "מועד בדיקה של המרצה".
export function activityEvents(events) {
  const found = new Map();
  for (const e of events || []) {
    const mod = e.modulename || "";
    const type = String(e.eventtype || "");
    if (!((mod === "assign" && type === "due") || (mod === "quiz" && type === "close"))) continue;
    const cmid = cmidOf(e.url);
    if (!cmid) continue;
    const x = { cmid, kind: mod, name: cleanName(e.name), ts: Number(e.timesort || e.timestart || 0), course: String(e.course?.fullname || "").trim(), courseId: e.course?.id, url: String(e.url || "") };
    if (e.action) x.actionable = e.action.actionable !== false;   // רק אם יש מידע, כדי לא לדרוס ערך קיים ב-undefined
    found.set(`${mod}:${cmid}`, x);
  }
  return [...found.values()];
}

// האם המטלה הוגשה? (תוקן 23.11.2026)
// מטלה: רק לפי דף המטלה עצמו (טבלת "מצב ההגשה"). "actionable=false" בלוח השנה של המודל קורה גם כשהמטלה
// עוד לא נפתחה להגשה – זה לא סימן שהוגשה (כך "מטלה 1" במתמטיקה סומנה בטעות "הוגש" לפני שנפתחה).
// אם דף המטלה לא נקרא בריצה הזו (page === null) – נשארים עם מה שהיה קודם.
// בוחן: לא מסמנים "נעשה" (actionable=false אומר רק שהבוחן עוד לא נפתח).
export function decideSubmitted({ kind, before, page }) {
  if (kind === "assign") return page === null || page === undefined ? !!before : !!page;
  // בוחן: actionable=false בלוח השנה = הבוחן עוד לא נפתח (בוחן שנעשה פשוט נעלם מהפעולות) – אז אין לנו סימן אמין ל"נעשה"
  return false;
}

// האם דף המטלה אומר שהמטלה הוגשה? בודקים רק את תא "מצב ההגשה" – לא את כל הדף (בהוראות של המרצה יכול להופיע "הוגש לבדיקה").
// true = הוגש, false = לא הוגש (טיוטה / חדש / "אין עדיין הגשות"), null = זה לא דף מטלה תקין (התחברות, תקלה) → לא יודעים.
export function isSubmitted(html) {
  const s = String(html || "");
  // 1. המודל שם על התא מחלקה לפי המצב: submissionstatussubmitted / draft / new / reopened / marked
  const c = s.match(/<td[^>]*class="[^"]*\bsubmissionstatus(submitted|draft|new|reopened|marked)\b/i);
  if (c) return /^(submitted|marked)$/i.test(c[1]);
  // 2. אחרת: הטקסט בשורה "מצב ההגשה" / "Submission status" בלבד
  const row = s.match(/(?:מצב ההגשה|Submission status)\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (row) {
    const t = row[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (/טיוטה|draft|לא הוגש|טרם הוגש|not submitted|no submission|אין עדיין/i.test(t)) return false;
    return /^(הוגש|הוגשה|נבדק|Submitted|Graded|Marked)/i.test(t);
  }
  return null;
}

// מועד כמחרוזת ISO (או ריק אם אין מועד)
export const dueIso = (ts) => (ts > 0 ? new Date(ts * 1000).toISOString() : "");
