// סיכומון AI – האפליקציה (גרסת בדיקה). ניווט לפי # בכתובת, כל מסך הוא פונקציה שמציירת HTML.
import { LessonRecorder, store, segmentsOf, support, recoverOrphans } from "./recorder.js";
import { demoSummary, demoQuiz, onboardingQuestions } from "./demo-data.js";
import { InkEditor, COLORS, MARKER_COLORS } from "./notes.js";

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
  hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-5-2.5L3.5 15a1.5 1.5 0 0 1 2.3-2L7 14"/>',
  type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

const TABS = [
  { hash: "home", label: "בית", icon: "home" },
  { hash: "notebooks", label: "מחברות", icon: "folder" },
  { hash: "record", label: "הקלטה", icon: "mic", cls: "rec-tab" },
  { hash: "summaries", label: "סיכומים", icon: "book" },
  { hash: "profile", label: "פרופיל", icon: "user" },
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
  const recent = (await store.listLessons()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 3);
  view.innerHTML = `<div class="page">
    <div>
      <p class="eyebrow">${new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1 style="font-size:clamp(30px,5vw,44px);margin-top:8px">היי${p.name ? " " + esc(p.name) : ""}</h1>
    </div>
    <a class="card" href="#record" style="text-decoration:none;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:16px">
      <div><h2 style="font-size:24px">מתחיל שיעור?</h2><p class="muted">לחיצה אחת ומתחילים להקליט. ההקלטה נכנסת למחברת של השיעור.</p></div>
      <span class="rec-btn" style="width:84px;height:84px;box-shadow:3px 3px 0 var(--ink);flex:none">${svg("mic")}</span>
    </a>
    ${installHint()}
    <section class="soft">
      <h3>מה בודקים בגרסה הזו?</h3>
      <ol class="steps">
        <li><a href="#record">מקליטים שיעור אמיתי</a> מההתחלה ועד הסוף, ובודקים שההקלטה נשמרה.</li>
        <li>כותבים סיכום בעצמכם ב<a href="#notebooks">מחברות</a>: בעט (Apple Pencil), באצבע או בהקלדה. לכל קורס יש תיקייה, ולכל שיעור דף משלו.</li>
        <li>עוברים על <a href="#summary">הסיכום לדוגמה</a> ועל <a href="#quiz">המבחן הקצר</a>, ככה ייראו הסיכומים שלך.</li>
        <li><a href="#feedback">שולחים משוב</a>: דקה אחת, וזה עוזר לנו יותר מכל דבר אחר.</li>
      </ol>
    </section>
    <div class="grid2">
      <section class="soft"><h3>הסיכום האחרון</h3>
        <a class="item" href="#summary" style="margin-top:12px"><span><span class="t">${demoSummary.course}</span><br><span class="small muted">${demoSummary.title}</span></span><span class="chip demo">דוגמה</span></a>
      </section>
      <section class="soft"><h3>מבחן קצר מחכה לך</h3>
        <a class="item" href="#quiz" style="margin-top:12px"><span><span class="t">5 שאלות על מיקרו</span><br><span class="small muted">בערך 2 דקות</span></span><span class="chip demo">דוגמה</span></a>
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

// ----- הקלטה -----
let recorder = null;
function record() {
  const p = prefs.get(); const s = support();
  const problems = [];
  if (!s.secure) problems.push("האפליקציה חייבת לרוץ בכתובת מאובטחת (https) כדי להשתמש במיקרופון.");
  if (!s.mic || !s.recorder) problems.push("הדפדפן הזה לא תומך בהקלטה. באייפד ובאייפון צריך iOS 14.3 ומעלה, בדפדפן Safari.");
  const active = recorder?.rec && recorder.rec.status !== "done";
  const paused = recorder?.rec?.status === "paused";
  view.innerHTML = `<div class="page">
    <h1 style="font-size:32px">הקלטת שיעור</h1>
    ${problems.map((x) => `<p class="notice alert">${x}</p>`).join("")}
    <label class="field">איזה קורס?<select id="course" name="course" ${active ? "disabled" : ""}>${(p.courses || []).map((c) => `<option ${recorder?.rec?.course === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
    <div class="card rec-stage">
      <div class="clock" id="clock" role="timer">${fmtTime(recorder?.elapsedMs || 0)}</div>
      <div class="meter" aria-hidden="true"><i id="lvl"></i></div>
      <button class="rec-btn ${recorder?.running ? "on" : ""}" id="recBtn" ${problems.length ? "disabled" : ""}>
        ${recorder?.running ? svg("stop") + "<span>סיום</span>" : svg("mic") + "<span>" + (paused ? "המשך" : "הקלט") + "</span>"}
      </button>
      <p class="saved-line" id="savedLine" aria-live="polite">${savedLine()}</p>
      ${paused ? '<p class="notice alert" style="text-align:right">ההקלטה נעצרה. לחצו "המשך" כדי להמשיך מאותה נקודה, או סיימו ושמרו את מה שכבר הוקלט.</p><button class="btn ghost" id="finishPaused">לסיים ולשמור</button>' : ""}
    </div>
    <div class="notice"><strong>כדי שההקלטה תחזיק את כל השיעור:</strong>
      <ul class="tips"><li>השאירו את סיכומון פתוח על המסך. אפשר לכתוב במקביל במסך מפוצל.</li><li>לא לנעול את המסך. ${s.wakeLock ? "האפליקציה מנסה להשאיר אותו דלוק לבד." : "כדאי לכבות נעילה אוטומטית בהגדרות."}</li><li>חברו למטען אם השיעור ארוך.</li></ul>
    </div>
    <p class="small muted">ההקלטה נכנסת אוטומטית למחברת של הקורס, לשיעור של היום. מקליטים רק כשזה מותר לפי מדיניות המרצה והמוסד. ההקלטה נשמרת רק במכשיר שלך.</p>
  </div>`;
  $("#recBtn").onclick = onRecClick;
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

// מתחיל הקלטה ומשייך אותה לשיעור (של היום בקורס הזה, או לשיעור שפתוח במחברת)
async function startRecording(course, lessonId = null) {
  const lesson = lessonId ? await store.getLesson(lessonId) : await lessonForToday(course);
  const r = new LessonRecorder();
  bindRecorder(r);
  await r.start(course, lesson.id);
  recorder = r; // רק אחרי שהמיקרופון באמת נפתח
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
    <div class="list">${recs.length ? recs.map(recItem).join("") : '<p class="muted">עוד אין הקלטות.</p>'}</div>
  </div>`;
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
    if ($("#del").dataset.sure) { await store.deleteRecording(id); toast("ההקלטה נמחקה"); location.hash = "recordings"; }
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

async function notebooks() {
  const p = prefs.get();
  const lessons = await store.listLessons();
  const courses = p.courses || [];
  view.innerHTML = `<div class="page">
    <h1 style="font-size:32px">המחברות שלי</h1>
    <p class="muted">תיקייה לכל קורס, ובכל תיקייה דף נפרד לכל שיעור. בדף יש כתב יד, הקלדה וההקלטה של אותו שיעור.</p>
    <div class="folders">${courses.map((c, i) => {
      const n = lessons.filter((l) => l.course === c).length;
      return `<a class="folder" href="#course-${i}" style="--fc:${FOLDER_COLORS[i % FOLDER_COLORS.length]}">${svg("folder")}<b>${esc(c)}</b><span class="small muted">${n ? n + (n === 1 ? " שיעור" : " שיעורים") : "עוד אין שיעורים"}</span></a>`;
    }).join("")}
      <button class="folder add" id="addCourse">${svg("plus")}<b>קורס חדש</b></button>
    </div>
    <p class="small"><a href="#recordings">כל ההקלטות</a></p>
  </div>`;
  $("#addCourse").onclick = () => {
    const name = (prompt("שם הקורס החדש:") || "").trim();
    if (!name) return;
    const pr = prefs.get();
    if ((pr.courses || []).includes(name)) return toast("הקורס הזה כבר קיים");
    pr.courses = [...(pr.courses || []), name]; prefs.set(pr);
    notebooks(); toast("נוספה תיקייה: " + name);
  };
}

async function courseFolder(i) {
  const course = (prefs.get().courses || [])[i];
  if (!course) { location.hash = "notebooks"; return; }
  const lessons = (await store.listLessons()).filter((l) => l.course === course).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  view.innerHTML = `<div class="page">
    <a href="#notebooks" class="small">→ כל המחברות</a>
    <div class="row" style="justify-content:space-between"><h1 style="font-size:30px;color:${FOLDER_COLORS[i % FOLDER_COLORS.length]}">${esc(course)}</h1>
      <button class="btn" id="newLesson">${svg("plus")} שיעור חדש</button></div>
    <div class="list">${lessons.length ? lessons.map((l) => lessonItem(l)).join("") : '<p class="muted">עוד אין שיעורים בקורס הזה. לחצו "שיעור חדש" כדי לפתוח דף ולכתוב.</p>'}</div>
  </div>`;
  $("#newLesson").onclick = async () => {
    const l = newLesson(course);
    await store.saveLesson(l);
    location.hash = "lesson-" + l.id;
  };
}

// ----- דף השיעור: כתב יד / הקלדה / הקלטות -----
let editor = null, editingLesson = null, saveTimer = null, lessonTimer = null;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(flushLesson, 700); }
async function flushLesson() {
  clearTimeout(saveTimer);
  if (!editingLesson) return;
  if (editor) editingLesson.pages = editor.pages;
  await store.saveLesson(editingLesson);
}
function closeLesson() {
  if (editingLesson) flushLesson();
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
        <button class="btn ghost small-btn" id="lshare">${svg("share")} <span>שיתוף</span></button>
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
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.lastElementChild.textContent = "בטוח? לחצו שוב (ההקלטות יישארו)"; return; }
    editingLesson = null;
    await store.deleteLesson(l.id);
    toast("השיעור נמחק");
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
function summaries() {
  const p = prefs.get();
  view.innerHTML = `<div class="page">
    <h1 style="font-size:32px">הסיכומים שלי</h1>
    <div class="list">
      <a class="item" href="#summary"><span><span class="t">${demoSummary.course}</span><br><span class="small muted">${demoSummary.title}</span></span><span class="chip demo">דוגמה</span></a>
    </div>
    <h2 style="font-size:22px">הקורסים שלי</h2>
    <div class="grid3">${(p.courses || []).map((c) => `<div class="soft"><b>${esc(c)}</b><p class="small muted">הסיכומים יופיעו כאן אחרי ההקלטה הראשונה</p></div>`).join("")}</div>
  </div>`;
}

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

function quiz(i = 0, score = 0, picked = null) {
  const qs = demoQuiz.questions;
  if (i >= qs.length) {
    view.innerHTML = `<div class="page" style="text-align:center;justify-items:center">
      <p class="eyebrow">סיימת</p><h1 style="font-size:48px">${score} / ${qs.length}</h1>
      <p class="muted">${score === qs.length ? "מושלם! החומר יושב טוב." : score >= qs.length - 2 ? "יפה מאוד. כדאי לעבור שוב על השאלות שטעית בהן." : "שווה לחזור על הסיכום ולנסות שוב."}</p>
      <div class="row" style="justify-content:center"><button class="btn" id="again">שוב</button><a class="btn ghost" href="#summary">חזרה לסיכום</a></div></div>`;
    $("#again").onclick = () => quiz();
    return;
  }
  const q = qs[i];
  view.innerHTML = `<div class="page">
    <div class="progress" aria-hidden="true"><i style="width:${(i / qs.length) * 100}%"></i></div>
    <div class="row" style="justify-content:space-between"><p class="eyebrow">שאלה ${i + 1} מתוך ${qs.length}</p><span class="chip demo">דוגמה</span></div>
    <h2 style="font-size:26px">${q.q}</h2>
    <div class="options">${q.options.map((o, k) => {
      const cls = picked === null ? "" : k === q.a ? "correct" : k === picked ? "wrong" : "";
      return `<button class="opt ${cls}" data-k="${k}" ${picked !== null ? "disabled" : ""}>${o}</button>`;
    }).join("")}</div>
    ${picked !== null ? `<p class="notice">${picked === q.a ? "נכון! " : "לא בדיוק. "}${q.why}</p><div class="row"><button class="btn" id="next">${i + 1 < qs.length ? "לשאלה הבאה" : "לתוצאה"}</button></div>` : ""}
  </div>`;
  view.querySelectorAll(".opt").forEach((b) => (b.onclick = () => quiz(i, score + (+b.dataset.k === q.a ? 1 : 0), +b.dataset.k)));
  $("#next") && ($("#next").onclick = () => quiz(i + 1, score));
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
    <div class="row"><button class="btn ghost" id="redo">לענות מחדש על השאלון</button><a class="btn" href="#feedback">${svg("share")} שליחת משוב</a></div>
    <div class="soft small"><b>פרטיות:</b> בגרסת הבדיקה הכול נשמר רק במכשיר שלך: התשובות, הקורסים וההקלטות. שום דבר לא נשלח לשרת. משוב נשלח רק כשאתם לוחצים "שליחה" ובוחרים למי.</div>
    <div class="soft small"><b>בדיקת מכשיר:</b> מיקרופון ${s.mic ? "✓" : "✗"} · הקלטה ${s.recorder ? "✓" : "✗"} (${esc(s.mime || "לא ידוע")}) · מסך דלוק ${s.wakeLock ? "✓" : "✗"} · מותקן כאפליקציה ${s.standalone ? "✓" : "✗"}</div>
    ${!s.standalone ? '<p class="notice"><b>להתקנה באייפד/אייפון:</b> ב-Safari לוחצים על כפתור השיתוף ובוחרים "הוסף למסך הבית".</p>' : ""}
  </div>`;
  $("#redo").onclick = () => onboarding(0);
}

// ---------- ניתוב ----------
async function route() {
  const hash = location.hash.slice(1) || "home";
  if (!prefs.get()) return onboarding(0);
  if (!hash.startsWith("lesson-")) closeLesson();
  const tab = hash.startsWith("rec-") || hash.startsWith("course-") || hash.startsWith("lesson-") || hash === "recordings" ? "notebooks" : hash === "summary" || hash === "quiz" ? "summaries" : hash === "feedback" ? "profile" : hash;
  renderTabs(tab);
  if (hash === "home") await home();
  else if (hash === "record") record();
  else if (hash === "recordings") await recordings();
  else if (hash.startsWith("rec-")) await recordingDetail(hash.slice(4));
  else if (hash === "summaries") summaries();
  else if (hash === "summary") summary();
  else if (hash === "quiz") quiz();
  else if (hash === "profile") profile();
  else if (hash === "feedback") feedback();
  else if (hash === "notebooks") await notebooks();
  else if (hash.startsWith("course-")) await courseFolder(+hash.slice(7));
  else if (hash.startsWith("lesson-")) { closeLesson(); await lessonPage(hash.slice(7)); }
  else await home();
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
// אזהרה לפני סגירה באמצע הקלטה
window.addEventListener("beforeunload", (e) => { if (recorder?.running) { e.preventDefault(); e.returnValue = ""; } });
// אם האפליקציה נסגרה באמצע הקלטה בפעם הקודמת, מסמנים אותה כנקטעה ואז מציגים
// שמירה לפני יציאה מהאפליקציה (באייפד: מעבר לאפליקציה אחרת)
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushLesson(); });
window.addEventListener("pagehide", () => flushLesson());
recoverOrphans().then(migrateRecordings).catch(() => {}).finally(route);

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
