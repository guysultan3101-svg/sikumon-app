// יומן הסמסטר (שיעורים בירוק בהיר, הגשות בכתום, מבחנים באדום),
// ותיבת הודעות באפליקציה במקום מיילים: תזכורות למבחנים ולהגשות, סיכומים חדשים, חדש במודל, וסיכום שבועי.

export function initPlanner(ctx) {
  const { view, $, esc, toast, prefs, store, extras } = ctx;
  const DAY = 864e5;
  const key = (d) => d.toLocaleDateString("en-CA");
  const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const semester = () => ({ start: "2026-10-18", end: "2027-01-29", ...(prefs.get().semester || {}) });

  // כל האירועים ביום מסוים: שיעורים לפי מערכת השעות (בתוך הסמסטר), הגשות מהמודל, ומבחנים
  async function eventsBetween(from, to) {
    const p = prefs.get(); const sem = semester();
    const dl = (await store.getItem("deadlines"))?.events || [];
    const out = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY)) {
      const k = key(d);
      if (k >= sem.start && k <= sem.end) {
        for (const s of (p.timetable || []).filter((x) => +x.day === d.getDay())) out.push({ date: k, kind: "lesson", time: s.start, end: s.end, title: s.course, course: s.course });
      }
    }
    for (const x of dl) { const k = x.due.slice(0, 10); if (k >= key(from) && k <= key(to)) out.push({ date: k, kind: "deadline", time: x.due.slice(11, 16), title: x.name, course: x.course, url: x.url, done: x.done }); }
    for (const e of p.exams || []) if (e.date >= key(from) && e.date <= key(to)) out.push({ date: e.date, kind: "exam", time: e.time || "09:00", title: `מבחן ${e.course}${e.moed ? " – מועד " + e.moed : ""}`, course: e.course });
    // בכל יום: קודם מבחנים, אחר כך הגשות, ובסוף שיעורים (ובתוך כל סוג – לפי השעה)
    const rank = { exam: 0, deadline: 1, lesson: 2 };
    return out.sort((a, b) => a.date.localeCompare(b.date) || rank[a.kind] - rank[b.kind] || a.time.localeCompare(b.time));
  }

  // ---------- יומן חודשי ----------
  async function calendar(ym = null) {
    const now = new Date();
    const [y, m] = ym ? ym.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
    const first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
    const gridStart = new Date(first.getTime() - first.getDay() * DAY);
    const gridEnd = new Date(last.getTime() + (6 - last.getDay()) * DAY);
    const evs = await eventsBetween(gridStart, gridEnd);
    const byDay = evs.reduce((a, e) => ((a[e.date] = a[e.date] || []).push(e), a), {});
    const mk = (yy, mm) => `${yy}-${String(mm).padStart(2, "0")}`;
    const prev = m === 1 ? mk(y - 1, 12) : mk(y, m - 1), next = m === 12 ? mk(y + 1, 1) : mk(y, m + 1);
    const cells = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = new Date(d.getTime() + DAY)) cells.push(d);
    const today = key(now);
    const sem = semester();
    view.innerHTML = `<div class="page cal-page">
      <div class="row" style="justify-content:space-between">
        <h1 style="font-size:30px">📅 ${first.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}</h1>
        <div class="row" style="gap:6px"><a class="btn ghost small-btn" href="#calendar-${prev}" aria-label="חודש קודם">→</a><a class="btn ghost small-btn" href="#calendar">היום</a><a class="btn ghost small-btn" href="#calendar-${next}" aria-label="חודש הבא">←</a></div>
      </div>
      <div class="legend"><span><i class="ev lesson"></i>שיעורים</span><span><i class="ev deadline"></i>הגשות</span><span><i class="ev exam"></i>מבחנים</span></div>
      <div class="cal" role="grid">
        ${DAYS.map((d) => `<div class="cal-h">${d}</div>`).join("")}
        ${cells.map((d) => {
          const k = key(d), list = byDay[k] || [];
          return `<button class="cal-d ${d.getMonth() !== m - 1 ? "out" : ""} ${k === today ? "today" : ""}" data-k="${k}" aria-label="${d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}${list.length ? ", " + list.length + " אירועים" : ""}">
            <span class="n">${d.getDate()}</span>
            <span class="evs">${list.slice(0, 4).map((e) => `<span class="ev ${e.kind} ${e.done ? "done" : ""}"><b>${esc(e.kind === "lesson" ? e.course : e.kind === "exam" ? "📝 " + e.course : "📌 " + e.course)}</b></span>`).join("")}${list.length > 4 ? `<span class="more">+${list.length - 4}</span>` : ""}</span>
            <span class="dots">${list.map((e) => `<i class="ev ${e.kind}"></i>`).join("")}</span></button>`;
        }).join("")}
      </div>
      <section class="soft" id="dayBox"></section>
      <details class="soft small"><summary><b>תאריכי הסמסטר</b> <span class="muted">(<bdi>${sem.start}</bdi> עד <bdi>${sem.end}</bdi>)</span></summary>
        <div class="row" style="margin-top:8px"><label class="field" style="flex:1">התחלה<input type="date" id="semS" value="${sem.start}"></label><label class="field" style="flex:1">סוף<input type="date" id="semE" value="${sem.end}"></label><button class="btn ghost" id="semSave">שמירה</button></div>
        <p class="muted" style="margin-top:6px">השיעורים ביומן נלקחים מ<a href="#timetable">מערכת השעות</a>, ההגשות מהמודל, והמבחנים מ<a href="#deadlines">לוח המבחנים</a>.</p></details>
    </div>`;
    const showDay = async (k) => {
      view.querySelectorAll(".cal-d").forEach((b) => b.classList.toggle("sel", b.dataset.k === k));
      const list = byDay[k] || [];
      $("#dayBox").innerHTML = `<h3>${new Date(k + "T12:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</h3>
        <div class="list" style="margin-top:8px">${list.map((e) => `<a class="item day-ev" data-kind="${e.kind}" data-course="${esc(e.course)}" data-date="${e.date}" ${e.url ? `href="${esc(e.url)}" target="_blank" rel="noopener"` : `href="#"`}><span style="min-width:0"><span class="t"><i class="ev ${e.kind}"></i> ${esc(e.title)}</span><br><span class="small muted"><bdi>${e.time}${e.end ? "–" + e.end : ""}</bdi>${e.kind === "lesson" ? " · פתיחת המחברת של השיעור" : e.kind === "deadline" ? " · פתיחה במודל" : ""}</span></span>${extras.chip ? (e.kind !== "lesson" ? extras.chip({ kind: e.kind, when: e.date + "T" + e.time }) : "") : ""}</a>`).join("") || '<p class="muted">אין כלום ביום הזה.</p>'}</div>`;
      $("#dayBox").querySelectorAll('.day-ev[data-kind="lesson"]').forEach((a) => (a.onclick = async (ev) => {
        ev.preventDefault();
        const l = await ctx.lessonForToday(a.dataset.course, a.dataset.date);
        location.hash = "lesson-" + l.id;
      }));
      $("#dayBox").querySelectorAll('.day-ev[data-kind="exam"]').forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); location.hash = "deadlines"; }));
    };
    view.querySelectorAll(".cal-d").forEach((b) => (b.onclick = () => showDay(b.dataset.k)));
    showDay(cells.some((d) => key(d) === today) ? today : key(first));
    $("#semSave").onclick = () => {
      const p = prefs.get(); p.semester = { start: $("#semS").value, end: $("#semE").value }; prefs.set(p);
      toast("תאריכי הסמסטר נשמרו"); calendar(ym);
    };
  }

  // ---------- תיבת הודעות ----------
  async function inboxStore() { return (await store.getItem("inbox")) || { id: "inbox", type: "inbox", items: [], seenSummaries: null, seenMoodle: null }; }
  // מחשב הודעות חדשות ומוסיף לתיבה (כל הודעה פעם אחת)
  async function refresh() {
    if (!prefs.get()) return []; // עוד לפני שאלון הפתיחה
    const box = await inboxStore();
    const have = new Set(box.items.map((x) => x.id));
    const add = (m) => { if (!have.has(m.id)) { box.items.unshift({ ...m, at: new Date().toISOString(), read: false }); have.add(m.id); fresh.push(m); } };
    const fresh = [];
    // מבחנים: 14, 7, 3, יום ובאותו יום
    for (const e of prefs.get().exams || []) {
      const d = Math.ceil((new Date(`${e.date}T${e.time || "09:00"}`) - Date.now()) / DAY);
      const bucket = [0, 1, 3, 7, 14].find((t) => d <= t);
      if (d >= 0 && bucket !== undefined) add({ id: `ex-${e.course}-${e.date}-${bucket}`, icon: "📝", title: `מבחן ב${e.course} ${d === 0 ? "היום" : d === 1 ? "מחר" : `בעוד ${d} ימים`}`, body: d <= 3 ? "זה הזמן לעבור על \"מה יהיה במבחן\" ולעשות מבחן חזרה." : "כדאי להתחיל חזרה: כרטיסיות ומבחנים קודמים מחכים.", link: "#deadlines" });
    }
    // הגשות: יומיים, יום, ובאותו יום
    for (const x of (await store.getItem("deadlines"))?.events || []) {
      const d = Math.ceil((new Date(x.due) - Date.now()) / DAY);
      if (!x.done && d >= 0 && d <= 2) add({ id: `dl-${x.id}-${d}`, icon: "📌", title: `${x.name} – ${d === 0 ? "היום" : d === 1 ? "מחר" : "בעוד יומיים"}`, body: `${x.course} · עד <bdi>${x.due.slice(11, 16)}</bdi>`, link: x.url, ext: true });
    }
    // סיכומים חדשים (בפעם הראשונה – רק זוכרים מה כבר קיים)
    const sums = (await store.listItems()).filter((x) => x.type === "summary");
    if (box.seenSummaries === null) box.seenSummaries = sums.map((s) => s.id);
    for (const s of sums.filter((s) => !box.seenSummaries.includes(s.id))) { add({ id: "sum-" + s.id, icon: s.kind === "formulas" ? "📐" : "📄", title: `${s.kind === "formulas" ? "דף נוסחאות עודכן" : "סיכום חדש"}: ${s.course}`, body: s.title, link: "#sum-" + s.id }); box.seenSummaries.push(s.id); }
    // חדש במודל
    const news = (await ctx.study.moodleNew()) || [];
    if (box.seenMoodle === null) box.seenMoodle = news.map((n) => n.url);
    for (const n of news.filter((n) => !box.seenMoodle.includes(n.url))) { add({ id: "md-" + n.url, icon: "🆕", title: `חדש במודל: ${n.course}`, body: n.name, link: n.url, ext: true }); box.seenMoodle.push(n.url); }
    // סיכום שבועי: ממוצאי שבת
    const now = new Date();
    if ((now.getDay() === 6 && now.getHours() >= 19) || now.getDay() === 0) {
      const sat = new Date(now.getTime() - ((now.getDay() + 1) % 7) * DAY);
      add({ id: "week-" + key(sat), icon: "📚", title: "השבוע שלך בלימודים", body: "מה למדת, מה מחכה לך, ובמה שווה לחזור", link: "#weekly" });
    }
    box.items = box.items.slice(0, 80);
    await store.putItem(box);
    if (fresh.length) {
      try { if (document.visibilityState === "hidden" && Notification?.permission === "granted") (await navigator.serviceWorker?.getRegistration())?.showNotification(fresh[0].title, { body: fresh[0].body.replace(/<[^>]+>/g, ""), tag: fresh[0].id }); } catch { /* */ }
    }
    paintBadge(box);
    return fresh;
  }
  function paintBadge(box) {
    const n = box.items.filter((x) => !x.read).length;
    document.querySelectorAll(".bell-n").forEach((el) => { el.textContent = n || ""; el.hidden = !n; });
  }
  async function inbox() {
    const box = await inboxStore();
    view.innerHTML = `<div class="page">
      <div class="row" style="justify-content:space-between"><h1 style="font-size:30px">🔔 הודעות</h1>${box.items.some((x) => !x.read) ? '<button class="btn ghost small-btn" id="readAll">סימון הכול כנקרא</button>' : ""}</div>
      <div class="list">${box.items.map((x) => `<a class="item msg ${x.read ? "" : "unread"}" data-id="${esc(x.id)}" href="${esc(x.link || "#inbox")}" ${x.ext ? 'target="_blank" rel="noopener"' : ""}><span class="micon">${x.icon}</span><span style="min-width:0;flex:1"><span class="t">${esc(x.title)}</span><br><span class="small muted">${x.body}</span></span><span class="small muted"><bdi>${new Date(x.at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</bdi></span></a>`).join("") || '<p class="muted">אין הודעות כרגע. כאן יופיעו תזכורות למבחנים ולהגשות, סיכומים חדשים, חדש במודל, וסיכום שבועי במוצאי שבת.</p>'}</div>
    </div>`;
    const mark = async (ids) => { const b = await inboxStore(); b.items.forEach((x) => ids.includes(x.id) && (x.read = true)); await store.putItem(b); paintBadge(b); };
    view.querySelectorAll(".msg").forEach((a) => a.addEventListener("click", () => mark([a.dataset.id])));
    $("#readAll") && ($("#readAll").onclick = async () => { await mark(box.items.map((x) => x.id)); inbox(); });
  }

  // ---------- סיכום שבועי (באפליקציה) ----------
  async function weekly() {
    const since = Date.now() - 7 * DAY;
    const sums = (await store.listItems()).filter((x) => x.type === "summary" && x.kind !== "formulas" && new Date(x.date) >= since);
    const lessons = (await store.listLessons()).filter((l) => new Date(l.date) >= since);
    const next = (await extras.upcoming()).filter((x) => extras.daysTo(x.when) <= 14);
    const at = await store.listAttempts();
    const last = Object.values(at.reduce((m, x) => ((m[x.quizId] = x), m), {}));
    const weak = last.filter((x) => x.score / x.total < 0.7).slice(0, 3);
    const byCourse = sums.reduce((m, s) => ((m[s.course] = m[s.course] || []).push(s), m), {});
    view.innerHTML = `<div class="page">
      <a href="#inbox" class="small">→ הודעות</a>
      <h1 style="font-size:30px">📚 השבוע שלך בלימודים</h1>
      <section class="card"><h2 style="font-size:20px">מה למדת השבוע</h2>
        ${Object.keys(byCourse).length ? `<div class="list" style="margin-top:8px">${Object.entries(byCourse).map(([c, l]) => `<div class="item"><span style="min-width:0"><span class="t">${esc(c)}</span><br><span class="small muted">${l.map((s) => `<a href="#sum-${esc(s.id)}">${esc(s.title)}</a>`).join(" · ")}</span></span></div>`).join("")}</div>` : '<p class="muted">לא נכנסו סיכומים חדשים השבוע.</p>'}
        <p class="small muted" style="margin-top:8px">כתבת ב-${lessons.filter((l) => (l.pages || []).some((p) => p.strokes.length) || l.text?.trim()).length} שיעורים והקלטת ${lessons.filter((l) => (l.recIds || []).length).length}. ${prefs.get().streak > 1 ? `🔥 ${prefs.get().streak} ימים ברצף.` : ""}</p></section>
      <section class="soft"><h2 style="font-size:20px">מה מחכה לך (שבועיים קדימה)</h2>
        <div class="list" style="margin-top:8px">${next.map((x) => `<a class="item" href="#deadlines"><span style="min-width:0"><span class="t">${x.kind === "exam" ? "📝" : "📌"} ${esc(x.title)}</span><br><span class="small muted">${esc(x.course)}</span></span>${extras.chip(x)}</a>`).join("") || '<p class="muted">אין מבחנים או הגשות בשבועיים הקרובים.</p>'}</div></section>
      <section class="soft"><h2 style="font-size:20px">שווה לחזור על</h2>
        <div class="list" style="margin-top:8px">${weak.map((w) => `<a class="item" href="#quiz-${esc(w.quizId)}"><span class="t">${esc(w.title)}</span><b class="score"><bdi>${w.score}/${w.total}</bdi></b></a>`).join("") || '<a class="item" href="#cards"><span class="t">🃏 כרטיסיות של השבוע</span></a>'}</div></section>
      <p class="muted">שבוע טוב, ובהצלחה! 💪</p>
    </div>`;
  }

  return { calendar, inbox, weekly, refresh, paintBadge, inboxStore, eventsBetween };
}
