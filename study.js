// סיכומים ומבחנים: ייבוא מ-Drive, רשימת סיכומים לפי קורס, מבחנים אישיים, היסטוריה ויצירת מבחן.
// הכול נשמר במכשיר (IndexedDB) – שום דבר לא עולה לשרת.

export function initStudy(ctx) {
  const { view, $, esc, svg, toast, prefs, store, demoQuiz } = ctx;
  const fmtDay = (iso) => new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
  const byCourse = (items) => {
    const order = prefs.get().courses || [];
    const m = new Map();
    for (const it of items) { if (!m.has(it.course)) m.set(it.course, []); m.get(it.course).push(it); }
    return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
  };
  // טווח מספרים בכותרת (1–2) מוצג משמאל לימין, כדי שלא יתהפך
  const escT = (t) => esc(t).replace(/(d+)s*([–-])s*(d+)/g, '<bdi dir="ltr">$1$2$3</bdi>');
  const lib = async (type) => (await store.listItems()).filter((x) => x.type === type);

  // ---------- ייבוא החבילה מ-Drive ----------
  async function importPack(file) {
    let pack;
    try { pack = JSON.parse(await file.text()); } catch { throw new Error("הקובץ לא נקרא. בחרו את 'סיכומון - החומר שלי.json'."); }
    if (pack?.type !== "sikumon-pack") throw new Error("זה לא קובץ של סיכומון.");
    for (const s of pack.summaries || []) await store.putItem({ ...s, type: "summary" });
    for (const q of pack.quizzes || []) await store.putItem({ ...q, type: "quiz" });
    // קורסים חדשים מ-Moodle נכנסים גם למחברות
    const p = prefs.get();
    const add = (pack.courses || []).filter((c) => !(p.courses || []).includes(c));
    p.courses = [...(p.courses || []), ...add];
    p.lastImport = new Date().toISOString();
    prefs.set(p);
    return { summaries: (pack.summaries || []).length, quizzes: (pack.quizzes || []).length, courses: add.length };
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

  // ---------- סיכומים ----------
  async function summaries() {
    const items = (await lib("summary")).sort((a, b) => (a.kind === "formulas") - (b.kind === "formulas") || b.date.localeCompare(a.date));
    const groups = byCourse(items);
    view.innerHTML = `<div class="page">
      <div class="row" style="justify-content:space-between"><h1 style="font-size:32px">הסיכומים שלי</h1>${importButton(items.length ? "עדכון מ-Drive" : "ייבוא מ-Drive")}</div>
      ${items.length ? "" : `<div class="notice"><b>איך מכניסים את הסיכומים שכבר יש לך?</b>
        <ol class="steps"><li>לוחצים "ייבוא מ-Drive".</li><li>בוחרים את הקובץ <b>סיכומון - החומר שלי.json</b> מהתיקייה "לימודים - אריאל" ב-Google Drive.</li><li>כל הסיכומים, דפי הנוסחאות והמבחנים נכנסים לאפליקציה, מסודרים לפי הקורסים שלך במודל.</li></ol></div>`}
      ${groups.map(([course, list]) => `<section class="soft"><h2 style="font-size:20px">${esc(course)}</h2><div class="list" style="margin-top:10px">${list.map((s) =>
        `<a class="item" href="#sum-${esc(s.id)}"><span style="min-width:0"><span class="t">${escT(s.title)}</span><br><span class="small muted">${s.kind === "formulas" ? "דף נוסחאות" : "סיכום"} · <bdi>${fmtDay(s.date)}</bdi></span></span>${s.kind === "formulas" ? '<span class="chip">📐 נוסחאות</span>' : ""}</a>`).join("")}</div></section>`).join("")}
      ${items.length ? "" : `<section class="soft"><h3>סיכום לדוגמה</h3><a class="item" href="#summary" style="margin-top:10px"><span><span class="t">מבוא לכלכלה מיקרו</span><br><span class="small muted">ככה נראה סיכום אוטומטי</span></span><span class="chip demo">דוגמה</span></a></section>`}
      ${prefs.get().lastImport ? `<p class="small muted">עודכן לאחרונה: <bdi>${new Date(prefs.get().lastImport).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</bdi>. בגרסה המלאה הסיכומים יגיעו מ-Moodle לבד, בלי ייבוא.</p>` : ""}
    </div>`;
    bindImport(summaries);
  }

  async function summaryPage(id) {
    const s = await store.getItem(id);
    if (!s) { view.innerHTML = '<div class="page"><p>הסיכום לא נמצא.</p><a href="#summaries">לכל הסיכומים</a></div>'; return; }
    const quiz = (await lib("quiz")).find((q) => q.summaryId === id);
    view.innerHTML = `<div class="page summary">
      <a href="#summaries" class="small">→ כל הסיכומים</a>
      <div class="row"><span class="chip">${esc(s.course)}</span><span class="chip"><bdi>${fmtDay(s.date)}</bdi></span></div>
      <h1 style="font-size:clamp(24px,4vw,34px)">${escT(s.title)}</h1>
      <article class="card md-body">${s.html}</article>
      ${quiz ? `<a class="btn" href="#quiz-${esc(quiz.id)}">${svg("check")} למבחן על הסיכום (${quiz.questions.length} שאלות)</a>` : ""}
    </div>`;
    // טבלאות רחבות נגללות הצידה בטלפון
    view.querySelectorAll(".md-body table").forEach((t) => { const w = document.createElement("div"); w.className = "tablewrap"; t.replaceWith(w); w.appendChild(t); });
  }

  // ---------- מבחנים ----------
  let retryQuiz = null; // "רק הטעויות" – מבחן זמני בזיכרון

  async function quizzes() {
    const qs = await lib("quiz");
    const attempts = (await store.listAttempts()).sort((a, b) => b.at.localeCompare(a.at));
    const stats = (id) => { const a = attempts.filter((x) => x.quizId === id); return a.length ? { n: a.length, last: a[0], best: Math.max(...a.map((x) => x.score / x.total)) } : null; };
    const courses = byCourse(qs).map(([c]) => c);
    const list = qs.length ? qs : [{ ...demoQuiz, id: "demo", title: "מיקרו – שאלות לדוגמה", course: "דוגמה", demo: true }];
    view.innerHTML = `<div class="page">
      <div class="row" style="justify-content:space-between"><h1 style="font-size:32px">המבחנים שלי</h1><a class="btn" href="#quiz-new">${svg("plus")} מבחן חדש</a></div>
      ${courses.length ? `<section class="card"><h3>חזרה למבחן</h3><p class="small muted">שאלות מעורבבות מכל המבחנים של הקורס, כמו במבחן אמיתי.</p>
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
      ${qs.length ? "" : `<p class="small muted">המבחנים על הסיכומים שלך נכנסים יחד עם הסיכומים, ב"ייבוא מ-Drive" במסך הסיכומים.</p>`}
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
    if (id === "retry" && retryQuiz) return runQuiz(retryQuiz);
    const q = id === "demo" ? { ...demoQuiz, id: "demo", title: "מיקרו – שאלות לדוגמה", course: "דוגמה" } : await store.getItem(id);
    if (!q) { location.hash = "quizzes"; return; }
    runQuiz(q);
  }

  // ---------- הרצת מבחן ----------
  function runQuiz(quiz, i = 0, score = 0, picked = null, wrong = []) {
    const qs = quiz.questions;
    if (i >= qs.length) {
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

  return { summaries, summaryPage, quizzes, quizById, mixQuiz, quizEditor, importPack };
}
