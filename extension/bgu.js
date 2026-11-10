// מערכת שעות מהפורטל הסטודנטיאלי של בן-גוריון (portal.bgu.ac.il/private/home).
// בדף הבית יש רשימה של כל שיעורי החודש לפי תאריך: שעת התחלה וסיום, שם הקורס (עם קישור למודל), סוג (כיתה / היברידי) וחדר.
// הפורטל לא מציג שם מרצה, ולכן המרצה נשאר ריק. הקוד כאן רק מפענח טקסט (בלי DOM), כדי שירוץ גם בתוסף וגם בבדיקות.
const MONTHS = { "ינואר": 1, "פברואר": 2, "מרץ": 3, "מרס": 3, "אפריל": 4, "מאי": 5, "יוני": 6, "יולי": 7, "אוגוסט": 8, "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12 };
const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const pad = (t) => String(t).padStart(5, "0");

// "[35] בניין כתות לימוד, 116, ע"ש משפחת מרקוס" -> "[35] בניין כתות לימוד, 116"
export function shortPlace(p) {
  let t = String(p || "").replace(/\s+/g, " ").trim().replace(/,?\s*(ע["״']ש|הפקולטה)\s.*$/, "").replace(/[,\s]+$/, "");
  if (t.length > 40) { const cut = t.slice(0, 40); const i = cut.lastIndexOf(","); t = (i > 8 ? cut.slice(0, i) : cut).trim(); }   // בלי פסיק תלוי
  return t;
}

// כל האירועים בדף: [{ date: "2026-11-09", start, end, title, kind, place, courseId }]
export function parseBguEvents(html) {
  const out = [];
  let date = null;
  const re = /class="date-label"[^>]*>([^<]*)<|<app-month-event-item([\s\S]*?)(?=<app-month-event-item|class="date-label"|$)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      const d = /(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(m[1]);
      date = d && MONTHS[d[2]] ? `${d[3]}-${String(MONTHS[d[2]]).padStart(2, "0")}-${String(+d[1]).padStart(2, "0")}` : null;
      continue;
    }
    const c = m[2] || "";
    const start = /class="start-time[^"]*"[^>]*>\s*(\d{1,2}:\d{2})/.exec(c)?.[1];
    const end = /class="end-time[^"]*"[^>]*>\s*(\d{1,2}:\d{2})/.exec(c)?.[1];
    const title = strip(/class="title[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(c)?.[1]);
    const kind = strip(/class="details-description[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(c)?.[1]);
    // בדף החי האייקון מכיל svg בתוכו (בדוגמה שנשלחה אלינו הוא הוסר), לכן מרשים כל תוכן בין <mat-icon> ל-</mat-icon>
    const place = strip(/data-mat-icon-name="location"[^>]*>[\s\S]*?<\/mat-icon>\s*<span[^>]*>([\s\S]*?)<\/span>/.exec(c)?.[1]);
    const courseId = /id%3D(\d+)/.exec(c)?.[1] || /course\/view\.php\?id=(\d+)/.exec(c)?.[1] || "";
    if (/בחינ|מבחן|מועד|הגשה/.test(kind)) continue;   // בחינה או הגשה היא לא שיעור שבועי
    if (date && start && end && title) out.push({ date, start, end, title, kind, place, courseId });
  }
  return out;
}

// מערכת שבועית מהאירועים. שם הקורס נלקח מהמודל (לפי המספר שבקישור), כדי שיתאים למחברות ולהקלטות של אותו קורס.
// אם בדף יש פחות מ-5 תאריכים (סוף החודש), משלימים מהמערכת הקודמת כדי שלא יימחקו שיעורים.
export function bguToSchedule(events, moodleCourses = [], prev = []) {
  const byId = new Map(moodleCourses.map((c) => [String(c.id), String(c.fullname || c.shortname || "").trim()]));
  const tt = new Map();
  for (const e of events) {
    const [y, mo, d] = e.date.split("-").map(Number);
    const day = new Date(y, mo - 1, d).getDay();
    const course = (byId.get(e.courseId) || e.title).slice(0, 200);
    const row = { day, start: pad(e.start), end: pad(e.end), course, place: shortPlace(e.place), lecturer: "" };
    tt.set(`${day}|${row.start}|${course}`, row);   // אותו שיעור בכמה שבועות = שורה אחת; החדר האחרון מנצח
  }
  if (new Set(events.map((e) => e.date)).size < 5) for (const p of prev) { const k = `${p.day}|${p.start}|${p.course}`; if (!tt.has(k)) tt.set(k, p); }
  return [...tt.values()].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}
