// סיכומון AI – האפליקציה (גרסת בדיקה). ניווט לפי # בכתובת, כל מסך הוא פונקציה שמציירת HTML.
import { LessonRecorder, store, segmentsOf, support, recoverOrphans } from "./recorder.js";
import { demoSummary, demoQuiz, onboardingQuestions } from "./demo-data.js";
import { InkEditor, COLORS, MARKER_COLORS, pdfToPages, makeThumb } from "./notes.js";
import { initStudy } from "./study.js";
import { initExtras } from "./extras.js";

const $ = (sel, el = document) => el.querySelector(sel);
const view = $("#view");

// ---------- אחסון הגדרות (במכשיר) ----------
const prefs = {
  get() { try { return JSON.parse(localStorage.getItem("sikumon-prefs") || "null"); } catch { return null; } },
  set(v) { try { localStorage.setItem("sikumon-prefs", JSON.stringify(v)); } catch { /* מצב פרטי */ } },
};

// ---------- אייקונים ----------
const icon = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  play: '<path d="M7 5v14l12-7z"/>',
  share: '<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  pen: '<path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>',
  marker: '<path d="M9 15l-4 5h5l2-2"/><path d="M8 13l7-9 5 4-8 8z"/>',
  eraser: '<path d="M8 20h12"/><path d="M4 15l9-10 7 7-8 8H8z"/><path d="M9 10l6 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-5-2.5L3.5 15a1.5 1.5 0 0 1 2.3-2L7 14"/>',
  type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  check: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 12l3 3 5-6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

const TABS = [
  { hash: "home", label: "בית", icon: "home" },
  { hash: "notebooks", label: "מחברות", icon: "folder" },
  { hash: "record", label: "הקלטה", icon: "mic", cls: "rec-tab" },
  { hash: "summaries", label: "סיכומים", icon: "book" },
  { hash: "quizzes", label: "מבחנים", icon: "check" },
  { hash: "profile", label: "פרופיל", icon: "user", cls: "hide-phone" },
];
function renderTabs(active) {
  // בשאלון הפתיחה אין תפריט
  $(".app").classList.toggle("bare", active === null);
  $("#tabs").innerHTML = TABS.map((t) =>
    `<a href="#${t.hash}" class="${t.cls || ""}" ${active === t.hash ? 'aria-current="page"' : ""}>${svg(t.icon)}<span>${t.label}</span></a>`).join("");
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 3200);
}
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
};
const fmtMB = (b) => (b / 1048576).toFixed(1) + " MB";
const fmtDate = (iso) => new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- יומן תקלות (נשמר במכשיר, מוצג ב"בדיקת מכשיר") ----------
function logError(where, e) {
  try {
    const log = JSON.parse(localStorage.getItem("sikumon-errors") || "[]");
    log.push({ at: new Date().toISOString(), where, msg: String(e?.stack || e?.message || e).slice(0, 400) });
    localStorage.setItem("sikumon-errors", JSON.stringify(log.slice(-20)));
  } catch { /* */ }
}
window.addEventListener("error", (e) => logError("window", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => logError("promise", e.reason));

// ---------- מסכים ----------
function onboarding(step = 0, answers = {}) {
  renderTabs(null);
  if (step === 0) {
    view.innerHTML = `<div class="page">
      <p class="eyebrow">ברוכים הבאים</p>
      <h1 style="font-size:clamp(32px,5vw,48px)">נתאים את <span class="mark">סיכומון</span> בדיוק אלייך</h1>
      <p class="muted">חמש שאלות קצרות על איך שאת/ה לומד/ת, ואז כמה פרטים על הקורסים. לוקח פחות מדקה.</p>
      <label class="field">איך לקרוא לך?<input type="text" id="name" name="name" autocomplete="given-name" placeholder="השם הפרטי שלך"></label>
      <label class="field">מוסד לימודים<select id="inst" name="inst"><option>אוניברסיטת אריאל</option><option>אוניברסיטת בן־גוריון</option><option>אוניברסיטת בר־אילן</option><option>אחר</option></select></label>
      <div class="row"><button class="btn" id="go">מתחילים</button></div>
    </div>`;
    $("#go").onclick = () => onboarding(1, { name: $("#name").value.trim(), inst: $("#inst").value });
    return;
  }
  const q = onboardingQuestions[step - 1];
  if (!q) return onboardingCourses(answers);
  view.innerHTML = `<div class="page">
    <div class="progress" aria-hidden="true"><i style="width:${(step / (onboardingQuestions.length + 1)) * 100}%"></i></div>
    <p class="eyebrow">שאלה ${step} מתוך ${onboardingQuestions.length}</p>
    <h2 style="font-size:28px">${q.q}</h2>
    <div class="options">${q.options.map((o, i) => `<button class="opt" data-i="${i}">${o}</button>`).join("")}</div>
  </div>`;
  view.querySelectorAll(".opt").forEach((b) => (b.onclick = () => onboarding(step + 1, { ...answers, [q.id]: q.options[+b.dataset.i] })));
}

function onboardingCourses(answers) {
  view.innerHTML = `<div class="page">
    <p class="eyebrow">כמעט סיימנו</p>
    <h2 style="font-size:28px">אילו קורסים יש לך בסמסטר?</h2>
    <p class="muted">שורה לכל קורס. אפשר לשנות אחר כך בפרופיל. (בגרסה הבאה זה יגיע לבד מה-Moodle שלך.)</p>
    <textarea id="courses" name="courses" rows="7" autocomplete="off" placeholder="מבוא לכלכלה מיקרו&#10;מתמטיקה לכלכלנים א&#10;יסודות החשבונאות"></textarea>
    <div class="row"><button class="btn" id="done">סיום</button></div>
  </div>`;
  $("#done").onclick = () => {
    const courses = $("#courses").value.split("\n").map((s) => s.trim()).filter(Boolean);
    prefs.set({ ...answers, courses: courses.length ? courses : ["קורס כללי"], createdAt: new Date().toISOString() });
    location.hash = "home";
    toast("מעולה! הפרופיל נשמר");
  };
}

async function home() {
  const p = prefs.get();
  const items = await store.listItems();
  const news = await study.moodleNew();
  const nowSlot = currentSlot();
  const next = (await extras.upcoming()).slice(0, 3);
  const hasMarks = (await store.listRecordings()).some((r) => (r.marks || []).length);
  const lastSum = items.filter((x) => x.type === "summary" && x.kind !== "formulas").sort((a, b) => b.date.localeCompare(a.date))[0];
  const quizCount = items.filter((x) => x.type === "quiz").length;
  const recent = (await store.listLessons()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 3);
  view.innerHTML = `<div class="page">
    <div>
      <p class="eyebrow">${new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p>
      <div class="row" style="justify-content:space-between;margin-top:8px"><h1 style="font-size:clamp(30px,5vw,44px)">היי${p.name ? " " + esc(p.name) : ""}</h1><a href="#profile" class="tool show-phone" aria-label="פרופיל">${svg("user")}</a></div>
    </div>
    <a class="card" href="#record" style="text-decoration:none;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:16px">
      <div><h2 style="font-size:24px">${nowSlot ? "עכשיו: " + esc(nowSlot.course) : "מתחיל שיעור?"}</h2><p class="muted">${nowSlot ? `<bdi>${nowSlot.start}–${nowSlot.end}</bdi> · לחיצה אחת, וההקלטה נכנסת ישר למחברת של הקורס.` : "לחיצה אחת ומתחילים להקליט. ההקלטה נכנסת למחברת של השיעור."}</p></div>
      <span class="rec-btn" style="width:84px;height:84px;box-shadow:3px 3px 0 var(--ink);flex:none">${svg("mic")}</span>
    </a>
    ${news && news.length ? `<section class="soft"><div class="row" style="justify-content:space-between"><h3>חדש במודל <span class="chip new">${news.length}</span></h3><a class="small" href="#notebooks">לפי קורסים</a></div><div class="list" style="margin-top:10px">${news.slice(0, 5).map((it) => study.moodleItem(it, true)).join("")}</div></section>` : ""}
    ${next.length ? `<section class="soft"><div class="row" style="justify-content:space-between"><h3>⏳ הבא בתור</h3><a class="small" href="#deadlines">לוח מבחנים</a></div><div class="list" style="margin-top:10px">${next.map((x) => `<a class="item" href="#deadlines"><span style="min-width:0"><span class="t">${x.kind === "exam" ? "📝" : "📌"} ${esc(x.title)}</span><br><span class="small muted">${esc(x.course)}</span></span>${extras.chip(x)}</a>`).join("")}</div></section>` : ""}
    ${hasMarks ? `<a class="item" href="#reels"><span><span class="t">🎬 הרגעים החשובים מהשיעורים</span><br><span class="small muted">קטע של דקה סביב כל ⭐ שסימנת</span></span></a>` : ""}
    ${study.getCode() ? "" : `<a class="item pair-cta" href="#summaries"><span><span class="t">🔗 חיבור אוטומטי למודל</span><br><span class="small muted">קוד אחד מהמחשב, ומאז הכול נכנס לבד</span></span></a>`}
    ${installHint()}
    <section class="soft">
      <h3>מה בודקים בגרסה הזו?</h3>
      <ol class="steps">
        <li><a href="#record">מקליטים שיעור אמיתי</a> מההתחלה ועד הסוף, ובודקים שההקלטה נשמרה.</li>
        <li>כותבים סיכום בעצמכם ב<a href="#notebooks">מחברות</a>: בעט (Apple Pencil), באצבע או בהקלדה. לכל קורס יש תיקייה, ולכל שיעור דף משלו.</li>
        <li>עוברים על <a href="#summaries">הסיכומים</a> ועושים <a href="#quizzes">מבחן</a>. אפשר גם לכתוב מבחן בעצמכם.</li>
        <li><a href="#feedback">שולחים משוב</a>: דקה אחת, וזה עוזר לנו יותר מכל דבר אחר.</li>
      </ol>
    </section>
    <div class="grid2">
      <section class="soft"><h3>הסיכום האחרון</h3>
        ${lastSum ? `<a class="item" href="#sum-${esc(lastSum.id)}" style="margin-top:12px"><span style="min-width:0"><span class="t">${esc(lastSum.course)}</span><br><span class="small muted">${esc(lastSum.title)}</span></span></a>` : `<a class="item" href="#summaries" style="margin-top:12px"><span><span class="t">ייבוא הסיכומים שלך</span><br><span class="small muted">מ-Drive, לפי הקורסים במודל</span></span>${svg("download")}</a>`}
      </section>
      <section class="soft"><h3>המבחנים שלי</h3>
        <a class="item" href="#quizzes" style="margin-top:12px"><span><span class="t">${quizCount ? quizCount + " מבחנים מחכים לך" : "5 שאלות על מיקרו"}</span><br><span class="small muted">${quizCount ? "על כל סיכום, וגם מבחנים שתכתוב בעצמך" : "בערך 2 דקות"}</span></span>${quizCount ? "" : '<span class="chip demo">דוגמה</span>'}</a>
      </section>
    </div>
    <section class="soft"><div class="row" style="justify-content:space-between"><h3>להמשיך מאיפה שהפסקת</h3><a href="#notebooks" class="small">כל המחברות</a></div>
      <div class="list" style="margin-top:12px">${recent.length ? recent.map((l) => lessonItem(l, true)).join("") : '<p class="muted">עוד אין שיעורים. פתחו <a href="#notebooks">מחברת</a> או התחילו הקלטה, והשיעור יופיע כאן.</p>'}</div>
    </section>
  </div>`;
  $("#hideInstall") && ($("#hideInstall").onclick = () => {
    try { localStorage.setItem("sikumon-hide-install", "1"); } catch { /* */ }
    $(".install").remove();
  });
}

// ----- משוב מהבודקים: מה עבד, כמה זה שווה, האם ימליצו -----
const feedbackQs = [
  { id: "rec", q: "איך עבדה ההקלטה בשיעור?", options: ["הקליטה את כל השיעור", "נקטעה באמצע", "לא עבדה בכלל", "עוד לא ניסיתי"] },
  { id: "useful", q: "כמה סיכום כזה היה עוזר לך ללמוד למבחן?", options: ["מאוד", "די הרבה", "קצת", "לא ממש"] },
  { id: "pay", q: "כמה היית מוכן/ה לשלם בחודש על סיכום ומבחן לכל שיעור?", options: ["לא הייתי משלם/ת", "עד 15 ₪", "בין 15 ל-30 ₪", "בין 30 ל-50 ₪", "יותר מ-50 ₪"] },
  { id: "nps", q: "מ-0 עד 10, כמה סביר שתמליץ/י לחבר מהתואר?", options: ["0 עד 4", "5 עד 6", "7 עד 8", "9 עד 10"] },
];
function feedback() {
  const ans = {};
  view.innerHTML = `<div class="page">
    <h1 style="font-size:32px">משוב על הגרסה</h1>
    <p class="muted">ארבע שאלות ושורה חופשית. בסוף המשוב נפתח לשליחה (וואטסאפ, מייל או כל אפליקציה אחרת), ואתם רואים בדיוק מה נשלח.</p>
    ${feedbackQs.map((q) => `<fieldset class="soft fs"><legend>${q.q}</legend><div class="options">${q.options.map((o, i) => `<button type="button" class="opt" data-q="${q.id}" data-i="${i}" aria-pressed="false">${o}</button>`).join("")}</div></fieldset>`).join("")}
    <label class="field">מה הכי חסר, או מה הכי הפריע?<textarea id="free" name="free" rows="4" autocomplete="off" placeholder="למשל: הייתי רוצה שהסיכום יגיע גם למייל…"></textarea></label>
    <div class="row"><button class="btn" id="send">${svg("share")} שליחת המשוב</button></div>
  </div>`;
  view.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
    const q = feedbackQs.find((x) => x.id === b.dataset.q);
    ans[q.id] = q.options[+b.dataset.i];
    view.querySelectorAll(`.opt[data-q="${q.id}"]`).forEach((o) => o.setAttribute("aria-pressed", o === b));
  }));
  $("#send").onclick = async () => {
    const p = prefs.get(); const s = support();
    const recs = await store.listRecordings();
    const longest = recs.reduce((m, r) => Math.max(m, r.durationMs || 0), 0);
    const text = ["משוב על סיכומון (גרסת בדיקה)", `מוסד: ${p.inst || "–"}`,
      ...feedbackQs.map((q) => `${q.q} ${ans[q.id] || "–"}`),
      `חופשי: ${$("#free").value.trim() || "–"}`,
      `הקלטות: ${recs.length}, הארוכה: ${fmtTime(longest)}, קטיעות: ${recs.reduce((a, r) => a + (r.interruptions?.length || 0), 0)}`,
      `מכשיר: ${/iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 ? "iPad" : /iPhone/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "מחשב"}, מותקן: ${s.standalone ? "כן" : "לא"}`].join("\n");
    try {
      if (navigator.share) { await navigator.share({ title: "משוב על סיכומון", text }); toast("תודה! המשוב עוזר לנו מאוד"); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); toast("המשוב הועתק. הדביקו אותו בוואטסאפ למי ששלח לכם את הקישור"); }
    catch { toast("לא הצלחתי לפתוח שליחה. צלמו מסך ושלחו לנו"); }
  };
}

// הסבר התקנה למסך הבית, רק למי שעוד לא התקין (אפשר לסגור)
function installHint() {
  const s = support();
  let hidden = false;
  try { hidden = localStorage.getItem("sikumon-hide-install") === "1"; } catch { /* */ }
  if (s.standalone || hidden) return "";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const how = ios
    ? 'ב-Safari לוחצים על כפתור השיתוף <span aria-hidden="true">(ריבוע עם חץ למעלה)</span> ובוחרים <b>"הוסף למסך הבית"</b>.'
    : 'בתפריט הדפדפן בוחרים <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b>.';
  return `<div class="notice install"><div><b>טיפ: התקינו את סיכומון כמו אפליקציה.</b> ${how}</div><button class="link" id="hideInstall">הבנתי</button></div>`;
}

function recItem(r) {
  const st = r.status === "done" ? '<span class="chip ok">נשמר</span>' : r.status === "paused" ? '<span class="chip warn">נקטע</span>' : '<span class="chip warn">מקליט</span>';
  return `<a class="item" href="#rec-${r.id}"><span><span class="t">${esc(r.course)}</span><br><span class="small muted"><bdi>${fmtDate(r.startedAt)}</bdi> · <bdi>${fmtTime(r.durationMs || 0)}</bdi></span></span>${st}</a>`;
}

// ----- מערכת שעות: לפי היום והשעה יודעים איזה שיעור עכשיו -----
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
// השיעור שמתקיים עכשיו (כולל רבע שעה לפני ו-10 דקות אחרי)
function currentSlot(d = new Date()) {
  const now = d.getHours() * 60 + d.getMinutes();
  return (prefs.get().timetable || []).find((x) => +x.day === d.getDay() && now >= toMin(x.start) - 15 && now <= toMin(x.end) + 10) || null;
}

// ----- מחיקה (עם אישור) -----
async function removeRecording(id) {
  const r = await store.getRecording(id);
  await store.deleteRecording(id);
  if (r?.lessonId) {
    const l = await store.getLesson(r.lessonId);
    if (l) { l.recIds = (l.recIds || []).filter((x) => x !== id); await store.saveLesson(l); }
  }
}
async function removeLesson(l) {
  const recs = (l.recIds || []).length;
  if (!confirm(`למחוק את "${lessonTitle(l)}"? אי אפשר לבטל.`)) return false;
  if (recs && confirm(`בשיעור יש ${recs === 1 ? "הקלטה אחת" : recs + " הקלטות"}. למחוק גם אותן?\n(ביטול = ההקלטות נשארות ב"כל ההקלטות")`)) {
    for (const id of l.recIds) await store.deleteRecording(id);
  }
  await store.deleteLesson(l.id);
  toast("השיעור נמחק");
  return true;
}
async function removeCourse(i) {
  const p = prefs.get();
  const course = (p.courses || [])[i];
  const lessons = (await store.listLessons()).filter((l) => l.course === course);
  if (!confirm(`למחוק את התיקייה "${course}"${lessons.length ? ` ואת ${lessons.length} השיעורים שבה` : ""}? אי אפשר לבטל.`)) return;
  const recIds = lessons.flatMap((l) => l.recIds || []);
  const delRecs = recIds.length && confirm(`למחוק גם ${recIds.length} הקלטות של הקורס?\n(ביטול = ההקלטות נשארות ב"כל ההקלטות")`);
  for (const l of lessons) await store.deleteLesson(l.id);
  if (delRecs) for (const id of recIds) await store.deleteRecording(id);
  // הקורס לא יחזור בסנכרון הבא מהמודל, וגם יוצא ממערכת השעות
  p.courses = p.courses.filter((c) => c !== course);
  p.hiddenCourses = [...new Set([...(p.hiddenCourses || []), course])];
  p.timetable = (p.timetable || []).filter((x) => x.course !== course);
  prefs.set(p);
  toast(`התיקייה "${course}" נמחקה`);
  location.hash = "notebooks";
}

// ----- הקלטה -----
let recorder = null;
function record() {
  const p = prefs.get(); const s = support();
  const problems = [];
  if (!s.secure) problems.push("האפליקציה חייבת לרוץ בכתובת מאובטחת (https) כדי להשתמש במיקרופון.");
  if (!s.mic || !s.recorder) problems.push("הדפדפן הזה לא תומך בהקלטה. באייפד ובאייפון צריך iOS 14.3 ומעלה, בדפדפן Safari.");
  const active = recorder?.rec && recorder.rec.status !== "done";
  const slot = currentSlot();
  if (slot && !(p.courses || []).includes(slot.course)) p.courses = [...(p.courses || []), slot.course];
  const paused = recorder?.rec?.status === "paused";
  view.innerHTML = `<div class="page">
    <h1 style="font-size:32px">הקלטת שיעור</h1>
    ${problems.map((x) => `<p class="notice alert">${x}</p>`).join("")}
    <label class="field">איזה קורס?<select id="course" name="course" ${active ? "disabled" : ""}>${(p.courses || []).map((c) => `<option ${(recorder?.rec?.course || slot?.course) === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
    <p class="small ${slot ? "" : "muted"}" style="margin-top:-12px">${active ? "" : slot ? `🕘 זוהה לפי מערכת השעות: <b>${esc(slot.course)}</b> (${DAYS[slot.day]} <bdi>${slot.start}–${slot.end}</bdi>). ההקלטה תיכנס למחברת שלו, לשיעור של היום.` : `אין שיעור במערכת השעות עכשיו, אז בוחרים קורס. <a href="#timetable">למערכת השעות</a>`}</p>
    <div class="card rec-stage">
      <div class="clock" id="clock" role="timer">${fmtTime(recorder?.elapsedMs || 0)}</div>
      <div class="meter" aria-hidden="true"><i id="lvl"></i></div>
      <button class="rec-btn ${recorder?.running ? "on" : ""}" id="recBtn" ${problems.length ? "disabled" : ""}>
        ${recorder?.running ? svg("stop") + "<span>סיום</span>" : svg("mic") + "<span>" + (paused ? "המשך" : "הקלט") + "</span>"}
      </button>
      <p class="saved-line" id="savedLine" aria-live="polite">${savedLine()}</p>
      ${recorder?.running ? `<button class="btn star-btn" id="starBtn">⭐ רגע חשוב <span id="starN">${(recorder.rec.marks || []).length || ""}</span></button><p class="small muted">לוחצים כשהמרצה אומר משהו חשוב. אחרי השיעור כל כוכב הופך לקטע של דקה ב"רילס".</p>` : ""}
      ${recorder?.running && recorder.rec.slotEnd ? `<p class="small muted">🕘 ההקלטה תיעצר לבד בסוף השיעור (<bdi>${new Date(recorder.rec.slotEnd).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</bdi>), אחרי שתאשרו.</p>` : ""}
      ${paused ? '<p class="notice alert" style="text-align:right">ההקלטה נעצרה. לחצו "המשך" כדי להמשיך מאותה נקודה, או סיימו ושמרו את מה שכבר הוקלט.</p><button class="btn ghost" id="finishPaused">לסיים ולשמור</button>' : ""}
    </div>
    <div class="notice"><strong>כדי שההקלטה תחזיק את כל השיעור:</strong>
      <ul class="tips"><li>השאירו את סיכומון פתוח על המסך. אפשר לכתוב במקביל במסך מפוצל.</li><li>לא לנעול את המסך. ${s.wakeLock ? "האפליקציה מנסה להשאיר אותו דלוק לבד." : "כדאי לכבות נעילה אוטומטית בהגדרות."}</li><li>חברו למטען אם השיעור ארוך.</li></ul>
    </div>
    <p class="small muted">ההקלטה נכנסת אוטומטית למחברת של הקורס, לשיעור של היום. מקליטים רק כשזה מותר לפי מדיניות המרצה והמוסד. ההקלטה נשמרת רק במכשיר שלך.</p>
  </div>`;
  $("#recBtn").onclick = onRecClick;
  $("#starBtn") && ($("#starBtn").onclick = starNow);
  $("#finishPaused") && ($("#finishPaused").onclick = finish);
  bindRecorderUi();
}

// שורת המצב מתחת לכפתור: מה כבר שמור במכשיר
function savedLine() {
  if (!recorder?.rec) return "לחצו כשהשיעור מתחיל. ההקלטה נשמרת במכשיר כל דקה.";
  const mins = recorder.chunkCount;
  const saved = mins ? `✓ ${mins === 1 ? "נשמרה דקה אחת" : "נשמרו " + mins + " דקות"}` : "החתיכה הראשונה תישמר אחרי דקה";
  return recorder.running ? `מקליט · ${saved}` : saved;
}

// ⭐ סימון רגע חשוב בהקלטה הפעילה
function starNow() {
  const m = recorder?.mark();
  if (!m) return;
  navigator.vibrate?.(30);
  const n = recorder.rec.marks.length;
  $("#starN") && ($("#starN").textContent = n);
  $("#lstar") && ($("#lstar").lastElementChild.textContent = n);
  toast(`⭐ נשמר רגע חשוב (${fmtTime(m.at)})`);
}

// סוף השיעור לפי מערכת השעות: שואלים אם לסיים, ואם אין תשובה תוך 3 דקות – מסיימים ושומרים לבד
let endPrompt = null;
function beep() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.25); setTimeout(() => a.close(), 600); } catch { /* */ }
}
setInterval(async () => {
  const end = recorder?.running && recorder.rec.slotEnd ? new Date(recorder.rec.slotEnd) : null;
  if (!end || Date.now() < end || endPrompt) return;
  beep(); navigator.vibrate?.([200, 100, 200]);
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (Notification?.permission === "granted") reg?.showNotification("השיעור נגמר", { body: "לסיים את ההקלטה? היא תיעצר לבד בעוד 3 דקות.", tag: "lesson-end" }); } catch { /* */ }
  let left = 180;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="endModal" role="alertdialog" aria-labelledby="endT"><div class="card"><h2 id="endT">השיעור ב${esc(recorder.rec.course)} נגמר</h2>
    <p class="muted">לפי מערכת השעות. לסיים ולשמור את ההקלטה? אם לא תענו, היא תיעצר ותישמר לבד בעוד <b id="endLeft">3:00</b>.</p>
    <div class="row"><button class="btn" id="endYes">סיום ושמירה</button><button class="btn ghost" id="endMore">להמשיך עוד 15 דק׳</button></div></div></div>`);
  const close = () => { clearInterval(endPrompt); endPrompt = null; $("#endModal")?.remove(); };
  endPrompt = setInterval(async () => {
    left -= 1; $("#endLeft") && ($("#endLeft").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
    if (left <= 0) { close(); if (recorder) await finish(true); }
  }, 1000);
  $("#endYes").onclick = async () => { close(); if (recorder) await finish(true); };
  $("#endMore").onclick = () => { recorder.rec.slotEnd = new Date(Date.now() + 15 * 60e3).toISOString(); close(); toast("ממשיכים להקליט עוד 15 דקות"); };
}, 20000);

// מתחיל הקלטה ומשייך אותה לשיעור (של היום בקורס הזה, או לשיעור שפתוח במחברת)
async function startRecording(course, lessonId = null) {
  const lesson = lessonId ? await store.getLesson(lessonId) : await lessonForToday(course);
  const r = new LessonRecorder();
  bindRecorder(r);
  await r.start(course, lesson.id);
  recorder = r; // רק אחרי שהמיקרופון באמת נפתח
  // אם השיעור במערכת השעות – זוכרים מתי הוא נגמר, כדי להציע לעצור לבד
  const slot = currentSlot();
  if (slot && slot.course === course) {
    const [h, m] = slot.end.split(":").map(Number); const end = new Date(); end.setHours(h, m, 0, 0);
    r.rec.slotEnd = end.toISOString();
    try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch { /* */ }
  }
  lesson.recIds = [...(lesson.recIds || []), r.rec.id];
  await store.saveLesson(lesson);
  toast("ההקלטה התחילה");
}

let busy = false;
async function onRecClick() {
  if (busy) return; // מונע לחיצה כפולה
  busy = true; $("#recBtn").disabled = true;
  try {
    if (!recorder || recorder.rec?.status === "done" || !recorder.rec) {
      await startRecording($("#course").value);
    } else if (recorder.rec.status === "paused") {
      await recorder.resume();
      toast("ההקלטה ממשיכה");
    } else {
      busy = false;
      await finish();
      return;
    }
    busy = false;
    record();
  } catch (e) {
    busy = false;
    if ($("#recBtn")) $("#recBtn").disabled = false;
    toast(e.name === "NotAllowedError" ? "צריך לאשר גישה למיקרופון. באייפון: הגדרות ← Safari ← מיקרופון ← לאפשר." : "לא הצלחתי להתחיל להקליט (" + e.name + "). נסו שוב.");
  }
}

async function finish(navigate = true) {
  if (busy) return;
  busy = true;
  toast("שומר…");
  const rec = await recorder.stop();
  busy = false;
  recorder = null;
  toast("ההקלטה נשמרה");
  if (navigate) location.hash = rec.lessonId ? "lesson-" + rec.lessonId : "rec-" + rec.id;
  return rec;
}
function bindRecorder(r) {
  r.addEventListener("interrupted", (e) => { toast(e.detail + ". לחצו 'המשך' כדי להמשיך להקליט."); if (location.hash === "#record") record(); });
}
let uiTimer = null;
function bindRecorderUi() {
  clearInterval(uiTimer);
  if (!recorder) return;
  const update = () => {
    if (location.hash !== "#record") return clearInterval(uiTimer);
    $("#clock") && ($("#clock").textContent = fmtTime(recorder?.elapsedMs || 0));
    const line = savedLine();
    if ($("#savedLine") && $("#savedLine").textContent !== line) $("#savedLine").textContent = line;
    $("#lvl") && ($("#lvl").style.width = Math.round((recorder?.level || 0) * 100) + "%");
  };
  uiTimer = setInterval(update, 250);
}

// ----- רשימת הקלטות ופרטי הקלטה -----
async function recordings() {
  const recs = (await store.listRecordings()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  view.innerHTML = `<div class="page">
    <h1 style="font-size:32px">ההקלטות שלי</h1>
    <p class="muted">ההקלטות נשמרות כרגע רק במכשיר הזה. בגרסה הבאה הן יעלו לענן ויהפכו לסיכום לבד.</p>
    <div class="list">${recs.length ? recs.map((r) => `<div class="rec-row">${recItem(r)}<button class="link del-rec" data-id="${r.id}" aria-label="מחיקת ההקלטה">${svg("trash")}</button></div>`).join("") : '<p class="muted">עוד אין הקלטות.</p>'}</div>
  </div>`;
  view.querySelectorAll(".del-rec").forEach((b) => (b.onclick = async () => {
    if (!confirm("למחוק את ההקלטה? אי אפשר לבטל.")) return;
    await removeRecording(b.dataset.id); toast("ההקלטה נמחקה"); recordings();
  }));
}

async function recordingDetail(id) {
  const r = await store.getRecording(id);
  if (!r) { view.innerHTML = '<div class="page"><p>ההקלטה לא נמצאה.</p></div>'; return; }
  const segs = await segmentsOf(r);
  const urls = segs.map((s) => URL.createObjectURL(s.blob));
  const ext = r.mime.includes("mp4") ? "m4a" : "webm";
  view.innerHTML = `<div class="page">
    <a href="${r.lessonId ? "#lesson-" + r.lessonId : "#recordings"}" class="small">→ ${r.lessonId ? "חזרה לשיעור" : "כל ההקלטות"}</a>
    <h1 style="font-size:30px">${esc(r.course)}</h1>
    <p class="muted"><bdi>${fmtDate(r.startedAt)}</bdi> · משך <bdi>${fmtTime(r.durationMs || 0)}</bdi> · <bdi>${fmtMB(r.bytes || 0)}</bdi></p>
    ${segs.map((s, i) => `<div class="soft"><div class="row" style="justify-content:space-between"><b>${segs.length > 1 ? "חלק " + (i + 1) + " מתוך " + segs.length : "ההקלטה"}</b></div><audio controls preload="metadata" src="${urls[i]}" style="margin-top:10px"></audio>
      <div class="row" style="margin-top:10px"><button class="btn ghost" data-share="${i}">${svg("share")} שיתוף / שמירה</button></div></div>`).join("") || '<p class="notice alert">לא נשמר אודיו בהקלטה הזו.</p>'}
    ${(r.marks || []).length ? `<a class="item" href="#reels-${r.id}"><span><span class="t">🎬 ${r.marks.length} רגעים חשובים</span><br><span class="small muted">${r.marks.map((m) => "⭐ " + fmtTime(m.at)).join(" · ")}</span></span></a>` : ""}
    ${r.interruptions.length ? `<div class="soft"><h3>קטיעות</h3><ul>${r.interruptions.map((x) => `<li>${fmtDate(x.at)}: ${esc(x.what)}</li>`).join("")}</ul></div>` : ""}
    <details class="soft"><summary><b>פרטים טכניים</b> <span class="muted small">(אם משהו לא עבד)</span></summary>
      <pre id="report" style="white-space:pre-wrap;font:13px/1.5 var(--font-mono);direction:ltr;text-align:left;margin:10px 0 0">${esc(JSON.stringify({ duration: fmtTime(r.durationMs || 0), size: fmtMB(r.bytes || 0), segments: segs.length, chunks: segs.reduce((a, s) => a + s.chunks, 0), interruptions: r.interruptions.length, mime: r.mime, support: support(), device: r.device }, null, 1))}</pre>
      <div class="row" style="margin-top:12px"><button class="btn ghost" id="copy">העתקת הדוח</button></div></details>
    <div class="row"><button class="btn danger" id="del">${svg("trash")} מחיקת ההקלטה</button></div>
  </div>`;
  view.querySelectorAll("[data-share]").forEach((b) => (b.onclick = async () => {
    const s = segs[+b.dataset.share];
    const file = new File([s.blob], `${r.course}-${r.startedAt.slice(0, 10)}-${+b.dataset.share + 1}.${ext}`, { type: r.mime });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: r.course });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); }
    } catch { /* המשתמש ביטל */ }
  }));
  $("#copy").onclick = async () => {
    try { await navigator.clipboard.writeText($("#report").textContent); toast("הדוח הועתק"); }
    catch { getSelection().selectAllChildren($("#report")); toast("סמנו והעתיקו את הדוח"); }
  };
  $("#del").onclick = async () => {
    if ($("#del").dataset.sure) { await removeRecording(id); toast("ההקלטה נמחקה"); location.hash = r.lessonId ? "lesson-" + r.lessonId : "recordings"; }
    else { $("#del").dataset.sure = "1"; $("#del").lastChild.textContent = " לחצו שוב למחיקה"; }
  };
}

// ----- מחברות: תיקייה לכל קורס, דף לכל שיעור -----
const FOLDER_COLORS = ["#2563EB", "#6D28D9", "#DB2777", "#16A34A", "#EA580C", "#0891B2", "#CA8A04", "#475569"];
const todayKey = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD לפי השעון המקומי
const fmtDay = (key) => new Date(key + "T12:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" });
const courseIndex = (name) => (prefs.get().courses || []).indexOf(name);

function newLesson(course, date = todayKey()) {
  return { id: "les-" + Date.now() + Math.random().toString(36).slice(2, 5), course, date, title: "", text: "", pages: [], recIds: [], createdAt: new Date().toISOString() };
}
// השיעור של היום בקורס (אם עוד אין, נפתח חדש)
async function lessonForToday(course, date = todayKey()) {
  const all = await store.listLessons();
  const found = all.filter((l) => l.course === course && l.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (found) return found;
  const l = newLesson(course, date);
  await store.saveLesson(l);
  return l;
}
const lessonTitle = (l) => l.title || "שיעור " + new Date(l.date + "T12:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });

function lessonItem(l, withCourse = false) {
  const strokes = (l.pages || []).reduce((a, p) => a + p.strokes.length + (p.image ? 1 : 0), 0);
  const chips = [strokes ? `<span class="chip">${svg("pen")} כתב יד</span>` : "", l.text?.trim() ? `<span class="chip">${svg("type")} הקלדה</span>` : "", l.recIds?.length ? `<span class="chip">${svg("mic")} ${l.recIds.length > 1 ? l.recIds.length + " הקלטות" : "הקלטה"}</span>` : ""].join("");
  return `<a class="item" href="#lesson-${l.id}"><span style="min-width:0"><span class="t">${esc(lessonTitle(l))}</span><br><span class="small muted">${withCourse ? esc(l.course) + " · " : ""}${fmtDay(l.date)}</span></span><span class="chips">${chips || '<span class="chip">ריק</span>'}</span></a>`;
}

// מסך המחברות בסגנון Notability: תיקיות צבעוניות בצד, חיפוש, וכרטיסים עם תצוגה מקדימה של כל שיעור
const fmtCardDate = (key) => new Date(key + "T12:00").toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });

async function notebooks(sel = null) { // sel = אינדקס הקורס, או null = כל השיעורים
  const p = prefs.get();
  const courses = p.courses || [];
  const course = sel === null ? null : courses[sel];
  if (sel !== null && !course) { location.hash = "notebooks"; return; }
  const all = await store.listLessons();
  const newBy = {};
  for (const it of (await study.moodleNew()) || []) newBy[it.course] = (newBy[it.course] || 0) + 1;
  const color = (i) => FOLDER_COLORS[i % FOLDER_COLORS.length];
  const list = (course ? all.filter((l) => l.course === course) : all)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const card = (l) => {
    const snippet = !l.thumb && l.text?.trim() ? `<span class="snip">${esc(l.text.trim().slice(0, 160))}</span>` : "";
    return `<a class="ncard" href="#lesson-${l.id}" data-id="${l.id}" data-q="${esc((lessonTitle(l) + " " + l.course + " " + (l.text || "")).toLowerCase())}">
      <button class="card-del" data-del="${l.id}" aria-label="מחיקת השיעור">${svg("trash")}</button>
      <div class="thumb">${l.thumb ? `<img src="${l.thumb}" alt="" loading="lazy">` : snippet}${l.recIds?.length ? `<span class="rec-dot" title="יש הקלטה">${svg("mic")}</span>` : ""}</div>
      <b>${esc(lessonTitle(l))}</b><span class="small muted">${course ? "" : esc(l.course) + " · "}${fmtCardDate(l.date)}</span></a>`;
  };
  view.innerHTML = `<div class="nb">
    <aside class="nb-side" aria-label="תיקיות">
      <label class="nb-search">${svg("search")}<input type="search" id="nbSearch" name="search" placeholder="חיפוש…" autocomplete="off" aria-label="חיפוש בשיעורים"></label>
      <a class="nb-f ${sel === null ? "on" : ""}" href="#notebooks"><i style="background:var(--ink)"></i><span>כל השיעורים</span><b>${all.length || ""}</b></a>
      <div class="nb-h"><span>תיקיות</span><button class="link" id="addCourse" aria-label="תיקייה חדשה">${svg("plus")}</button></div>
      ${courses.map((c, i) => {
        const n = all.filter((l) => l.course === c).length;
        return `<a class="nb-f ${sel === i ? "on" : ""}" href="#course-${i}"><i style="background:${color(i)}"></i><span>${esc(c)}</span>${newBy[c] ? `<span class="chip new">${newBy[c]}</span>` : ""}<b>${n || ""}</b><button class="folder-del" data-i="${i}" aria-label="מחיקת התיקייה ${esc(c)}">${svg("trash")}</button></a>`;
      }).join("")}
      <a class="nb-f" href="#recordings"><i style="background:var(--red)"></i><span>כל ההקלטות</span></a>
    </aside>
    <section class="nb-main">
      <div class="row" style="justify-content:space-between">
        <div><h1 style="font-size:clamp(24px,3.5vw,32px)${course ? `;color:${color(sel)}` : ""}">${course ? esc(course) : "כל השיעורים"}</h1>${course ? `<a href="#deadlines" class="cd-row">${(await extras.upcoming(course)).slice(0, 2).map(extras.chip).join("")}</a>` : ""}</div>
        <div class="row" style="gap:8px">
          ${course ? `<label class="btn ghost small-btn">${svg("download")} ייבוא מ-Notability<input type="file" id="pdfIn" accept="application/pdf,.pdf" multiple hidden></label>` : ""}
          <button class="btn ghost small-btn" id="editNb" aria-pressed="false">עריכה</button>
          <button class="btn small-btn" id="newLesson">${svg("plus")} חדש</button>
        </div>
      </div>
      <div class="cards" id="cards">${list.map(card).join("") || `<p class="muted">${course ? 'עוד אין שיעורים בתיקייה הזו. לחצו "חדש" כדי לפתוח דף, או "ייבוא מ-Notability" כדי להכניס את מה שכתבתם בעבר.' : "עוד אין שיעורים. בחרו תיקייה מהרשימה ולחצו \"חדש\"."}</p>`}</div>
      ${!course && list.length === 0 ? "" : ""}
      ${course ? extras.pastExamsBlock(await extras.pastExams(course), course) : ""}
      ${course ? study.moodleSection(await study.moodleCourse(course)) : ""}
    </section>
  </div>`;

  extras.bindPastExams(() => notebooks(sel));
  // מצב עריכה: מופיעים כפתורי מחיקה על כל שיעור ועל כל תיקייה
  $("#editNb").onclick = () => {
    const on = !view.querySelector(".nb").classList.toggle("editing") ? false : true;
    $("#editNb").setAttribute("aria-pressed", on); $("#editNb").textContent = on ? "סיום" : "עריכה";
    if (on) toast("לחצו על פח האשפה כדי למחוק שיעור או תיקייה");
  };
  view.querySelectorAll(".card-del").forEach((b) => (b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const l = list.find((x) => x.id === b.dataset.del);
    if (l && await removeLesson(l)) notebooks(sel).then(() => $("#editNb")?.click());
  }));
  view.querySelectorAll(".folder-del").forEach((b) => (b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    await removeCourse(+b.dataset.i);
  }));
  // בטלפון: התיקייה שנבחרה נגללת לתוך השורה
  if (innerWidth <= 820) $(".nb-f.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  // חיפוש מיידי בכרטיסים
  $("#nbSearch").oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    view.querySelectorAll(".ncard").forEach((c) => (c.hidden = !!q && !c.dataset.q.includes(q)));
  };
  $("#addCourse").onclick = () => {
    const name = (prompt("שם התיקייה (הקורס) החדשה:") || "").trim();
    if (!name) return;
    const pr = prefs.get();
    if ((pr.courses || []).includes(name)) return toast("התיקייה הזו כבר קיימת");
    pr.courses = [...(pr.courses || []), name]; prefs.set(pr);
    location.hash = "course-" + (pr.courses.length - 1);
    toast("נוספה תיקייה: " + name);
  };
  $("#newLesson").onclick = async () => {
    const target = course || (sel === null && courses.length === 1 ? courses[0] : null);
    if (!target) { toast("בחרו קודם תיקייה מהרשימה, ואז \"חדש\""); return; }
    const l = newLesson(target);
    await store.saveLesson(l);
    location.hash = "lesson-" + l.id;
  };
  // ייבוא קובצי PDF מ-Notability: כל קובץ הופך לשיעור בתיקייה הזו
  $("#pdfIn") && ($("#pdfIn").onchange = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    let done = 0;
    for (const f of files) {
      try {
        toast(`מייבא ${done + 1} מתוך ${files.length}: ${f.name}`);
        const pages = await pdfToPages(f);
        const date = todayKey(new Date(f.lastModified || Date.now()));
        const l = { ...newLesson(course, date), title: f.name.replace(/\.pdf$/i, "").trim(), pages, source: "notability" };
        l.thumb = await makeThumb(pages[0]);
        await store.saveLesson(l);
        done += 1;
      } catch (err) { toast(`לא הצלחתי לייבא את ${f.name}: ${err.message}`); }
    }
    toast(`יובאו ${done} שיעורים ל"${course}". אפשר להמשיך לכתוב עליהם`);
    notebooks(sel);
  });
  // תצוגה מקדימה לשיעורים ישנים שעוד אין להם (נוצרת פעם אחת ונשמרת)
  for (const l of list.filter((x) => !x.thumb && (x.pages || []).some((pg) => pg.strokes.length || pg.image))) {
    const first = l.pages.find((pg) => pg.strokes.length || pg.image);
    l.thumb = await makeThumb(first);
    await store.saveLesson(l);
    const box = view.querySelector(`.ncard[data-id="${l.id}"] .thumb`);
    if (box) box.insertAdjacentHTML("afterbegin", `<img src="${l.thumb}" alt="">`);
  }
}
const courseFolder = (i) => notebooks(i);

// ----- דף השיעור: כתב יד / הקלדה / הקלטות -----
let editor = null, editingLesson = null, saveTimer = null, lessonTimer = null;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(() => flushLesson(), 700); }
async function flushLesson(withThumb = false) {
  clearTimeout(saveTimer);
  const l = editingLesson, ed = editor; // שומרים הפניה – הסגירה מאפסת את המשתנים
  if (!l) return;
  if (ed) l.pages = ed.pages;
  if (withThumb) {
    const first = (l.pages || []).find((pg) => pg.strokes.length || pg.image);
    l.thumb = first ? await makeThumb(first) : null;
  }
  await store.saveLesson(l);
}
function closeLesson() {
  document.body.classList.remove("focus");
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  if (editingLesson) flushLesson(true);
  editor?.destroy(); editor = null; editingLesson = null; clearInterval(lessonTimer);
}

async function lessonPage(id) {
  const l = await store.getLesson(id);
  if (!l) { view.innerHTML = '<div class="page"><p>השיעור לא נמצא.</p><a href="#notebooks">חזרה למחברות</a></div>'; return; }
  editingLesson = l;
  let mode = "ink";
  try { mode = localStorage.getItem("sikumon-note-mode") || "ink"; } catch { /* */ }
  const ci = courseIndex(l.course);
  const recs = (await Promise.all((l.recIds || []).map((r) => store.getRecording(r)))).filter(Boolean);

  view.innerHTML = `<div class="page lesson">
    <a href="${ci >= 0 ? "#course-" + ci : "#notebooks"}" class="small">→ ${esc(l.course)}</a>
    <div class="lesson-head">
      <input class="title-input" id="ltitle" name="title" autocomplete="off" value="${esc(l.title)}" placeholder="${esc(lessonTitle(l))}" aria-label="שם השיעור">
      <span class="small muted">${fmtDay(l.date)}</span>
    </div>
    <div class="row" style="justify-content:space-between">
      <div class="seg" role="tablist" aria-label="סוג הכתיבה">
        <button role="tab" data-mode="ink" aria-selected="${mode === "ink"}">${svg("pen")} כתב יד</button>
        <button role="tab" data-mode="text" aria-selected="${mode === "text"}">${svg("type")} הקלדה</button>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn ghost small-btn" id="lrec">${svg("mic")} <span>הקלטה</span></button>
        <button class="btn ghost small-btn" id="lstar" hidden>⭐ <span></span></button>
        <button class="btn ghost small-btn" id="lshare">${svg("share")} <span>שיתוף</span></button>
        <button class="btn small-btn" id="lfull">${svg("expand")} <span>מסך מלא</span></button>
      </div>
    </div>
    <div id="inkArea" ${mode === "ink" ? "" : "hidden"}>
      <div class="toolbar" role="toolbar" aria-label="כלי כתיבה">
        <div class="tgroup">
          <button class="tool" data-tool="pen" aria-label="עט">${svg("pen")}</button>
          <button class="tool" data-tool="marker" aria-label="מרקר">${svg("marker")}</button>
          <button class="tool" data-tool="eraser" aria-label="מחק">${svg("eraser")}</button>
        </div>
        <div class="tgroup" id="swatches"></div>
        <div class="tgroup">${[0, 1, 2].map((k) => `<button class="tool size" data-size="${k}" aria-label="עובי ${["דק", "בינוני", "עבה"][k]}"><i style="width:${[4, 7, 11][k]}px;height:${[4, 7, 11][k]}px"></i></button>`).join("")}</div>
        <div class="tgroup">
          <button class="tool" id="undo" aria-label="בטל">${svg("undo")}</button>
          <button class="tool" id="redo" aria-label="בצע שוב">${svg("redo")}</button>
          <button class="tool" id="penOnly" aria-label="רק עט כותב, האצבע גוללת">${svg("hand")}</button>
          <button class="tool" id="fullExit" aria-label="יציאה ממסך מלא">${svg("shrink")}</button>
        </div>
      </div>
      <div class="sheets" id="sheets"></div>
      <div class="row" style="justify-content:center;margin-top:14px">
        <button class="btn ghost" data-add="lines">${svg("plus")} עמוד שורות</button>
        <button class="btn ghost" data-add="grid">${svg("plus")} עמוד משבצות</button>
        <label class="btn ghost">${svg("image")} תמונה / שקף<input type="file" id="addImg" accept="image/*" hidden></label>
      </div>
    </div>
    <div id="textArea" ${mode === "text" ? "" : "hidden"}>
      <textarea id="ltext" name="notes" class="note-text" dir="auto" autocomplete="off" placeholder="מקלידים כאן את הסיכום של השיעור…">${esc(l.text)}</textarea>
      <p class="small muted">באייפד אפשר לכתוב כאן גם בעט, ו-Scribble יהפוך את זה לטקסט.</p>
    </div>
    <section class="soft" id="lrecs">
      <h3>ההקלטות של השיעור</h3>
      ${recs.length ? recs.map((r) => `<a class="item" href="#rec-${r.id}" style="margin-top:10px"><span>הקלטה מ-<bdi>${new Date(r.startedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</bdi></span><span class="small muted"><bdi>${fmtTime(r.durationMs || 0)}</bdi></span></a>`).join("") : '<p class="muted small" style="margin-top:6px">אין הקלטה לשיעור הזה. לחצו "הקלטה" למעלה כדי להקליט בזמן שאתם כותבים.</p>'}
    </section>
    <div class="row"><button class="btn danger" id="ldel">${svg("trash")} <span>מחיקת השיעור</span></button></div>
  </div>`;

  // --- כתב יד ---
  editor = new InkEditor($("#sheets"), l.pages || []);
  l.pages = editor.pages;
  const paintTools = () => {
    view.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === editor.tool));
    view.querySelectorAll("[data-size]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.size === editor.size));
    const list = editor.tool === "marker" ? MARKER_COLORS : COLORS, curC = editor.tool === "marker" ? editor.markerColor : editor.color;
    $("#swatches").innerHTML = editor.tool === "eraser" ? '<span class="small muted" style="padding:0 6px">נוגעים בקו כדי למחוק אותו</span>' :
      list.map((c) => `<button class="tool swatch" data-color="${c}" aria-label="צבע" aria-pressed="${c === curC}"><i style="background:${c}"></i></button>`).join("");
    $("#swatches").querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => {
      if (editor.tool === "marker") editor.markerColor = b.dataset.color; else editor.color = b.dataset.color;
      paintTools();
    }));
    $("#undo").disabled = !editor.canUndo; $("#redo").disabled = !editor.canRedo;
    $("#penOnly").setAttribute("aria-pressed", editor.penOnly);
  };
  view.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => { editor.tool = b.dataset.tool; paintTools(); }));
  view.querySelectorAll("[data-size]").forEach((b) => (b.onclick = () => { editor.size = +b.dataset.size; paintTools(); }));
  $("#undo").onclick = () => editor.undo();
  $("#redo").onclick = () => editor.redo();
  $("#penOnly").onclick = () => { editor.setPenOnly(!editor.penOnly); toast(editor.penOnly ? "רק העט כותב. האצבע גוללת את הדף." : "עכשיו גם האצבע כותבת."); };
  editor.addEventListener("change", () => { paintTools(); l.pages = editor.pages; saveSoon(); });
  editor.addEventListener("penonly", () => { paintTools(); toast("זוהה עט: מעכשיו האצבע גוללת והעט כותב"); });
  view.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { editor.addPage(b.dataset.add).scrollIntoView({ behavior: "smooth", block: "start" }); }));
  $("#addImg").onchange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { (await editor.addImagePage(f)).scrollIntoView({ behavior: "smooth", block: "start" }); toast("התמונה נוספה כעמוד. אפשר לכתוב עליה"); }
    catch { toast("לא הצלחתי לפתוח את התמונה"); }
    e.target.value = "";
  };
  paintTools();

  // --- מסך מלא: רק הדף וסרגל הכלים, בלי תפריטים ---
  const setFull = async (on) => {
    document.body.classList.toggle("focus", on);
    try {
      const el = document.documentElement;
      if (on && !document.fullscreenElement) await (el.requestFullscreen?.() || el.webkitRequestFullscreen?.());
      if (!on && (document.fullscreenElement || document.webkitFullscreenElement)) await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
    } catch { /* באייפון אין מסך מלא של הדפדפן – מסתירים רק את התפריטים */ }
    if (on && mode !== "ink") view.querySelector('[data-mode="ink"]').click();
    setTimeout(() => editor?.layout(), 250);
    window.scrollTo(0, 0);
  };
  $("#lfull").onclick = () => setFull(true);
  $("#fullExit").onclick = () => setFull(false);
  document.onfullscreenchange = () => { if (!document.fullscreenElement && document.body.classList.contains("focus")) setFull(false); };

  // --- הקלדה ושם ---
  const grow = (t) => { t.style.height = "auto"; t.style.height = Math.max(320, t.scrollHeight + 4) + "px"; };
  $("#ltext").oninput = (e) => { l.text = e.target.value; grow(e.target); saveSoon(); };
  $("#ltitle").oninput = (e) => { l.title = e.target.value.trim(); saveSoon(); };
  view.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => {
    mode = b.dataset.mode;
    try { localStorage.setItem("sikumon-note-mode", mode); } catch { /* */ }
    view.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("#inkArea").hidden = mode !== "ink"; $("#textArea").hidden = mode !== "text";
    if (mode === "ink") editor.layout(); else grow($("#ltext"));
  }));
  if (mode === "text") grow($("#ltext"));

  // --- הקלטה מתוך הדף ---
  const paintRec = () => {
    const b = $("#lrec"); if (!b) return clearInterval(lessonTimer);
    const mine = recorder?.rec?.lessonId === l.id;
    b.classList.toggle("live", !!(mine && recorder.running));
    const st = $("#lstar"); if (st) { st.hidden = !(mine && recorder.running); st.onclick = starNow; st.lastElementChild.textContent = (recorder?.rec?.marks || []).length || "רגע חשוב"; }
    b.lastElementChild.textContent = !recorder ? "הקלטה" : !mine ? "מקליט בשיעור אחר" : recorder.running ? "עצירה · " + fmtTime(recorder.elapsedMs) : "המשך הקלטה";
  };
  $("#lrec").onclick = async () => {
    if (busy) return;
    try {
      if (!recorder) { busy = true; await startRecording(l.course, l.id); busy = false; l.recIds = (await store.getLesson(l.id)).recIds; }
      else if (recorder.rec.lessonId !== l.id) { location.hash = "record"; return; }
      else if (recorder.rec.status === "paused") { busy = true; await recorder.resume(); busy = false; }
      else { await flushLesson(); await finish(false); route(); return; }
    } catch (e) {
      busy = false;
      toast(e.name === "NotAllowedError" ? "צריך לאשר גישה למיקרופון. באייפון: הגדרות ← Safari ← מיקרופון." : "לא הצלחתי להקליט (" + e.name + ")");
    }
    paintRec();
  };
  paintRec(); clearInterval(lessonTimer); lessonTimer = setInterval(paintRec, 1000);

  // --- שיתוף: כל העמודים כתמונות + הטקסט ---
  $("#lshare").onclick = async () => {
    await flushLesson();
    const name = `${l.course} - ${lessonTitle(l)}`;
    const files = [];
    for (const [i, pg] of editor.pages.entries()) {
      if (!pg.strokes.length && !pg.image) continue;
      files.push(new File([await editor.pageToBlob(pg)], `${name} - עמוד ${i + 1}.png`, { type: "image/png" }));
    }
    const text = l.text?.trim() ? `${name}\n\n${l.text}` : name;
    try {
      if (files.length && navigator.canShare?.({ files })) await navigator.share({ files, title: name, text });
      else if (navigator.share) await navigator.share({ title: name, text });
      else if (files.length) files.forEach((f) => { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); });
      else { await navigator.clipboard.writeText(text); toast("הטקסט הועתק"); }
    } catch (e) { if (e.name !== "AbortError") toast("השיתוף לא הצליח"); }
  };

  // --- מחיקה (לחיצה שנייה לאישור) ---
  $("#ldel").onclick = async () => {
    const b = $("#ldel");
    if (!(await removeLesson(l))) return;
    editingLesson = null;
    location.hash = ci >= 0 ? "course-" + ci : "notebooks";
  };
}

// הקלטות ישנות (מלפני המחברות) נכנסות לשיעור לפי הקורס והתאריך
async function migrateRecordings() {
  for (const r of await store.listRecordings()) {
    if (r.lessonId) continue;
    const l = await lessonForToday(r.course, todayKey(new Date(r.startedAt)));
    l.recIds = [...new Set([...(l.recIds || []), r.id])];
    await store.saveLesson(l);
    r.lessonId = l.id;
    await store.saveRecording(r);
  }
}

// ----- סיכומים, סיכום ומבחן -----
function summary() {
  const s = demoSummary;
  view.innerHTML = `<div class="page summary">
    <a href="#summaries" class="small">→ כל הסיכומים</a>
    <div class="row"><span class="chip demo">דוגמה</span><span class="chip">${new Date(s.date).toLocaleDateString("he-IL")}</span></div>
    <h1 style="font-size:clamp(26px,4vw,36px)">${s.course}: ${s.title}</h1>
    <section class="card"><h2 style="margin-top:0">הנקודות המרכזיות</h2><ol style="margin-top:10px">${s.keyPoints.map((k) => `<li>${k}</li>`).join("")}</ol></section>
    ${s.sections.map((x) => `<section class="soft"><h3>${x.h}</h3><div style="margin-top:8px">${x.body}</div></section>`).join("")}
    <section class="soft"><h3>הודעות מהמרצה</h3><ul style="margin-top:8px">${s.announcements.map((a) => `<li>${a}</li>`).join("")}</ul></section>
    ${s.mathFormat ? `<section class="card"><h2 style="margin-top:0">דף הנוסחאות</h2><div class="list" style="margin-top:10px">${s.formulas.map((f) => `<div><div class="small"><b>${f.name}</b> ${f.today ? '<span class="star">⭐ השיעור</span>' : ""}</div><div class="formula">${f.f}</div></div>`).join("")}</div></section>` : ""}
    <a class="btn" href="#quiz">למבחן הקצר על השיעור</a>
  </div>`;
}

// ----- בדיקת מכשיר: בודק לבד את כל מה שהאפליקציה צריכה, ומפיק דוח לשליחה -----
async function diag() {
  const rows = [];
  view.innerHTML = `<div class="page">
    <a href="#profile" class="small">→ פרופיל</a>
    <h1 style="font-size:30px">בדיקת מכשיר</h1>
    <p class="muted">לחיצה אחת בודקת את כל מה שסיכומון צריך במכשיר הזה. בסוף שולחים את הדוח, וככה אפשר לראות מרחוק מה עובד ומה לא.</p>
    <div class="row"><button class="btn" id="runDiag">התחלת בדיקה</button></div>
    <div class="list" id="diagList"></div>
    <section class="soft" id="penBox" hidden><h3>בדיקת עט / אצבע</h3><p class="small muted">כתבו קו קטן בתוך המסגרת, עם העט ואחר כך עם האצבע.</p>
      <div id="penPad" class="pen-pad"></div><p class="small" id="penOut">עוד לא נגעת</p></section>
    <div class="row" id="diagShare" hidden><button class="btn" id="sendDiag">${svg("share")} שליחת הדוח</button><button class="btn ghost" id="copyDiag">העתקה</button></div>
  </div>`;
  const list = $("#diagList");
  const add = (name, ok, detail) => {
    rows.push({ name, ok, detail });
    list.insertAdjacentHTML("beforeend", `<div class="item"><span style="min-width:0"><span class="t">${ok === true ? "✅" : ok === false ? "❌" : "⚠️"} ${esc(name)}</span><br><span class="small muted">${esc(detail)}</span></span></div>`);
  };
  const pen = { pen: 0, touch: 0, mouse: 0, maxP: 0, minP: 1 };
  const report = () => {
    const ua = navigator.userAgent;
    const dev = /iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1 ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : "מחשב";
    const ios = (ua.match(/OS (\d+)_(\d+)/) || ua.match(/Version\/(\d+)\.(\d+)/) || []).slice(1, 3).join(".");
    let errs = [];
    try { errs = JSON.parse(localStorage.getItem("sikumon-errors") || "[]"); } catch { /* */ }
    return [`דוח בדיקת מכשיר – סיכומון (${new Date().toLocaleString("he-IL")})`, `מכשיר: ${dev}, גרסה ${ios || "?"}, מסך ${screen.width}×${screen.height}`,
      ...rows.map((r) => `${r.ok === true ? "✅" : r.ok === false ? "❌" : "⚠️"} ${r.name}: ${r.detail}`),
      `עט: נגיעות עט ${pen.pen}, אצבע ${pen.touch}, לחץ ${pen.pen ? pen.minP.toFixed(2) + "–" + pen.maxP.toFixed(2) : "-"}`,
      `תקלות אחרונות: ${errs.length ? errs.slice(-5).map((x) => `[${x.at.slice(5, 16)}] ${x.where}: ${x.msg.split("\n")[0]}`).join(" | ") : "אין"}`,
      `UA: ${ua}`].join("\n");
  };

  // משטח לבדיקת העט: מזהה עט / אצבע ורגישות ללחץ
  const pad = $("#penPad");
  pad.addEventListener("pointerdown", (e) => { e.preventDefault(); pad.setPointerCapture(e.pointerId); });
  pad.addEventListener("pointermove", (e) => {
    if (!e.buttons && e.pointerType === "mouse") return;
    pen[e.pointerType] = (pen[e.pointerType] || 0) + 1;
    if (e.pointerType === "pen" && e.pressure) { pen.maxP = Math.max(pen.maxP, e.pressure); pen.minP = Math.min(pen.minP, e.pressure); }
    $("#penOut").textContent = pen.pen ? `✅ עט זוהה. לחץ בין ${pen.minP.toFixed(2)} ל-${pen.maxP.toFixed(2)} ${pen.maxP - pen.minP > 0.15 ? "(רגישות ללחץ עובדת)" : "(נסו ללחוץ חזק ואז חלש)"}` : `זוהתה ${e.pointerType === "touch" ? "אצבע" : "עכבר"}. נסו גם עם העט.`;
  });

  $("#runDiag").onclick = async () => {
    $("#runDiag").disabled = true; $("#runDiag").textContent = "בודק…";
    list.innerHTML = ""; rows.length = 0;
    const s = support();
    add("כתובת מאובטחת", s.secure, s.secure ? "https – המיקרופון מותר" : "לא https – המיקרופון ייחסם");
    add("מותקן כאפליקציה", s.standalone ? true : null, s.standalone ? "נפתח ממסך הבית" : "נפתח בדפדפן. מומלץ: שיתוף ← הוסף למסך הבית");
    // אחסון
    try {
      const id = "diag-" + Date.now();
      await store.putItem({ id, type: "diag" }); const back = await store.getItem(id); await store.deleteItem(id);
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      add("שמירה במכשיר", !!back, `${back ? "כתיבה וקריאה עובדות" : "לא נקרא בחזרה"}${est ? ` · בשימוש ${fmtMB(est.usage || 0)} מתוך ${fmtMB(est.quota || 0)}` : ""} · ${persisted ? "מוגן ממחיקה אוטומטית" : "לא מוגן ממחיקה (נשמר עדיין)"}`);
    } catch (e) { add("שמירה במכשיר", false, e.message); }
    // מיקרופון והקלטה של 4 שניות
    if (!s.mic || !s.recorder) add("מיקרופון והקלטה", false, "הדפדפן לא תומך בהקלטה");
    else if (recorder) add("מיקרופון והקלטה", null, "יש הקלטה פעילה – מדלגים כדי לא להפריע לה");
    else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream, s.mime ? { mimeType: s.mime } : undefined);
        const parts = [];
        mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
        const stopped = new Promise((r) => (mr.onstop = r));
        mr.start(1000); await new Promise((r) => setTimeout(r, 4000)); mr.stop(); await stopped;
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(parts, { type: mr.mimeType });
        const dur = await new Promise((res) => { const a = new Audio(); a.preload = "metadata"; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(NaN); a.src = URL.createObjectURL(blob); setTimeout(() => res(NaN), 4000); });
        add("מיקרופון והקלטה", blob.size > 1000, `${parts.length} חתיכות, ${(blob.size / 1024).toFixed(0)} KB, ${mr.mimeType || "?"}${isFinite(dur) ? `, ${dur.toFixed(1)} שניות` : ""}`);
      } catch (e) { add("מיקרופון והקלטה", false, e.name === "NotAllowedError" ? "אין אישור למיקרופון (הגדרות ← Safari ← מיקרופון)" : e.name + ": " + e.message); }
    }
    // מסך דלוק
    try { const w = await navigator.wakeLock.request("screen"); await w.release(); add("השארת המסך דלוק", true, "עובד – המסך לא ייכבה בזמן הקלטה"); }
    catch (e) { add("השארת המסך דלוק", null, "לא נתמך כאן. בזמן שיעור: הגדרות ← תצוגה ← נעילה אוטומטית ← אף פעם"); }
    // חיבור למודל דרך המחשב
    if (!study.getCode()) add("חיבור למודל", null, "עוד לא הוזן קוד צימוד (סיכומים ← חיבור אוטומטי)");
    else {
      try { const r = await study.syncNow(); const p = prefs.get(); add("חיבור למודל", true, `התקבל עדכון מהמחשב: ${r.summaries} סיכומים, ${r.quizzes} מבחנים${p.lastSyncPack ? ` · נוצר ${new Date(p.lastSyncPack).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}`); }
      catch (e) { add("חיבור למודל", false, e.message); }
    }
    // מה יש במכשיר
    const [recs, lessons, items] = await Promise.all([store.listRecordings(), store.listLessons(), store.listItems()]);
    add("תוכן באפליקציה", true, `${recs.length} הקלטות, ${lessons.length} שיעורים במחברות, ${items.filter((x) => x.type === "summary").length} סיכומים, ${items.filter((x) => x.type === "quiz").length} מבחנים`);
    $("#penBox").hidden = false; $("#diagShare").hidden = false;
    $("#runDiag").disabled = false; $("#runDiag").textContent = "בדיקה חוזרת";
  };
  $("#sendDiag").onclick = async () => {
    const text = report();
    try { if (navigator.share) { await navigator.share({ title: "דוח בדיקת מכשיר – סיכומון", text }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); toast("הדוח הועתק"); } catch { toast("לא הצלחתי לשתף. צלמו מסך"); }
  };
  $("#copyDiag").onclick = async () => { try { await navigator.clipboard.writeText(report()); toast("הדוח הועתק. הדביקו אותו לקלוד"); } catch { toast("לא הצלחתי להעתיק"); } };
}

function timetable() {
  const p = prefs.get();
  const rows = [...(p.timetable || [])].sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  const courses = p.courses || [];
  const row = (x, k) => `<div class="tt-row" data-k="${k}">
    <select class="tt-day" aria-label="יום">${DAYS.slice(0, 6).map((d, i) => `<option value="${i}" ${+x.day === i ? "selected" : ""}>${d}</option>`).join("")}</select>
    <input type="time" class="tt-start" value="${x.start}" aria-label="שעת התחלה"><span>עד</span><input type="time" class="tt-end" value="${x.end}" aria-label="שעת סיום">
    <select class="tt-course" aria-label="קורס">${courses.map((c) => `<option ${c === x.course ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <button class="link tt-del" aria-label="מחיקת השיעור מהמערכת">${svg("trash")}</button></div>`;
  view.innerHTML = `<div class="page">
    <a href="#profile" class="small">→ פרופיל</a>
    <h1 style="font-size:30px">מערכת השעות שלי</h1>
    <p class="muted">לפי המערכת, כשלוחצים "הקלט" האפליקציה יודעת לבד איזה שיעור עכשיו, וההקלטה נכנסת ישר למחברת של אותו קורס.</p>
    <div class="list" id="ttList">${rows.map(row).join("") || '<p class="muted">עוד אין שיעורים במערכת.</p>'}</div>
    <div class="row"><button class="btn ghost" id="ttAdd">${svg("plus")} שיעור במערכת</button><button class="btn" id="ttSave">שמירה</button></div>
  </div>`;
  $("#ttAdd").onclick = () => {
    if (!courses.length) { toast("צריך קודם קורס אחד לפחות במחברות"); return; }
    const k = Date.now();
    $("#ttList").querySelector("p")?.remove();
    $("#ttList").insertAdjacentHTML("beforeend", row({ day: new Date().getDay() % 6, start: "09:00", end: "12:00", course: courses[0] }, k));
    bindDel();
  };
  const bindDel = () => view.querySelectorAll(".tt-del").forEach((b) => (b.onclick = () => b.closest(".tt-row").remove()));
  bindDel();
  $("#ttSave").onclick = () => {
    const tt = [...view.querySelectorAll(".tt-row")].map((r) => ({ day: +r.querySelector(".tt-day").value, start: r.querySelector(".tt-start").value, end: r.querySelector(".tt-end").value, course: r.querySelector(".tt-course").value }))
      .filter((x) => x.start && x.end && toMin(x.end) > toMin(x.start));
    const pr = prefs.get(); pr.timetable = tt; pr.timetableEdited = true; prefs.set(pr);
    toast("מערכת השעות נשמרה"); timetable();
  };
}

function profile() {
  const p = prefs.get();
  const rows = onboardingQuestions.map((q) => `<div class="item"><span class="muted small">${q.q}</span><b>${esc(p[q.id] || "–")}</b></div>`).join("");
  const s = support();
  view.innerHTML = `<div class="page">
    <h1 style="font-size:32px">הפרופיל שלי</h1>
    <div class="soft"><b>${esc(p.name || "")}</b> · ${esc(p.inst || "")}</div>
    <h2 style="font-size:22px">איך אני לומד/ת</h2><div class="list">${rows}</div>
    <h2 style="font-size:22px">הקורסים</h2><div class="soft">${(p.courses || []).map(esc).join(" · ")}</div>
    <a class="item" href="#timetable"><span><span class="t">🕘 מערכת השעות</span><br><span class="small muted">${(p.timetable || []).length ? (p.timetable.length + " שיעורים בשבוע · ההקלטות נכנסות לבד לקורס הנכון") : "עוד לא הוגדרה. בלעדיה בוחרים קורס ידנית בכל הקלטה"}</span></span></a>
    <div class="row"><button class="btn ghost" id="redo">לענות מחדש על השאלון</button><a class="btn" href="#feedback">${svg("share")} שליחת משוב</a></div>
    <div class="soft small"><b>פרטיות:</b> בגרסת הבדיקה הכול נשמר רק במכשיר שלך: התשובות, הקורסים וההקלטות. שום דבר לא נשלח לשרת. משוב נשלח רק כשאתם לוחצים "שליחה" ובוחרים למי.</div>
    <a class="item" href="#diag"><span><span class="t">🩺 בדיקת מכשיר</span><br><span class="small muted">בודק מיקרופון, הקלטה, שמירה, עט וחיבור למודל, ומפיק דוח</span></span></a>
    <div class="soft small" hidden><b>בדיקת מכשיר:</b> מיקרופון ${s.mic ? "✓" : "✗"} · הקלטה ${s.recorder ? "✓" : "✗"} (${esc(s.mime || "לא ידוע")}) · מסך דלוק ${s.wakeLock ? "✓" : "✗"} · מותקן כאפליקציה ${s.standalone ? "✓" : "✗"}</div>
    ${!s.standalone ? '<p class="notice"><b>להתקנה באייפד/אייפון:</b> ב-Safari לוחצים על כפתור השיתוף ובוחרים "הוסף למסך הבית".</p>' : ""}
  </div>`;
  $("#redo").onclick = () => onboarding(0);
}

// ---------- ניתוב ----------
async function route() {
  try { await routeInner(); }
  catch (e) {
    // במקום מסך ריק: הודעה ברורה, כפתור רענון, ופרטים לדוח תקלה
    logError("route " + location.hash, e);
    view.innerHTML = `<div class="page"><h1 style="font-size:28px">משהו השתבש במסך הזה</h1>
      <p class="muted">הנתונים שלך שמורים. אפשר לנסות שוב, ואם זה חוזר – שלחו לנו את הפרטים מ"בדיקת מכשיר" בפרופיל.</p>
      <div class="row"><button class="btn" onclick="location.reload()">רענון</button><a class="btn ghost" href="#home">למסך הבית</a></div>
      <pre class="small muted" style="white-space:pre-wrap;direction:ltr;text-align:left">${esc(e?.message || e)}</pre></div>`;
  }
}
async function routeInner() {
  let hash = location.hash.slice(1) || "home";
  try { hash = decodeURIComponent(hash); } catch { /* כתובת לא תקינה */ }
  if (!prefs.get()) return onboarding(0);
  if (!hash.startsWith("lesson-")) closeLesson();
  const tab = hash.startsWith("sum") || hash === "summary" || hash === "deadlines" || hash === "exam-focus" ? "summaries" : hash.startsWith("reels") ? "notebooks" : hash.startsWith("sum") || hash === "summary" ? "summaries" : hash.startsWith("quiz") ? "quizzes" : hash.startsWith("rec-") || hash.startsWith("course-") || hash.startsWith("lesson-") || hash === "recordings" ? "notebooks" : hash === "summary" || hash === "quiz" ? "summaries" : hash === "feedback" || hash === "diag" || hash === "timetable" ? "profile" : hash;
  renderTabs(tab);
  if (hash === "home") await home();
  else if (hash === "record") record();
  else if (hash === "recordings") await recordings();
  else if (hash.startsWith("rec-")) await recordingDetail(hash.slice(4));
  else if (hash === "summaries") {
    await study.summaries();
    const nx = (await extras.upcoming())[0];
    view.querySelector(".page h1")?.insertAdjacentHTML("afterend", `<div class="grid2">
      <a class="card star-card" href="#exam-focus"><h3>⭐ מה יהיה במבחן</h3><p class="small muted">כל מה שהמרצים אמרו שחשוב, מכל הסיכומים</p></a>
      <a class="card" href="#deadlines"><h3>⏳ לוח מבחנים והגשות</h3><p class="small muted">${nx ? esc(nx.title) + " · " + extras.inDays(extras.daysTo(nx.when)) : "הוסיפו את תאריכי המבחנים"}</p></a></div>`);
  }
  else if (hash === "summary") summary();
  else if (hash.startsWith("sum-")) await study.summaryPage(hash.slice(4));
  else if (hash === "quizzes") await study.quizzes();
  else if (hash === "quiz-new") study.quizEditor();
  else if (hash.startsWith("quiz-mix-")) await study.mixQuiz(+hash.slice(9));
  else if (hash === "quiz") await study.quizById("demo");
  else if (hash.startsWith("quiz-")) await study.quizById(hash.slice(5));
  else if (hash === "profile") profile();
  else if (hash === "feedback") feedback();
  else if (hash === "diag") await diag();
  else if (hash === "timetable") timetable();
  else if (hash === "deadlines") await extras.deadlinesScreen();
  else if (hash === "exam-focus") await extras.examFocus();
  else if (hash === "reels") await extras.reels();
  else if (hash.startsWith("reels-")) await extras.reels(hash.slice(6));
  else if (hash === "notebooks") await notebooks();
  else if (hash.startsWith("course-")) await courseFolder(+hash.slice(7));
  else if (hash.startsWith("lesson-")) { closeLesson(); await lessonPage(hash.slice(7)); }
  else await home();
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
const study = initStudy({ view, $, esc, svg, toast, prefs, store, demoQuiz });
const extras = initExtras({ view, $, esc, svg, toast, prefs, store, segmentsOf, fmtTime });
window.addEventListener("hashchange", route);
// אזהרה לפני סגירה באמצע הקלטה
window.addEventListener("beforeunload", (e) => { if (recorder?.running) { e.preventDefault(); e.returnValue = ""; } });
// אם האפליקציה נסגרה באמצע הקלטה בפעם הקודמת, מסמנים אותה כנקטעה ואז מציגים
// שמירה לפני יציאה מהאפליקציה (באייפד: מעבר לאפליקציה אחרת)
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushLesson(true); });
window.addEventListener("pagehide", () => flushLesson());
recoverOrphans().then(migrateRecordings).catch(() => {}).finally(route);
let lastAutoSync = 0;
async function autoSync() {
  if (!study.getCode() || Date.now() - lastAutoSync < 10 * 60e3 || editingLesson || recorder?.running) return;
  lastAutoSync = Date.now();
  try {
    const r = await study.syncNow();
    if (r?.fresh && ["#home", "#summaries", "#quizzes", "#notebooks", ""].includes(location.hash)) { route(); toast("עודכן מהמודל"); }
  } catch { /* בלי אינטרנט – ננסה בפעם הבאה */ }
}
setTimeout(autoSync, 1500);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") autoSync(); });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
