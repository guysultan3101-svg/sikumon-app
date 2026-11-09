// מה מסכמים ומה לא. הסינון לפי שם הפריט בקורס (בלי להוריד כלום), וזיהוי כפילויות.
// נבדק מול הקבצים האמיתיים של סטודנטית מבן-גוריון (tests/classify.test.mjs).

// פריט שנראה כמו שיעור: הרצאה, מצגת, תרגול (שיעור תרגול), נושא, פרק, רישומי שיעור
const LESSON = /הרצאה|שיעור|מצגת|תרגול|lecture|slides?|presentation|\btopic ?\d|נושא ?\d|\bCB\d|\bIC\.|פרק|שבוע|week|רישומים/i;
// לא חומר שיעור: פתרונות, דפי עבודה ותרגילים, בחינות, נוסחאות, סילבוס, הנחיות, קבצי נתונים, סיכומים של אחרים
const JUNK = /פתרון|פתרונות|פתור|תשובות|דף עבודה|דפי עבודה|תרגיל|בוחן|בחינה|מבחן|מועד [אבג]|\bexam|quiz|solutions?|worksheet|homework|exercise|נוסחאות|formulas?|סילבוס|syllabus|לוח זמנים|הנחיות|instructions|טופס|כתובות|abbrev|forAI|העשרה|פוטנציאלי|מחשבון|data ?set|sample data|\.sample\b|\.xlsx|\.csv|\.bas|חומר עזר|סיכום|העתק|mushrooms|doctors_list|patients/i;
const PREV_YEARS = /משנים קודמות|שנים קודמות|שנה שעברה|previous years?|prior years?|last year/i;
const EXAMPLE_FOLDER = /^\s*(דוגמ|examples?\b|samples?\b)/i;

// תחילת שנת הלימודים הנוכחית: 1 באוקטובר
function academicStart(now) {
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 9, 1);
}

// האם בשם יש תאריך (או שנה) שקדם לשנת הלימודים הנוכחית: חומר של שנה שעברה
export function isOld(name, now = new Date()) {
  const start = academicStart(now);
  for (const m of String(name).matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b/g)) {
    let y = +m[3]; if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (!isNaN(d) && d < start) return true;
  }
  for (const m of String(name).matchAll(/\b(20\d\d)\b/g)) if (+m[1] < start.getFullYear()) return true;
  // שנה עברית "תשפ"ו" ומטה (תשפ"ז היא השנה הנוכחית)
  if (/תשפ["״']?[א-ו](?![א-ת])/.test(name) && start.getFullYear() >= 2026) return true;
  return false;
}

// שם בסיס לזיהוי אותו קובץ שהועלה פעמיים ("(העתק)", "v2", "(מעודכן)")
export function baseName(name) {
  return String(name).toLowerCase()
    .replace(/\((העתק|מעודכן|copy|updated|חדש)\)/g, "")
    .replace(/\.\d{3}(?=\.)/g, "")          // CB1.234.02 -> CB1.02
    .replace(/\.?v\d+$/g, "").replace(/[\s_\-.]+/g, "");
}

// סיבת דילוג על פריט, או "" אם מסכמים
export function skipReason(it, now = new Date()) {
  const name = it.name || "";
  if (it.type === "folder" && EXAMPLE_FOLDER.test(name)) return "תיקיית דוגמאות";
  if (JUNK.test(name)) return "לא שיעור (תרגיל/פתרון/נוסחאות/נתונים/בחינה)";
  if (PREV_YEARS.test(name)) return "חומר משנים קודמות";
  if (isOld(name, now)) return "חומר של שנה שעברה";
  return "";
}

// כל הפריטים של קורס אחד ← מה מסכמים ומה לא. בקורס שיש בו שמות של שיעורים ברורים (3 ומעלה) מסכמים רק אותם
export function planCourse(items, now = new Date()) {
  const keep = [], skipped = [];
  const live = [];
  for (const it of items) { const r = skipReason(it, now); if (r) skipped.push({ it, reason: r }); else live.push(it); }
  const strict = items.filter((it) => LESSON.test(it.name || "")).length >= 3;   // סופרים גם שיעורים ישנים: קורס שמתנהל בשמות "הרצאה/שיעור" ברור
  const seen = new Map();
  for (const it of live) {
    if (strict && !LESSON.test(it.name || "")) { skipped.push({ it, reason: "לא נראה כמו שיעור" }); continue; }
    const k = baseName(it.name);
    const prev = seen.get(k);
    if (prev) {
      // אותה הרצאה פעמיים: נשאר הפריט החדש יותר (מזהה גבוה יותר במודל = הועלה מאוחר יותר), לא סתם האחרון ברשימה
      const newer = (+it.id || 0) >= (+prev.id || 0) ? it : prev;
      const older = newer === it ? prev : it;
      skipped.push({ it: older, reason: "כפילות (אותו שם, גרסה ישנה יותר)" });
      if (newer === it) { keep.splice(keep.indexOf(prev), 1); keep.push(it); seen.set(k, it); }
      continue;
    }
    seen.set(k, it); keep.push(it);
  }
  return { keep, skipped };
}
