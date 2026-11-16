import { takeQuizSlot, markQuizStarted } from "./limits.js";
import * as api from "./api.js";
import { makeQuery, score, snippet, markHtml, courseKey } from "./search-he.js";
// כלים לסטודנט: 🔊 הקראת סיכום, ⏱️ סימולציית מבחן, 🎯 "כמה אני צריך במבחן", 🔍 חיפוש בכל החומר,
// 🖨️ הדפסת סיכום / דף נוסחאות, ו-🙋 שאלות למתרגל. הכול עובד במכשיר, בלי AI ובלי שרת.

export function initTools(ctx) {
  const { view, $, esc, svg, toast, prefs, store } = ctx;

  // ---------- 🔊 הקראה בקול ----------
  // מקריא את הסיכום חלק אחרי חלק, ומסמן את החלק שמוקרא עכשיו
  function attachReader() {
    const body = view.querySelector(".md-body");
    if (!body) return;
    // דפדפן בלי הקראה בקול: מציגים רק את כפתור ה-PDF
    if (!("speechSynthesis" in window)) {
      view.querySelector(".page h1")?.insertAdjacentHTML("afterend", `<div class="reader row"><button class="btn ghost small-btn" id="printBtn">📄 PDF</button></div>`);
      $("#printBtn").onclick = () => { const p = document.getElementById("sumPdf"); if (p) p.click(); else printView(); };
      return;
    }
    // מקריאים רק את השיעור עצמו: בלי "המקור", בלי "לבדוק" ובלי הערות טכניות
    const SKIP_H = /^(לבדוק|מקור|הערות?|הערה טכנית)/;
    const blocks = [];
    let skipping = false;
    for (const el of body.children) {
      if (/^H[1-4]$/.test(el.tagName)) skipping = SKIP_H.test(el.textContent.replace("🪄 הסבר נוסף", "").trim());
      if (skipping || el.tagName === "BLOCKQUOTE" || !el.textContent.trim()) continue;
      if (/^\*{0,2}המקור/.test(el.textContent.trim())) continue;
      blocks.push(el);
    }
    view.querySelector(".page h1")?.insertAdjacentHTML("afterend", `<div class="reader row" role="group" aria-label="הקראה">
      <button class="btn small-btn" id="rdPlay">🔊 הקראה</button><button class="btn ghost small-btn" id="rdStop" hidden>⏹ עצירה</button>
      <select id="rdRate" name="rdRate" aria-label="מהירות" style="width:auto"><option value="0.9">איטי</option><option value="1" selected>רגיל</option><option value="1.25">מהיר</option><option value="1.5">מהיר מאוד</option></select>
      <button class="btn ghost small-btn" id="printBtn">📄 PDF</button></div>`);
    let i = 0, playing = false, paused = false, fails = 0;
    const voice = () => speechSynthesis.getVoices().find((v) => /^he|iw/i.test(v.lang));
    // טקסט נקי להקראה: בלי אימוג'י ובלי כפתורים, וסימנים נקראים כמילים
    const clean = (t) => t.replace(/🪄 הסבר נוסף/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\|/g, ", ").replace(/[−–]/g, " פחות ").replace(/=/g, " שווה ").replace(/\s+/g, " ").trim();
    const mark = () => blocks.forEach((b, k) => b.classList.toggle("reading", playing && k === i));
    const speakNext = () => {
      if (!playing) return;
      if (i >= blocks.length) { stop(); toast("ההקראה הסתיימה"); return; }
      mark(); blocks[i].scrollIntoView({ behavior: "smooth", block: "center" });
      const u = new SpeechSynthesisUtterance(clean(blocks[i].textContent));
      u.lang = "he-IL"; u.rate = +$("#rdRate").value; const v = voice(); if (v) u.voice = v;
      u.onend = () => { fails = 0; i += 1; speakNext(); };
      // אם ההקראה נכשלת שוב ושוב (אין קול במכשיר) – עוצרים ומסבירים, במקום לדלג על כל הסיכום
      u.onerror = (e) => { if (e.error === "interrupted" || e.error === "canceled") return; if (++fails >= 2) { stop(); toast("ההקראה לא עובדת במכשיר הזה. באייפון: הגדרות ← נגישות ← תוכן מוקרא ← קולות ← עברית"); return; } i += 1; speakNext(); };
      speechSynthesis.speak(u);
    };
    const stop = () => { playing = false; paused = false; speechSynthesis.cancel(); mark(); $("#rdPlay") && ($("#rdPlay").textContent = "🔊 הקראה"); $("#rdStop") && ($("#rdStop").hidden = true); };
    // באייפד/אייפון: הקול של הדפדפן מושתק במצב שקט. מבקשים "מצב השמעה" (כמו מוזיקה),
    // ומנגנים רגע של שקט מתוך הלחיצה כדי "לפתוח" את הרמקול – ככה ההקראה נשמעת גם בלי אוזניות.
    const unlockAudio = () => {
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* */ }
      try {
        const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=");
        a.play().catch(() => {});
      } catch { /* */ }
    };
    $("#rdPlay").onclick = () => {
      unlockAudio();
      if (playing && !paused) { speechSynthesis.pause(); paused = true; $("#rdPlay").textContent = "▶ המשך"; return; }
      if (paused) { speechSynthesis.resume(); paused = false; $("#rdPlay").textContent = "⏸ השהיה"; return; }
      if (!voice()) toast("אין במכשיר קול בעברית? באייפון: הגדרות ← נגישות ← תוכן מוקרא ← קולות ← עברית");
      else if (/iPad|iPhone|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) toast("לא שומעים? מכבים מצב שקט: מחליקים ממרכז הבקרה ולוחצים על הפעמון, ומגבירים ווליום");
      playing = true; i = 0; $("#rdPlay").textContent = "⏸ השהיה"; $("#rdStop").hidden = false; speakNext();
    };
    $("#rdStop").onclick = stop;
    // לחיצה על חלק בסיכום בזמן הקראה – ממשיכים משם
    blocks.forEach((b, k) => b.addEventListener("click", () => { if (playing) { speechSynthesis.cancel(); i = k; setTimeout(speakNext, 50); } }));
    // PDF: בדף סיכום – הייצוא המעוצב (עם הלוגו של Clearly); בשאר הדפים – שמירה רגילה כ-PDF. מה-PDF אפשר גם להדפיס
    $("#printBtn").onclick = () => { stop(); const p = document.getElementById("sumPdf"); if (p) p.click(); else printView(); };
    window.addEventListener("hashchange", stop, { once: true });
  }

  // ---------- 🖨️ הדפסה / שמירה כ-PDF ----------
  function printView() {
    document.body.classList.add("printing");
    const done = () => { document.body.classList.remove("printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
  }

  // ---------- ⏱️ סימולציית מבחן ----------
  async function simSetup() {
    const qs = (await store.listItems()).filter((x) => x.type === "quiz");
    const courses = [...new Set(qs.map((q) => q.course))];
    view.innerHTML = `<div class="page">
      <a href="#quizzes" class="small">→ מבחנים</a>
      <h1 style="font-size:30px">⏱️ סימולציית מבחן</h1>
      <p class="muted">כמו מבחן אמיתי: שאלות מכל הקורס, טיימר, ובלי לראות תשובות עד הסוף. בסוף מקבלים ציון והסבר על כל טעות.</p>
      ${courses.length ? `<div class="card" style="display:grid;gap:12px">
        <label class="field">קורס<select id="smC" name="smC">${courses.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label class="field">מספר שאלות<select id="smN" name="smN"><option>10</option><option selected>15</option><option>20</option><option>30</option></select></label>
        <label class="field">זמן (דקות)<select id="smT" name="smT"><option>10</option><option selected>20</option><option>30</option><option>45</option><option>60</option></select></label>
        <div class="row"><button class="btn" id="smGo">מתחילים ⏱️</button></div></div>` : '<p class="notice">עוד אין שאלות. הן נכנסות עם הסיכומים (מבחן לכל סיכום), או ממבחנים שכותבים בעצמכם.</p>'}
    </div>`;
    $("#smGo") && ($("#smGo").onclick = async () => {
      if (!(await takeQuizSlot())) return; // עד 3 מבחנים ביום
      markQuizStarted();
      const course = $("#smC").value;
      const pool = qs.filter((q) => q.course === course).flatMap((q) => q.questions);
      const n = Math.min(+$("#smN").value, pool.length);
      if (n < +$("#smN").value) toast(`יש בקורס רק ${pool.length} שאלות, אז המבחן יהיה של ${n}`);
      const pick = pool.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
      simRun({ course, questions: pick, minutes: +$("#smT").value });
    });
  }
  function simRun(sim) {
    const answers = Array(sim.questions.length).fill(null);
    const endAt = Date.now() + sim.minutes * 60e3;
    let i = 0, timer = null;
    const finish = async () => {
      clearInterval(timer);
      const score = sim.questions.reduce((s, q, k) => s + (answers[k] === q.a ? 1 : 0), 0);
      await store.addAttempt({ id: "att-" + Date.now(), quizId: "sim-" + sim.course, title: "סימולציה – " + sim.course, course: sim.course, at: new Date().toISOString(), score, total: sim.questions.length, wrong: sim.questions.map((q, k) => (answers[k] === q.a ? -1 : k)).filter((k) => k >= 0) });
      ctx.onQuizDone?.();
      const pct = Math.round((score / sim.questions.length) * 100);
      view.innerHTML = `<div class="page">
        <div class="card" style="text-align:center;display:grid;gap:6px;justify-items:center"><p class="eyebrow">סיום הסימולציה</p><h1 style="font-size:56px">${pct}</h1><p class="muted"><bdi>${score}/${sim.questions.length}</bdi> נכונות · ${pct >= 85 ? "מצוין! מוכן למבחן." : pct >= 60 ? "עובר. כדאי לחזק את מה שטעית בו." : "עוד לא. כדאי לחזור על הסיכומים והכרטיסיות."}</p></div>
        <h2 style="font-size:20px">מה טעית בו</h2>
        <div class="list">${sim.questions.map((q, k) => (answers[k] === q.a ? "" : `<div class="soft"><b>${esc(q.q)}</b><p class="small" style="margin-top:6px">✅ ${esc(q.options[q.a])}${answers[k] !== null ? ` · <span style="color:var(--red)">❌ ענית: ${esc(q.options[answers[k]])}</span>` : " · לא ענית"}</p>${q.why ? `<p class="small muted">${esc(q.why)}</p>` : ""}</div>`)).join("") || '<p class="muted">לא טעית באף שאלה! 🎉</p>'}</div>
        <div class="row"><a class="btn" href="#sim">סימולציה נוספת</a><a class="btn ghost" href="#progress">📈 ההתקדמות שלי</a></div></div>`;
    };
    const draw = () => {
      const q = sim.questions[i];
      view.innerHTML = `<div class="page">
        <div class="row" style="justify-content:space-between"><p class="eyebrow">שאלה ${i + 1} מתוך ${sim.questions.length} · ${esc(sim.course)}</p><b class="sim-clock" id="smClock"></b></div>
        <div class="progress" aria-hidden="true"><i style="width:${(answers.filter((a) => a !== null).length / sim.questions.length) * 100}%"></i></div>
        <h2 style="font-size:24px">${esc(q.q)}</h2>
        <div class="options">${q.options.map((o, k) => `<button class="opt" data-k="${k}" aria-pressed="${answers[i] === k}">${esc(o)}</button>`).join("")}</div>
        <div class="sim-nav">${sim.questions.map((_, k) => `<button class="sim-dot ${answers[k] !== null ? "done" : ""} ${k === i ? "cur" : ""}" data-go="${k}" aria-label="שאלה ${k + 1}">${k + 1}</button>`).join("")}</div>
        <div class="row" style="justify-content:space-between"><button class="btn ghost" id="smPrev" ${i ? "" : "disabled"}>→ הקודמת</button>${i + 1 < sim.questions.length ? '<button class="btn" id="smNext">הבאה ←</button>' : '<button class="btn" id="smEnd">הגשת המבחן</button>'}</div>
      </div>`;
      view.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { answers[i] = +b.dataset.k; draw(); }));
      view.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { i = +b.dataset.go; draw(); }));
      $("#smPrev").onclick = () => { i -= 1; draw(); };
      $("#smNext") && ($("#smNext").onclick = () => { i += 1; draw(); });
      $("#smEnd") && ($("#smEnd").onclick = () => { const left = answers.filter((a) => a === null).length; if (!left || confirm(`נשארו ${left} שאלות בלי תשובה. להגיש בכל זאת?`)) finish(); });
      tick();
    };
    const tick = () => {
      const s = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      const el = $("#smClock"); if (el) { el.textContent = `⏱️ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; el.classList.toggle("hot", s < 120); }
      if (s <= 0) { toast("נגמר הזמן! המבחן הוגש"); finish(); }
    };
    timer = setInterval(() => { if (!location.hash.startsWith("#sim")) return clearInterval(timer); tick(); }, 1000);
    draw();
  }

  // ---------- 🎯 כמה אני צריך במבחן ----------
  function grades() {
    const p = prefs.get();
    const g = p.grades || {};
    const courses = p.courses || [];
    const calc = (c) => {
      const items = c.items || [];
      const known = items.filter((x) => x.g !== "" && x.g != null);
      const wKnown = known.reduce((s, x) => s + +x.w, 0), wLeft = items.filter((x) => x.g === "" || x.g == null).reduce((s, x) => s + +x.w, 0);
      const have = known.reduce((s, x) => s + (+x.w * +x.g) / 100, 0);
      const target = +c.target || 60;
      const need = wLeft ? ((target - have) / wLeft) * 100 : null;
      const sofar = wKnown ? Math.round((have / wKnown) * 100) : null;
      const final = wLeft ? null : Math.round(have);
      return { need, sofar, final, wSum: wKnown + wLeft, target };
    };
    const row = (x) => `<div class="gr-row"><input type="text" class="gr-n" value="${esc(x.name || "")}" placeholder="רכיב (למשל: מבחן)" aria-label="רכיב"><input type="number" class="gr-w" value="${x.w ?? ""}" min="0" max="100" placeholder="משקל %" aria-label="משקל באחוזים" inputmode="decimal"><input type="number" class="gr-g" value="${x.g ?? ""}" min="0" max="100" placeholder="ציון (ריק אם עוד לא)" aria-label="ציון" inputmode="decimal"><button class="link tt-del gr-del" aria-label="מחיקה">${svg("trash")}</button></div>`;
    const cards = courses.map((c, ci) => {
      const d = g[c] || { credits: "", target: 60, items: [{ name: "תרגילים", w: 20, g: "" }, { name: "מבחן", w: 80, g: "" }] };
      const r = calc(d);
      const msg = r.wSum !== 100 ? `<span class="cd warm">סכום המשקלות ${r.wSum}% (צריך 100%)</span>` : r.final !== null ? `<span class="cd ${r.final >= r.target ? "" : "hot"}">ציון סופי: ${r.final}</span>` : r.need === null ? "" : r.need <= 0 ? `<span class="cd">כבר עברת את היעד 🎉</span>` : r.need > 100 ? `<span class="cd hot">צריך ${Math.ceil(r.need)} – לא אפשרי, אולי מועד ב׳/שקלול</span>` : `<span class="cd ${r.need > 85 ? "hot" : r.need > 70 ? "warm" : ""}">צריך לפחות ${Math.ceil(r.need)} במה שנשאר</span>`;
      return `<section class="soft gr-card" data-c="${ci}"><div class="row" style="justify-content:space-between"><h2 style="font-size:18px;margin:0">${esc(c)}</h2>${msg}</div>
        <div class="row small" style="gap:8px;margin-top:6px"><label>יעד <input type="number" class="gr-t" value="${d.target}" min="0" max="100" style="width:80px" inputmode="decimal"></label><label>נ״ז <input type="number" class="gr-c" value="${d.credits}" min="0" step="0.5" style="width:80px" inputmode="decimal"></label>${r.sofar !== null ? `<span class="muted">ממוצע עד עכשיו: ${r.sofar}</span>` : ""}</div>
        <div class="gr-items">${d.items.map(row).join("")}</div><button class="btn ghost small-btn gr-add">${svg("plus")} רכיב</button></section>`;
    }).join("");
    // ממוצע משוקלל לפי נקודות זכות (רק קורסים עם ציון סופי)
    const fin = courses.map((c) => [g[c], g[c] && calc(g[c]).final]).filter(([d, f]) => d && f !== null && +d.credits);
    const gpa = fin.length ? (fin.reduce((s, [d, f]) => s + f * +d.credits, 0) / fin.reduce((s, [d]) => s + +d.credits, 0)).toFixed(1) : null;
    view.innerHTML = `<div class="page">
      <a href="#quizzes" class="small">→ מבחנים</a>
      <h1 style="font-size:30px">🎯 כמה אני צריך במבחן?</h1>
      <p class="muted">לכל קורס: הרכיבים (תרגילים, בוחן, מבחן) עם המשקל שלהם, והציונים שכבר יש. רשמו "יעד" (למשל 60 כדי לעבור, או 85), והאפליקציה תגיד כמה צריך במה שנשאר.</p>
      ${gpa ? `<div class="stat" style="max-width:240px"><b>${gpa}</b><span>ממוצע משוקלל (קורסים עם ציון סופי)</span></div>` : ""}
      ${cards || '<p class="muted">אין קורסים.</p>'}
      <div class="row"><button class="btn" id="grSave">שמירה וחישוב</button></div>
    </div>`;
    const bindDel = () => view.querySelectorAll(".gr-del").forEach((b) => (b.onclick = () => b.closest(".gr-row").remove()));
    bindDel();
    view.querySelectorAll(".gr-add").forEach((b) => (b.onclick = () => { b.previousElementSibling.insertAdjacentHTML("beforeend", row({})); bindDel(); }));
    $("#grSave").onclick = () => {
      const pr = prefs.get(); pr.grades = pr.grades || {};
      view.querySelectorAll(".gr-card").forEach((card) => {
        const c = courses[+card.dataset.c];
        pr.grades[c] = { target: card.querySelector(".gr-t").value || 60, credits: card.querySelector(".gr-c").value, items: [...card.querySelectorAll(".gr-row")].map((r) => ({ name: r.querySelector(".gr-n").value.trim(), w: r.querySelector(".gr-w").value, g: r.querySelector(".gr-g").value })).filter((x) => x.w !== "") };
      });
      prefs.set(pr); toast("נשמר"); grades();
    };
  }

  // ---------- 🔍 חיפוש בכל החומר ----------
  // הטקסט של קבצי הקורס (התוסף קורא אותו מהמודל ושומר בתיקייה הפרטית). נשמר במטמון של המכשיר, כדי שלא יורד שוב בכל חיפוש
  let ctMem = null, ctAt = 0, ctUser = null;
  const ctSupported = () => "DecompressionStream" in window;
  async function courseTexts(onProgress) {
    const uid = api.user()?.id || null;
    if (ctMem && ctUser === uid && Date.now() - ctAt < 10 * 60 * 1000) return ctMem;   // לכל משתמש בנפרד
    ctUser = uid;
    if (!uid || !ctSupported()) return (ctMem = []);
    const list = await api.ctList();
    let cache = null; try { cache = await caches.open("clearly-ctext-v1"); } catch { /* בלי מטמון – מורידים */ }
    const key = (f) => `https://ctext.local/${f.name}?u=${encodeURIComponent(f.updated_at || "")}`;
    const out = [], queue = [...list]; let done = 0;
    const worker = async () => {
      for (let f; (f = queue.shift()); ) {
        try {
          const hit = cache && (await cache.match(key(f)));
          let j;
          if (hit) j = await hit.json();
          else { j = await api.ctGet(f.name); try { await cache?.put(key(f), new Response(JSON.stringify(j))); } catch { /* מטמון מלא */ } }
          if (Array.isArray(j?.pages)) out.push(j);
        } catch { /* קובץ אחד שלא נטען לא עוצר את החיפוש */ }
        onProgress?.(++done, list.length);
      }
    };
    await Promise.all([1, 2, 3, 4].map(worker));
    try { const keep = new Set(list.map(key)); for (const r of await cache.keys()) if (!keep.has(r.url)) await cache.delete(r); } catch { /* לא חובה */ }
    ctAt = Date.now();
    return (ctMem = out);
  }

  // ---------- 🔍 חיפוש בכל החומר ----------
  // סיכומים, דפי נוסחאות, מחברות, מבחנים, כרטיסיות, שאלות למתרגל – ובתוך כל עמוד בקבצים מהמודל.
  // חיפוש בעברית (תחיליות, אותיות סופיות, ניקוד), תוצאות מקובצות לפי קורס, ולחיצה מגיעה ישר למקום עם סימון.
  // שם קובץ בעברית עם סיומת באנגלית ("פתרון 02.pdf") מתהפך בתצוגה מימין לשמאל – הסיומת מוצגת כתווית נפרדת
  // "עמוד" ב-PDF, "שקף" במצגת, "חלק" בוורד (בוורד אין עמודים – הקובץ נחתך לחלקים של כ-1,800 תווים)
  const UNIT = (name) => (/\.pptx$/i.test(name) ? ["שקף", "שקפים"] : /\.docx$/i.test(name) ? ["חלק", "חלקים"] : ["עמוד", "עמודים"]);
  const fileLabel = (n) => { const m = String(n || "").match(/^(.*)\.(pdf|pptx|docx)$/i); return m ? `<bdi>${esc(m[1])}</bdi> <span class="chip">${m[2].toUpperCase()}</span>` : `<bdi>${esc(n)}</bdi>`; };
  const KINDS = [["all", "הכול"], ["sum", "📄 סיכומים"], ["file", "📚 קבצי הקורס"], ["note", "📓 מחברות"], ["quiz", "✅ מבחנים וכרטיסיות"]];
  const KIND_N = { sum: ["סיכום", "סיכומים"], file: ["קובץ", "קבצים"], note: ["מחברת", "מחברות"], quiz: ["שאלה", "שאלות"], moodle: ["פריט במודל", "פריטים במודל"] };
  async function search(q0 = "") {
    let course0 = ""; try { course0 = sessionStorage.getItem("clearly-search-course") || ""; sessionStorage.removeItem("clearly-search-course"); } catch { /* בלי אחסון */ }
    view.innerHTML = `<div class="page search-page">
      <h1 style="font-size:30px">🔍 חיפוש בכל החומר</h1>
      <label class="nb-search" style="max-width:640px">${svg("search")}<input type="search" id="gq" name="q" value="${esc(q0)}" placeholder="למשל: עלות אלטרנטיבית, מכפיל, F4…" autocomplete="off" aria-label="חיפוש"></label>
      <div class="sf-row" role="group" aria-label="סינון תוצאות"><select id="gc" name="gc" aria-label="קורס"><option value="">כל הקורסים</option></select>
        ${KINDS.map(([k, l]) => `<button type="button" class="sf-chip${k === "all" ? " on" : ""}" data-k="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("")}</div>
      <p id="gidx" class="small muted" aria-live="polite"></p>
      <div id="gres"></div></div>`;
    const items = await store.listItems();
    const lessons = await store.listLessons();
    const feed = items.find((x) => x.id === "moodle-feed");
    const text = (h) => { const d = new DOMParser().parseFromString(h || "", "text/html").body; d.querySelectorAll("td,th,li,p,h1,h2,h3,h4,tr,br").forEach((n) => n.append(" · ")); return d.textContent.replace(/(\s·\s)+/g, " · ").replace(/^\s*·\s*/, ""); };
    const docs = [
      ...items.filter((x) => x.type === "summary").map((s) => ({ kind: "sum", icon: s.kind === "formulas" ? "📐" : "📄", title: s.title, course: s.course, body: text(s.html), link: "#sum-" + s.id, hl: true })),
      ...lessons.map((l) => ({ kind: "note", icon: "📓", title: ctx.lessonTitle(l), course: l.course, body: l.text || "", link: "#lesson-" + l.id })),
      ...items.filter((x) => x.type === "quiz").flatMap((q) => q.questions.map((x) => ({ kind: "quiz", icon: "✅", title: x.q, course: q.course, body: x.options[x.a] + " " + (x.why || ""), link: "#quiz-" + q.id }))),
      ...items.filter((x) => x.type === "card").map((c) => ({ kind: "quiz", icon: "🃏", title: c.front, course: c.course, body: c.back, link: "#cards" })),
      ...items.filter((x) => x.type === "tq").map((t) => ({ kind: "note", icon: "🙋", title: t.text, course: t.course, body: t.answer || "", link: "#questions" })),
      ...(feed?.courses || []).flatMap((c) => c.sections.flatMap((s) => s.items.map((it) => ({ kind: "file", moodle: true, icon: "🎓", title: it.name, course: c.course, body: s.title, link: it.url, ext: true })))),
    ];
    // שם הקורס במודל ("10126 - מבוא למאקרו כלכלה - 2026א") ושמו באפליקציה ("מבוא למאקרו כלכלה") = אותו קורס, קבוצה אחת
    // הקורסים שבחרתם באפליקציה קודמים: השם שלהם הוא שמוצג
    const appCourses = [...new Set([...(prefs.get()?.courses || []), ...items.filter((x) => x.type === "summary").map((s) => s.course)].filter(Boolean))];
    const byKey = new Map(); for (const c of appCourses) { const k = courseKey(c); if (k && !byKey.has(k)) byKey.set(k, c); }
    const canon = (c) => (c && byKey.get(courseKey(c))) || c;
    docs.forEach((d) => { d.course = canon(d.course); });
    course0 = canon(course0);
    let kind = "all", fileDocs = [];
    const fillCourses = () => {
      const sel = $("#gc"), cur = sel.value || course0;
      const cs = [...new Set(docs.concat(fileDocs).map((d) => d.course).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
      sel.innerHTML = '<option value="">כל הקורסים</option>' + cs.map((c) => `<option${c === cur ? " selected" : ""}>${esc(c)}</option>`).join("");
    };
    fillCourses();
    const plural = (k, n) => `${n} ${KIND_N[k][n === 1 ? 0 : 1]}`;
    let Q = makeQuery("");
    const run = () => {
      Q = makeQuery($("#gq").value);
      const gres = $("#gres");
      if (!Q.ok) { gres.innerHTML = '<p class="muted">מקלידים לפחות 2 אותיות. החיפוש עובר על סיכומים, דפי נוסחאות, מה שכתבתם בשיעורים, שאלות מבחן, כרטיסיות, שאלות למתרגל – ובתוך הקבצים של הקורס מהמודל.</p>'; return; }
      const course = $("#gc").value;
      const pool = docs.concat(fileDocs).filter((d) => (!course || d.course === course) && (kind === "all" || d.kind === kind));
      const hits = [];
      for (const d of pool) { const s = score(Q, d.title, d.body); if (s) hits.push({ d, ...s }); }
      // עמודים מאותו קובץ = תוצאה אחת (העמוד הכי מתאים), ושאר העמודים ככפתורים
      const files = new Map(), rest = [];
      for (const h of hits) {
        if (!h.d.file) { rest.push(h); continue; }
        const g = files.get(h.d.file.key);
        if (!g) files.set(h.d.file.key, { ...h, pages: [h] });
        else { g.pages.push(h); if (h.score > g.score) Object.assign(g, { d: h.d, score: h.score }); }
      }
      const all = rest.concat([...files.values()].map((g) => ({ ...g, score: g.score + Math.min(g.pages.length, 6) }))).sort((a, b) => b.score - a.score).slice(0, 120);
      if (!all.length) { gres.innerHTML = `<p class="muted">לא נמצא כלום${course ? " בקורס הזה" : ""}. נסו מילה אחרת, או פחות מילים.</p>`; return; }
      // מקבצים לפי קורס: רואים במקום אחד איפה המושג מופיע – בסיכום, באיזה קובץ ובאיזה עמוד
      const groups = new Map();
      for (const h of all) { const c = h.d.course || "כללי"; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(h); }
      const item = (h) => {
        const d = h.d;
        if (d.file) {
          const pg = h.pages.map((x) => x.d.page).sort((a, b) => a - b);
          const [u1, u2] = UNIT(d.title);
          return `<div class="item sr-file" data-f="${esc(d.file.key)}"><span style="min-width:0;flex:1"><span class="t">📚 ${fileLabel(d.title)}</span> <span class="small muted">· ${u1} ${d.page + 1}${d.file.pages.length > 1 ? ` מתוך ${d.file.pages.length}` : ""}</span><br>
            <span class="small muted sr-snip">${snippet(Q, d.body, esc)}</span>
            ${pg.length > 1 ? `<span class="sr-pages">מופיע גם ב${pg.length > 12 ? "-" + pg.length + " " + u2 + ":" : u2} ${pg.filter((p) => p !== d.page).slice(0, 12).map((p) => `<button type="button" class="sf-pg" data-p="${p}" aria-label="${u1} ${p + 1}">${p + 1}</button>`).join("")}</span>` : ""}</span>
            <button type="button" class="btn small-btn sr-open" data-p="${d.page}">פתיחה ב${u1} ${d.page + 1}</button></div>`;
        }
        const sn = snippet(Q, d.body, esc);
        return `<a class="item${d.hl ? " sr-hl" : ""}" href="${esc(d.link)}" ${d.ext ? 'target="_blank" rel="noopener"' : ""}><span style="min-width:0"><span class="t">${d.icon} ${esc(d.title)}</span>${d.moodle ? ' <span class="small muted">· במודל</span>' : ""}<br><span class="small muted">${sn || ""}</span></span></a>`;
      };
      const head = (c, list) => {
        const n = {}; for (const h of list) { const k = h.d.moodle ? "moodle" : h.d.kind; n[k] = (n[k] || 0) + 1; }
        const pages = list.filter((h) => h.d.file).reduce((a, h) => a + h.pages.length, 0);
        return Object.entries(n).map(([k, v]) => plural(k, v) + (k === "file" && pages ? ` (${pages} מקומות בתוכם)` : "")).join(" · ");
      };
      gres.innerHTML = `<p class="small muted">נמצא ב-${all.length} מקומות${groups.size > 1 ? ` ב-${groups.size} קורסים` : ""}</p>` + [...groups].map(([c, list]) => `<section class="sr-group"><h2 class="sr-h">${esc(c)}</h2><p class="small muted sr-sum">${head(c, list)}</p><div class="list">${list.map(item).join("")}</div></section>`).join("");
      gres.querySelectorAll(".sr-hl").forEach((a) => a.addEventListener("click", () => { try { sessionStorage.setItem("clearly-hl", Q.q); } catch { /* בלי סימון */ } }));
      gres.querySelectorAll(".sr-file").forEach((el) => {
        const j = fileDocs.find((d) => d.file.key === el.dataset.f)?.file;
        el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => openPage(j, +b.dataset.p)));
      });
    };
    // עמוד מתוך קובץ: הטקסט של העמוד עם סימון, מעבר בין עמודים, וקישור לקובץ במודל
    const openPage = (j, i) => {
      if (!j) return;
      document.getElementById("fpModal")?.remove();
      const hitPages = j.pages.map((t, k) => (score(Q, "", t) ? k : -1)).filter((k) => k >= 0);
      const [u1] = UNIT(j.name);
      document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="fpModal" role="dialog" aria-modal="true" aria-labelledby="fpT"><div class="card fp-box">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px"><span style="min-width:0"><h2 id="fpT" style="font-size:20px;margin:0">📚 ${fileLabel(j.name)}</h2><span class="small muted">${esc(canon(j.course) || "")} · <span id="fpN"></span></span></span><button type="button" class="link" id="fpX" aria-label="סגירה" style="font-size:22px">✕</button></div>
        <div id="fpText" class="fp-text" tabindex="0"></div>
        <div class="row fp-nav"><button type="button" class="btn ghost small-btn" id="fpPrev">→ ${u1} קודם</button><button type="button" class="btn ghost small-btn" id="fpNext">${u1} הבא ←</button>
          <button type="button" class="btn ghost small-btn" id="fpHit">⏭ ההופעה הבאה של "${esc(Q.q)}"</button>
          ${/^https:\/\//.test(j.url || "") ? `<a class="btn small-btn" id="fpOpen" target="_blank" rel="noopener">פתיחת הקובץ במודל ↗</a>` : ""}</div>
        <p class="small muted" style="margin:0">זה הטקסט כפי שנקרא מהקובץ (בלי תמונות וגרפים, ולפעמים מספרים מסודרים אחרת). הקובץ המקורי – במודל.</p></div></div>`);
      const m = document.getElementById("fpModal");
      const show = (k) => {
        i = Math.max(0, Math.min(j.pages.length - 1, k));
        $("#fpN").textContent = `${u1} ${i + 1} מתוך ${j.pages.length}`;
        $("#fpText").innerHTML = j.pages[i] ? markHtml(Q, j.pages[i].replace(/\n{2,}/g, "\n"), esc) : `<p class="muted">אין טקסט ב${u1} הזה (אולי תמונה או גרף).</p>`;
        $("#fpText").scrollTop = 0; $("#fpText").querySelector("mark")?.scrollIntoView({ block: "center" });
        $("#fpPrev").disabled = i === 0; $("#fpNext").disabled = i === j.pages.length - 1;
        const nx = hitPages.find((k2) => k2 > i) ?? hitPages[0]; $("#fpHit").hidden = hitPages.length < 2; $("#fpHit").dataset.p = nx;
        const o = $("#fpOpen"); if (o) o.href = j.url + (/\.pdf$/i.test(j.name) ? "#page=" + (i + 1) : "");
      };
      const close = () => { m.remove(); removeEventListener("keydown", key); };
      const key = (e) => { if (e.key === "Escape") close(); };
      addEventListener("keydown", key);
      $("#fpX").onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
      $("#fpPrev").onclick = () => show(i - 1); $("#fpNext").onclick = () => show(i + 1); $("#fpHit").onclick = () => show(+$("#fpHit").dataset.p);
      show(i); $("#fpX").focus();
    };
    view.querySelectorAll(".sf-chip").forEach((b) => (b.onclick = () => { kind = b.dataset.k; view.querySelectorAll(".sf-chip").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); run(); }));
    $("#gc").onchange = run;
    $("#gq").oninput = run; run(); $("#gq").focus();
    // קבצי הקורס נטענים ברקע; כשמוכנים – החיפוש רץ שוב
    const idx = $("#gidx");
    idx.textContent = "📚 טוען את הטקסט של קבצי הקורס…";
    try {
      const fl = await courseTexts((d, n) => { if (n > 8) idx.textContent = `📚 טוען את קבצי הקורס… ${d}/${n}`; });
      if (!view.contains(idx)) return;   // עברו לדף אחר בינתיים
      fileDocs = fl.flatMap((j) => { const c = canon(j.course); return j.pages.map((t, i) => ({ kind: "file", file: j, page: i, title: j.name, course: c, body: t })); });
      const pages = fl.reduce((a, j) => a + j.pages.length, 0);
      idx.innerHTML = fl.length ? `📚 מחפש גם בתוך ${fl.length} קבצים מהמודל (${pages.toLocaleString("he-IL")} עמודים ושקפים)`
        : !ctSupported() ? "הדפדפן הזה ישן מדי לחיפוש בתוך קבצי הקורס – אחרי עדכון של המכשיר (iOS / ספארי) זה יעבוד. בינתיים מחפשים בשאר החומר."
        : 'כדי לחפש גם <b>בתוך</b> הקבצים מהמודל (באיזה עמוד כתוב מה) – צריך את <a href="#connect">המחבר למודל</a> בגרסה 1.6.14 ומעלה. הוא קורא את הקבצים בהדרגה.';
      fillCourses(); run();
    } catch { if (view.contains(idx)) idx.textContent = "לא הצלחנו לטעון את קבצי הקורס כרגע – מחפשים בשאר החומר."; }
  }

  // ---------- 🙋 שאלות למתרגל ----------
  async function questions() {
    const p = prefs.get();
    const list = (await store.listItems()).filter((x) => x.type === "tq").sort((a, b) => (a.done - b.done) || b.at.localeCompare(a.at));
    const open = list.filter((x) => !x.done);
    view.innerHTML = `<div class="page">
      <h1 style="font-size:30px">🙋 שאלות למתרגל</h1>
      <p class="muted">משהו לא ברור בשיעור? רושמים כאן, ובתרגול שואלים. אחרי שקיבלתם תשובה, מסמנים ✓ וכותבים אותה.</p>
      <section class="card" style="display:grid;gap:10px">
        <label class="field">קורס<select id="tqC" name="tqC">${(p.courses || []).map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label class="field">השאלה<textarea id="tqT" name="tqT" rows="2" autocomplete="off" placeholder="למשל: למה העקומה קעורה ולא קמורה?"></textarea></label>
        <div class="row"><button class="btn" id="tqAdd">${svg("plus")} הוספה</button></div></section>
      <h2 style="font-size:20px">פתוחות (${open.length})</h2>
      <div class="list">${list.map((x) => `<div class="soft tq ${x.done ? "done" : ""}" data-id="${x.id}">
        <div class="row" style="justify-content:space-between;align-items:flex-start"><span style="min-width:0;flex:1"><b>${esc(x.text)}</b><br><span class="small muted">${esc(x.course)}${x.lessonId ? ` · <a href="#lesson-${x.lessonId}">מהשיעור</a>` : ""}</span></span>
        <span class="row" style="gap:4px"><button class="pe-done ${x.done ? "on" : ""} tq-done" aria-label="סימון כנשאל">${x.done ? "✓" : ""}</button><button class="link tt-del tq-del" aria-label="מחיקה">${svg("trash")}</button></span></div>
        ${x.done ? `<textarea class="tq-ans" rows="2" placeholder="מה המתרגל ענה?" autocomplete="off">${esc(x.answer || "")}</textarea>` : ""}</div>`).join("") || '<p class="muted">אין שאלות פתוחות.</p>'}</div>
    </div>`;
    $("#tqAdd").onclick = async () => {
      const text = $("#tqT").value.trim(); if (!text) return toast("כתבו את השאלה קודם");
      await store.putItem({ id: "tq-" + Date.now(), type: "tq", course: $("#tqC").value, text, at: new Date().toISOString(), done: false });
      toast("נוספה שאלה"); questions();
    };
    const get = (el) => list.find((x) => x.id === el.closest(".tq").dataset.id);
    view.querySelectorAll(".tq-done").forEach((b) => (b.onclick = async () => { const x = get(b); x.done = !x.done; await store.putItem(x); questions(); }));
    view.querySelectorAll(".tq-del").forEach((b) => (b.onclick = async () => { if (confirm("למחוק את השאלה?")) { await store.deleteItem(get(b).id); questions(); } }));
    view.querySelectorAll(".tq-ans").forEach((t) => (t.onchange = async () => { const x = get(t); x.answer = t.value; await store.putItem(x); toast("נשמר"); }));
  }
  // מתוך דף שיעור: שאלה מהירה
  async function quickQuestion(course, lessonId) {
    const text = (prompt("מה השאלה למתרגל?") || "").trim(); if (!text) return;
    await store.putItem({ id: "tq-" + Date.now(), type: "tq", course, lessonId, text, at: new Date().toISOString(), done: false });
    toast("🙋 השאלה נשמרה ב\"שאלות למתרגל\"");
  }
  async function openQuestions() { return (await store.listItems()).filter((x) => x.type === "tq" && !x.done); }

  return { attachReader, printView, simSetup, grades, search, questions, quickQuestion, openQuestions };
}
