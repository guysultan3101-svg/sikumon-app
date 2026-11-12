// לקראת מבחן ובזמן שיעור: לוח מבחנים והגשות עם ספירה לאחור ותזכורות ביומן,
// מבחנים משנים קודמות מהמודל, "מה יהיה במבחן", ורילס של הרגעים החשובים מההקלטות.

export function initExtras(ctx) {
  const { view, $, esc, svg, toast, prefs, store, segmentsOf, fmtTime } = ctx;
  const DAY = 864e5;
  const daysTo = (iso) => { const t = new Date(iso); if (t < Date.now()) return -1; const a = new Date(t), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((a - b) / DAY); };   // ימים לפי לוח השנה; מה שכבר עבר = -1
  const inDays = (n) => (n < 0 ? "עבר" : n === 0 ? "היום!" : n === 1 ? "מחר" : `בעוד ${n} ימים`);
  const fmtWhen = (iso) => new Date(iso).toLocaleString("he-IL", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const urgency = (n) => (n <= 3 ? "hot" : n <= 14 ? "warm" : "");

  // ---------- מבחנים (שמורים בהגדרות) ומועדי הגשה (מהמודל) ----------
  const exams = () => (prefs.get().exams || []).filter((e) => e.date).map((e) => ({ ...e, when: `${e.date}T${e.time || "09:00"}` }));
  async function deadlines() { return (await store.getItem("deadlines"))?.events || []; }
  // הדבר הבא בתור לכל קורס (או לכולם)
  async function upcoming(course = null) {
    const ex = exams().filter((e) => daysTo(e.when) >= 0).map((e) => ({ kind: "exam", title: `${e.label ? e.label + " · " : "מבחן "}${e.course}${e.moed ? " – מועד " + e.moed : ""}`, course: e.course, when: e.when }));
    const dl = (await deadlines()).filter((d) => !d.done && daysTo(d.due) >= 0).map((d) => ({ kind: "deadline", title: d.name, course: d.course, when: d.due, url: d.url }));
    return [...ex, ...dl].filter((x) => !course || x.course === course).sort((a, b) => a.when.localeCompare(b.when));
  }
  const chip = (x) => `<span class="cd ${urgency(daysTo(x.when))}">${x.kind === "exam" ? "📝" : "📌"} ${esc(x.kind === "exam" ? "מבחן" : "הגשה")} ${inDays(daysTo(x.when))}</span>`;

  // ---------- תזכורות ביומן (קובץ ics: תזכורת שבוע, 3 ימים ויום לפני מבחן) ----------
  function ics(items) {
    const z = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const alarms = (kind) => (kind === "exam" ? ["-P7D", "-P3D", "-P1D"] : ["-P1D", "-PT3H"]).map((t) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:תזכורת\r\nTRIGGER:${t}\r\nEND:VALARM`).join("\r\n");
    const ev = items.map((x, i) => `BEGIN:VEVENT\r\nUID:sikumon-${i}-${z(x.when)}@sikumon\r\nDTSTAMP:${z(new Date().toISOString())}\r\nDTSTART:${z(x.when)}\r\nDURATION:PT${x.kind === "exam" ? 3 : 1}H\r\nSUMMARY:${(x.kind === "exam" ? "📝 " : "📌 ") + x.title}\r\n${alarms(x.kind)}\r\nEND:VEVENT`).join("\r\n");
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sikumon//HE\r\nCALSCALE:GREGORIAN\r\n${ev}\r\nEND:VCALENDAR\r\n`;
  }
  function addToCalendar(items) {
    if (!items.length) { toast("אין מועדים להוסיף"); return; }
    const url = URL.createObjectURL(new Blob([ics(items)], { type: "text/calendar" }));
    const a = document.createElement("a"); a.href = url; a.download = "Clearly-מועדים.ics"; a.click();
    toast("נפתח קובץ יומן. לוחצים \"הוספה ליומן\" והתזכורות נכנסות לטלפון");
  }

  // ---------- מבחנים משנים קודמות (מתוך המודל) ----------
  const EXAM_RE = /מבחן|מבחנים|בחינ|מועד [אב]|exam/i;
  async function pastExams(course) {
    const feed = await store.getItem("moodle-feed");
    const mc = feed?.courses.find((c) => c.course === course);
    if (!mc) return [];
    return mc.sections.flatMap((s) => s.items.filter((it) => ["resource", "folder", "url"].includes(it.type) && (EXAM_RE.test(s.title) || EXAM_RE.test(it.name))).map((it) => ({ ...it, section: s.title })));
  }
  function pastExamsBlock(list, course) {
    if (!list.length) return "";
    const done = prefs.get().doneExams || {};
    const n = list.filter((x) => done[x.url]).length;
    return `<section class="soft"><div class="row" style="justify-content:space-between"><h2 style="font-size:20px">📝 מבחנים משנים קודמות</h2><span class="chip">${n}/${list.length} נפתרו</span></div>
      <p class="small muted">מבחנים לדוגמה שהמרצה העלה למודל. פותחים, פותרים, ומסמנים ✓ כשסיימתם.</p>
      <div class="list" style="margin-top:8px">${list.map((x) => `<div class="pe-row"><button class="pe-done ${done[x.url] ? "on" : ""}" data-url="${esc(x.url)}" aria-label="סימון כנפתר">${done[x.url] ? "✓" : ""}</button><a class="item" href="${esc(x.url)}" target="_blank" rel="noopener"><span style="min-width:0"><span class="t">${esc(x.name)}</span><br><span class="small muted">${esc(x.section)}</span></span></a></div>`).join("")}</div></section>`;
  }
  function bindPastExams(rerender) {
    view.querySelectorAll(".pe-done").forEach((b) => (b.onclick = () => {
      const p = prefs.get(); p.doneExams = p.doneExams || {};
      if (p.doneExams[b.dataset.url]) delete p.doneExams[b.dataset.url]; else p.doneExams[b.dataset.url] = new Date().toISOString();
      prefs.set(p); rerender();
    }));
  }

  // ---------- מסך: לוח מבחנים והגשות ----------
  async function deadlinesScreen() {
    const p = prefs.get();
    const items = await upcoming();
    const courses = p.courses || [];
    const examRows = p.exams || [];
    const row = (e) => `<div class="tt-row ex-row">
      <select class="ex-course" aria-label="קורס">${courses.map((c) => `<option ${c === e.course ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <select class="ex-moed" aria-label="מועד">${["א", "ב", "מיוחד"].map((m) => `<option ${m === e.moed ? "selected" : ""}>${m}</option>`).join("")}</select>
      <input type="date" class="ex-date" value="${e.date || ""}" aria-label="תאריך"><input type="time" class="ex-time" value="${e.time || "09:00"}" aria-label="שעה">
      <button class="link tt-del ex-del" aria-label="מחיקה">${svg("trash")}</button></div>`;
    const pe = (await Promise.all(courses.map(async (c) => [c, await pastExams(c)]))).filter(([, l]) => l.length);
    view.innerHTML = `<div class="page">
      <h1 style="font-size:30px">⏳ לוח מבחנים והגשות</h1>
      <section class="card"><div class="row" style="justify-content:space-between"><h2 style="font-size:20px">מה מחכה לך</h2><button class="btn ghost small-btn" id="toCal">📅 הוספה ליומן עם תזכורות</button></div>
        <div class="list" style="margin-top:10px">${items.map((x) => `<a class="item" ${x.url ? `href="${esc(x.url)}" target="_blank" rel="noopener"` : ""}><span style="min-width:0"><span class="t">${x.kind === "exam" ? "📝" : "📌"} ${esc(x.title)}</span><br><span class="small muted">${esc(x.course)} · <bdi>${fmtWhen(x.when)}</bdi></span></span><span class="cd ${urgency(daysTo(x.when))}">${inDays(daysTo(x.when))}</span></a>`).join("") || '<p class="muted">אין מבחנים או הגשות קרובים. הוסיפו את תאריכי המבחנים למטה.</p>'}</div>
        <p class="small muted" style="margin-top:8px">הגשות ובחנים מגיעים לבד מהמודל. התזכורות ביומן: שבוע, 3 ימים ויום לפני כל מבחן, ויום ו-3 שעות לפני כל הגשה.</p></section>
      <section class="soft"><h2 style="font-size:20px">תאריכי המבחנים שלי</h2><p class="small muted">מעתיקים מלוח המבחנים של האוניברסיטה (במערכת המידע לסטודנט). פעם אחת בסמסטר.</p>
        <div class="list" id="exList" style="margin-top:8px">${examRows.map(row).join("")}</div>
        <div class="row" style="margin-top:10px"><button class="btn ghost" id="exAdd">${svg("plus")} מבחן</button><button class="btn" id="exSave">שמירה</button></div></section>
      ${pe.map(([c, l]) => pastExamsBlock(l, c).replace("📝 מבחנים משנים קודמות", "📝 " + esc(c) + ": מבחנים קודמים")).join("")}
    </div>`;
    $("#toCal").onclick = () => addToCalendar(items);
    const bindDel = () => view.querySelectorAll(".ex-del").forEach((b) => (b.onclick = () => b.closest(".ex-row").remove()));
    bindDel();
    $("#exAdd").onclick = () => { if (!courses.length) return toast("צריך קודם קורס"); $("#exList").insertAdjacentHTML("beforeend", row({ course: courses[0], moed: "א" })); bindDel(); };
    $("#exSave").onclick = () => {
      const ex = [...view.querySelectorAll(".ex-row")].map((r) => ({ course: r.querySelector(".ex-course").value, moed: r.querySelector(".ex-moed").value, date: r.querySelector(".ex-date").value, time: r.querySelector(".ex-time").value })).filter((e) => e.date);
      const pr = prefs.get(); pr.exams = ex; pr.examsEdited = true; prefs.set(pr);
      toast("המבחנים נשמרו"); deadlinesScreen();
    };
    bindPastExams(deadlinesScreen);
  }

  // ---------- ⭐ מה יהיה במבחן: כל מה שהמרצה אמר שחשוב, מכל הסיכומים ----------
  const KEY_RE = /מבחן|בחינה|בוחן|יופיע|חשוב מאוד|חובה לדעת|לזכור|שימו לב|הגשה|מטלה/;
  async function examFocus() {
    const sums = (await store.listItems()).filter((x) => x.type === "summary" && x.kind !== "formulas");
    const byCourse = new Map();
    for (const s of sums) {
      const doc = new DOMParser().parseFromString(s.html, "text/html");
      const out = new Set();
      // 1. כל מה שתחת "הודעות חשובות מהמרצה"
      doc.querySelectorAll("h2,h3").forEach((h) => {
        if (!/הודעות|חשוב/.test(h.textContent)) return;
        for (let el = h.nextElementSibling; el && !/^H[23]$/.test(el.tagName); el = el.nextElementSibling) {
          (el.matches("ul,ol") ? [...el.querySelectorAll("li")] : [el]).forEach((x) => x.textContent.trim() && out.add(x.innerHTML.trim()));
        }
      });
      // 2. משפטים בכל הסיכום שמדברים על המבחן
      doc.querySelectorAll("li,p").forEach((x) => { const t = x.textContent; if (KEY_RE.test(t) && t.length < 400 && !x.querySelector("li")) out.add(x.innerHTML.trim()); });
      if (out.size) { if (!byCourse.has(s.course)) byCourse.set(s.course, []); byCourse.get(s.course).push({ s, items: [...out] }); }
    }
    view.innerHTML = `<div class="page">
      <a href="#summaries" class="small">→ הסיכומים</a>
      <h1 style="font-size:30px">⭐ מה יהיה במבחן</h1>
      <p class="muted">כל מה שהמרצים אמרו שחשוב למבחן, מכל הסיכומים, במקום אחד ולפי קורס.</p>
      ${[...byCourse.entries()].map(([c, list]) => `<section class="card focus-c"><h2 style="font-size:21px">${esc(c)}</h2>
        ${list.map(({ s, items }) => `<div class="focus-s"><a class="small" href="#sum-${esc(s.id)}">${esc(s.title)}</a><ul>${items.map((h) => `<li>${h}</li>`).join("")}</ul></div>`).join("")}</section>`).join("") || '<p class="muted">עוד אין בסיכומים דברים שסומנו כחשובים למבחן. הם יופיעו כאן אחרי השיעורים הבאים.</p>'}
    </div>`;
  }

  // ---------- 🎬 רילס: הרגעים שסימנת בכוכב בזמן ההקלטה ----------
  async function reels(recId = null) {
    const recs = (await store.listRecordings()).filter((r) => (r.marks || []).length && (!recId || r.id === recId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const clips = recs.flatMap((r) => r.marks.map((m, i) => ({ r, m, i })));
    if (!clips.length) {
      view.innerHTML = `<div class="page"><h1 style="font-size:30px">🎬 הרגעים החשובים</h1><p class="muted">עוד אין רגעים. בזמן הקלטה לוחצים על <b>⭐ רגע חשוב</b> כשהמרצה אומר משהו חשוב, וכאן תקבלו קטע של דקה סביב כל כוכב.</p></div>`;
      return;
    }
    view.innerHTML = `<div class="reels" id="reels">
      ${clips.map(({ r, m, i }, k) => `<section class="reel" data-k="${k}">
        <div class="reel-card"><p class="eyebrow">${esc(r.course)} · <bdi>${new Date(r.startedAt).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</bdi></p>
          <h2>⭐ רגע ${i + 1} מתוך ${r.marks.length}</h2><p class="muted"><bdi>${fmtTime(m.at)}</bdi> בהקלטה${m.note ? " · " + esc(m.note) : ""}</p>
          <div class="bars" aria-hidden="true">${"<i></i>".repeat(24)}</div>
          <div class="reel-prog"><i></i></div>
          <div class="row" style="justify-content:center"><button class="btn reel-play">▶ השמעה</button>${r.lessonId ? `<a class="btn ghost" href="#lesson-${r.lessonId}">למחברת</a>` : ""}</div>
          <p class="small muted">${k + 1}/${clips.length} · מחליקים למעלה לרגע הבא</p></div></section>`).join("")}
    </div>`;
    const audio = new Audio();
    const urls = new Map();
    let cur = -1, endAt = 0;
    async function urlFor(r, seg) {
      const key = r.id + ":" + seg;
      if (!urls.has(key)) { const s = (await segmentsOf(r)).find((x) => x.segment === seg); urls.set(key, s ? URL.createObjectURL(s.blob) : null); }
      return urls.get(key);
    }
    async function play(k) {
      const { r, m } = clips[k];
      const u = await urlFor(r, m.seg ?? 0);
      if (!u) { toast("ההקלטה של הרגע הזה לא נמצאה"); return; }
      cur = k;
      const start = Math.max(0, m.t / 1000 - 20); endAt = m.t / 1000 + 40;
      if (audio.src !== u) { audio.src = u; await new Promise((res) => { audio.onloadedmetadata = res; setTimeout(res, 1500); }); }
      audio.currentTime = start;
      try { await audio.play(); } catch { /* צריך לחיצה */ }
      view.querySelectorAll(".reel").forEach((el) => el.classList.toggle("playing", +el.dataset.k === k));
    }
    audio.ontimeupdate = () => {
      if (cur < 0) return;
      const { m } = clips[cur]; const start = Math.max(0, m.t / 1000 - 20);
      const pct = Math.min(100, ((audio.currentTime - start) / (endAt - start)) * 100);
      const bar = view.querySelector(`.reel[data-k="${cur}"] .reel-prog i`); if (bar) bar.style.width = pct + "%";
      if (audio.currentTime >= endAt) { audio.pause(); view.querySelector(`.reel[data-k="${cur}"]`)?.classList.remove("playing"); }
    };
    view.querySelectorAll(".reel-play").forEach((b) => (b.onclick = () => {
      const k = +b.closest(".reel").dataset.k;
      if (cur === k && !audio.paused) { audio.pause(); b.closest(".reel").classList.remove("playing"); } else play(k);
    }));
    // גלילה לרגע הבא מפעילה אותו לבד (אחרי הלחיצה הראשונה)
    let unlocked = false;
    view.addEventListener("click", () => (unlocked = true), { once: true });
    const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting && unlocked) play(+e.target.dataset.k); }), { threshold: 0.7 });
    view.querySelectorAll(".reel").forEach((el) => io.observe(el));
    const stop = () => { audio.pause(); io.disconnect(); urls.forEach((u) => u && URL.revokeObjectURL(u)); window.removeEventListener("hashchange", stop); };
    window.addEventListener("hashchange", stop);
  }

  return { upcoming, chip, daysTo, inDays, deadlinesScreen, examFocus, reels, pastExams, pastExamsBlock, bindPastExams, addToCalendar };
}
