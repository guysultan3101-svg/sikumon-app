// Clearly – האפליקציה (גרסת בדיקה). ניווט לפי # בכתובת, כל מסך הוא פונקציה שמציירת HTML.
import { LessonRecorder, store, segmentsOf, support, recoverOrphans } from "./recorder.js";
import { quizzesLeft } from "./limits.js";
import { demoSummary, demoQuiz, onboardingQuestions } from "./demo-data.js";
import { InkEditor, COLORS, MARKER_COLORS, pdfToPages, makeThumb, imgBoxOf } from "./notes.js";
import { initStudy } from "./study.js";
import { initExtras } from "./extras.js";
import { initPractice } from "./practice.js";
import { initPlanner } from "./planner.js";
import { initTools } from "./tools.js";
import { initSocial } from "./social.js";
import { initSettings } from "./settings.js";
import { initAssistant } from "./assistant.js";
import { initAssignments } from "./assignments.js";
import * as ai from "./ai.js";
import * as api from "./api.js";

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
  line: '<path d="M4 20 20 4"/><path d="M8 20l-4-4M20 8l-4-4"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
  arrow: '<path d="M5 19 19 5M10 5h9v9"/>',
  lasso: '<path d="M12 4c5 0 9 2.5 9 6s-4 6-9 6-9-2.5-9-6 4-6 9-6z" stroke-dasharray="3 3"/><path d="M7 15c-2 2-1 5 2 5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-5-2.5L3.5 15a1.5 1.5 0 0 1 2.3-2L7 14"/>',
  type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  check: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 12l3 3 5-6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5"/><path d="M5 20h14"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

const TABS = [
  { hash: "home", label: "בית", icon: "home" },
  { hash: "social", label: "חברים", icon: "users" },
  { hash: "notebooks", label: "מחברות", icon: "folder" },
  { hash: "record", label: "הקלטה", icon: "mic", cls: "rec-tab" },
  { hash: "calendar", label: "יומן", icon: "cal" },
  { hash: "summaries", label: "סיכומים", icon: "book" },
  { hash: "quizzes", label: "מבחנים", icon: "check" },
  { hash: "assignments", label: "הגשת עבודות", icon: "upload" },
  { hash: "messages", label: "הודעות", icon: "chat", cls: "hide-phone" },
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
      <h1 style="font-size:clamp(32px,5vw,48px)">נתאים את <span class="mark">Clearly</span> בדיוק אלייך</h1>
      <p class="muted">חמש שאלות קצרות על איך שאת/ה לומד/ת, ואז כמה פרטים על הקורסים. לוקח פחות מדקה.</p>
      <label class="field">איך לקרוא לך?<input type="text" id="name" name="name" autocomplete="given-name" placeholder="השם הפרטי שלך" value="${esc((api.profile()?.full_name || "").split(" ")[0])}"></label>
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
    <p class="muted">שורה לכל קורס. אפשר לשנות אחר כך בהגדרות ← לימודים.</p>
    <textarea id="courses" name="courses" rows="7" autocomplete="off" placeholder="מבוא לכלכלה מיקרו&#10;מתמטיקה לכלכלנים א&#10;יסודות החשבונאות"></textarea>
    <div class="row"><button class="btn" id="done">סיום</button></div>
  </div>`;
  $("#done").onclick = () => {
    const courses = $("#courses").value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!courses.length) { toast("כתבו לפחות קורס אחד (שורה לכל קורס)"); return; }
    prefs.set({ ...answers, courses, createdAt: new Date().toISOString() });
    social.pushPrefs(); api.track("onboarding_done");
    // אם הכתובת כבר #home – אין "מעבר", אז מציירים את הבית ידנית
    if (location.hash === "#home") route(); else location.hash = "home";
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
  const gaps = await practice.missing();
  const tq = await tools.openQuestions();
  const lastSum = items.filter((x) => x.type === "summary" && x.kind !== "formulas").sort((a, b) => b.date.localeCompare(a.date))[0];
  const quizCount = items.filter((x) => x.type === "quiz").length;
  const recent = (await store.listLessons()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 3);
  view.innerHTML = `<div class="page">
    <div>
      <p class="eyebrow">${new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p>
      <div class="row" style="justify-content:space-between;margin-top:8px"><h1 style="font-size:clamp(30px,5vw,44px)">היי${p.name ? " " + esc(p.name) : ""}${(p.streak || 0) > 1 && p.streakDay >= new Date(Date.now() - 864e5).toLocaleDateString("en-CA") ? ` <span class="streak">🔥 ${p.streak}</span>` : ""}</h1><span class="row" style="gap:4px"><a href="#messages" class="tool show-phone bell" aria-label="הודעות מחברים">${svg("chat")}<span class="dm-n" hidden></span></a><a href="#search" class="tool" aria-label="חיפוש בכל החומר">${svg("search")}</a><a href="#inbox" class="tool bell" aria-label="הודעות">${svg("bell")}<span class="bell-n" hidden></span></a><a href="#profile" class="tool show-phone" aria-label="פרופיל">${svg("user")}</a></span></div>
    </div>
    <a class="card" href="#record" style="text-decoration:none;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:16px">
      <div><h2 style="font-size:24px">${nowSlot ? "עכשיו: " + esc(nowSlot.course) : "מתחיל שיעור?"}</h2><p class="muted">${nowSlot ? `<bdi>${nowSlot.start}–${nowSlot.end}</bdi> · לחיצה אחת, וההקלטה נכנסת ישר למחברת של הקורס.` : "לחיצה אחת ומתחילים להקליט. ההקלטה נכנסת למחברת של השיעור."}</p></div>
      <span class="rec-btn" style="width:84px;height:84px;box-shadow:3px 3px 0 var(--ink);flex:none">${svg("mic")}</span>
    </a>
    ${news && news.length ? `<section class="soft"><div class="row" style="justify-content:space-between"><h3>חדש במודל <span class="chip new">${news.length}</span></h3><a class="small" href="#notebooks">לפי קורסים</a></div><div class="list" style="margin-top:10px">${news.slice(0, 5).map((it) => study.moodleItem(it, true)).join("")}</div></section>` : ""}
    ${next.length ? `<section class="soft"><div class="row" style="justify-content:space-between"><h3>⏳ הבא בתור</h3><a class="small" href="#deadlines">לוח מבחנים</a></div><div class="list" style="margin-top:10px">${next.map((x) => `<a class="item" href="#deadlines"><span style="min-width:0"><span class="t">${x.kind === "exam" ? "📝" : "📌"} ${esc(x.title)}</span><br><span class="small muted">${esc(x.course)}</span></span>${extras.chip(x)}</a>`).join("")}</div></section>` : ""}
    ${tq.length ? `<a class="item" href="#questions"><span style="min-width:0"><span class="t">🙋 ${tq.length} שאלות למתרגל</span><br><span class="small muted">${esc(tq[0].course)}: ${esc(tq[0].text)}</span></span></a>` : ""}
    ${gaps.length ? `<a class="item" href="#missing"><span style="min-width:0"><span class="t">📋 להשלים: ${gaps.length} דברים</span><br><span class="small muted">${esc(gaps[0].text)}</span></span></a>` : ""}
    ${hasMarks ? `<a class="item" href="#reels"><span><span class="t">🎬 הרגעים החשובים מהשיעורים</span><br><span class="small muted">קטע של דקה סביב כל ⭐ שסימנת</span></span></a>` : ""}
    ${study.getCode() ? "" : `<div class="grid2"><a class="card" href="#upload"><b class="card-t">📄 סיכום ממצגת</b><p class="small muted">מעלים מצגת או PDF של שיעור ומקבלים סיכום אישי + מבחן</p></a><a class="card" href="#connect"><b class="card-t">🔗 חיבור למודל</b><p class="small muted">תוסף לכרום במחשב – כל קובץ חדש במודל מסוכם לבד</p></a></div>`}
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
        ${lastSum ? `<a class="item" href="#sum-${esc(lastSum.id)}" style="margin-top:12px"><span style="min-width:0"><span class="t">${esc(lastSum.course)}</span><br><span class="small muted">${esc(lastSum.title)}</span></span></a>` : `<a class="item" href="#upload" style="margin-top:12px"><span><span class="t">📄 הסיכום הראשון שלך</span><br><span class="small muted">מעלים מצגת או PDF של שיעור</span></span></a>`}
      </section>
      <section class="soft"><h3>המבחנים שלי</h3>
        <a class="item" href="${quizCount ? "#quizzes" : "#upload"}" style="margin-top:12px"><span><span class="t">${quizCount ? quizCount + " מבחנים מחכים לך" : "עוד אין מבחנים"}</span><br><span class="small muted">${quizCount ? "על כל סיכום, וגם מבחנים שתכתוב בעצמך" : "מבחן קצר נוצר לבד עם כל סיכום"}</span></span></a>
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
    <p class="muted">ארבע שאלות ושורה חופשית. המשוב נשלח ישר אלינו.</p>
    ${feedbackQs.map((q) => `<fieldset class="soft fs"><legend>${q.q}</legend><div class="options">${q.options.map((o, i) => `<button type="button" class="opt" data-q="${q.id}" data-i="${i}" aria-pressed="false">${o}</button>`).join("")}</div></fieldset>`).join("")}
    <label class="field">מה הכי חסר, או מה הכי הפריע?<textarea id="free" name="free" rows="4" autocomplete="off" placeholder="למשל: הייתי רוצה שהסיכום יגיע גם למייל…"></textarea></label>
    <div class="row"><button class="btn" id="send">שליחת המשוב</button></div>
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
    const text = ["משוב על Clearly (גרסת בדיקה)", `מוסד: ${p.inst || "–"}`,
      ...feedbackQs.map((q) => `${q.q} ${ans[q.id] || "–"}`),
      `חופשי: ${$("#free").value.trim() || "–"}`,
      `הקלטות: ${recs.length}, הארוכה: ${fmtTime(longest)}, קטיעות: ${recs.reduce((a, r) => a + (r.interruptions?.length || 0), 0)}`,
      `מכשיר: ${/iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 ? "iPad" : /iPhone/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "מחשב"}, מותקן: ${s.standalone ? "כן" : "לא"}`].join("\n");
    try { await api.sendFeedback({ ...ans, free: $("#free").value.trim(), text }); toast("תודה! המשוב נשלח ועוזר לנו מאוד 🙏"); location.hash = "#home"; }
    catch (e) { toast("המשוב לא נשלח: " + e.message); }
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
    ? '<ol class="steps small" style="margin:6px 0 0"><li>לוחצים על <b>כפתור השיתוף</b> למעלה <span aria-hidden="true">(ריבוע עם חץ ⬆️)</span>.</li><li>גוללים קצת ובוחרים <b>"הוסף למסך הבית"</b>.</li><li>לוחצים <b>"הוסף"</b>. זהו – Clearly מופיע במסך הבית כמו כל אפליקציה.</li></ol>'
    : '<ol class="steps small" style="margin:6px 0 0"><li>בשורת הכתובת למעלה, בצד ימין, לוחצים על הסמל <b>⊕</b> או <b>"התקנה"</b>.</li><li>לוחצים <b>"התקנה"</b>. זהו.</li></ol>';
  return `<div class="notice install"><div><b>📲 התקינו את Clearly כמו אפליקציה (חצי דקה):</b>${how}</div><button class="link" id="hideInstall">הבנתי</button></div>`;
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

// ----- 💬 שאל את השיעור + 🪄 הסבר נוסף (AI) -----
async function attachAI(id) {
  const sum = await store.getItem(id);
  const page = view.querySelector(".page"); if (!sum || !page) return;
  const lessonText = ai.htmlToText(sum.html);
  const hasKey = ai.hasAI();
  page.insertAdjacentHTML("beforeend", `<section class="card chat" id="chat">
    <h2 style="font-size:21px">💬 שאל את השיעור</h2>
    ${hasKey ? `<p class="small muted">שואלים כל שאלה על השיעור הזה, ומקבלים הסבר לפי החומר. אפשר גם לסמן משפט בסיכום ולבקש הסבר נוסף.</p>
    <div class="chat-log" id="chatLog" aria-live="polite"></div>
    <div class="chips-row" id="chatSugg">${["לא הבנתי את הנושא המרכזי, תסביר שוב", "תן לי דוגמה מספרית", "מה הכי חשוב לזכור מהשיעור למבחן?", "תשאל אותי שאלה לבדוק שהבנתי"].map((q) => `<button class="chip-btn" data-q="${q}">${q}</button>`).join("")}</div>
    <form class="chat-form" id="chatForm"><textarea id="chatIn" name="question" rows="2" placeholder="למשל: מה ההבדל בין עלות שולית לעלות ממוצעת…" autocomplete="off"></textarea><button class="btn" id="chatSend">שליחה</button></form>`
    : `<p class="notice">כדי להשתמש, מחברים פעם אחת AI חינמי בהגדרות. <a href="#settings-ai">לחיבור</a></p>`}
  </section>`);
  // כפתור "הסבר נוסף" ליד כל כותרת בסיכום
  view.querySelectorAll(".md-body h2").forEach((h) => h.insertAdjacentHTML("beforeend", ` <button class="explain-btn" aria-label="הסבר נוסף על החלק הזה">🪄 הסבר נוסף</button>`));
  const history = [];
  let ctrl = null;
  const send = async (question) => {
    if (!hasKey) { location.hash = "settings-ai"; toast("קודם מחברים AI בהגדרות"); return; }
    if (ctrl) return;
    const log = $("#chatLog");
    log.insertAdjacentHTML("beforeend", `<div class="bubble me">${esc(question)}</div><div class="bubble bot"><span class="typing">חושב…</span></div>`);
    const bot = log.lastElementChild;
    // גוללים לשאלה החדשה, כך שהשאלה והתשובה שלה מול העיניים
    bot.previousElementSibling.scrollIntoView({ behavior: "smooth", block: "start" });
    let text = "";
    ctrl = new AbortController();
    $("#chatSend").textContent = "עצירה";
    try {
      const full = await ai.ask({ lessonTitle: sum.title, lessonText, history, question, signal: ctrl.signal, onText: (t) => { text += t; bot.innerHTML = ai.miniMd(text); } });
      history.push({ role: "user", content: question }, { role: "assistant", content: full });
      bot.innerHTML = ai.miniMd(full);
    } catch (e) {
      if (e.code !== "abort") bot.innerHTML = `<span class="err">${esc(e.message)}</span>`;
      else if (text) history.push({ role: "user", content: question }, { role: "assistant", content: text });
    } finally { ctrl = null; $("#chatSend") && ($("#chatSend").textContent = "שליחה"); }
  };
  if (hasKey) {
    $("#chatForm").onsubmit = (e) => {
      e.preventDefault();
      if (ctrl) { ctrl.abort(); return; }
      const q = $("#chatIn").value.trim(); if (!q) return;
      $("#chatIn").value = ""; send(q);
    };
    $("#chatIn").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); } };
    view.querySelectorAll("#chatSugg [data-q]").forEach((b) => (b.onclick = () => send(b.dataset.q)));
  }
  view.querySelectorAll(".explain-btn").forEach((b) => (b.onclick = () => {
    const h = b.closest("h2"); let t = h.textContent.replace("🪄 הסבר נוסף", "").trim() + "\n";
    for (let el = h.nextElementSibling; el && el.tagName !== "H2"; el = el.nextElementSibling) t += el.textContent + "\n";
    send("תסביר לי את החלק הזה מהשיעור בצורה פשוטה יותר, עם דוגמה:\n\n" + t.trim().slice(0, 2500));
  }));
  // סימון טקסט בסיכום -> סרגל "הסבר נוסף"
  const bar = document.createElement("div"); bar.className = "sel-bar"; bar.hidden = true;
  bar.innerHTML = `<button class="btn small-btn" data-m="simple">🪄 תסביר פשוט יותר</button><button class="btn ghost small-btn" data-m="example">📝 תן דוגמה</button>`;
  document.body.appendChild(bar);
  let picked = "";
  const onSel = () => {
    const sel = getSelection(); const t = sel?.toString().trim() || "";
    const inside = sel?.rangeCount && view.querySelector(".md-body")?.contains(sel.getRangeAt(0).commonAncestorContainer);
    picked = inside && t.length > 3 ? t : ""; bar.hidden = !picked;
  };
  document.addEventListener("selectionchange", onSel);
  bar.querySelectorAll("button").forEach((b) => (b.onpointerdown = (e) => {
    e.preventDefault(); if (!picked) return;
    const q = b.dataset.m === "simple" ? `תסביר לי בפשטות את זה מהשיעור: "${picked}"` : `תן לי דוגמה פשוטה (אם אפשר עם מספרים) ל: "${picked}"`;
    bar.hidden = true; getSelection().removeAllRanges(); send(q);
  }));
  window.addEventListener("hashchange", () => { document.removeEventListener("selectionchange", onSel); bar.remove(); ctrl?.abort(); }, { once: true });
}

// ----- 🎧 פודקאסטים: שני מגישים (נועה ואיתי) משוחחים על כל שיעור -----
async function podcastsList(course = null) { return ((await store.getItem("podcasts"))?.items || []).filter((p) => !course || p.course === course); }
const podMin = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function podCard(p, withCourse = true) {
  return `<div class="pod" data-pod="${esc(p.id)}"><button class="pod-play" aria-label="השמעה">▶</button><span style="min-width:0;flex:1"><span class="t">${esc(p.title)}</span><br><span class="small muted">${withCourse ? esc(p.course) + " · " : ""}🎧 <bdi>${podMin(p.seconds || 0)}</bdi> · נועה ואיתי</span></span></div>`;
}
// נגן אחד לכל האפליקציה: נשאר למטה גם כשעוברים מסך
let podAudio = null;
async function playPodcast(p) {
  try {
    toast("טוען את הפרק…");
    const blob = await study.podcastAudio(p);
    if (!podAudio) { podAudio = new Audio(); }
    podAudio.src = URL.createObjectURL(blob);
    $("#podBar")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="pod-bar" id="podBar"><span class="t">🎧 ${esc(p.title)}</span><audio controls id="podEl"></audio><select id="podRate" aria-label="מהירות"><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option></select><button class="tool" id="podX" aria-label="סגירה">✕</button></div>`);
    const el = $("#podEl"); el.src = podAudio.src; podAudio = el;
    $("#podRate").onchange = () => (el.playbackRate = +$("#podRate").value);
    $("#podX").onclick = () => { el.pause(); $("#podBar").remove(); };
    await el.play().catch(() => {});
  } catch (e) { toast(e.message); }
}
function bindPods(list) {
  view.querySelectorAll("[data-pod]").forEach((el) => (el.querySelector(".pod-play").onclick = () => { const p = list.find((x) => x.id === el.dataset.pod); if (p) playPodcast(p); }));
}
async function podcastsPage() {
  const list = await podcastsList();
  const by = list.reduce((m, p) => ((m[p.course] = m[p.course] || []).push(p), m), {});
  view.innerHTML = `<div class="page">
    <h1 style="font-size:30px">🎧 פודקאסטים על השיעורים</h1>
    <p class="muted">פרק קצר על כל שיעור (5–7 דקות): נועה ואיתי מסבירים אחד לשני את החומר, עם דוגמאות. מושלם לאוטובוס לאוניברסיטה.</p>
    ${Object.entries(by).map(([c, l]) => `<section class="soft"><h2 style="font-size:20px">${esc(c)}</h2><div class="list" style="margin-top:8px">${l.map((p) => podCard(p, false)).join("")}</div></section>`).join("") || '<p class="muted">עוד אין פודקאסטים. פרק חדש נוצר לבד לכל סיכום חדש.</p>'}
    ${list.length ? `<details class="soft"><summary><b>התסריט של הפרק האחרון</b></summary><div class="pod-script">${list[list.length - 1].lines.map((ln) => `<p><b>${esc((list[list.length - 1].hosts || {})[ln.s] || ln.s)}:</b> ${esc(ln.t)}</p>`).join("")}</div></details>` : ""}
  </div>`;
  bindPods(list);
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
    <label class="field">איזה קורס?<select id="course" name="course" ${active ? "disabled" : ""}><option value="" ${(recorder?.rec?.course || slot?.course) ? "" : "selected"} disabled>בחרו קורס…</option>${(p.courses || []).map((c) => `<option ${(recorder?.rec?.course || slot?.course) === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
    ${(p.courses || []).length ? "" : '<p class="notice">עוד אין קורסים. מוסיפים אותם ב<a href="#settings-study">הגדרות ← לימודים</a>.</p>'}
    <p class="small ${slot ? "" : "muted"}" style="margin-top:-12px">${active ? "" : slot ? `🕘 זוהה לפי מערכת השעות: <b>${esc(slot.course)}</b> (${DAYS[slot.day]} <bdi>${slot.start}–${slot.end}</bdi>). ההקלטה תיכנס למחברת שלו, לשיעור של היום.` : `אין שיעור במערכת השעות עכשיו, אז בוחרים קורס. <a href="#timetable">למערכת השעות</a>`}</p>
    ${s.display && !active ? `<label class="field">מה להקליט?<select id="recSrc" name="recSrc">
      <option value="mic">🎤 מיקרופון – שיעור בכיתה</option>
      <option value="system">💻 הקול מהמחשב – שיעור בזום / וידאו</option>
      <option value="both">🎤 ➕ 💻 גם וגם</option>
    </select></label>
    <p class="small muted" id="recSrcHint" style="margin-top:-10px"></p>` : ""}
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
      <ul class="tips"><li>השאירו את Clearly פתוח על המסך. אפשר לכתוב במקביל במסך מפוצל.</li><li>לא לנעול את המסך. ${s.wakeLock ? "האפליקציה מנסה להשאיר אותו דלוק לבד." : "כדאי לכבות נעילה אוטומטית בהגדרות."}</li><li>חברו למטען אם השיעור ארוך.</li></ul>
    </div>
    <p class="small muted">ההקלטה נכנסת אוטומטית למחברת של הקורס, לשיעור של היום. מקליטים רק כשזה מותר לפי מדיניות המרצה והמוסד. ההקלטה נשמרת רק במכשיר שלך.</p>
  </div>`;
  $("#recBtn").onclick = onRecClick;
  // כפתור ההקלטה כבוי עד שבוחרים קורס (כדי שההקלטה תיכנס למחברת הנכונה)
  $("#course").onchange = () => $("#course").classList.remove("need");
  const srcSel = $("#recSrc");
  if (srcSel) { const srcHint = () => { $("#recSrcHint").textContent = srcSel.value === "mic" ? "" : 'כשתלחצו "הקלט", ייפתח חלון של כרום — בחרו את חלון/לשונית הזום, וסמנו למטה את "שיתוף אודיו". אפשר אז לעבור לזום, ההקלטה ממשיכה.'; }; srcSel.onchange = srcHint; srcHint(); }
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
  const r0 = recorder;
  if (r0?.running && r0.rec.slotEnd && !r0.rec.warned15) {
    const e0 = new Date(r0.rec.slotEnd).getTime();
    if (Date.now() >= e0 - 15 * 60e3 && Date.now() < e0) { r0.rec.warned15 = true; toast("🕘 השיעור נגמר בעוד ~15 דקות. ההקלטה תיעצר לבד בסוף, ותוכלו להאריך."); }
  }
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
async function startRecording(course, lessonId = null, source = "mic") {
  const lesson = lessonId ? await store.getLesson(lessonId) : await lessonForToday(course);
  const r = new LessonRecorder();
  bindRecorder(r);
  await r.start(course, lesson.id, { source });
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
  // לפני הקלטה חדשה צריך לבחור קורס – אומרים את זה בבירור
  if ((!recorder || !recorder.rec || recorder.rec.status === "done") && !$("#course")?.value) {
    const c = $("#course"); c.classList.add("need"); c.focus(); c.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("☝️ קודם בוחרים קורס למעלה, ואז מקליטים");
    return;
  }
  busy = true; $("#recBtn").disabled = true;
  try {
    if (!recorder || recorder.rec?.status === "done" || !recorder.rec) {
      await startRecording($("#course").value, null, $("#recSrc")?.value || "mic");
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
    toast(e.code === "noaudio" ? e.message : e.name === "NotAllowedError" ? "צריך לאשר גישה למיקרופון/לשיתוף. באייפון: הגדרות ← Safari ← מיקרופון ← לאפשר." : "לא הצלחתי להתחיל להקליט (" + e.name + "). נסו שוב.");
  }
}

async function finish(navigate = true) {
  if (busy) return;
  busy = true;
  toast("שומר…");
  const rec = await recorder.stop();
  busy = false;
  recorder = null;
  toast("ההקלטה נשמרה ✓ מתמללים ומסכמים אותה עכשיו, לבד");
  if (navigate) location.hash = rec.lessonId ? "lesson-" + rec.lessonId : "rec-" + rec.id;
  setTimeout(autoTranscribe, 800);
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

// ---------- מספר השיעור: כמה פעמים הקורס נפגש מתחילת הסמסטר, לפי מערכת השעות ----------
function lessonNo(course, dateISO) {
  const p = prefs.get() || {};
  const start = (p.semester && p.semester.start) || "2026-10-18";
  const days = [...new Set((p.timetable || []).filter((x) => x.course === course).map((x) => x.day))];
  if (!days.length || !dateISO) return null;
  const end = new Date(String(dateISO).slice(0, 10) + "T12:00");
  let n = 0;
  for (const t = new Date(start + "T12:00"); t <= end; t.setDate(t.getDate() + 1)) if (days.includes(t.getDay())) n++;
  return n || null;
}
function lessonLabel(course, dateISO, fixedNo = null) {
  const n = fixedNo || lessonNo(course, dateISO);
  return (n ? `שיעור ${n} · ` : "") + new Date(String(dateISO).slice(0, 10) + "T12:00").toLocaleDateString("he-IL");
}

// ---------- תמלול וסיכום אוטומטיים: ברגע שהקלטה נגמרת, וגם הקלטות שחיכו (למשל בלי אינטרנט) ----------
const trProgress = new Map(); // recId -> "מתמלל חלק 2 מתוך 6…"
async function autoTranscribe() {
  if (!api.user() || transcribing || !navigator.onLine) return;
  const today = new Date().toLocaleDateString("en-CA");
  const waiting = (await store.listRecordings())
    .filter((r) => r.status === "done" && !r.summaryId && (r.durationMs || 0) >= 45000 && r.autoPausedDay !== today && (r.autoTries || 0) < 3)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const r of waiting) {
    try {
      await transcribeRecording(r, (m) => { trProgress.set(r.id, m); paintTrProgress(r.id); });
      trProgress.delete(r.id);
      toast(`✅ ${r.course}: התמלול והסיכום מוכנים`);
      refreshInbox();
      if ([`#rec-${r.id}`, "#summaries", "#notebooks"].includes(location.hash) || location.hash.startsWith("#course-") || location.hash.startsWith("#lesson-")) route();
    } catch (e) {
      trProgress.set(r.id, "❌ " + e.message); paintTrProgress(r.id);
      const fresh = await store.getRecording(r.id);
      if (e.code === "limit" || e.code === "global_cap") { fresh.autoPausedDay = today; await store.saveRecording(fresh); break; } // ממשיכים מחר מאותו מקום
      fresh.autoTries = (fresh.autoTries || 0) + 1; await store.saveRecording(fresh);
    }
  }
}
function paintTrProgress(id) {
  document.querySelectorAll(`[data-trlive="${id}"]`).forEach((el) => (el.textContent = trProgress.get(id) || ""));
}

// ---------- 📝 תמלול וסיכום של הקלטה (גם שיעור של שעתיים) ----------
// כל קטע של ההקלטה עולה בשלמותו לאחסון זמני, השרת מעביר אותו ל-Gemini (עד 2GB לקובץ) ומוחק אותו מאצלנו,
// ואז מתמללים חלונות של 15 דקות מתוך הקובץ. ההתקדמות נשמרת: אם נגמרה המכסה או האינטרנט – ממשיכים מאותו חלון.
const PIECE_MAX = 45 * 1024 * 1024; // מגבלת האחסון לקובץ אחד היא 50MB
const WINDOW_SEC = 12 * 60; // 15 דקות לקחו 92 שניות – קרוב מדי למגבלת השרת (150)
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
async function recordingPieces(r) {
  const chunks = (await store.chunksOf(r.id)).sort((a, b) => a.segment - b.segment || a.seq - b.seq);
  const bySeg = new Map();
  for (const c of chunks) { if (!bySeg.has(c.segment)) bySeg.set(c.segment, []); bySeg.get(c.segment).push(c); }
  const pieces = [];
  for (const [seg, list] of bySeg) {
    const size = list.reduce((n, c) => n + c.blob.size, 0);
    if (size <= PIECE_MAX) { pieces.push({ key: `s${seg}`, blob: new Blob(list.map((c) => c.blob), { type: r.mime }), headSec: 0, estSec: list.length * 60 }); continue; }
    // קטע ענק (הקלטה ישנה בלי חלוקה): מפצלים לפי חתיכות. חלק שלא מתחיל בהתחלה מקבל את החתיכה הראשונה ("הראש" של הקובץ)
    let group = [], bytes = 0, n = 0;
    const flush = () => {
      if (!group.length) return;
      const head = n > 0 ? [list[0]] : [];
      pieces.push({ key: `s${seg}p${n}`, blob: new Blob([...head, ...group].map((c) => c.blob), { type: r.mime }), headSec: n > 0 ? 60 : 0, estSec: group.length * 60 });
      n++; group = []; bytes = list[0].blob.size;
    };
    for (const c of list) {
      if (c.blob.size > PIECE_MAX) throw new Error("חלק מההקלטה גדול מדי (מעל 45MB בחתיכה אחת). הקלטות חדשות מתחלקות לבד, כך שזה לא יקרה שוב");
      if (bytes + c.blob.size > PIECE_MAX) flush();
      group.push(c); bytes += c.blob.size;
    }
    flush();
  }
  return pieces;
}
let transcribing = null; // רק תמלול אחד בכל פעם
async function transcribeRecording(r, onStep) {
  if (transcribing) throw new Error("כבר מתמללים הקלטה אחרת. רגע…");
  transcribing = r.id;
  try {
    if (!r.transcript) {
      const pieces = await recordingPieces(r);
      if (!pieces.length) throw new Error("לא נשמר אודיו בהקלטה הזו");
      r.tr = r.tr || { files: {}, texts: {} };
      const base = (r.mime || "audio/mp4").split(";")[0];
      const ext = { "audio/mp4": "m4a", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" }[base] || "m4a";
      const totalSec = Math.round((r.durationMs || 0) / 1000) || pieces.reduce((n, p) => n + p.estSec, 0);
      const order = [];
      let offset = 0; // שניות מתחילת השיעור
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        // מעלים את הקטע (אם עוד לא, או אם הקובץ אצל Gemini כבר פג – אחרי יותר מ-40 שעות)
        const prepare = async () => {
          onStep?.(`⬆️ מעלה את חלק ${i + 1} מתוך ${pieces.length} של ההקלטה…`);
          const path = await api.uploadRecording(`${r.id}-${p.key}-${Date.now()}.${ext}`, p.blob, base);
          onStep?.(`🔄 מכין את חלק ${i + 1} מתוך ${pieces.length}…`);
          const f = await api.transcribeStep({ action: "prepare", path });
          r.tr.files[p.key] = { file: f.file, seconds: f.seconds || p.estSec, at: Date.now() };
          await store.saveRecording(r);
        };
        const fresh = (st) => st && st.file && Date.now() - st.at < 40 * 3600_000;
        const pending = () => { for (let from = p.headSec; from < (r.tr.files[p.key]?.seconds || p.estSec); from += WINDOW_SEC) if (!r.tr.texts[`${p.key}:${from}`]) return true; return false; };
        if (pending() && !fresh(r.tr.files[p.key])) await prepare();
        const seconds = r.tr.files[p.key]?.seconds || p.estSec;
        for (let from = p.headSec; from < seconds; from += WINDOW_SEC) {
          const key = `${p.key}:${from}`, to = Math.min(from + WINDOW_SEC, seconds);
          order.push(key);
          if (r.tr.texts[key]) continue; // חלון שכבר תומלל (למשל אחרי שנגמרה המכסה אתמול)
          const at = offset + (from - p.headSec);
          onStep?.(`🎧 מתמלל דקה ${mmss(at)}–${mmss(at + to - from)} מתוך ${mmss(Math.max(totalSec, at + to - from))}…`);
          const call = () => api.transcribeStep({ action: "window", file: r.tr.files[p.key].file, from, to, total: seconds, offsetMin: Math.max(0, Math.floor((offset - p.headSec) / 60)) });
          let res;
          try { res = await call(); } catch (e) { if (e.code !== "not_found") throw e; await prepare(); res = await call(); }
          r.tr.texts[key] = res.text || "";
          await store.saveRecording(r);
        }
        offset += seconds - p.headSec;
      }
      r.transcript = order.map((k) => r.tr.texts[k]).filter(Boolean).join("\n\n");
      // ניקוי: הקבצים נמחקים מ-Gemini (בלי לחכות)
      for (const st of Object.values(r.tr.files)) api.transcribeStep({ action: "cleanup", file: st.file }).catch(() => {});
      r.tr = null;
    }
    await store.saveRecording(r);
    onStep?.("✨ כותב סיכום אישי…");
    const title = `${r.course} · ${lessonLabel(r.course, r.startedAt)}`;
    const res = await api.summarizeText(r.transcript.slice(0, 280000), title, r.course, "rec:" + r.id);
    await social.syncSummaries();
    r.summaryId = "srv-" + res.id;
    await store.saveRecording(r);
    api.track("transcribe");
    return r;
  } finally { transcribing = null; }
}
// כרטיס "תמלול וסיכום" (בדף ההקלטה ובדף השיעור)
function transcriptCard(r) {
  const done = !!r.transcript, partial = Object.values(r.tr?.texts || {}).filter(Boolean).length;
  return `<section class="soft tr-card" data-trcard="${esc(r.id)}">
    <div class="row" style="justify-content:space-between"><h3>📝 תמלול וסיכום</h3>${r.summaryId ? `<a class="btn small-btn" href="#sum-${esc(r.summaryId)}">📚 לסיכום</a>` : ""}</div>
    ${done ? "" : transcribing === r.id ? '<p class="small muted">⏳ מתמלל ומסכם עכשיו, אוטומטית. אפשר להמשיך לעבוד באפליקציה.</p>' : `<p class="small muted">${partial ? `תומללו ${partial} חלקים. ממשיכים מאיפה שעצרנו.` : "ההקלטה מתומללת ומסוכמת לבד כשיש אינטרנט. אפשר גם להתחיל עכשיו."}</p>
    <button class="btn" type="button" data-trgo="${esc(r.id)}">✨ ${partial ? "להמשיך לתמלל" : "לתמלל ולסכם עכשיו"}</button>`}
    ${done && !r.summaryId ? `<button class="btn" type="button" data-trgo="${esc(r.id)}">✨ ליצור סיכום מהתמלול</button>` : ""}
    <p class="small" data-trstate data-trlive="${esc(r.id)}" aria-live="polite">${esc(trProgress.get(r.id) || "")}</p>
    ${done ? `<details><summary><b>התמלול המלא</b> <span class="small muted">(${r.transcript.split(/\s+/).length} מילים)</span></summary><div class="transcript">${esc(r.transcript).replace(/\[(\d{1,3}:\d{2})\]/g, '<b class="ts">$1</b>').replace(/\n/g, "<br>")}</div>
      <div class="row" style="margin-top:8px"><button class="btn ghost small-btn" type="button" data-trcopy="${esc(r.id)}">העתקת התמלול</button></div></details>` : ""}
  </section>`;
}
function bindTranscript(after) {
  view.querySelectorAll("[data-trgo]").forEach((b) => (b.onclick = async () => {
    const r = await store.getRecording(b.dataset.trgo); if (!r) return;
    const st = b.closest("[data-trcard]").querySelector("[data-trstate]");
    b.disabled = true;
    try { await transcribeRecording(r, (m) => (st.textContent = m)); toast("✅ התמלול והסיכום מוכנים"); after(); }
    catch (e) { st.textContent = "❌ " + e.message; b.disabled = false; }
  }));
  view.querySelectorAll("[data-trcopy]").forEach((b) => (b.onclick = async () => {
    const r = await store.getRecording(b.dataset.trcopy);
    try { await navigator.clipboard.writeText(r.transcript); toast("התמלול הועתק"); } catch { toast("לא הצלחתי להעתיק"); }
  }));
}

async function transcriptPage(id) {
  const t = await store.getItem(id);
  if (!t) { view.innerHTML = '<div class="page"><p>התמלול לא נמצא.</p><a href="#notebooks">למחברות</a></div>'; return; }
  const ci = courseIndex(t.course);
  view.innerHTML = `<div class="page">
    <a href="${ci >= 0 ? "#course-" + ci : "#notebooks"}" class="small">→ ${esc(t.course)}</a>
    <h1 style="font-size:30px">📹 ${esc(t.course)}</h1>
    <p class="chip" style="justify-self:start">${esc(lessonLabel(t.course, t.date))} · מהזום</p>
    <section class="soft tr-card">
      <div class="row" style="justify-content:space-between"><h3>📝 התמלול</h3>${t.summaryId ? `<a class="btn small-btn" href="#sum-${esc(t.summaryId)}">📚 לסיכום של השיעור</a>` : '<span class="small muted">⏳ הסיכום ייכנס לבד בעדכון הבא</span>'}</div>
      <div class="transcript">${esc(t.text).replace(/\[(\d{1,3}:\d{2}(?::\d{2})?)\]/g, '<b class="ts">$1</b>').replace(/\n/g, "<br>")}</div>
      <div class="row"><button class="btn ghost small-btn" type="button" id="trCopy">העתקת התמלול</button></div>
    </section></div>`;
  $("#trCopy").onclick = async () => { try { await navigator.clipboard.writeText(t.text); toast("התמלול הועתק"); } catch { toast("לא הצלחתי להעתיק"); } };
}

async function recordingDetail(id) {
  const r = await store.getRecording(id);
  if (!r) { view.innerHTML = '<div class="page"><p>ההקלטה לא נמצאה.</p></div>'; return; }
  const segs = await segmentsOf(r);
  const urls = segs.map((s) => URL.createObjectURL(s.blob));
  const ext = r.mime.includes("mp4") ? "m4a" : "webm";
  view.innerHTML = `<div class="page">
    <a href="${r.lessonId ? "#lesson-" + r.lessonId : "#recordings"}" class="small">→ ${r.lessonId ? "חזרה לשיעור" : "כל ההקלטות"}</a>
    <h1 style="font-size:30px">🎙️ ${esc(r.course)}</h1>
    <p class="chip" style="justify-self:start">${esc(lessonLabel(r.course, r.startedAt))}</p>
    <p class="muted"><bdi>${fmtDate(r.startedAt)}</bdi> · משך <bdi>${fmtTime(r.durationMs || 0)}</bdi> · <bdi>${fmtMB(r.bytes || 0)}</bdi></p>
    ${segs.map((s, i) => `<div class="soft"><div class="row" style="justify-content:space-between"><b>${segs.length > 1 ? "חלק " + (i + 1) + " מתוך " + segs.length : "ההקלטה"}</b></div><audio controls preload="metadata" src="${urls[i]}" style="margin-top:10px"></audio>
      <div class="row" style="margin-top:10px"><button class="btn ghost" data-share="${i}">${svg("share")} שיתוף / שמירה</button></div></div>`).join("") || '<p class="notice alert">לא נשמר אודיו בהקלטה הזו.</p>'}
    ${segs.length ? transcriptCard(r) : ""}
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
  bindTranscript(() => recordingDetail(id));
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

// כל השיעורים המוקלטים של קורס: הקלטות מהאפליקציה + שיעורים מהזום, מהחדש לישן, עם מספר שיעור ומצב
async function courseRecordings(course) {
  const recs = (await store.listRecordings()).filter((r) => r.course === course).map((r) => ({ kind: "rec", id: r.id, date: r.startedAt, r }));
  const zoom = (await store.listItems()).filter((x) => x.type === "transcript" && x.course === course).map((t) => ({ kind: "zoom", id: t.id, date: t.date, t }));
  const all = [...recs, ...zoom].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!all.length) return "";
  const row = (x) => {
    if (x.kind === "zoom") return `<a class="item" href="#tr-${esc(x.id)}"><span style="min-width:0"><span class="t">📹 ${esc(lessonLabel(course, x.date))}</span><br><span class="small muted">מהזום · ${x.t.summaryId ? "✅ תמלול וסיכום" : "📝 תמלול"}</span></span>${x.t.summaryId ? `<span class="chip ok">סוכם</span>` : ""}</a>`;
    const r = x.r;
    const st = r.summaryId ? "✅ תמלול וסיכום" : transcribing === r.id ? "⏳ מתמלל ומסכם…" : r.transcript ? "📝 תומלל, הסיכום בדרך" : r.status === "done" ? "⏳ ממתין לתמלול" : "🔴 בהקלטה";
    return `<a class="item" href="#rec-${esc(r.id)}"><span style="min-width:0"><span class="t">🎙️ ${esc(lessonLabel(course, r.startedAt))}</span><br><span class="small muted">הקלטה · <bdi>${fmtTime(r.durationMs || 0)}</bdi> · <span data-trlive="${esc(r.id)}">${st}</span></span></span>${r.summaryId ? `<span class="chip ok">סוכם</span>` : ""}</a>`;
  };
  return `<section class="soft"><h3>🎙️ הקלטות ותמלולים (${all.length})</h3><div class="list" style="margin-top:8px">${all.map(row).join("")}</div></section>`;
}

async function notebooks(sel = null) { // sel = אינדקס הקורס, או null = כל השיעורים
  const p = prefs.get();
  const courses = p.courses || [];
  const course = sel === null ? null : courses[sel];
  if (sel !== null && !course) { location.hash = "notebooks"; return; }
  const all = await store.listLessons();
  const pods = await podcastsList();
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
          ${course ? `<label class="btn ghost small-btn">${svg("download")} ייבוא PDF (מצגות / Notability)<input type="file" id="pdfIn" accept="application/pdf,.pdf" multiple hidden></label>` : ""}
          <button class="btn ghost small-btn" id="editNb" aria-pressed="false">עריכה</button>
          <button class="btn small-btn" id="newLesson">${svg("plus")} חדש</button>
        </div>
      </div>
      ${course ? await courseRecordings(course) : ""}
      <div class="cards" id="cards">${list.map(card).join("") || `<p class="muted">${course ? 'עוד אין שיעורים בתיקייה הזו. לחצו "חדש" כדי לפתוח דף, או "ייבוא מ-Notability" כדי להכניס את מה שכתבתם בעבר.' : "עוד אין שיעורים. בחרו תיקייה מהרשימה ולחצו \"חדש\"."}</p>`}</div>
      ${!course && list.length === 0 ? "" : ""}
      ${course ? extras.pastExamsBlock(await extras.pastExams(course), course) : ""}
      ${course ? study.moodleSection(await study.moodleCourse(course)) : ""}
    </section>
  </div>`;

  extras.bindPastExams(() => notebooks(sel));
  bindPods(pods);
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
function closeSplit() { document.body.classList.remove("split"); $("#splitPane")?.remove(); setTimeout(() => editor?.layout(), 200); }
function closeLesson() {
  closeSplit();
  document.body.classList.remove("focus");
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  if (editingLesson) flushLesson(true);
  editor?.destroy(); editor = null; editingLesson = null; clearInterval(lessonTimer);
}

// ✏️ עריכת תמונה בעמוד: גודל, מיקום בדף, וחיתוך (גוררים מלבן על התמונה)
function imageEditor(editor, i) {
  const page = editor.pages[i]; if (!page?.image) return;
  const box = { ...imgBoxOf(page) };
  let crop = null; // {x,y,w,h} בחלקים מהתמונה
  document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="imgModal" role="dialog" aria-labelledby="imgT"><div class="card img-card">
    <h2 id="imgT">✏️ עריכת התמונה</h2>
    <div class="ie-stage" id="ieStage"><img id="ieImg" src="${page.image}" alt="התמונה"><div class="ie-crop" id="ieCrop" hidden></div></div>
    <p class="small muted">✂️ לחיתוך: גוררים מלבן על התמונה. לחיצה אחת מבטלת את החיתוך.</p>
    <label>גודל בעמוד: <b id="ieSizeV">${Math.round(box.w * 100)}%</b><input type="range" id="ieSize" min="20" max="100" value="${Math.round(box.w * 100)}"></label>
    <label>מיקום מלמעלה: <b id="ieTopV">${Math.round(box.y * 100)}%</b><input type="range" id="ieTop" min="0" max="90" value="${Math.round(box.y * 100)}"></label>
    <div class="row"><span class="small">צד:</span><button class="btn ghost small-btn" data-side="right" type="button">ימין</button><button class="btn ghost small-btn" data-side="center" type="button">מרכז</button><button class="btn ghost small-btn" data-side="left" type="button">שמאל</button></div>
    <div class="row"><button class="btn" id="ieOk" type="button">שמירה</button><button class="btn ghost" id="ieNo" type="button">ביטול</button><button class="btn ghost" id="ieDel" type="button">🗑️ הסרת התמונה</button></div>
  </div></div>`);
  const m = $("#imgModal"), stage = $("#ieStage"), cropEl = $("#ieCrop");
  const close = () => m.remove();
  $("#ieNo").onclick = close;
  $("#ieSize").oninput = (e) => { box.w = +e.target.value / 100; box.x = Math.min(box.x, 1 - box.w); $("#ieSizeV").textContent = e.target.value + "%"; };
  $("#ieTop").oninput = (e) => { box.y = +e.target.value / 100; $("#ieTopV").textContent = e.target.value + "%"; };
  m.querySelectorAll("[data-side]").forEach((b) => (b.onclick = () => { box.x = b.dataset.side === "right" ? 1 - box.w : b.dataset.side === "center" ? (1 - box.w) / 2 : 0; toast("המיקום נשמר כשלוחצים שמירה"); }));
  // חיתוך: גרירת מלבן על התמונה
  let start = null;
  const rel = (e) => { const r = $("#ieImg").getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  const drawCrop = () => {
    if (!crop || crop.w < 0.03 || crop.h < 0.03) { cropEl.hidden = true; return; }
    const r = $("#ieImg").getBoundingClientRect(), sr = stage.getBoundingClientRect();
    Object.assign(cropEl.style, { left: r.left - sr.left + crop.x * r.width + "px", top: r.top - sr.top + crop.y * r.height + "px", width: crop.w * r.width + "px", height: crop.h * r.height + "px" });
    cropEl.hidden = false;
  };
  stage.addEventListener("pointerdown", (e) => { e.preventDefault(); stage.setPointerCapture(e.pointerId); start = rel(e); crop = null; drawCrop(); });
  stage.addEventListener("pointermove", (e) => { if (!start) return; const [x, y] = rel(e); crop = { x: Math.min(x, start[0]), y: Math.min(y, start[1]), w: Math.abs(x - start[0]), h: Math.abs(y - start[1]) }; drawCrop(); });
  stage.addEventListener("pointerup", () => { start = null; if (crop && (crop.w < 0.03 || crop.h < 0.03)) crop = null; drawCrop(); });
  $("#ieDel").onclick = () => { if (!confirm("להסיר את התמונה מהעמוד? מה שכתבת עליה יישאר.")) return; editor.updateImage(i, null, null); close(); };
  $("#ieOk").onclick = async () => {
    let url = page.image;
    if (crop) {
      const im = $("#ieImg");
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(im.naturalWidth * crop.w)); cv.height = Math.max(1, Math.round(im.naturalHeight * crop.h));
      cv.getContext("2d").drawImage(im, im.naturalWidth * crop.x, im.naturalHeight * crop.y, cv.width, cv.height, 0, 0, cv.width, cv.height);
      url = cv.toDataURL("image/jpeg", 0.85);
    }
    editor.updateImage(i, url, { ...box });
    close(); toast("התמונה עודכנה ✓");
  };
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
        <button class="btn ghost small-btn" id="ltq">🙋 <span>שאלה למתרגל</span></button>
        <button class="btn ghost small-btn" id="lshare">${svg("share")} <span>שיתוף</span></button>
        <button class="btn ghost small-btn" id="lsplit">${svg("split")} <span>מסך מפוצל</span></button>
        <button class="btn small-btn" id="lfull">${svg("expand")} <span>מסך מלא</span></button>
      </div>
    </div>
    ${recs.length ? `<section class="soft" id="lrecs"><h3>🎙️ ההקלטות של השיעור</h3>
      ${recs.map((r) => `<div class="item lrec" style="margin-top:10px"><a href="#rec-${r.id}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><span class="t">הקלטה מ-<bdi>${new Date(r.startedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</bdi> · <bdi>${fmtTime(r.durationMs || 0)}</bdi></span><br><span class="small muted">${r.summaryId ? "✅ תומלל וסוכם" : r.transcript ? "📝 תומלל" : "עוד לא תומלל"}</span></a>
        ${r.summaryId ? `<a class="btn small-btn" href="#sum-${esc(r.summaryId)}">📚 סיכום</a>` : `<a class="btn ghost small-btn" href="#rec-${r.id}">✨ תמלול וסיכום</a>`}</div>`).join("")}
    </section>` : ""}
    <div id="inkArea" ${mode === "ink" ? "" : "hidden"}>
      <div class="toolbar" role="toolbar" aria-label="כלי כתיבה">
        <div class="tgroup">
          <button class="tool" data-tool="pen" aria-label="עט">${svg("pen")}</button>
          <button class="tool" data-tool="marker" aria-label="מרקר">${svg("marker")}</button>
          <button class="tool" data-tool="eraser" aria-label="מחק">${svg("eraser")}</button>
          <button class="tool" data-tool="lasso" aria-label="לאסו: סימון והזזה">${svg("lasso")}</button>
        </div>
        <div class="tgroup">
          <button class="tool" data-tool="line" aria-label="קו ישר (סרגל)">${svg("line")}</button>
          <button class="tool" data-tool="rect" aria-label="מלבן">${svg("rect")}</button>
          <button class="tool" data-tool="ellipse" aria-label="עיגול">${svg("ellipse")}</button>
          <button class="tool" data-tool="arrow" aria-label="חץ">${svg("arrow")}</button>
        </div>
        <div class="tgroup" id="selBox" hidden><button class="tool sel-del" id="selDel" aria-label="מחיקת הבחירה">${svg("trash")}</button></div>
        <div class="tgroup">
          <label class="tool" aria-label="צילום הלוח">${svg("camera")}<input type="file" id="camIn" accept="image/*" capture="environment" hidden></label>
        </div>
        <div class="tgroup">
          <select id="paperSel" aria-label="סוג הדף" class="paper-sel"><option value="blank">דף חלק</option><option value="lines">שורות</option><option value="grid">משבצות</option></select>
        </div>
        <div class="tgroup">
          <button class="tool" id="zoomOut" aria-label="הקטנה">−</button>
          <span class="small zoom-val" id="zoomVal">100%</span>
          <button class="tool" id="zoomIn" aria-label="הגדלה">+</button>
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
      ${(l.pages || []).some((pg) => pg.image) ? "" : `<div class="notice slide-cta"><span>📄 <b>יש מצגת לשיעור?</b> מוסיפים אותה לכאן וכותבים עליה בעט, ישר על השקפים.</span><label class="btn small-btn">הוספת המצגת<input type="file" class="slidesIn" accept="application/pdf,.pdf,image/*" multiple hidden></label></div>`}
      <div class="sheets-wrap"><div class="sheets" id="sheets"></div></div>
      <div class="row" style="justify-content:center;margin-top:14px">
        <button class="btn ghost" data-add="blank">${svg("plus")} עמוד חלק</button>
        <button class="btn ghost" data-add="lines">${svg("plus")} עמוד שורות</button>
        <button class="btn ghost" data-add="grid">${svg("plus")} עמוד משבצות</button>
        <label class="btn ghost">📄 מצגת / PDF של השיעור<input type="file" class="slidesIn" accept="application/pdf,.pdf,image/*" multiple hidden></label>
        <label class="btn ghost">${svg("image")} תמונה<input type="file" id="addImg" accept="image/*" hidden></label>
      </div>
    </div>
    <div id="textArea" ${mode === "text" ? "" : "hidden"}>
      <textarea id="ltext" name="notes" class="note-text" dir="auto" autocomplete="off" placeholder="מקלידים כאן את הסיכום של השיעור…">${esc(l.text)}</textarea>
      <p class="small muted">באייפד אפשר לכתוב כאן גם בעט, ו-Scribble יהפוך את זה לטקסט.</p>
    </div>
    <div class="row"><button class="btn danger" id="ldel">${svg("trash")} <span>מחיקת השיעור</span></button></div>
  </div>`;

  // --- כתב יד ---
  editor = new InkEditor($("#sheets"), l.pages || []);
  l.pages = editor.pages;
  const paintTools = () => {
    view.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === editor.tool));
    view.querySelectorAll("[data-size]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.size === editor.size));
    const list = editor.tool === "marker" ? MARKER_COLORS : COLORS, curC = editor.tool === "marker" ? editor.markerColor : editor.color;
    $("#swatches").innerHTML = editor.tool === "lasso" ? '<span class="small muted" style="padding:0 6px">מקיפים כדי לסמן</span>' : editor.tool === "eraser" ? '<span class="small muted" style="padding:0 6px">נוגעים בקו כדי למחוק אותו</span>' :
      list.map((c) => `<button class="tool swatch" data-color="${c}" aria-label="צבע" aria-pressed="${c === curC}"><i style="background:${c}"></i></button>`).join("");
    $("#swatches").querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => {
      if (editor.tool === "marker") editor.markerColor = b.dataset.color; else editor.color = b.dataset.color;
      paintTools();
    }));
    $("#undo").disabled = !editor.canUndo; $("#redo").disabled = !editor.canRedo;
    $("#penOnly").setAttribute("aria-pressed", editor.penOnly);
  };
  view.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => {
    editor.tool = b.dataset.tool;
    if (editor.tool !== "lasso") editor.clearSelection();
    if (editor.tool === "lasso") toast("מקיפים בעט את מה שרוצים לסמן, ואז גוררים או מוחקים");
    paintTools();
  }));
  editor.addEventListener("selection", () => { $("#selBox").hidden = !editor.sel; });
  $("#selDel").onclick = () => editor.deleteSelection();
  // צילום הלוח: התמונה נכנסת כעמוד חדש שאפשר לכתוב עליו
  $("#camIn").onchange = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { (await editor.addImagePage(f)).scrollIntoView({ behavior: "smooth", block: "start" }); toast("📷 הלוח נוסף כעמוד. אפשר לכתוב עליו"); }
    catch { toast("לא הצלחתי לפתוח את התמונה"); }
  };
  view.querySelectorAll("[data-size]").forEach((b) => (b.onclick = () => { editor.size = +b.dataset.size; paintTools(); }));
  $("#undo").onclick = () => editor.undo();
  $("#redo").onclick = () => editor.redo();
  $("#penOnly").onclick = () => { editor.setPenOnly(!editor.penOnly); toast(editor.penOnly ? "רק העט כותב. האצבע גוללת את הדף." : "עכשיו גם האצבע כותבת."); };
  editor.addEventListener("change", () => { paintTools(); l.pages = editor.pages; saveSoon(); });
  editor.addEventListener("penonly", () => { paintTools(); toast("זוהה עט: מעכשיו האצבע גוללת והעט כותב"); });
  view.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { editor.addPage(b.dataset.add).scrollIntoView({ behavior: "smooth", block: "start" }); }));
  // מצגת/PDF של השיעור: כל שקף נכנס כעמוד שאפשר לכתוב עליו (כמו ב-Notability)
  view.querySelectorAll(".slidesIn").forEach((inp) => (inp.onchange = async (e) => {
    const files = [...(e.target.files || [])]; e.target.value = "";
    if (!files.length) return;
    let first = null, n = 0;
    for (const f of files) {
      try {
        if (/\.(pptx?|key|docx?)$/i.test(f.name)) { toast("מצגת PowerPoint/Keynote: פותחים אותה, בוחרים שיתוף/ייצוא ← PDF, ומוסיפים את ה-PDF"); continue; }
        if (f.type.startsWith("image/")) { const el = await editor.addImagePage(f); first ||= el; n += 1; continue; }
        toast(`טוען את ${f.name}…`);
        for (const pg of await pdfToPages(f)) { const el = editor.addPage("blank", pg.image); first ||= el; n += 1; }
      } catch (err) { toast(`לא הצלחתי לפתוח את ${f.name}: ${err.message}`); }
    }
    if (n) { view.querySelector(".slide-cta")?.remove(); first?.scrollIntoView({ behavior: "smooth", block: "start" }); toast(`✓ נוספו ${n} שקפים. אפשר לכתוב עליהם בעט`); }
  }));
  $("#addImg").onchange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { (await editor.addImagePage(f)).scrollIntoView({ behavior: "smooth", block: "start" }); toast("התמונה נוספה כעמוד. אפשר לכתוב עליה"); }
    catch { toast("לא הצלחתי לפתוח את התמונה"); }
    e.target.value = "";
  };
  paintTools();

  // --- סוג הדף: משנה את העמוד שמול העיניים (וגם העמודים החדשים יהיו כאלה) ---
  const syncPaper = () => { if (!editor || !$("#paperSel")) return; $("#paperSel").value = editor.pages[editor.currentIndex()]?.bg || "lines"; };
  syncPaper();
  $("#paperSel").onchange = () => { editor.setPageBg(editor.currentIndex(), $("#paperSel").value); toast("סוג הדף עודכן"); };
  // מאזין אחד בלבד (כל פתיחה של שיעור מחליפה את הקודם)
  if (window.__paperSync) window.removeEventListener("scroll", window.__paperSync);
  window.__paperSync = syncPaper; window.addEventListener("scroll", syncPaper, { passive: true });
  // --- הגדלה / הקטנה ---
  let zoom = 1;
  try { zoom = +localStorage.getItem("sikumon-zoom") || 1; } catch { /* */ }
  const setZoom = (z) => { zoom = editor.setZoom(z); $("#zoomVal").textContent = Math.round(zoom * 100) + "%"; try { localStorage.setItem("sikumon-zoom", zoom); } catch { /* */ } };
  setZoom(zoom);
  $("#zoomIn").onclick = () => setZoom(zoom + 0.25);
  $("#zoomOut").onclick = () => setZoom(zoom - 0.25);
  // --- עריכת תמונה בעמוד ---
  $("#sheets").addEventListener("click", (e) => { const b = e.target.closest("[data-imgedit]"); if (b) imageEditor(editor, +b.dataset.imgedit); });

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
  $("#ltq").onclick = () => tools.quickQuestion(l.course, l.id);
  $("#lsplit").onclick = async () => {
    if (document.body.classList.contains("split")) { closeSplit(); return; }
    const sums = (await store.listItems()).filter((x) => x.type === "summary").sort((a, b) => (b.course === l.course) - (a.course === l.course) || (a.kind === "formulas") - (b.kind === "formulas") || b.date.localeCompare(a.date));
    if (!sums.length) { toast("עוד אין סיכומים להציג לצד המחברת"); return; }
    document.body.classList.add("split");
    document.body.insertAdjacentHTML("beforeend", `<aside class="split-pane" id="splitPane"><div class="row" style="justify-content:space-between;gap:8px"><select id="splitSel" name="splitSel" style="flex:1">${sums.map((x) => `<option value="${esc(x.id)}">${x.kind === "formulas" ? "📐 " : ""}${esc(x.course)} – ${esc(x.title)}</option>`).join("")}</select><button class="tool" id="splitX" aria-label="סגירת המסך המפוצל">✕</button></div><article class="md-body" id="splitBody"></article></aside>`);
    const show = () => { const it = sums.find((x) => x.id === $("#splitSel").value); $("#splitBody").innerHTML = it?.html || ""; };
    $("#splitSel").onchange = show; $("#splitX").onclick = closeSplit; show();
    setTimeout(() => editor?.layout(), 200);
  };
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
    <p class="muted">לחיצה אחת בודקת את כל מה ש-Clearly צריך במכשיר הזה. בסוף שולחים את הדוח, וככה אפשר לראות מרחוק מה עובד ומה לא.</p>
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
    return [`דוח בדיקת מכשיר – Clearly (${new Date().toLocaleString("he-IL")})`, `מכשיר: ${dev}, גרסה ${ios || "?"}, מסך ${screen.width}×${screen.height}`,
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
    try { if (navigator.share) { await navigator.share({ title: "דוח בדיקת מכשיר – Clearly", text }); return; } } catch (e) { if (e.name === "AbortError") return; }
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

async function profile(tab = "posts") {
  const st = support();
  const head = await social.myProfile(tab);
  view.innerHTML = `<div class="page" style="max-width:760px">
    ${head}
    <section class="list">
      <a class="item" href="#timetable"><span><span class="t">🕘 מערכת השעות</span></span></a>
      <a class="item" href="#feedback"><span><span class="t">✉️ משוב על הגרסה</span></span></a>
    </section>
    ${!st.standalone ? '<p class="notice"><b>להתקנה באייפד/אייפון:</b> ב-Safari לוחצים על כפתור השיתוף ובוחרים "הוסף למסך הבית".</p>' : ""}
    <p class="small muted">גרסת האפליקציה: <b>${APP_VERSION}</b></p>
  </div>`;
  social.bindMyProfile(tab);
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
  // כותרת הלשונית לפי המסך (קורא מסך מקריא אותה במעבר בין מסכים)
  const h1 = view.querySelector("h1")?.textContent.trim();
  document.title = h1 ? `${h1.slice(0, 60)} · Clearly` : "Clearly";
}
async function routeInner() {
  let hash = location.hash.slice(1) || "home";
  try { hash = decodeURIComponent(hash); } catch { /* כתובת לא תקינה */ }
  // משתמש חדש: קודם פותחים פרופיל, ורק אז השאלון ("איך אני לומד/ת")
  // בלי חשבון (או לפני שנוצר פרופיל): הרשמה / כניסה
  // מסמכים משפטיים ותמיכה: פתוחים גם לפני ההרשמה (צריך לקרוא את התנאים לפני שמסכימים להם)
  if (hash.startsWith("legal-") && !api.profile()) { renderTabs(null); settings.legal(hash.slice(6)); view.querySelector(".page")?.insertAdjacentHTML("afterbegin", '<a class="back-btn" href="#home">→ חזרה</a>'); return; }
  if (!api.user() || !api.profile()) { renderTabs(null); assistant.mount(null); return social.signup(api.user() ? "signup" : undefined); }
  if (api.profile().access === "waitlist") { renderTabs(null); assistant.mount(null); return waitlistPage(); }
  if (!prefs.get()) return onboarding(0);
  if (!hash.startsWith("lesson-")) closeLesson();
  if (hash === "social-missed") hash = "missed-lesson";
  const tab = hash === "missed-lesson" || hash === "upload" ? "summaries" : hash === "connect" ? "home" : hash.startsWith("share-") ? "social" : hash.startsWith("messages") || hash.startsWith("dm-") ? "messages" : hash.startsWith("settings") || hash.startsWith("legal-") || hash.startsWith("profile") ? "profile" : hash.startsWith("social") || hash.startsWith("u-") ? "social" : hash.startsWith("calendar") ? "calendar" : hash === "inbox" || hash === "weekly" || hash.startsWith("msg-") ? "home" : hash.startsWith("sum") || hash === "summary" || hash === "deadlines" || hash === "exam-focus" ? "summaries" : hash.startsWith("reels") ? "notebooks" : hash === "podcasts" ? "summaries" : hash.startsWith("cards") || hash === "progress" || hash === "sim" ? "quizzes" : hash.startsWith("search") || hash === "questions" ? "home" : hash === "missing" ? "home" : hash.startsWith("sum") || hash === "summary" ? "summaries" : hash.startsWith("quiz") ? "quizzes" : hash.startsWith("rec-") || hash.startsWith("tr-") || hash.startsWith("mf-") || hash.startsWith("course-") || hash.startsWith("lesson-") || hash === "recordings" ? "notebooks" : hash === "summary" || hash === "quiz" ? "summaries" : hash === "feedback" || hash === "diag" || hash === "timetable" ? "profile" : hash.startsWith("assign-") ? "assignments" : hash.startsWith("materials-") ? "calendar" : hash === "admin" ? "profile" : hash;
  curTab = tab;
  renderTabs(tab);
  if (hash === "home") { await home(); planner.inboxStore().then(planner.paintBadge); }
  else if (hash === "record") record();
  else if (hash === "recordings") await recordings();
  else if (hash.startsWith("rec-")) await recordingDetail(hash.slice(4));
  else if (hash.startsWith("tr-")) await transcriptPage(hash.slice(3));
  else if (hash === "assignments") await assignments.page();
  else if (hash.startsWith("assign-")) await assignments.detail(decodeURIComponent(hash.slice(7)));
  else if (hash.startsWith("materials-")) await planner.materials(decodeURIComponent(hash.slice(10)));
  else if (hash.startsWith("mf-")) { await study.moodleFilePage(decodeURIComponent(hash.slice(3))); tools.attachReader?.(); }
  else if (hash === "summaries") {
    await study.summaries();
    const pods = await podcastsList();
    const nx = (await extras.upcoming())[0];
    view.querySelector(".page h1")?.insertAdjacentHTML("afterend", `<div class="grid2">
      <a class="card" href="#upload"><b class="card-t">📄 סיכום ממצגת / PDF</b><p class="small muted">מעלים קובץ של שיעור, ומקבלים סיכום לפי איך שאת/ה לומד/ת</p></a>
      <a class="card star-card" href="#exam-focus"><b class="card-t">⭐ מה יהיה במבחן</b><p class="small muted">כל מה שהמרצים אמרו שחשוב, מכל הסיכומים</p></a>
      ${pods.length ? `<a class="card" href="#podcasts"><h3>🎧 פודקאסטים</h3><p class="small muted">${pods.length} פרקים קצרים על השיעורים – נועה ואיתי מסבירים</p></a>` : ""}
      <a class="card" href="#missed-lesson"><b class="card-t">🙋 פספסתי שיעור</b><p class="small muted">מבקשים מהחברים בקורס סיכום, תמונה של הלוח או הקלטה</p></a>
      <a class="card" href="#deadlines"><b class="card-t">⏳ לוח מבחנים והגשות</b><p class="small muted">${nx ? esc(nx.title) + " · " + extras.inDays(extras.daysTo(nx.when)) : "הוסיפו את תאריכי המבחנים"}</p></a></div>`);
    if (pods.length) {
      view.querySelector(".page .grid2")?.insertAdjacentHTML("afterend", `<section class="pod-strip"><h2 style="font-size:20px">🎧 האחרונים</h2><div class="list">${pods.slice(-3).reverse().map((p) => podCard(p)).join("")}</div><a class="small" href="#podcasts">כל הפודקאסטים (${pods.length})</a></section>`);
      // ▶ קטן ליד כל סיכום שיש לו פודקאסט
      view.querySelectorAll('.item[href^="#sum-"]').forEach((a) => { const id = decodeURIComponent(a.getAttribute("href").slice(5)); const p = pods.find((x) => x.summaryId === id); if (p) a.insertAdjacentHTML("beforeend", `<span class="chip pod-chip" data-podsum="${esc(p.id)}">🎧 ${podMin(p.seconds)}</span>`); });
      view.querySelectorAll("[data-podsum]").forEach((c) => (c.onclick = (e) => { e.preventDefault(); e.stopPropagation(); playPodcast(pods.find((x) => x.id === c.dataset.podsum)); }));
      bindPods(pods);
    }
  }
  else if (hash === "summary") summary();
  else if (hash.startsWith("sum-")) {
    await study.summaryPage(hash.slice(4)); tools.attachReader();
    const pods = (await podcastsList()).filter((p) => p.summaryId === hash.slice(4));
    if (pods.length) { view.querySelector(".reader")?.insertAdjacentHTML("afterend", podCard(pods[0], false)); bindPods(pods); }
    await attachAI(hash.slice(4));
  }
  else if (hash === "podcasts") await podcastsPage();
  else if (hash === "sim") await tools.simSetup();
  else if (hash === "search") await tools.search();
  else if (hash.startsWith("search-")) await tools.search(hash.slice(7));
  else if (hash === "questions") await tools.questions();
  else if (hash === "calendar") await planner.calendar();
  else if (hash.startsWith("calendar-")) await planner.calendar(hash.slice(9));
  else if (hash === "inbox") await planner.inbox();
  else if (hash === "weekly") await planner.weekly();
  else if (hash.startsWith("msg-")) await planner.message(hash.slice(4), ai.miniMd);
  else if (hash === "quizzes") {
    await study.quizzes();
    view.querySelector(".page > .row")?.insertAdjacentHTML("afterend", `<div class="grid2"><a class="card" href="#cards"><b class="card-t">🃏 כרטיסיות זיכרון</b><p class="small muted">חזרה מרווחת מכל המבחנים ודפי הנוסחאות</p></a><a class="card" href="#progress"><b class="card-t">📈 ההתקדמות שלי</b><p class="small muted">ציונים לאורך זמן, ובמה כדאי לחזור</p></a><a class="card" href="#sim"><b class="card-t">⏱️ סימולציית מבחן</b><p class="small muted">טיימר, שאלות מכל הקורס, ציון בסוף</p></a></div><p class="small muted">היום נשארו לך <b>${quizzesLeft()}</b> מבחנים. רוצים עוד? משתפים את Clearly עם חבר/ה.</p>`);
  }
  else if (hash === "quiz-new") study.quizEditor();
  else if (hash.startsWith("quiz-mix-")) await study.mixQuiz(+hash.slice(9));
  else if (hash === "quiz") await study.quizById("demo");
  else if (hash.startsWith("quiz-")) await study.quizById(hash.slice(5));
  else if (hash === "social") await social.feed();
  else if (hash === "social-friends") await social.friends();
  else if (hash === "missed-lesson") await social.missed();
  else if (hash === "upload") uploadPage();
  else if (hash === "connect") connectPage();
  else if (hash.startsWith("share-")) await social.shareFrom(hash.slice(6));
  else if (hash === "messages") await social.messages();
  else if (hash === "messages-req") await social.messages("req");
  else if (hash.startsWith("dm-")) await social.dm(hash.slice(3));
  else if (hash === "admin") { if (isAdmin) await adminPage(); else location.hash = "#home"; }
  else if (hash === "settings") await settings.page();
  else if (hash.startsWith("settings-")) await settings.page(hash.slice(9));
  else if (hash.startsWith("legal-")) settings.legal(hash.slice(6));
  else if (hash === "profile-liked" || hash === "profile-saved") await profile(hash.slice(8));
  else if (hash.startsWith("u-")) await social.profile(hash.slice(2));
  else if (hash === "profile") await profile();
  else if (hash === "feedback") feedback();
  else if (hash === "diag") await diag();
  else if (hash === "timetable") timetable();
  else if (hash === "deadlines") await extras.deadlinesScreen();
  else if (hash === "cards") await practice.cardsScreen();
  else if (hash.startsWith("cards-")) await practice.cardsScreen(hash.slice(6));
  else if (hash === "missing") await practice.missingScreen();
  else if (hash === "progress") await practice.progressScreen();
  else if (hash === "exam-focus") await extras.examFocus();
  else if (hash === "reels") await extras.reels();
  else if (hash.startsWith("reels-")) await extras.reels(hash.slice(6));
  else if (hash === "notebooks") await notebooks();
  else if (hash.startsWith("course-")) await courseFolder(+hash.slice(7));
  else if (hash.startsWith("lesson-")) { closeLesson(); await lessonPage(hash.slice(7)); }
  else await home();
  if (isAdmin && hash.startsWith("settings")) view.querySelector("#set-account")?.insertAdjacentHTML("beforeend", '<a class="btn" href="#admin" style="justify-self:start">🛠️ ניהול Early Access</a>');
  assistant.mount(tab);
  if (!seenTabs.has(tab)) { seenTabs.add(tab); api.track("open:" + tab); }
  paintCounts();
  if (hash !== "home" && !hash.startsWith("lesson-")) {
    const pg = view.querySelector(".page");
    if (pg) { pg.insertAdjacentHTML("afterbegin", '<button class="back-btn" type="button" aria-label="חזרה לדף הקודם">→ חזרה</button>'); pg.querySelector(".back-btn").onclick = goBack; }
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
const studyCtx = { view, $, esc, svg, toast, prefs, store, demoQuiz, lessonLabel };
const study = initStudy(studyCtx);
const practice = initPractice({ view, $, esc, svg, toast, prefs, store });
studyCtx.onQuizDone = () => practice.bumpStreak();
const extras = initExtras({ view, $, esc, svg, toast, prefs, store, segmentsOf, fmtTime });
const tools = initTools({ view, $, esc, svg, toast, prefs, store, lessonTitle, onQuizDone: () => practice.bumpStreak() });
const social = initSocial({ view, $, esc, toast, prefs, store, api });
const assignments = initAssignments({ view, $, esc, toast, store, api, onChange: () => paintCounts() });
const settings = initSettings({ view, $, esc, toast, prefs, store, ai, social, api, onboardingQuestions, version: () => APP_VERSION });
const seenTabs = new Set();
// מספרים: בקשות חברות על לשונית "חברים", הודעות שלא נקראו על "הודעות"
async function paintCounts() {
  const put = (sel, n) => document.querySelectorAll(sel).forEach((el) => { el.textContent = n || ""; el.hidden = !n; });
  document.querySelectorAll('#tabs a[href="#social"], #tabs a[href="#messages"], #tabs a[href="#assignments"]').forEach((a) => { if (!a.querySelector(".tab-n")) a.insertAdjacentHTML("beforeend", '<span class="tab-n" hidden></span>'); });
  // עבודות פתוחות – מהמכשיר, עובד גם בלי אינטרנט
  try { put('#tabs a[href="#assignments"] .tab-n', await assignments.openCount()); } catch { /* */ }
  try {
    const c = await social.counts();
    put('#tabs a[href="#social"] .tab-n', c.requests); put('#tabs a[href="#messages"] .tab-n', c.unread); put(".dm-n", c.unread);
  } catch { /* בלי אינטרנט */ }
}
// סנכרון מהשרת: התראות (🔔) וסיכומים (שלי + של חברים מאותה כיתה)
let lastServerSync = 0;
async function serverSync(force = false) {
  if (!api.user() || (!force && Date.now() - lastServerSync < 60e3)) return;
  lastServerSync = Date.now();
  try {
    const fresh = await social.syncNotifications();
    planner.inboxStore().then(planner.paintBadge);
    if (fresh.length && location.hash !== "#inbox") toast(`🔔 ${fresh[0].title}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ""}`);
    if (await applyUniSchedule() && ["#calendar", "#timetable", "#deadlines", "#home", ""].includes(location.hash)) route();
    await applyCourseMaterials();
    const n = await social.syncSummaries();
    autoTranscribe();
    if (n && ["#summaries", "#quizzes", "#home", ""].includes(location.hash)) route();
    paintCounts();
  } catch (e) { logError("serverSync", e); }
}
setInterval(() => serverSync(), 2 * 60e3);
// מערכת השעות והמבחנים מהמידע האישי (דרך המחבר) – נכנסים לבד, כל עוד לא שינית אותם בעצמך.
// קורסים שעוד לא במחברות נוספים, כדי שההקלטה תדע לבד לאיזה קורס להיכנס.
// חומרים לכל קורס + קישור לזום (מהמחבר בכרום) – נשמרים במכשיר
async function applyCourseMaterials() {
  const rows = await api.courseMaterials().catch(() => null);
  if (!rows?.length) return;
  const map = {};
  for (const r of rows) map[r.course] = { zoom: r.zoom || "", items: r.items || [], at: r.updated_at };
  await store.putItem({ id: "course-materials", type: "course-materials", map });
}
async function applyUniSchedule() {
  const row = await api.uniSchedule().catch(() => null);
  const p = prefs.get();
  if (!row || !p || p.uniScheduleAt === row.updated_at) return false;
  const hidden = p.hiddenCourses || [];
  if (!p.timetableEdited && row.timetable?.length) p.timetable = row.timetable.filter((x) => !hidden.includes(x.course));
  if (!p.examsEdited && row.exams?.length) p.exams = row.exams.filter((x) => !hidden.includes(x.course));
  const add = [...new Set((row.timetable || []).map((x) => x.course))].filter((c) => c && !(p.courses || []).includes(c) && !hidden.includes(c));
  p.courses = [...(p.courses || []), ...add];
  p.uniScheduleAt = row.updated_at;
  prefs.set(p);
  return true;
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") serverSync(); });

// ---------- 📄 העלאת מצגת / PDF -> סיכום אישי ----------
function uploadPage() {
  const courses = prefs.get()?.courses || [];
  view.innerHTML = `<div class="page" style="max-width:640px">
    <h1 style="font-size:30px">📄 סיכום ממצגת או PDF</h1>
    <p class="muted">מעלים קובץ של שיעור (מצגת מהמודל, PDF, וורד או צילום של הלוח), ומקבלים סיכום אישי לפי איך שאת/ה לומד/ת, עם מבחן קצר בסוף.</p>
    <section class="card" style="display:grid;gap:12px">
      <label>קורס<select id="upC">${courses.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
      <label>הקובץ<input type="file" id="upF" accept=".pdf,.pptx,.docx,.txt,.md,image/*,application/pdf"></label>
      <p class="small muted">PDF, מצגת (pptx), וורד (docx), תמונה או טקסט · עד 15MB · עד 10 סיכומים ביום</p>
      <button class="btn" type="button" id="upGo">✨ סכם לי</button>
      <p class="small" id="upState" aria-live="polite"></p>
    </section>
    <p class="small muted">🔒 הקובץ נשלח לסיכום ולא נשמר אצלנו – רק הסיכום נשמר בחשבון שלך. משתמשים רק בחומר שקיבלת כסטודנט/ית בקורס.</p>
  </div>`;
  $("#upGo").onclick = async () => {
    const f = $("#upF").files[0]; if (!f) return toast("בחרו קובץ");
    $("#upGo").disabled = true; $("#upState").textContent = "⏳ קורא את הקובץ וכותב סיכום… (חצי דקה עד דקה)";
    try {
      const r = await social.upload(f, $("#upC").value);
      api.track("upload");
      $("#upState").textContent = "✅ הסיכום מוכן!";
      location.hash = "#sum-srv-" + r.id;
    } catch (e) { $("#upState").textContent = "❌ " + e.message; $("#upGo").disabled = false; }
  };
}

// ---------- Early Access ----------
let isAdmin = false;
function waitlistPage() {
  view.innerHTML = `<div class="page" style="max-width:560px;text-align:center;justify-items:center">
    <img src="icons/logo-mark.png" alt="" width="72" height="72">
    <p class="eyebrow">Early Access</p>
    <h1 style="font-size:32px">נרשמת – את/ה ברשימה 🎉</h1>
    <p class="muted">אנחנו פותחים את Clearly בהדרגה, כדי שהכול יעבוד מצוין לכל מי שנכנס. כשיגיע תורך נשלח מייל ל-<b dir="ltr">${esc(api.user()?.email || "")}</b>, ואז פשוט נכנסים.</p>
    <section class="soft" style="text-align:right;display:grid;gap:6px;width:100%"><b>בינתיים:</b><ul class="tips" style="margin:0"><li>אפשר לקרוא <a href="welcome/">איך Clearly עובד</a>.</li><li>ספרו לחברים מהכיתה, כדי שגם הם יירשמו.</li></ul></section>
    <div class="row" style="justify-content:center"><button class="btn" type="button" id="wlCheck">בדיקה אם כבר נפתח</button><button class="btn ghost" type="button" id="wlOut">יציאה מהחשבון</button></div>
  </div>`;
  $("#wlCheck").onclick = () => location.reload();
  $("#wlOut").onclick = async () => { await api.signOut(); location.href = "welcome/"; };
}
async function adminPage() {
  view.innerHTML = '<div class="page"><p class="muted">טוען…</p></div>';
  let r;
  try { r = await api.notifyEmail({ action: "waitlist" }); }
  catch (e) { view.innerHTML = `<div class="page"><p class="notice alert">${esc(e.message)}</p></div>`; return; }
  const list = r.waitlist || [];
  view.innerHTML = `<div class="page" style="max-width:820px">
    <h1 style="font-size:30px">🛠️ ניהול Early Access</h1>
    ${r.smtp ? `<p class="notice">📧 המיילים יוצאים מ-<b dir="ltr">${esc(r.from || "")}</b> (תשובות מגיעות ל-clearlyappsupport@gmail.com). <button class="link" type="button" id="adTest">שליחת מייל בדיקה אליי</button></p>` : '<p class="notice alert"><b>המיילים עוד לא מחוברים.</b> אפשר לאשר אנשים, אבל המייל "Clearly פתוח בשבילך" לא יישלח עד שמוסיפים בשרת את סיסמת האפליקציה של Gmail.</p>'}
    <p class="muted">${list.length} ממתינים. <b>"אישור"</b> פותח את Clearly לאדם אחד ושולח לו מייל. <b>"השקה"</b> פותח לכולם ושולח מייל לכולם.</p>
    <div class="row"><button class="btn" type="button" id="adLaunch" ${list.length ? "" : "disabled"}>🚀 השקה: לפתוח לכולם (${list.length}) ולשלוח מייל</button></div>
    <div class="list">${list.map((p) => `<div class="item"><span style="min-width:0;flex:1"><span class="t">${esc(p.full_name)} <span class="small muted" dir="ltr">@${esc(p.username)}</span></span><br><span class="small muted">${esc(p.uni)}${p.degree ? " · " + esc(p.degree) : ""} · <span dir="ltr">${esc(p.email)}</span> · נרשם/ה ב-${new Date(p.created_at).toLocaleDateString("he-IL")}</span></span><button class="btn small-btn" type="button" data-ok="${esc(p.id)}">אישור</button></div>`).join("") || '<p class="muted">אין אף אחד ברשימת ההמתנה.</p>'}</div>
  </div>`;
  view.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = "מאשר…";
    try { const x = await api.notifyEmail({ action: "approve", user_id: b.dataset.ok }); toast(x.mailed ? "✓ אושר ונשלח מייל" : "✓ אושר (המייל לא נשלח)"); adminPage(); }
    catch (e) { toast(e.message); b.disabled = false; b.textContent = "אישור"; }
  }));
  $("#adTest") && ($("#adTest").onclick = async () => {
    try { const x = await api.notifyEmail({ action: "test" }); toast(`✓ נשלח מייל בדיקה ל-${x.to}`); } catch (e) { toast(e.message); }
  });
  $("#adLaunch").onclick = async () => {
    if (!confirm(`לפתוח את Clearly לכל ${list.length} הממתינים ולשלוח לכולם מייל?`)) return;
    $("#adLaunch").disabled = true; $("#adLaunch").textContent = "פותח ושולח…";
    try { const x = await api.notifyEmail({ action: "launch" }); toast(`🚀 נפתח ל-${x.approved}, נשלחו ${x.mailed} מיילים`); adminPage(); }
    catch (e) { toast(e.message); $("#adLaunch").disabled = false; }
  };
}

// ---------- 🔗 חיבור למודל: תוסף לכרום במחשב ----------
function connectPage() {
  view.innerHTML = `<div class="page" style="max-width:680px">
    <h1 style="font-size:30px">🔗 חיבור למודל</h1>
    <p class="muted">עושים את זה <b>פעם אחת, במחשב</b> (כ-3 דקות). אחר כך הסיכומים, המטלות ומערכת השעות מגיעים לבד – גם לאייפד.</p>
    <section class="card" style="display:grid;gap:12px">
      <ol class="steps big-steps">
        <li><b>מורידים את התוסף:</b><br><a class="btn" href="extension/sikumon-connector.zip" download style="margin-top:6px">⬇️ הורדת התוסף</a><br><span class="small muted">יורד קובץ בשם sikumon-connector.zip</span></li>
        <li><b>פותחים את הקובץ:</b> בתיקיית "הורדות", לוחצים על הקובץ <b>בכפתור הימני של העכבר</b> ← <b>"חלץ הכול"</b> ← <b>"חלץ"</b>. נוצרת תיקייה רגילה.</li>
        <li><b>נכנסים לדף התוספים של כרום:</b> מעתיקים את הכתובת, מדביקים בשורת הכתובת למעלה, ולוחצים Enter.<br><span class="row" style="margin-top:6px"><code dir="ltr">chrome://extensions</code><button class="btn ghost small-btn" type="button" id="cpExt">📋 העתקה</button></span></li>
        <li><b>מדליקים את המתג "מצב פיתוח"</b> (Developer mode) – בפינה העליונה של הדף.</li>
        <li><b>לוחצים "טעינת פריט לא ארוז"</b> (Load unpacked), בוחרים את התיקייה מצעד 2, ולוחצים "בחירת תיקייה".</li>
        <li><b>מתחברים:</b> לוחצים על סמל הפאזל 🧩 למעלה בכרום ← "המחבר של Clearly" ← מתחברים עם <b>אותו מייל וסיסמה של Clearly</b>.</li>
        <li><b>בוחרים "אוניברסיטת אריאל"</b> ← "שמירה" ← "פתיחת המודל", ומתחברים למודל כרגיל.</li>
      </ol>
      <p class="notice">✅ <b>זהו!</b> מעכשיו הכול מגיע לבד. כשהמחשב דלוק וכרום פתוח, התוסף בודק את המודל כל כמה שעות.</p>
    </section>
    <p class="small muted">🔒 התוסף לא רואה ולא שומר את הסיסמה שלך למודל. נתקעת? כתבו ל-<a href="mailto:clearlyappsupport@gmail.com">clearlyappsupport@gmail.com</a> ונעזור. אין מחשב? אפשר תמיד <a href="#upload">להעלות מצגת</a> מהאייפד.</p>
  </div>`;
  $("#cpExt").onclick = async () => { try { await navigator.clipboard.writeText("chrome://extensions"); toast("הועתק ✓ עכשיו מדביקים בשורת הכתובת"); } catch { toast("סמנו את הכתובת והעתיקו אותה ידנית"); } };
}
const assistant = initAssistant({ store, esc, ai, prefs });
settings.applyUI();
// מסירים את "קורס כללי" הישן (ברירת מחדל מגרסאות קודמות) – אם אין בו שיעורים
(async () => {
  const p = prefs.get(); if (!p?.courses?.includes("קורס כללי")) return;
  if ((await store.listLessons()).some((l) => l.course === "קורס כללי")) return;
  p.courses = p.courses.filter((c) => c !== "קורס כללי"); prefs.set(p);
})().catch(() => {});
// חזרה דף אחד אחורה: אם נכנסו ישר לדף (בלי היסטוריה באפליקציה) – לבית
let navDepth = 0, goingBack = false, curTab = "home";
window.addEventListener("hashchange", () => { if (goingBack) { navDepth = Math.max(0, navDepth - 1); goingBack = false; } else navDepth++; });
// "חזרה": מתוך דף פנימי – לדף הראשי של אותה לשונית (למשל מסיכום -> לכל הסיכומים). מדף ראשי של לשונית – לבית.
function goBack() {
  const h = (location.hash.slice(1) || "home").split("?")[0];
  location.hash = h === curTab || curTab === "home" || !curTab ? "#home" : "#" + curTab;
}
const planner = initPlanner({ view, $, esc, toast, prefs, store, extras, study, lessonForToday });
// הודעות: בודקים בפתיחה, אחרי סנכרון, וכל 10 דקות
async function refreshInbox() { try { const f = await planner.refresh(); if (f.length && location.hash !== "#inbox") toast(`🔔 ${f[0].title}${f.length > 1 ? ` (+${f.length - 1})` : ""}`); } catch (e) { logError("inbox", e); } }
setTimeout(async () => { await refreshInbox(); morningPopup(); }, 2500);

// ☀️ פעם ביום, בכניסה הראשונה: חלון "מה עושים היום" (מההודעה של סוכן הבוקר)
async function morningPopup() {
  const p = prefs.get(); if (!p) return;
  const today = new Date().toLocaleDateString("en-CA");
  if (p.briefShown === today || document.getElementById("briefModal")) return;
  const m = ((await store.getItem("pack-messages"))?.items || []).find((x) => x.id === "brief-" + today);
  if (!m) return;
  p.briefShown = today; prefs.set(p);
  document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="briefModal" role="dialog" aria-labelledby="briefT"><div class="card brief-card">
    <h2 id="briefT">${m.icon || "☀️"} ${esc(m.title)}</h2><article class="md-body">${ai.miniMd(m.md || "")}</article>
    <div class="row"><button class="btn" id="briefOk">יאללה, מתחילים 💪</button><a class="btn ghost" href="#inbox" id="briefInbox">לכל ההודעות</a></div></div></div>`);
  const close = async () => {
    document.getElementById("briefModal")?.remove();
    const box = await planner.inboxStore(); box.items.forEach((x) => x.id === "pm-" + m.id && (x.read = true)); await store.putItem(box); planner.paintBadge(box);
  };
  $("#briefOk").onclick = close; $("#briefInbox").onclick = close;
}
setInterval(refreshInbox, 10 * 60e3);
window.addEventListener("hashchange", route);
// אזהרה לפני סגירה באמצע הקלטה
window.addEventListener("beforeunload", (e) => { if (recorder?.running) { e.preventDefault(); e.returnValue = ""; } });
// אם האפליקציה נסגרה באמצע הקלטה בפעם הקודמת, מסמנים אותה כנקטעה ואז מציגים
// שמירה לפני יציאה מהאפליקציה (באייפד: מעבר לאפליקציה אחרת)
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushLesson(true); });
window.addEventListener("pagehide", () => flushLesson());
// חזרה מההתחברות ל-OpenRouter: מחליפים את הקוד במפתח של המשתמש
ai.finishOpenRouterLogin().then((k) => k && toast("OpenRouter חובר ✓ בחרו מודל")).catch((e) => toast(e.message));
recoverOrphans().then(migrateRecordings).catch(() => {})
  .then(() => api.init().catch((e) => logError("api.init", e)))
  .then(() => { social.restorePrefs(); api.touch(); ai.loadQuota(); serverSync(true); if (api.user()) api.amAdmin().then((v) => { isAdmin = v; }).catch(() => {}); })
  .finally(async () => { await route(); if (api.isRecovery()) social.newPasswordModal(); });
let lastAutoSync = 0;
async function autoSync() {
  if (!study.getCode() || Date.now() - lastAutoSync < 10 * 60e3 || editingLesson || recorder?.running) return;
  lastAutoSync = Date.now();
  try {
    const r = await study.syncNow();
    refreshInbox().then(morningPopup);
    if (r?.fresh && ["#home", "#summaries", "#quizzes", "#notebooks", "#calendar", "#deadlines", "#inbox", ""].includes(location.hash)) { route(); toast("עודכן מהמודל"); }
  } catch { /* בלי אינטרנט – ננסה בפעם הבאה */ }
}
setTimeout(autoSync, 1500);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") autoSync(); });

const APP_VERSION = "54";
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
    reg.update();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update(); });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    if (recorder?.running || editingLesson) { toast("יש גרסה חדשה – היא תיכנס בפעם הבאה שתפתחו את האפליקציה"); return; }
    reloading = true; location.reload();
  });
}
document.querySelector(".beta") && (document.querySelector(".beta").textContent = "גרסת בדיקה · " + APP_VERSION);
