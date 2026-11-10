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

// האם דף המטלה אומר שהמטלה הוגשה
export function isSubmitted(html) {
  const t = String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  return /הוגש(?:ה)? (?:להערכה|לבדיקה|לציון)|Submitted for grading|Submitted for marking/i.test(t);
}

// מועד כמחרוזת ISO (או ריק אם אין מועד)
export const dueIso = (ts) => (ts > 0 ? new Date(ts * 1000).toISOString() : "");
