// מערכת שעות ולוח מבחנים מ"מידע אישי" של המוסד (באריאל: meyda.ariel.ac.il).
// המודל לא יודע מתי השיעורים, אבל המידע האישי כן. נכנסים אליו עם אותו חשבון מיקרוסופט של המודל:
// פותחים לשנייה לשונית ברקע, קוראים את המערכת והמבחנים (רק קריאה), וסוגרים. לא רואים ולא שומרים סיסמה.
import { parseBguEvents, bguToSchedule } from "./bgu.js";
export const PORTALS = { "https://moodlearn.ariel.ac.il": "https://meyda.ariel.ac.il/Portals/student", "https://moodle.bgu.ac.il/moodle": "https://portal.bgu.ac.il/private/home" };
const EVERY = 20 * 3600e3;   // פעם ביום מספיק (המערכת כמעט לא משתנה)
const WAIT = 45e3;           // כמה זמן מחכים שההתחברות תסתיים

const get = (k) => chrome.storage.local.get(k).then((o) => o[k]);
const set = (o) => chrome.storage.local.set(o);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (tabId, func, args = []) => chrome.scripting.executeScript({ target: { tabId }, func, args }).then((r) => r[0]?.result);

// בתוך הלשונית: איפה אנחנו, ואם זה דף הכניסה – לוחצים "מעבר להזדהות" (ההתחברות של מיקרוסופט עוברת לבד)
function pageState() {
  if (sessionStorage.token && !/\/login/i.test(location.pathname)) return "ready";
  const a = [...document.querySelectorAll("a")].find((x) => /מעבר להזדהות/.test(x.innerText));
  if (a && !window.__clearlyClicked) { window.__clearlyClicked = true; a.click(); return "clicked"; }
  return "wait";
}
// בתוך הלשונית: אותן קריאות שהדף עצמו עושה (מערכת השעות ל-3 שבועות + המבחנים). מחזירים רק את השדות שצריך.
async function readPortal() {
  const H = { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + sessionStorage.token };
  const post = async (p, body) => { const r = await fetch("/Portals/api/" + p, { method: "POST", headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); };
  const sp = (await post("StudentSchedule/Data", { urlParameters: {} }))._ScheduleParams;
  const weeks = [(await post("StudentScheduleCommon/GetSchedule", sp)).scheduleViewItemWeek?.clientData || []];
  const sun = new Date(); sun.setUTCHours(0, 0, 0, 0); sun.setUTCDate(sun.getUTCDate() - sun.getUTCDay());
  for (const k of [1, 2]) {
    const d = new Date(sun.getTime() + k * 7 * 864e5);
    weeks.push((await post("StudentScheduleCommon/DateChanged", { date: d.toISOString(), _ScheduleParams: sp })).scheduleViewItemWeek?.clientData || []);
  }
  const lessons = weeks.flat().map((x) => ({ start: x.mar_full_start, end: x.mar_full_end, title: x.title, code: String(x.mar_subject || "").split(/\r?\n/)[1] || "", place: x.place || "", lecturer: x.moreinfo || "" }));
  const ex = await post("StudentExams/Data", { urlParameters: {} });
  const exams = (ex.collapsedExams?.clientData || []).map((x) => ({ date: x.moedorder || x.date, time: x.krs_bhn_moed_mishaa || "", title: x.krs_shm, code: x.krs_mis_kvuza || "", label: x.krs_bhn_shm || "", moed: x.krs_bhn_moed_mis }));
  return { lessons, exams };
}

// שם הקורס כמו במודל (לפי מספר הקורס), כדי שהשיעורים יתחברו למחברות ולהקלטות של אותו קורס
function namer(moodleCourses) {
  const byCode = {};
  for (const c of moodleCourses) {
    const code = `${c.idnumber || ""} ${c.shortname || ""}`.match(/(\d{7})/)?.[1];
    if (code && !byCode[code]) byCode[code] = (c.fullname || c.shortname || "").trim();
  }
  // בשמות מהמידע האישי הגרש לפעמים קופץ להתחלה ("'מבוא לשיווק א")
  const fix = (t) => { t = String(t || "").trim(); return t.startsWith("'") ? t.slice(1).trim() + "'" : t; };
  return (code, title) => byCode[String(code).match(/(\d{7})/)?.[1]] || fix(title);
}
const hhmm = (iso) => String(iso).slice(11, 16);
const MOED = { 1: "א", 2: "ב", 3: "ג" };

export function toSchedule(raw, moodleCourses) {
  const name = namer(moodleCourses);
  // שיעור שבועי = יום + שעה + קורס (מאחדים את 3 השבועות, כך ששבוע של חג לא מוחק שיעורים)
  const tt = new Map();
  for (const l of raw.lessons) {
    if (!l.start || !l.end) continue;
    const [y, m, d] = l.start.slice(0, 10).split("-").map(Number);
    const row = { day: new Date(y, m - 1, d).getDay(), start: hhmm(l.start), end: hhmm(l.end), course: name(l.code, l.title), place: l.place.trim().slice(0, 40), lecturer: l.lecturer.trim().slice(0, 60) };
    tt.set(`${row.day}|${row.start}|${row.course}`, row);
  }
  const exams = raw.exams.filter((e) => e.date).map((e) => ({
    date: e.date.slice(0, 10), time: /\d{1,2}:\d{2}/.exec(e.time)?.[0]?.padStart(5, "0") || "", course: name(e.code, e.title),
    moed: MOED[e.moed] || "", label: /^בחינה$/.test(e.label.trim()) ? "" : e.label.trim().slice(0, 40),
  }));
  const timetable = [...tt.values()].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  return { timetable, exams: exams.sort((a, b) => a.date.localeCompare(b.date)) };
}

// בפורטל של בן-גוריון (אפליקציית Angular): מוכן כשרשימת האירועים של החודש נטענה; אם עדיין בהתחברות – מחכים
function bguState() {
  if (location.hostname !== "portal.bgu.ac.il" || /login|signin|auth/i.test(location.pathname)) return "wait";
  if (document.querySelector(".month-events-wrap app-month-event-item")) return "ready";
  return document.querySelector(".month-events-wrap app-month-events") ? "empty" : "wait";
}
function readBgu() { return document.querySelector(".month-events-wrap")?.outerHTML || ""; }

// פותחים את המידע האישי בלשונית ברקע, מחכים להתחברות, קוראים וסוגרים
async function fetchPortal(url) {
  const bgu = new URL(url).hostname === "portal.bgu.ac.il";
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    const until = Date.now() + WAIT;
    let empty = 0;
    while (Date.now() < until) {
      await sleep(1500);
      // באמצע ההתחברות הלשונית נמצאת אצל מיקרוסופט – שם אין לנו גישה, פשוט מחכים
      let st = await run(tab.id, bgu ? bguState : pageState).catch(() => "wait");
      if (st === "empty") { empty++; st = empty >= 4 ? "ready" : "wait"; } else empty = 0;   // רשימה ריקה: מחכים כמה בדיקות לפני שמחליטים שאין שיעורים
      if (st === "ready") { await sleep(1500); return bgu ? { bguHtml: await run(tab.id, readBgu) } : await run(tab.id, readPortal); }
    }
    throw Object.assign(new Error(bgu ? "צריך להיכנס פעם אחת לפורטל הסטודנטיאלי של בן-גוריון בכרום" : "צריך להיכנס פעם אחת ל'מידע האישי' של האוניברסיטה בכרום"), { code: "portal_login" });
  } finally { chrome.tabs.remove(tab.id).catch(() => {}); }
}

// בדיקה אחת: מערכת שעות + מבחנים -> השרת של Clearly (שורה אחת למשתמש, רק הוא רואה)
export async function syncPortal(a, base, moodleCourses, rest, force = false) {
  const url = PORTALS[base];
  if (!url) return null;
  if (!force && Date.now() - ((await get("portalAt")) || 0) < EVERY) return null;
  const raw = await fetchPortal(url);
  let s;
  if (raw?.bguHtml !== undefined) {
    const events = parseBguEvents(raw.bguHtml || "");
    if (!events.length) throw new Error("לא נמצאו שיעורים בפורטל של בן-גוריון (בדקו שהחודש מציג שיעורים)");
    s = { timetable: bguToSchedule(events, moodleCourses, (await get("bguTimetable")) || []), exams: [] };
    await set({ bguTimetable: s.timetable });
  } else {
    if (!raw?.lessons) throw new Error("המידע האישי לא החזיר מערכת שעות");
    s = toSchedule(raw, moodleCourses);
  }
  const r = await rest("uni_schedule", a, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ owner: a.user, timetable: s.timetable, exams: s.exams, source: new URL(url).host, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error("שמירת מערכת השעות נכשלה (" + r.status + ")");
  await set({ portalAt: Date.now() });
  return { lessons: s.timetable.length, exams: s.exams.length };
}
