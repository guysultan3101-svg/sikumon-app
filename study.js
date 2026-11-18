// סיכומים ומבחנים: ייבוא מ-Drive, רשימת סיכומים לפי קורס, מבחנים אישיים, היסטוריה ויצירת מבחן.
// הכול נשמר במכשיר (IndexedDB) – שום דבר לא עולה לשרת.

import { takeQuizSlot, markQuizStarted } from "./limits.js";
import { makeQuery, markDom, courseKey } from "./search-he.js";

export function initStudy(ctx) {
  const { view, $, esc, svg, toast, prefs, store, demoQuiz } = ctx;
  // "שיעור 5 · 3.11.2026" לסיכום של שיעור (מזום / מהקלטה); אחרת רק התאריך
  const when = (s) => (s.lessonDate ? ctx.lessonLabel(s.course, s.lessonDate, s.lessonNo) : fmtDay(s.date));
  const srcIcon = (s) => (s.source === "zoom" ? "📹 " : s.source === "recording" ? "🎙️ " : "");
  const fmtDay = (iso) => new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
  const byCourse = (items) => {
    const order = prefs.get().courses || [];
    const m = new Map();
    for (const it of items) { if (!m.has(it.course)) m.set(it.course, []); m.get(it.course).push(it); }
    return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
  };
  // טווח מספרים בכותרת (1–2) מוצג משמאל לימין, כדי שלא יתהפך
  // רק טווח של שני מספרים ("1–2"); תאריך כמו 12-11-2026 נשאר כמו שהוא (הוא כבר מוצג נכון)
  const escT = (t) => esc(t).replace(/(?<![\d.\/]|\d\s*[–-]\s*)(\d+)\s*([–-])\s*(\d+)(?![\d.\/]|\s*[–-]\s*\d)/g, '<bdi dir="ltr">$1$2$3</bdi>');
  const lib = async (type) => (await store.listItems()).filter((x) => x.type === type);

  // ---------- ייבוא החבילה מ-Drive ----------
  async function importPack(file) {
    let pack;
    try { pack = JSON.parse(await file.text()); } catch { throw new Error("הקובץ לא נקרא. בחרו את 'סיכומון - החומר שלי.json'."); }
    return applyPack(pack);
  }
  async function applyPack(pack) {
    if (pack?.type !== "sikumon-pack") throw new Error("זה לא קובץ של Clearly.");
    for (const s of pack.summaries || []) await store.putItem({ ...s, type: "summary" });
    if (pack.moodle) await store.putItem({ id: "moodle-feed", type: "moodle", courses: pack.moodle, at: pack.createdAt });
    if (pack.deadlines) await store.putItem({ id: "deadlines", type: "deadlines", events: pack.deadlines, at: pack.createdAt });
    if (pack.podcasts) await store.putItem({ id: "podcasts", type: "podcasts", items: pack.podcasts, at: pack.createdAt });
    if (pack.messages) await store.putItem({ id: "pack-messages", type: "messages", items: pack.messages, at: pack.createdAt });
    for (const q of pack.quizzes || []) await store.putItem({ ...q, type: "quiz" });
    // תמלולי שיעורים מהזום (מהמחשב) – מופיעים באזור ההקלטות של הקורס, מחוברים לסיכום של אותו שיעור
    for (const t of pack.transcripts || []) await store.putItem({ ...t, type: "transcript" });
    // קורסים חדשים מ-Moodle נכנסים גם למחברות
    const p = prefs.get();
    const add = (pack.courses || []).filter((c) => !(p.courses || []).includes(c) && !(p.hiddenCourses || []).includes(c));
    // מערכת השעות מגיעה מהמחשב, כל עוד לא שינית אותה בעצמך באפליקציה
    if (pack.exams?.length && !p.examsEdited) p.exams = pack.exams;
    if (pack.timetable?.length && !p.timetableEdited) p.timetable = pack.timetable.filter((x) => !(p.hiddenCourses || []).includes(x.course));
    p.courses = [...(p.courses || []), ...add];
    p.lastImport = new Date().toISOString();
    prefs.set(p);
    return { summaries: (pack.summaries || []).length, quizzes: (pack.quizzes || []).length, courses: add.length };
  }
  // ---------- סנכרון אוטומטי מהמחשב (מודל + סיכומים + מבחנים) ----------
  // המחשב מעלה קובץ נעול; כאן מורידים אותו ופותחים עם קוד הצימוד. בלי הקוד הקובץ לא קריא.
  const SYNC_BASE = "https://guysultan3101-svg.github.io/sikumon-sync/";
  const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const getCode = () => { try { return localStorage.getItem("sikumon-sync-code") || ""; } catch { return ""; } };
  const b64 = (x) => Uint8Array.from(atob(x), (ch) => ch.charCodeAt(0));
  async function syncFileName(code) {
    const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sikumon-sync:" + normCode(code)));
    return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 20) + ".json";
  }
  async function decryptBytes(code, f) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(normCode(code)), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(f.salt), iterations: f.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(f.iv) }, key, b64(f.data));
  }
  async function decrypt(code, f) { return JSON.parse(new TextDecoder().decode(await decryptBytes(code, f))); }
  // קובץ קול של פודקאסט: מורידים פעם אחת, פותחים עם קוד הצימוד, ושומרים במכשיר לשמיעה גם בלי אינטרנט
  async function podcastAudio(pod) {
    const cached = await store.getItem("pod-audio-" + pod.key);
    if (cached?.blob) return cached.blob;
    const res = await fetch(SYNC_BASE + pod.file, { cache: "no-store" });
    if (!res.ok) throw new Error("הפרק עוד לא זמין להורדה. נסו שוב בעוד כמה דקות.");
    const blob = new Blob([await decryptBytes(getCode(), await res.json())], { type: "audio/mpeg" });
    await store.putItem({ id: "pod-audio-" + pod.key, type: "pod-audio", blob });
    return blob;
  }
  let syncing = null;
  async function syncNow(code = getCode(), { quiet = true } = {}) {
    if (!code) return null;
    if (syncing) return syncing;
    syncing = (async () => {
      const res = await fetch(SYNC_BASE + (await syncFileName(code)) + "?t=" + Date.now(), { cache: "no-store" });
      if (res.status === 404) throw new Error("לא נמצא עדכון לקוד הזה. בדקו שהקוד הוקלד נכון.");
      if (!res.ok) throw new Error("אין חיבור לאינטרנט כרגע.");
      let pack;
      try { pack = await decrypt(code, await res.json()); } catch { throw new Error("הקוד לא מתאים. בדקו שהוקלד נכון."); }
      const p0 = prefs.get();
      const fresh = !p0.lastSync || pack.createdAt !== p0.lastSyncPack;
      const r = await applyPack(pack);
      const p = prefs.get(); p.lastSync = new Date().toISOString(); p.lastSyncPack = pack.createdAt; prefs.set(p);
      if (fresh && !quiet) toast(`עודכן מהמודל: ${r.summaries} סיכומים, ${r.quizzes} מבחנים`);
      return { ...r, fresh };
    })();
    try { return await syncing; } finally { syncing = null; }
  }
  // מסך הצימוד: מקלידים פעם אחת את הקוד מהמחשב
  function pairCard() {
    const code = getCode();
    const p = prefs.get();
    if (code) return `<div class="soft small row" style="justify-content:space-between"><span>🔗 <b>מחובר למודל דרך המחשב.</b> ${p.lastSync ? `עודכן <bdi>${new Date(p.lastSync).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</bdi>` : ""}</span><button class="btn ghost small-btn" id="syncBtn">רענון</button></div>`;
    // קוד צימוד מהמחשב – רק דרך הקישור המיוחד (#summaries?pair). לבודקים זה מבלבל
    if (!/pair/.test(location.href)) return "";
    return `<details class="soft small"><summary>יש לך קוד צימוד מהמחשב?</summary><section class="pair" style="margin-top:8px"><h2 style="font-size:19px;margin:0">🔗 חיבור בקוד צימוד</h2>
      <p class="small muted">מקלידים פעם אחת את קוד הצימוד מהמחשב. מאותו רגע, כל מה שחדש במודל, כל סיכום וכל מבחן נכנסים לאפליקציה לבד.</p>
      <div class="row" style="margin-top:10px"><input type="text" id="pairCode" name="pairCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" style="flex:1;min-width:180px;direction:ltr;text-align:center;font-family:var(--font-mono);letter-spacing:.1em"><button class="btn" id="pairGo">חיבור</button></div></section></details>`;
  }
  function bindPair(after) {
    $("#syncBtn") && ($("#syncBtn").onclick = async () => {
      try { const r = await syncNow(getCode(), { quiet: false }); if (r && !r.fresh) toast("הכול מעודכן"); after(); } catch (e) { toast(e.message); }
    });
    $("#pairGo") && ($("#pairGo").onclick = async () => {
      const code = $("#pairCode").value;
      if (normCode(code).length !== 12) { toast("הקוד צריך להיות 12 תווים, כמו XXXX-XXXX-XXXX"); return; }
      $("#pairGo").disabled = true; $("#pairGo").textContent = "מתחבר…";
      try {
        await syncNow(code);
        try { localStorage.setItem("sikumon-sync-code", normCode(code)); } catch { /* */ }
        toast("מחובר! הסיכומים, המבחנים והמודל נכנסו לאפליקציה");
        after();
      } catch (e) { toast(e.message); $("#pairGo").disabled = false; $("#pairGo").textContent = "חיבור"; }
    });
  }

  function importButton(label = "ייבוא מ-Drive") {
    return `<label class="btn ghost">${svg("download")} ${label}<input type="file" class="packInput" accept=".json,application/json" hidden></label>`;
  }
  function bindImport(after) {
    view.querySelectorAll(".packInput").forEach((inp) => (inp.onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        const r = await importPack(f);
        toast(`יובאו ${r.summaries} סיכומים ו-${r.quizzes} מבחנים${r.courses ? `, ו-${r.courses} קורסים נוספו למחברות` : ""}`);
        after();
      } catch (err) { toast(err.message); }
      e.target.value = "";
    }));
  }

  // ---------- רמת קושי לכל קורס (1 = הכי קל לי, 5 = הכי קשה) ----------
  const levelOf = (c) => ((prefs.get() || {}).levels || {})[c] || 0;
  function setLevel(c, n) {
    const p = prefs.get(); if (!p) return;
    p.levels = { ...(p.levels || {}) };
    if (n) p.levels[c] = n; else delete p.levels[c];
    prefs.set(p);
    ctx.pushPrefs?.();
  }
  function levelPicker(course) {
    const v = levelOf(course);
    return `<div class="lvl-row" data-course="${esc(course)}"><span class="small">קושי עבורי:</span><span class="lvl" role="group" aria-label="רמת קושי של הקורס, 1 הכי קל ו-5 הכי קשה">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="lvl-b" data-lvl="${n}" aria-pressed="${v === n}" aria-label="קושי ${n} מתוך 5">${n}</button>`).join("")}</span><span class="small muted">1 קל לי · 5 הכי קשה</span></div>`;
  }
  function bindLevels(root, after) {
    root.querySelectorAll(".lvl-row").forEach((row) => row.querySelectorAll(".lvl-b").forEach((b) => (b.onclick = () => {
      const c = row.dataset.course, n = +b.dataset.lvl, cur = levelOf(c);
      setLevel(c, cur === n ? 0 : n);   // לחיצה שוב על אותו מספר מבטלת
      row.querySelectorAll(".lvl-b").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.lvl === levelOf(c))));
      toast(levelOf(c) ? `קושי ${levelOf(c)} מתוך 5. מעכשיו העוזר, הסיכומים החדשים והמבחנים יותאמו לזה` : "רמת הקושי נמחקה");
      after?.();
    })));
  }
  const isNb = (s) => String(s.title || "").startsWith("📓");

  // ---------- סיכומים ----------
  async function summaries() {
    // סיכום שקיים גם במכשיר וגם בשרת (גיבוי, או אותה כותרת): מוצג פעם אחת – העותק במכשיר, שקשור לפודקאסט ולמבחן
    const all = (await lib("summary")).filter((x) => x.kind !== "formulas"), localIds = new Set(all.map((x) => x.id));   // דפי נוסחאות: בדף "תוספים לשיעורים"
    const normT = (t) => String(t || "").replace(/[\s"'״׳–-]+/g, " ").trim().toLowerCase();
    const localTitles = new Set(all.filter((x) => !x.server && !x.from).map((x) => normT(x.title)));
    const items = all.filter((x) => !(x.ref?.startsWith("local:") && localIds.has(x.ref.slice(6))) && !(x.server && !x.from && !isNb(x) && localTitles.has(normT(x.title)))).sort((a, b) => (a.kind === "formulas") - (b.kind === "formulas") || isNb(b) - isNb(a) || b.date.localeCompare(a.date));
    // סיכום ששיתפו איתי: נכנס לקורס שלי באותו שם (גם אם אצל החבר הקורס כתוב קצת אחרת)
    const myKeys = new Map(); for (const c of [...(prefs.get()?.courses || []), ...items.filter((x) => !x.from).map((x) => x.course)]) { const k = courseKey(c); if (c && !myKeys.has(k)) myKeys.set(k, c); }
    const shown = items.map((x) => (x.from ? { ...x, course: myKeys.get(courseKey(x.course)) || x.course } : x));
    const groups = byCourse(shown);
    for (const c of prefs.get()?.courses || []) if (c && !groups.some(([k]) => k === c)) groups.push([c, []]);
    // הסיכומים ששיתפו איתי – בתיקייה לכל אדם (לפי השם שלו), ולא בתוך הרשימה שלי
    const sharedOf = (list) => { const m = new Map(); for (const s of list.filter((x) => x.from)) { const k = s.fromId || s.from; if (!m.has(k)) m.set(k, { name: s.from, list: [] }); m.get(k).list.push(s); } return [...m.values()].sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name, "he")); };
    const sumItem = (s) => `<a class="item" href="#sum-${esc(s.id)}"><span style="min-width:0"><span class="t">${escT(s.title)}</span><br><span class="small muted">${s.kind === "formulas" ? "דף נוסחאות · " : srcIcon(s)}<bdi>${esc(when(s))}</bdi></span></span>${s.kind === "formulas" ? '<span class="chip">📐 נוסחאות</span>' : ""}</a>`;
    const sharedPanel = (list, gi) => { const people = sharedOf(list); return `<div class="sh-panel" id="shp-${gi}" hidden>${people.length ? people.map((p) => `<details class="sh-folder"><summary>📁 הסיכומים ששותפו על ידי <b><bdi>${esc(p.name)}</bdi></b> <span class="muted">(${p.list.length})</span></summary><div class="list">${p.list.map(sumItem).join("")}</div></details>`).join("") : '<p class="small muted" style="margin:0">עוד אף אחד לא שיתף איתך סיכומים בקורס הזה. חברים יכולים לשתף איתך קורס מהפרופיל שלהם (🤝 שיתוף).</p>'}</div>`; };
    view.innerHTML = `<div class="page">
      <h1 style="font-size:32px">הסיכומים שלי</h1>
      <a class="notice" href="#extras" style="display:block;text-decoration:none;color:inherit">🧩 <b>תוספים לשיעורים</b>: דפי עבודה, תרגילים, פתרונות, סילבוס ודפי נוסחאות, מהמודל ←</a>
      ${pairCard()}
      ${groups.map(([course, list], gi) => `<section class="soft"><div class="row" style="justify-content:space-between;align-items:center;gap:8px"><h2 style="font-size:20px">${esc(course)}</h2>${list.some((x) => !isNb(x) && x.kind !== "formulas" && !x.from && !x.demo) ? `<button class="btn ghost small-btn nb-btn" data-g="${gi}" type="button">${list.some((x) => isNb(x) && !x.from) ? "🔄 עדכון המחברת המסכמת" : "📓 מחברת מסכמת"}</button>` : ""}<button class="btn ghost small-btn sh-btn" data-g="${gi}" type="button" aria-expanded="false" aria-controls="shp-${gi}">🤝 שיתפו איתי (${list.filter((x) => x.from).length})</button><button class="btn ghost small-btn my-up" data-g="${gi}" type="button">📝 העלאת סיכום שלי</button></div>${levelPicker(course)}${sharedPanel(list, gi)}<div class="list" style="margin-top:10px">${list.filter((s) => !s.from).map(sumItem).join("")}</div></section>`).join("")}
      ${items.length ? "" : `<section class="soft"><h2 style="font-size:20px;margin:0">עוד אין סיכומים</h2><p class="small muted">העלו מצגת או PDF של שיעור, או חברו את המודל – והסיכומים יגיעו לכאן, מותאמים לאיך שאת/ה לומד/ת.</p><div class="row" style="margin-top:8px"><a class="btn" href="#upload">📄 העלאת מצגת</a><a class="btn ghost" href="#connect">🔗 חיבור למודל</a></div></section>`}

    </div>`;
    bindImport(summaries);
    bindPair(summaries);
    bindLevels(view);
    // מחברת מסכמת: כל הסיכומים של הקורס בסיכום אחד (נספר כסיכום אחד מהמכסה היומית)
    view.querySelectorAll(".my-up").forEach((b) => (b.onclick = () => ctx.ownSummary?.(groups[+b.dataset.g][0])));
    view.querySelectorAll(".sh-btn").forEach((b) => (b.onclick = () => {
      const p = view.querySelector("#shp-" + b.dataset.g); p.hidden = !p.hidden; b.setAttribute("aria-expanded", String(!p.hidden));
      if (!p.hidden) { const f = p.querySelectorAll("details"); if (f.length === 1) f[0].open = true; }   // אדם אחד – פותחים ישר את התיקייה שלו
    }));
    view.querySelectorAll(".nb-btn").forEach((b) => (b.onclick = async () => {
      const course = groups[+b.dataset.g][0];
      if (!ctx.api) return;
      b.disabled = true; const old = b.textContent; b.textContent = "בונה מחברת… (עד דקה)";
      try {
        // הטקסט של כל הסיכומים שלי בקורס (מהישן לחדש), בלי דפי נוסחאות ובלי מחברת קודמת
        const mine = groups[+b.dataset.g][1].filter((x) => !isNb(x) && x.kind !== "formulas" && !x.from && !x.demo).sort((x, y) => String(x.date).localeCompare(String(y.date)));
        const toText = (html) => { const d = document.createElement("div"); d.innerHTML = html || ""; d.querySelectorAll("h1,h2,h3,h4,p,li,tr,br").forEach((n) => n.append("\n")); return d.textContent.replace(/\n{3,}/g, "\n\n").trim(); };
        const text = mine.map((x) => `## ${x.title}\n${ctx.htmlToMd ? ctx.htmlToMd(x.html) : toText(x.html)}`).join("\n\n");   // Markdown: טבלאות ורשימות נשמרות
        const r = await ctx.api.courseNotebook(course, text, Math.max(mine.length, 2));
        await ctx.syncSummaries?.();
        toast(`📓 המחברת המסכמת של ${course} מוכנה (מ-${r.count} סיכומים)`);
        summaries();
      } catch (err) { toast(err.message); b.disabled = false; b.textContent = old; }
    }));
  }

  async function summaryPage(id) {
    const s = await store.getItem(id);
    if (!s) { view.innerHTML = '<div class="page"><p>הסיכום לא נמצא.</p><a href="#summaries">לכל הסיכומים</a></div>'; return; }
    const quiz = (await lib("quiz")).find((q) => q.summaryId === id);
    view.innerHTML = `<div class="page summary">
      <a href="#summaries" class="small">→ כל הסיכומים</a>
      <div class="row"><span class="chip">${esc(s.course)}</span><span class="chip">${srcIcon(s)}<bdi>${esc(when(s))}</bdi></span></div>
      ${!s.from && !s.demo ? `<div class="row" style="gap:8px;align-items:center"><label class="small" for="sumCourse">📂 הקורס של הסיכום:</label><select id="sumCourse" style="min-width:180px">${[...new Set([s.course, ...(prefs.get()?.courses || [])].filter(Boolean))].map((c) => `<option ${c === s.course ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><button class="btn ghost small-btn" type="button" id="sumCourseGo">שמירה</button></div>` : ""}
      <h1 style="font-size:clamp(24px,4vw,34px)">${escT(s.title)}</h1>
      <article class="card md-body">${s.html}</article>
      <div class="row">${quiz ? `<a class="btn" href="#quiz-${esc(quiz.id)}">${svg("check")} למבחן על הסיכום (${quiz.questions.length} שאלות)</a>` : ""}<button class="btn ghost" id="sumPdf" type="button" hidden>📄 PDF</button></div>
    </div>`;
    // טבלאות רחבות נגללות הצידה בטלפון
    view.querySelectorAll(".md-body table").forEach((t) => { const w = document.createElement("div"); w.className = "tablewrap"; t.replaceWith(w); w.appendChild(t); });
    // הגענו מהחיפוש: מסמנים את המילה בסיכום וגוללים ישר למקום הראשון שבו היא מופיעה
    let hq = ""; try { hq = sessionStorage.getItem("clearly-hl") || ""; sessionStorage.removeItem("clearly-hl"); } catch { /* בלי אחסון */ }
    if (hq) {
      const first = markDom(view.querySelector(".md-body"), makeQuery(hq));
      if (first) {
        const n = view.querySelectorAll(".md-body mark.hl").length;
        view.querySelector(".page h1").insertAdjacentHTML("afterend", `<p class="small hl-note" role="status">🔍 מסומן: "${esc(hq)}" · ${n === 1 ? "מקום אחד" : n + " מקומות"} <button type="button" class="link" id="hlNext">הבא ↓</button> <button type="button" class="link" id="hlClear">ניקוי הסימון</button></p>`);
        let at = 0; const marks = [...view.querySelectorAll(".md-body mark.hl")];
        const go = (k) => { marks.forEach((m) => m.classList.remove("now")); const m = marks[k]; m.classList.add("now"); m.scrollIntoView({ block: "center", behavior: "smooth" }); };
        $("#hlNext").onclick = () => { at = (at + 1) % marks.length; go(at); };
        $("#hlClear").onclick = () => { marks.forEach((m) => m.replaceWith(m.textContent)); view.querySelector(".hl-note")?.remove(); };
        requestAnimationFrame(() => setTimeout(() => go(0), 120));
      }
    }
    $("#sumPdf").onclick = () => exportPdf(s);
    if ($("#sumCourseGo")) $("#sumCourseGo").onclick = async () => {
      const c = $("#sumCourse").value; if (!c || c === s.course) return toast("זה כבר הקורס של הסיכום");
      try {
        if (s.server && s.id.startsWith("srv-")) await ctx.api.setSummaryCourse(s.id.slice(4), c);
        else {
          const copy = (await lib("summary")).find((x) => x.ref === "local:" + s.id);
          if (copy) { await ctx.api.setSummaryCourse(copy.id.slice(4), c); await store.putItem({ ...copy, course: c }); }
        }
        await store.putItem({ ...s, course: c });
        toast(`✓ הסיכום עבר ל${c}`); dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (e) { toast("לא הצלחתי לשנות: " + e.message); }
    };
  }

  // ייצוא סיכום / מחברת מסכמת לקובץ PDF אמיתי (בלי חלון הדפסה): הלוגו של Clearly בפינה הימנית העליונה של כל עמוד.
  // במחשב הקובץ יורד; באייפון/אייפד נפתח "שיתוף" – משם שומרים בקבצים או מדפיסים.
  // הדף נבנה מחוץ למסך, הדפדפן עצמו מצייר כל עמוד (SVG ← תמונה) – כך עברית, אנגלית ומספרים יוצאים בדיוק כמו במסך –
  // וכל העמודים נכנסים לקובץ PDF אחד.
  const JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  const loadPdfLib = () => window.jspdf ? Promise.resolve() : new Promise((ok, bad) => {
    const sc = document.createElement("script"); sc.src = JSPDF; sc.onload = ok;
    sc.onerror = () => { sc.remove(); bad(new Error("אין חיבור לאינטרנט – לא הצלחתי להכין PDF")); };
    document.head.appendChild(sc);
  });
  const toDataUrl = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(blob); });
  // הגופנים של האפליקציה (Heebo / Rubik) מוטמעים בתמונה, אחרת היא נכתבת בגופן ברירת מחדל
  let fontCss = null;
  async function embeddedFonts() {
    if (fontCss !== null) return fontCss;
    fontCss = "";
    try {
      const links = [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"]')];
      for (const l of links) {
        let css = await (await fetch(l.href)).text();
        // רק עברית ולטינית בסיסית – לא מורידים את כל השפות
        const faces = css.split("}").filter((f) => /@font-face/.test(f) && /U\+0590|U\+0000-00FF/i.test(f));
        for (const f of faces) {
          const u = f.match(/url\((https:[^)]+)\)/)?.[1]; if (!u) continue;
          const data = await toDataUrl(await (await fetch(u)).blob());
          fontCss += f.replace(u, data) + "}\n";
        }
      }
    } catch { /* בלי חיבור – גופן ברירת מחדל */ }
    return fontCss;
  }
  // כל ה-CSS של האפליקציה (מהקבצים שלנו), כדי שהעמוד ייראה כמו הסיכום במסך
  const appCss = () => [...document.styleSheets].map((sh) => { try { return [...sh.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n");
  let pdfBusy = false;
  async function exportPdf(s) {
    if (pdfBusy) return; pdfBusy = true;
    const btn = document.getElementById("printBtn"), label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "⏳ מכין PDF…"; }
    const name = String(s.title || "סיכום").replace(/[\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) + " - Clearly.pdf";
    document.getElementById("pdfHold")?.remove();
    const hold = document.createElement("div"); hold.id = "pdfHold";
    hold.innerHTML = `<div id="pdfRoot" dir="rtl" lang="he"><div class="pmeta">${esc(s.course)} · <bdi>${esc(when(s))}</bdi></div><h1>${escT(s.title)}</h1><article class="md-body">${s.html}</article></div>`;
    document.body.appendChild(hold);
    const root = hold.firstElementChild;
    try {
      const [, fonts] = await Promise.all([loadPdfLib(), embeddedFonts()]);
      // תמונות בתוך הסיכום: מוטמעות (תמונה חיצונית לא נטענת בתוך SVG)
      await Promise.all([...root.querySelectorAll("img")].map(async (im) => {
        try { if (!im.src.startsWith("data:")) im.src = await toDataUrl(await (await fetch(im.src)).blob()); await im.decode(); } catch { im.remove(); }
      }));
      try { await document.fonts.ready; } catch { /* */ }
      const logo = new Image(); logo.src = "icons/logo-mark.png";
      try { await logo.decode(); } catch { /* ממשיכים גם בלי הלוגו */ }
      // מידות: עמוד A4, שוליים (מ"מ) – למעלה מקום ללוגו. רוחב התוכן במסך = 700px
      const MM = { top: 22, side: 12, bottom: 14 }, PW = 210, PH = 297, CW = 700;
      const pxPerMm = CW / (PW - 2 * MM.side), pageH = Math.floor((PH - MM.top - MM.bottom) * pxPerMm);
      // איפה מותר לחתוך עמוד: בין שורות/פסקאות/שורות טבלה, לא באמצע שורה. כותרת לא נשארת לבד בתחתית עמוד
      // תמונה גבוהה מעמוד מוקטנת לגובה עמוד – שלא תיחתך באמצע
      root.querySelectorAll("img").forEach((im) => { im.style.maxHeight = pageH - 110 + "px"; im.style.width = "auto"; im.style.maxWidth = "100%"; });
      // טבלה רחבה מהעמוד – שום עמודה לא נחתכת: (1) גופן קטן יותר, (2) מילים ארוכות נשברות בתוך התא, (3) אם עדיין רחבה – כל הטבלה מוקטנת
      const W0 = root.clientWidth;
      root.querySelectorAll("table").forEach((tb) => {
        for (let f = 13; tb.scrollWidth > W0 + 1 && f > 9; f--) tb.style.fontSize = f + "px";
        // קודם שוברים רק כותרות עמודות, אחר כך מקטינים את הטבלה (עד 60%), ורק בסוף שוברים גם מספרים בתאים
        const fits = () => tb.getBoundingClientRect().width <= W0 + 1;   // כולל את ההקטנה (zoom)
        if (!fits()) tb.querySelectorAll("th").forEach((c) => { c.style.overflowWrap = "anywhere"; });
        if (!fits()) tb.style.zoom = String(Math.max(0.6, (W0 - 2) / tb.scrollWidth));
        if (!fits()) { tb.style.zoom = ""; tb.querySelectorAll("td").forEach((c) => { c.style.overflowWrap = "anywhere"; }); }
        if (!fits()) tb.style.zoom = String(Math.max(0.3, (W0 - 2) / tb.scrollWidth));
      });
      const top0 = root.getBoundingClientRect().top, total = Math.ceil(root.scrollHeight);
      const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.floor(r.top - top0), y: Math.ceil(r.bottom - top0) }; };
      // שורות הטקסט (כל שורה במקום שלה בדף). שורות בתוך כותרת או טבלה לא משמשות לחיתוך
      const lines = [], lineCuts = [];
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const rg = document.createRange();
      while (tw.nextNode()) {
        const n = tw.currentNode, inner = n.parentElement.closest("h1, h2, h3, h4, table");
        rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) if (r.height) { const l = { top: Math.floor(r.top - top0), y: Math.ceil(r.bottom - top0) }; lines.push(l); if (!inner) lineCuts.push(l.y); }
      }
      // דברים שאסור לחתוך דרכם: שורה, שורת טבלה, תמונה
      const solid = lines.concat([...root.querySelectorAll("tr, img")].map(box));
      // מקומות חיתוך: סוף פסקה/פריט/שורת טבלה/בלוק, בין שתי שורות טקסט, או ממש לפני כותרת (כך כותרת לא נשארת לבד בתחתית עמוד)
      const heads = [...root.querySelectorAll("h1, h2, h3, h4")].map(box);
      // כותרת לא נשארת לבד בתחתית עמוד: אסור לחתוך בתוך כותרת, ואסור לחתוך אם מאז הכותרת האחרונה שמעל החיתוך
      // עוד לא הופיעה אף שורה של תוכן (טקסט, שורת טבלה או תמונה). כך גם "פרק" ומיד "סעיף" עוברים יחד לעמוד הבא
      const inHead = (l) => heads.some((h) => l.top >= h.top - 1 && l.y <= h.y + 1);
      const content = lines.filter((l) => !inHead(l)).concat([...root.querySelectorAll("tr, img")].map(box));
      const headOk = (y) => {
        if (heads.some((h) => y > h.top + 1 && y < h.y)) return false;
        const above = heads.filter((h) => h.y <= y + 1).reduce((m, h) => (!m || h.y > m.y ? h : m), null);
        return !above || content.some((c) => c.top >= above.y - 1 && c.y <= y + 1);
      };
      const cand = [...new Set([
        ...[...root.querySelectorAll("p, li, tr, blockquote, pre, hr, img, .pmeta, table, ul, ol")].map((el) => box(el).y),
        ...lineCuts, ...heads.map((h) => h.top),
      ])].filter(headOk).sort((a, b) => b - a);
      // גיבוי לשורת טבלה ענקית (גבוהה מעמוד): מותר לחתוך גם בין שורות טקסט בתוך התא
      const allLines = [...new Set(lines.map((l) => l.y))].filter(headOk).sort((a, b) => b - a);
      const clear = (y, list) => !list.some((s) => s.top < y - 1 && s.y > y + 1);
      const pages = []; let start = 0;
      while (start < total - 2) {
        let end = start + pageH;
        if (end < total) {
          let fit = cand.find((y) => y > start + 20 && y <= end && clear(y, solid));
          // עמוד שנשאר כמעט ריק (למשל רק כותרות של טבלה ואחריהן שורה ענקית) – עדיף לחתוך בין שורות טקסט בתוך הטבלה
          if (!fit || fit < start + pageH * 0.5) {
            const inner = allLines.find((y) => y > start + 20 && y <= end && clear(y, lines));
            if (inner && (!fit || inner > fit)) fit = inner;
          }
          if (fit) end = fit;
        } else end = total;
        pages.push([start, end]); start = end;
      }
      const css = fonts + appCss();
      const body = new XMLSerializer().serializeToString(root);
      const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const SCALE = 2;
      for (let i = 0; i < pages.length; i++) {
        const [a, b] = pages[i], h = b - a;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${h}"><foreignObject x="0" y="0" width="${CW}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${CW}px;height:${h}px;overflow:hidden;background:#fff"><style>${css.replace(/<\/style/gi, "<\/style")}</style><div style="margin-top:${-a}px">${body}</div></div></foreignObject></svg>`;
        const img = new Image();
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        await img.decode();
        const cv = document.createElement("canvas"); cv.width = CW * SCALE; cv.height = h * SCALE;
        const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        if (i) pdf.addPage();
        pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", MM.side, MM.top, PW - 2 * MM.side, h / pxPerMm);
      }
      // הלוגו + Clearly בפינה הימנית העליונה של כל עמוד, ומספר עמוד למטה
      const n = pdf.internal.getNumberOfPages(), W = PW;
      for (let i = 1; i <= n; i++) {
        pdf.setPage(i);
        if (logo.naturalWidth) pdf.addImage(logo, "PNG", W - 12 - 9, 7, 9, 9);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(38, 43, 107);
        pdf.text("Clearly", W - 12 - 11, 13.5, { align: "right" });
        pdf.setDrawColor(213, 222, 242); pdf.setLineWidth(0.4); pdf.line(12, 18, W - 12, 18);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(120, 130, 150);
        pdf.text(`${i} / ${n}`, W / 2, PH - 7, { align: "center" });
      }
      const blob = pdf.output("blob");
      const file = new File([blob], name, { type: "application/pdf" });
      // באייפון/אייפד: חלון השיתוף (שמירה בקבצים / הדפסה / שליחה). אחרת – הורדה רגילה
      const touch = navigator.maxTouchPoints > 1 && /iPhone|iPad|Macintosh|Android/.test(navigator.userAgent);
      if (touch && navigator.canShare?.({ files: [file] })) {
        const share = async () => { try { await navigator.share({ files: [file], title: name }); return true; } catch (e) { if (e?.name === "AbortError") return true; if (e?.name === "NotAllowedError") return false; throw e; } };
        // ההכנה לוקחת כמה שניות, ואז הדפדפן לפעמים דורש לחיצה חדשה כדי לפתוח שיתוף – מציגים כפתור "ה-PDF מוכן"
        if (!(await share())) {
          document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="pdfReady" role="dialog" aria-modal="true"><div class="card" style="display:grid;gap:12px;text-align:center;max-width:340px"><b style="font-size:19px">📄 ה-PDF מוכן</b><button class="btn" id="pdfShare">שמירה / שיתוף / הדפסה</button><button class="btn ghost small-btn" id="pdfClose">סגירה</button></div></div>`);
          const m = document.getElementById("pdfReady");
          document.getElementById("pdfShare").onclick = async () => { m.remove(); await share().catch((e) => toast("לא הצלחתי לשתף: " + e.message)); };
          document.getElementById("pdfClose").onclick = () => m.remove();
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        toast("📄 ה-PDF ירד למחשב");
      }
    } catch (e) {
      toast("לא הצלחתי להכין PDF: " + (e?.message || e));
    } finally {
      hold.remove(); pdfBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  // ---------- מבחנים ----------
  let retryQuiz = null; // "רק הטעויות" – מבחן זמני בזיכרון

  async function quizzes() {
    const qs = await lib("quiz");
    const attempts = (await store.listAttempts()).sort((a, b) => b.at.localeCompare(a.at));
    const stats = (id) => { const a = attempts.filter((x) => x.quizId === id); return a.length ? { n: a.length, last: a[0], best: Math.max(...a.map((x) => x.score / x.total)) } : null; };
    const courses = byCourse(qs).map(([c]) => c);
    const list = qs;
    view.innerHTML = `<div class="page">
      <div class="row" style="justify-content:space-between"><h1 style="font-size:32px">המבחנים שלי</h1><a class="btn" href="#quiz-new">${svg("plus")} מבחן חדש</a></div>
      ${courses.length ? `<section class="card"><h2 style="font-size:20px;margin:0">חזרה למבחן</h2><p class="small muted">שאלות מעורבבות מכל המבחנים של הקורס, כמו במבחן אמיתי.</p>
        <div class="row" style="margin-top:10px"><select id="mixCourse" name="mixCourse" style="flex:1;min-width:200px">${courses.map((c, i) => `<option value="${i}">${esc(c)}</option>`).join("")}</select><button class="btn" id="mixGo">התחלה</button></div></section>` : ""}
      ${byCourse(list).map(([course, items]) => `<section class="soft"><h2 style="font-size:20px">${esc(course)}</h2><div class="list" style="margin-top:10px">${items.map((q) => {
        const st = stats(q.id);
        return `<div class="item quiz-row"><a href="#quiz-${esc(q.id)}" style="min-width:0;flex:1;color:inherit;text-decoration:none"><span class="t">${escT(q.title)}</span><br><span class="small muted">${q.questions.length} שאלות${q.source === "mine" ? " · נכתב על ידך" : ""}${st ? ` · ${st.n} ${st.n === 1 ? "ניסיון" : "ניסיונות"} · אחרון <bdi>${st.last.score}/${st.last.total}</bdi>` : ""}</span></a>
          ${q.demo ? '<span class="chip demo">דוגמה</span>' : st ? `<span class="chip ${st.best === 1 ? "ok" : ""}">${st.best === 1 ? "מושלם" : "שוב"}</span>` : '<span class="chip">חדש</span>'}
          ${q.source === "mine" ? `<button class="link del-quiz" data-id="${esc(q.id)}" aria-label="מחיקת המבחן">${svg("trash")}</button>` : ""}</div>`;
      }).join("")}</div></section>`).join("")}
      <section class="soft"><h2 style="font-size:20px">היסטוריה</h2>
        ${attempts.length ? `<div class="list" style="margin-top:10px">${attempts.slice(0, 30).map((a) => `<div class="item"><span style="min-width:0"><span class="t">${escT(a.title)}</span><br><span class="small muted">${esc(a.course)} · <bdi>${new Date(a.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</bdi></span></span><b class="score ${a.score === a.total ? "full" : ""}"><bdi>${a.score}/${a.total}</bdi></b></div>`).join("")}</div>` : '<p class="muted small" style="margin-top:6px">עוד לא עשית מבחנים. כל מבחן שתעשה יישמר כאן, עם הציון והתאריך.</p>'}
      </section>
      ${qs.length ? "" : `<section class="soft"><h2 style="font-size:20px;margin:0">עוד אין מבחנים</h2><p class="small muted">מבחן קצר נוצר לבד עם כל סיכום. העלו מצגת של שיעור כדי להתחיל.</p><a class="btn" href="#upload" style="margin-top:8px">📄 העלאת מצגת</a></section>`}
    </div>`;
    $("#mixGo") && ($("#mixGo").onclick = () => { location.hash = "quiz-mix-" + $("#mixCourse").value; });
    view.querySelectorAll(".del-quiz").forEach((b) => (b.onclick = async () => {
      if (!b.dataset.sure) { b.dataset.sure = "1"; b.classList.add("danger-text"); toast("לחצו שוב כדי למחוק את המבחן"); return; }
      await store.deleteItem(b.dataset.id); toast("המבחן נמחק"); quizzes();
    }));
  }

  // מבחן מעורב: עד 10 שאלות אקראיות מכל המבחנים של הקורס
  async function mixQuiz(i) {
    const qs = await lib("quiz");
    const course = byCourse(qs).map(([c]) => c)[i];
    const pool = qs.filter((q) => q.course === course).flatMap((q) => q.questions);
    if (!pool.length) { location.hash = "quizzes"; return; }
    const pick = pool.map((q) => [Math.random(), q]).sort((a, b) => a[0] - b[0]).slice(0, 10).map((x) => x[1]);
    runQuiz({ id: "mix-" + i, title: "חזרה למבחן – " + course, course, questions: pick });
  }

  async function quizById(id) {
    if (id === "retry" && retryQuiz) { if (!(await takeQuizSlot())) { location.hash = "quizzes"; return; } return runQuiz(retryQuiz); }
    const q = id === "demo" ? { ...demoQuiz, id: "demo", title: "מיקרו – שאלות לדוגמה", course: "דוגמה" } : await store.getItem(id);
    if (!q) { location.hash = "quizzes"; return; }
    // עד 3 מבחנים ביום (מבחן לדוגמה לא נספר)
    if (id !== "demo" && !(await takeQuizSlot())) { location.hash = "quizzes"; return; }
    runQuiz(q);
  }

  // ---------- הרצת מבחן ----------
  function runQuiz(quiz, i = 0, score = 0, picked = null, wrong = []) {
    const qs = quiz.questions;
    if (i >= qs.length) {
      ctx.onQuizDone?.();
      store.addAttempt({ id: "att-" + Date.now(), quizId: quiz.id, title: quiz.title, course: quiz.course, at: new Date().toISOString(), score, total: qs.length, wrong });
      const pct = score / qs.length;
      view.innerHTML = `<div class="page" style="text-align:center;justify-items:center">
        <p class="eyebrow">סיימת</p><h1 style="font-size:56px"><bdi>${score} / ${qs.length}</bdi></h1>
        <p class="muted">${pct === 1 ? "מושלם! החומר יושב טוב." : pct >= 0.7 ? "יפה מאוד. כדאי לעבור שוב על מה שטעית בו." : "שווה לחזור על הסיכום ולנסות שוב."}</p>
        <div class="row" style="justify-content:center">
          ${wrong.length ? '<button class="btn" id="retryWrong">לתרגל רק את הטעויות</button>' : ""}
          <button class="btn ghost" id="again">שוב מההתחלה</button>
          ${quiz.summaryId ? `<a class="btn ghost" href="#sum-${esc(quiz.summaryId)}">חזרה לסיכום</a>` : ""}
          <a class="btn ghost" href="#quizzes">כל המבחנים</a>
        </div></div>`;
      $("#again").onclick = () => runQuiz(quiz);
      $("#retryWrong") && ($("#retryWrong").onclick = () => {
        retryQuiz = { ...quiz, id: quiz.id, title: quiz.title + " (טעויות)", questions: wrong.map((k) => qs[k]) };
        runQuiz(retryQuiz);
      });
      return;
    }
    const q = qs[i];
    view.innerHTML = `<div class="page">
      <div class="progress" aria-hidden="true"><i style="width:${(i / qs.length) * 100}%"></i></div>
      <div class="row" style="justify-content:space-between"><p class="eyebrow">שאלה ${i + 1} מתוך ${qs.length}</p><span class="chip">${esc(quiz.course)}</span></div>
      <h2 style="font-size:26px">${esc(q.q)}</h2>
      <div class="options">${q.options.map((o, k) => {
        const cls = picked === null ? "" : k === q.a ? "correct" : k === picked ? "wrong" : "";
        return `<button class="opt ${cls}" data-k="${k}" ${picked !== null ? "disabled" : ""}>${esc(o)}</button>`;
      }).join("")}</div>
      <div aria-live="polite">${picked !== null ? `<p class="notice">${picked === q.a ? "נכון! " : "לא בדיוק. "}${esc(q.why || "")}</p>` : ""}</div>
      ${picked !== null ? `<div class="row"><button class="btn" id="next">${i + 1 < qs.length ? "לשאלה הבאה" : "לתוצאה"}</button></div>` : ""}
    </div>`;
    view.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
      markQuizStarted();   // המבחן נספר מהתשובה הראשונה, לא מהפתיחה
      const k = +b.dataset.k, ok = k === q.a;
      runQuiz(quiz, i, score + (ok ? 1 : 0), k, ok ? wrong : [...wrong, i]);
    }));
    $("#next") && ($("#next").onclick = () => runQuiz(quiz, i + 1, score, null, wrong));
  }

  // ---------- יצירת מבחן אישי ----------
  function quizEditor() {
    const courses = prefs.get().courses || [];
    const qBlock = (n) => `<fieldset class="soft fs qblock"><legend>שאלה ${n}</legend>
      <label class="field">השאלה<textarea class="qq" rows="2" autocomplete="off" placeholder="למשל: מהי הזהות החשבונאית?"></textarea></label>
      <div class="options">${[0, 1, 2, 3].map((k) => `<label class="opt-edit"><input type="radio" name="ans${n}" value="${k}" ${k === 0 ? "checked" : ""} aria-label="תשובה נכונה"><input type="text" class="qo" autocomplete="off" placeholder="תשובה ${k + 1}${k === 0 ? " (סמנו את הנכונה בעיגול)" : ""}"></label>`).join("")}</div>
      <label class="field">הסבר (לא חובה)<input type="text" class="qw" autocomplete="off" placeholder="למה זו התשובה הנכונה…"></label></fieldset>`;
    view.innerHTML = `<div class="page">
      <a href="#quizzes" class="small">→ כל המבחנים</a>
      <h1 style="font-size:30px">מבחן חדש</h1>
      <p class="muted">כותבים שאלות בעצמכם, למשל ממבחן משנה קודמת או ממה שהמרצה אמר שחשוב. המבחן נשמר אצלכם, ואפשר לחזור עליו כמה שרוצים.</p>
      <label class="field">שם המבחן<input type="text" id="qtitle" name="qtitle" autocomplete="off" placeholder="למשל: מיקרו – מבחן תשפ״ה מועד א׳"></label>
      <label class="field">קורס<select id="qcourse" name="qcourse">${courses.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
      <div id="qlist">${qBlock(1)}</div>
      <div class="row"><button class="btn ghost" id="addQ">${svg("plus")} עוד שאלה</button><button class="btn" id="saveQ">שמירת המבחן</button></div>
    </div>`;
    let n = 1;
    $("#addQ").onclick = () => { n += 1; $("#qlist").insertAdjacentHTML("beforeend", qBlock(n)); $("#qlist").lastElementChild.querySelector(".qq").focus(); };
    $("#saveQ").onclick = async () => {
      const questions = [...view.querySelectorAll(".qblock")].map((b) => {
        const opts = [...b.querySelectorAll(".qo")].map((x) => x.value.trim());
        const a = +b.querySelector("input[type=radio]:checked").value;
        const keep = opts.map((o, k) => [o, k]).filter(([o]) => o);
        return { q: b.querySelector(".qq").value.trim(), options: keep.map(([o]) => o), a: keep.findIndex(([, k]) => k === a), why: b.querySelector(".qw").value.trim() };
      }).filter((q) => q.q && q.options.length >= 2 && q.a >= 0);
      if (!questions.length) { toast("צריך לפחות שאלה אחת עם שתי תשובות ותשובה נכונה מסומנת"); return; }
      const quiz = { id: "my-" + Date.now(), type: "quiz", source: "mine", title: $("#qtitle").value.trim() || "המבחן שלי", course: $("#qcourse").value, questions };
      await store.putItem(quiz);
      toast(`המבחן נשמר: ${questions.length} שאלות`);
      location.hash = "quizzes";
    };
  }

  const TYPE_ICON = { resource: "📄", folder: "📁", url: "🔗", assign: "📝", quiz: "✅", forum: "💬", lti: "🎥", page: "📃", zoom: "🎥" };
  const isNew = (it) => it.firstSeen && it.firstSeen !== "baseline" && Date.now() - new Date(it.firstSeen) < 7 * 864e5;
  async function moodleCourse(course) {
    const feed = await store.getItem("moodle-feed");
    return feed?.courses.find((c) => c.course === course) || null;
  }
  async function moodleNew() {
    const feed = await store.getItem("moodle-feed");
    if (!feed) return null;
    return feed.courses.flatMap((c) => c.sections.flatMap((s) => s.items.filter(isNew).map((it) => ({ ...it, course: c.course }))))
      .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
  }
  // לחיצה על פריט מהמודל נפתחת בתוך האפליקציה (#mf-…): הסיכום שלנו שלו, או דף פרטים
  const moodleItem = (it, withCourse = false) => `<a class="item" href="#mf-${encodeURIComponent(it.url)}"><span style="min-width:0"><span class="t">${TYPE_ICON[it.type] || "•"} ${esc(it.name)}</span>${withCourse || it.dates ? `<br><span class="small muted">${withCourse ? esc(it.course) : ""}${withCourse && it.dates ? " · " : ""}${esc(it.dates)}</span>` : ""}</span>${isNew(it) ? '<span class="chip new">חדש</span>' : ""}</a>`;
  // הסיכום שלנו לקובץ מהמודל: אותו קורס, והשם של הקובץ מופיע בשם הסיכום (כמילים שלמות – "מצגת 1" ≠ "מצגת 10")
  const norm = (s) => " " + String(s || "").toLowerCase().replace(/^g-/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
  async function summaryForMoodle(it, course) {
    const n = norm(it.name);
    if (n.trim().length < 3) return null;
    const sums = (await lib("summary")).filter((s) => s.kind !== "formulas" && (!course || norm(s.course) === norm(course)));
    return sums.find((s) => norm(s.id).includes(n) || norm(s.title).includes(n) || norm(s.file).includes(n)) || null;
  }
  // קישור ישיר לקובץ עצמו (ולא לדף הפעילות במודל)
  const directUrl = (it) => it.type === "resource" ? it.url + (it.url.includes("?") ? "&" : "?") + "redirect=1" : it.url;
  async function moodleFilePage(url) {
    const feed = await store.getItem("moodle-feed");
    let it = null, mc = null, sec = null;
    for (const c of feed?.courses || []) for (const s of c.sections) { const f = s.items.find((x) => x.url === url); if (f) { it = f; mc = c; sec = s; } }
    if (!it) { view.innerHTML = '<div class="page"><p>הפריט לא נמצא. אולי הוא הוסר מהמודל.</p><a href="#notebooks">למחברות</a></div>'; return; }
    const sum = await summaryForMoodle(it, mc.course);
    const open = `<a class="btn ghost" href="${esc(directUrl(it))}" target="_blank" rel="noopener">${TYPE_ICON[it.type] || "•"} ${it.type === "resource" ? "הקובץ המקורי במודל" : "פתיחה במודל"}</a>`;
    if (sum) {
      // יש סיכום – נפתח ישר בתוך האפליקציה, עם הקובץ המקורי כאופציה
      await summaryPage(sum.id);
      view.querySelector(".page")?.insertAdjacentHTML("afterbegin", `<div class="notice" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between"><span>📥 מהמודל: <b>${esc(it.name)}</b> · ${esc(mc.course)}</span>${open}</div>`);
      return;
    }
    const assign = it.type === "assign";
    view.innerHTML = `<div class="page" style="max-width:760px">
      <a href="#notebooks" class="small">→ ${esc(mc.course)}</a>
      <h1 style="font-size:28px">${TYPE_ICON[it.type] || "•"} ${esc(it.name)}</h1>
      <div class="row"><span class="chip">${esc(mc.course)}</span>${sec?.title ? `<span class="chip">${esc(sec.title)}</span>` : ""}${it.dates ? `<span class="chip">${esc(it.dates)}</span>` : ""}${isNew(it) ? '<span class="chip new">חדש</span>' : ""}</div>
      <section class="soft">
        ${assign ? `<h3>📝 מטלה להגשה</h3><p class="small muted">כל ההגשות שלך מרוכזות ב"הגשת עבודות".</p><div class="row"><a class="btn" href="#assignments">📝 להגשת עבודות</a>${open}</div>`
        : it.type === "resource" ? `<h3>⏳ הסיכום בדרך</h3><p class="small muted">המחבר במחשב מסכם קבצים חדשים מהמודל לבד, והסיכום ייפתח כאן. אפשר גם להעלות את הקובץ עכשיו ולקבל סיכום תוך דקה.</p><div class="row"><a class="btn" href="#upload">📄 לסכם עכשיו</a>${open}</div>`
        : `<p class="small muted">זה פריט מסוג שנפתח רק במודל (פורום, בוחן, קישור או זום).</p><div class="row">${open}</div>`}
        <p class="small muted" style="margin-top:8px">אם המודל מבקש להתחבר – מתחברים פעם אחת, ומשם זה נפתח ישר.</p>
      </section></div>`;
  }

  function moodleSection(mc) {
    if (!mc) return "";
    const newCount = mc.sections.reduce((a, s) => a + s.items.filter(isNew).length, 0);
    return `<section class="soft"><div class="row" style="justify-content:space-between"><h2 style="font-size:20px">מהמודל ${newCount ? `<span class="chip new">${newCount} חדשים</span>` : ""}</h2><a class="small" href="${esc(mc.url)}" target="_blank" rel="noopener">פתיחה במודל</a></div>
      ${mc.sections.map((s) => `<details class="msec" ${s.items.some(isNew) ? "open" : ""}><summary><b>${esc(s.title || "כללי")}</b> <span class="small muted">(${s.items.length})</span></summary><div class="list" style="margin-top:8px">${s.items.map((it) => moodleItem(it)).join("")}</div></details>`).join("")}
      <p class="small muted" style="margin-top:8px">${mc.updated && !isNaN(new Date(mc.updated)) ? `עודכן <bdi>${new Date(mc.updated).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</bdi>. ` : ""}קבצים שסוכמו נפתחים כאן, באפליקציה.</p></section>`;
  }

  return { levelOf, levelPicker, bindLevels, podcastAudio, syncNow, getCode, pairCard, bindPair, moodleCourse, moodleNew, moodleItem, moodleSection, moodleFilePage, summaryForMoodle, isNew, summaries, summaryPage, quizzes, quizById, mixQuiz, quizEditor, importPack };
}
