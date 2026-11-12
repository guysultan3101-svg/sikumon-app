// תרגול ומעקב: כרטיסיות זיכרון (חזרה מרווחת), "מה חסר לי" ומעקב התקדמות לפי קורס.
// הכול מחושב במכשיר מתוך הסיכומים, המבחנים, השיעורים ומערכת השעות.

export function initPractice(ctx) {
  const { view, $, esc, svg, toast, prefs, store } = ctx;
  const DAY = 864e5;
  const STEPS = [0, 1, 3, 7, 14, 30]; // ימים עד החזרה הבאה, לפי "קופסה"

  // ---------- כרטיסיות ----------
  async function allCards() {
    const items = await store.listItems();
    const cards = [];
    // מכל מבחן: השאלה מקדימה, התשובה וההסבר מאחור
    for (const q of items.filter((x) => x.type === "quiz")) {
      q.questions.forEach((x, i) => cards.push({ id: q.id + "#" + i, course: q.course, front: x.q, back: x.options[x.a] + (x.why ? "\n\n" + x.why : ""), src: "מבחן" }));
    }
    // מדפי הנוסחאות: שם הנוסחה מקדימה, הנוסחה מאחור
    for (const f of items.filter((x) => x.type === "summary" && x.kind === "formulas")) {
      const doc = new DOMParser().parseFromString(f.html, "text/html");
      doc.querySelectorAll("tr").forEach((tr, i) => {
        const td = [...tr.querySelectorAll("td")].map((x) => x.textContent.trim());
        if (td.length >= 2 && td[0] && td[1]) cards.push({ id: f.id + "#t" + i, course: f.course, front: td[0].replace(/⭐/g, "").trim(), back: td.slice(1).join("\n"), src: "נוסחאות" });
      });
      doc.querySelectorAll("li").forEach((li, i) => {
        const t = li.textContent.replace(/⭐/g, "").trim();
        const m = t.match(/^(.{3,80}?)\s*[:=]\s*(.+)$/);
        if (m) cards.push({ id: f.id + "#l" + i, course: f.course, front: m[1].trim(), back: m[2].trim(), src: "נוסחאות" });
      });
    }
    // כרטיסיות שכתבת בעצמך
    for (const c of items.filter((x) => x.type === "card")) cards.push({ ...c, src: "שלי" });
    return cards;
  }
  async function cardState() { return (await store.getItem("cards-state")) || { id: "cards-state", type: "state", boxes: {} }; }
  const isDue = (st, id) => !st.boxes[id] || st.boxes[id].due <= Date.now();

  async function cardsScreen(course = "") {
    const cards = await allCards();
    const st = await cardState();
    const courses = [...new Set(cards.map((c) => c.course))];
    const pool = cards.filter((c) => !course || c.course === course);
    const lvl = (c) => ((JSON.parse(localStorage.getItem("sikumon-prefs") || "{}").levels) || {})[c.course] || 0;
    const due = pool.filter((c) => isDue(st, c.id));
    const mastered = pool.filter((c) => (st.boxes[c.id]?.box || 0) >= 4).length;
    view.innerHTML = `<div class="page">
      <a href="#quizzes" class="small">→ מבחנים</a>
      <h1 style="font-size:30px">🃏 כרטיסיות זיכרון</h1>
      <p class="muted">שאלה מקדימה, תשובה מאחור. מה שיודעים חוזר בעוד כמה ימים, ומה שלא יודעים חוזר מחר. ככה זוכרים לאורך זמן.</p>
      <div class="chips-row">${["", ...courses].map((c) => `<a class="chip-btn ${c === course ? "on" : ""}" href="#cards${c ? "-" + encodeURIComponent(c) : ""}">${c ? esc(c) : "הכול"}</a>`).join("")}</div>
      <section class="card" style="text-align:center;display:grid;gap:10px;justify-items:center">
        <h2 style="font-size:40px"><bdi>${due.length}</bdi></h2><p class="muted">כרטיסיות לחזרה היום · ${pool.length} בסך הכול · ${mastered} כבר יושבות טוב</p>
        <button class="btn" id="startCards" ${due.length ? "" : "disabled"}>${due.length ? "מתחילים" : "אין מה לחזור היום 🎉"}</button></section>
      <details class="soft"><summary><b>כרטיסייה חדשה משלך</b></summary>
        <div style="display:grid;gap:10px;margin-top:10px">
          <label class="field">קורס<select id="cCourse" name="cCourse">${(prefs.get().courses || []).map((c) => `<option ${c === course ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label class="field">צד קדמי (שאלה / מושג)<input type="text" id="cFront" name="cFront" autocomplete="off" placeholder="למשל: עלות אלטרנטיבית שולית"></label>
          <label class="field">צד אחורי (תשובה)<textarea id="cBack" name="cBack" rows="3" autocomplete="off" placeholder="למשל: ΔY / ΔX – הוויתור על יחידה אחת נוספת"></textarea></label>
          <div class="row"><button class="btn ghost" id="cSave">${svg("plus")} הוספה</button></div></div></details>
    </div>`;
    $("#cSave").onclick = async () => {
      const front = $("#cFront").value.trim(), back = $("#cBack").value.trim();
      if (!front || !back) { toast("צריך גם צד קדמי וגם צד אחורי"); return; }
      await store.putItem({ id: "card-" + Date.now(), type: "card", course: $("#cCourse").value, front, back });
      toast("הכרטיסייה נוספה"); cardsScreen(course);
    };
    $("#startCards").onclick = () => session(due.sort(() => Math.random() - 0.5).sort((a, b) => lvl(b) - lvl(a)).slice(0, 20), st, course)   // קורסים קשים (לפי הרמה שהוגדרה) קודם;
  }

  function session(list, st, course, i = 0, known = 0) {
    if (i >= list.length) {
      view.innerHTML = `<div class="page" style="text-align:center;justify-items:center"><p class="eyebrow">סיימת</p><h1 style="font-size:48px"><bdi>${known}/${list.length}</bdi></h1>
        <p class="muted">${known === list.length ? "מעולה! הכול יושב." : "מה שלא ידעת יחזור מחר."}</p><div class="row" style="justify-content:center"><a class="btn" href="#quizzes">חזרה למבחנים</a></div></div>`;
      bumpStreak();
      return;
    }
    const c = list[i];
    view.innerHTML = `<div class="page">
      <div class="progress" aria-hidden="true"><i style="width:${(i / list.length) * 100}%"></i></div>
      <div class="row" style="justify-content:space-between"><p class="eyebrow">כרטיסייה ${i + 1} מתוך ${list.length}</p><span class="chip">${esc(c.course)} · ${c.src}</span></div>
      <button class="flash" id="flash" aria-live="polite"><span class="ff">${esc(c.front)}</span><span class="fb" hidden>${esc(c.back).replace(/\n/g, "<br>")}</span><span class="small muted fh">לוחצים כדי להפוך</span></button>
      <div class="row" id="ans" hidden style="justify-content:center"><button class="btn danger" id="no">לא ידעתי</button><button class="btn" id="yes" style="background:var(--green)">ידעתי ✓</button></div>
    </div>`;
    $("#flash").onclick = () => { $(".fb").hidden = false; $(".fh").hidden = true; $("#flash").classList.add("flipped"); $("#ans").hidden = false; };
    const grade = async (ok) => {
      const b = ok ? Math.min((st.boxes[c.id]?.box || 0) + 1, STEPS.length - 1) : 1;
      st.boxes[c.id] = { box: b, due: Date.now() + (ok ? STEPS[b] : 1) * DAY };
      await store.putItem(st);
      session(list, st, course, i + 1, known + (ok ? 1 : 0));
    };
    $("#yes").onclick = () => grade(true);
    $("#no").onclick = () => grade(false);
  }

  // ---------- רצף ימים: נספר כשעושים מבחן או כרטיסיות ----------
  function bumpStreak() {
    const p = prefs.get(); const today = new Date().toLocaleDateString("en-CA");
    const y = new Date(Date.now() - DAY).toLocaleDateString("en-CA");
    if (p.streakDay === today) return;
    p.streak = p.streakDay === y ? (p.streak || 0) + 1 : 1; p.streakDay = today; prefs.set(p);
    if (p.streak > 1) toast(`🔥 ${p.streak} ימים ברצף!`);
  }

  // ---------- מה חסר לי ----------
  async function missing() {
    const p = prefs.get();
    const lessons = await store.listLessons();
    const has = (course, date) => lessons.some((l) => l.course === course && l.date === date && ((l.pages || []).some((pg) => pg.strokes.length || pg.image) || l.text?.trim() || (l.recIds || []).length));
    const out = [];
    const now = new Date();
    for (let d = 1; d <= 21; d++) {
      const day = new Date(now - d * DAY); const key = day.toLocaleDateString("en-CA");
      for (const s of (p.timetable || []).filter((x) => +x.day === day.getDay())) {
        if (!has(s.course, key)) out.push({ kind: "lesson", course: s.course, date: key, text: `${s.course} · ${day.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" })}: אין כתב, הקלדה או הקלטה` });
      }
    }
    const items = await store.listItems();
    const tried = new Set((await store.listAttempts()).map((a) => a.quizId));
    for (const q of items.filter((x) => x.type === "quiz" && !tried.has(x.id))) out.push({ kind: "quiz", course: q.course, id: q.id, text: `עוד לא עשית את המבחן על "${q.title}"` });
    return out;
  }
  async function missingScreen() {
    const list = await missing();
    view.innerHTML = `<div class="page">
      <h1 style="font-size:30px">📋 מה חסר לי</h1>
      <p class="muted">שיעורים מ-3 השבועות האחרונים (לפי מערכת השעות) שאין עליהם כלום, ומבחנים שעוד לא עשית.</p>
      <div class="list">${list.map((x) => `<a class="item" href="${x.kind === "quiz" ? "#quiz-" + esc(x.id) : "#notebooks"}"><span style="min-width:0"><span class="t">${x.kind === "quiz" ? "✅" : "📓"} ${esc(x.text)}</span></span></a>`).join("") || '<p class="muted">אין פערים. כל הכבוד! 🎉</p>'}</div>
      ${(prefs.get().timetable || []).length ? "" : '<p class="notice">כדי לזהות שיעורים שחסרים, צריך <a href="#timetable">מערכת שעות</a>.</p>'}
    </div>`;
  }

  // ---------- מעקב התקדמות ----------
  function spark(points) {
    if (points.length < 2) return "";
    const W = 260, H = 60, xs = (i) => (i / (points.length - 1)) * W, ys = (v) => H - v * H;
    return `<svg viewBox="-4 -4 ${W + 8} ${H + 8}" class="spark" role="img" aria-label="מגמת הציונים"><polyline fill="none" stroke="var(--blue)" stroke-width="3" stroke-linejoin="round" points="${points.map((v, i) => `${xs(i)},${ys(v)}`).join(" ")}"/>${points.map((v, i) => `<circle cx="${xs(i)}" cy="${ys(v)}" r="3.5" fill="var(--blue)"/>`).join("")}</svg>`;
  }
  async function progressScreen() {
    const p = prefs.get();
    const at = (await store.listAttempts()).sort((a, b) => a.at.localeCompare(b.at));
    const lessons = await store.listLessons();
    const items = await store.listItems();
    const st = await cardState();
    const cards = await allCards();
    const courses = [...new Set([...(p.courses || []), ...at.map((a) => a.course)])].filter((c) => c !== "דוגמה");
    const rows = courses.map((c) => {
      const a = at.filter((x) => x.course === c);
      const pts = a.map((x) => x.score / x.total);
      const avg = pts.length ? Math.round((pts.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, pts.length)) * 100) : null;
      const cc = cards.filter((x) => x.course === c);
      return { c, a, pts, avg, lessons: lessons.filter((l) => l.course === c).length, sums: items.filter((x) => x.type === "summary" && x.course === c).length, cards: cc.length, mastered: cc.filter((x) => (st.boxes[x.id]?.box || 0) >= 4).length };
    }).filter((r) => r.a.length || r.lessons || r.sums);
    const weak = Object.values(at.reduce((m, x) => ((m[x.quizId] = x), m), {})).filter((x) => x.score / x.total < 0.7).slice(0, 5);
    view.innerHTML = `<div class="page">
      <a href="#quizzes" class="small">→ מבחנים</a>
      <h1 style="font-size:30px">📈 ההתקדמות שלי</h1>
      <div class="grid3"><div class="stat"><b>${p.streak || 0} 🔥</b><span>ימים ברצף</span></div><div class="stat"><b>${at.length}</b><span>מבחנים שעשית</span></div><div class="stat"><b>${Object.values(st.boxes).filter((b) => b.box >= 4).length}</b><span>כרטיסיות שיושבות טוב</span></div></div>
      ${weak.length ? `<section class="soft"><h2 style="font-size:20px;margin:0">כדאי לחזור על</h2><div class="list" style="margin-top:8px">${weak.map((w) => `<a class="item" href="#quiz-${esc(w.quizId)}"><span style="min-width:0"><span class="t">${esc(w.title)}</span><br><span class="small muted">${esc(w.course)}</span></span><b class="score"><bdi>${w.score}/${w.total}</bdi></b></a>`).join("")}</div></section>` : ""}
      ${rows.map((r) => `<section class="soft prog-row"><div><h2 style="font-size:18px;margin:0">${esc(r.c)}</h2><p class="small muted">${r.lessons} שיעורים במחברת · ${r.sums} סיכומים · ${r.a.length} מבחנים · כרטיסיות ${r.mastered}/${r.cards}</p></div>
        <div class="prog-side">${r.avg !== null ? `<b class="score ${r.avg >= 80 ? "full" : ""}">${r.avg}%</b>` : '<span class="small muted">עוד אין ציונים</span>'}${spark(r.pts)}</div></section>`).join("") || '<p class="muted">עוד אין נתונים. עשו מבחן או כרטיסיות, וההתקדמות תופיע כאן.</p>'}
    </div>`;
  }

  return { cardsScreen, missing, missingScreen, progressScreen, bumpStreak };
}
