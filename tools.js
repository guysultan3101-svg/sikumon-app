// כלים לסטודנט: 🔊 הקראת סיכום, ⏱️ סימולציית מבחן, 🎯 "כמה אני צריך במבחן", 🔍 חיפוש בכל החומר,
// 🖨️ הדפסת סיכום / דף נוסחאות, ו-🙋 שאלות למתרגל. הכול עובד במכשיר, בלי AI ובלי שרת.

export function initTools(ctx) {
  const { view, $, esc, svg, toast, prefs, store } = ctx;

  // ---------- 🔊 הקראה בקול ----------
  // מקריא את הסיכום חלק אחרי חלק, ומסמן את החלק שמוקרא עכשיו
  function attachReader() {
    const body = view.querySelector(".md-body");
    if (!body || !("speechSynthesis" in window)) return;
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
      <button class="btn ghost small-btn" id="printBtn">🖨️ הדפסה / PDF</button></div>`);
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
    $("#rdPlay").onclick = () => {
      if (playing && !paused) { speechSynthesis.pause(); paused = true; $("#rdPlay").textContent = "▶ המשך"; return; }
      if (paused) { speechSynthesis.resume(); paused = false; $("#rdPlay").textContent = "⏸ השהיה"; return; }
      if (!voice()) toast("אין במכשיר קול בעברית? באייפון: הגדרות ← נגישות ← תוכן מוקרא ← קולות ← עברית");
      playing = true; i = 0; $("#rdPlay").textContent = "⏸ השהיה"; $("#rdStop").hidden = false; speakNext();
    };
    $("#rdStop").onclick = stop;
    // לחיצה על חלק בסיכום בזמן הקראה – ממשיכים משם
    blocks.forEach((b, k) => b.addEventListener("click", () => { if (playing) { speechSynthesis.cancel(); i = k; setTimeout(speakNext, 50); } }));
    $("#printBtn").onclick = () => printView();
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
    $("#smGo") && ($("#smGo").onclick = () => {
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
      return `<section class="soft gr-card" data-c="${ci}"><div class="row" style="justify-content:space-between"><h3>${esc(c)}</h3>${msg}</div>
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
  async function search(q0 = "") {
    view.innerHTML = `<div class="page">
      <h1 style="font-size:30px">🔍 חיפוש בכל החומר</h1>
      <label class="nb-search" style="max-width:640px">${svg("search")}<input type="search" id="gq" name="q" value="${esc(q0)}" placeholder="למשל: עלות שולית, מאזן, F4…" autocomplete="off" aria-label="חיפוש"></label>
      <div id="gres" class="list"></div></div>`;
    const items = await store.listItems();
    const lessons = await store.listLessons();
    const feed = items.find((x) => x.id === "moodle-feed");
    const text = (h) => new DOMParser().parseFromString(h, "text/html").body.textContent;
    const docs = [
      ...items.filter((x) => x.type === "summary").map((s) => ({ icon: s.kind === "formulas" ? "📐" : "📄", title: s.title, sub: s.course, body: text(s.html), link: "#sum-" + s.id })),
      ...lessons.map((l) => ({ icon: "📓", title: ctx.lessonTitle(l), sub: l.course, body: l.text || "", link: "#lesson-" + l.id })),
      ...items.filter((x) => x.type === "quiz").flatMap((q) => q.questions.map((x) => ({ icon: "✅", title: x.q, sub: q.course, body: x.options[x.a] + " " + (x.why || ""), link: "#quiz-" + q.id }))),
      ...items.filter((x) => x.type === "card").map((c) => ({ icon: "🃏", title: c.front, sub: c.course, body: c.back, link: "#cards" })),
      ...items.filter((x) => x.type === "tq").map((t) => ({ icon: "🙋", title: t.text, sub: t.course, body: t.answer || "", link: "#questions" })),
      ...(feed?.courses || []).flatMap((c) => c.sections.flatMap((s) => s.items.map((it) => ({ icon: "🎓", title: it.name, sub: c.course + " · מודל", body: s.title, link: it.url, ext: true })))),
    ];
    const run = () => {
      const q = $("#gq").value.trim().toLowerCase();
      if (q.length < 2) { $("#gres").innerHTML = '<p class="muted">מקלידים לפחות 2 אותיות. החיפוש עובר על סיכומים, דפי נוסחאות, מה שהקלדתם בשיעורים, שאלות מבחן, כרטיסיות, שאלות למתרגל וחומרים מהמודל.</p>'; return; }
      const hits = docs.map((d) => { const t = (d.title + " " + d.body).toLowerCase(); const k = t.indexOf(q); return k < 0 ? null : { d, k, score: (d.title.toLowerCase().includes(q) ? 0 : 1) }; }).filter(Boolean).sort((a, b) => a.score - b.score).slice(0, 60);
      const snip = (d) => { const b = d.body.replace(/\s+/g, " "); const k = b.toLowerCase().indexOf(q); if (k < 0) return ""; const s = Math.max(0, k - 50); return (s ? "…" : "") + esc(b.slice(s, k)) + "<mark>" + esc(b.slice(k, k + q.length)) + "</mark>" + esc(b.slice(k + q.length, k + q.length + 70)) + "…"; };
      $("#gres").innerHTML = hits.map(({ d }) => `<a class="item" href="${esc(d.link)}" ${d.ext ? 'target="_blank" rel="noopener"' : ""}><span style="min-width:0"><span class="t">${d.icon} ${esc(d.title)}</span><br><span class="small muted">${esc(d.sub)}${snip(d) ? " · " + snip(d) : ""}</span></span></a>`).join("") || '<p class="muted">לא נמצא כלום.</p>';
    };
    $("#gq").oninput = run; run(); $("#gq").focus();
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
      const text = $("#tqT").value.trim(); if (!text) return;
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
