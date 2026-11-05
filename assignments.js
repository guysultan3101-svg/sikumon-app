// הגשת עבודות: כל המטלות מהמודל לפי קורסים, עם מספר על הלשונית (כמו הודעות שלא נקראו בוואטסאפ).
// לכל מטלה: כמה זמן נשאר, הקובץ שהסטודנט/ית הכין/ה (נשמר במכשיר), וסימון "הוגש".
// ההעלאה עצמה למודל (כטיוטה – הסטודנט/ית רק לוחץ/ת "שליחה" במודל) – דרך המחבר במחשב, בשלב הבא.

export function initAssignments(ctx) {
  const { view, $, esc, toast, store, api } = ctx;
  const DAY = 864e5;
  const MAX_FILE = 25 * 1024 * 1024;
  const moodleId = (url) => (String(url || "").match(/[?&]id=(\d+)/) || [])[1] || url || "";
  const workId = (key) => "aw-" + String(key).replace(/[^\w-]+/g, "_").slice(-80);
  const daysTo = (iso) => Math.ceil((new Date(iso) - Date.now()) / DAY);
  const left = (iso) => {
    const ms = new Date(iso) - Date.now();
    if (ms < 0) return "המועד עבר";
    const h = Math.floor(ms / 3600e3);
    return h < 24 ? `נשארו ${h} שעות` : `נשארו ${Math.ceil(ms / DAY)} ימים`;
  };
  const urgency = (iso) => { const d = daysTo(iso); return d <= 2 ? "hot" : d <= 7 ? "warm" : ""; };
  const fmtWhen = (iso) => new Date(iso).toLocaleString("he-IL", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const STATUS = { todo: "⚪ עוד לא התחלתי", working: "🟡 בעבודה", ready: "🔵 הקובץ מוכן", submitted: "✅ הוגש" };

  // כל המטלות: מועדי הגשה מהמודל + מטלות שמופיעות בדף הקורס (גם בלי מועד)
  async function all() {
    const dl = (await store.getItem("deadlines"))?.events || [];
    const feed = await store.getItem("moodle-feed");
    const byKey = new Map();
    for (const e of dl) {
      if (!(e.type === "assign" || /mod\/assign\//.test(e.url || "") || /הגשה|מטלה|עבודה|תרגיל|ש"ב|שיעורי בית/.test(e.name))) continue;
      const key = moodleId(e.url) || "dl-" + e.id;
      byKey.set(key, { key, name: e.name, course: e.course, due: e.due, url: e.url, moodleDone: !!e.done });
    }
    for (const c of feed?.courses || []) for (const s of c.sections) for (const it of s.items) {
      if (it.type !== "assign") continue;
      const key = moodleId(it.url);
      if (byKey.has(key)) { byKey.get(key).section = s.title; continue; }
      byKey.set(key, { key, name: it.name, course: c.course, due: null, url: it.url, section: s.title });
    }
    // מטלות שהמחבר במחשב מצא (בודקים בלי המחשב של גיא), ומצב ההגשות מהאפליקציה למודל
    let jobs = [];
    if (api?.user?.()) {
      try {
        for (const m of await api.assignItems()) {
          const key = moodleId(m.url);
          const prev = byKey.get(key);
          if (prev) { prev.due = prev.due || m.note; prev.moodleDone = prev.moodleDone || m.status === "done"; prev.intro = prev.intro || m.intro; if ((m.files || []).length && !(prev.attach || []).length) prev.attach = m.files; continue; }
          byKey.set(key, { key, name: m.name, course: m.course, due: m.note || null, url: m.url, moodleDone: m.status === "done", intro: m.intro || null, attach: m.files || [] });
        }
        jobs = await api.submissionJobs();
      } catch { /* בלי אינטרנט – מה שבמכשיר */ }
    }
    const work = new Map((await store.listItems()).filter((x) => x.type === "assign-work").map((w) => [w.key, w]));
    return [...byKey.values()].map((a) => {
      const w = work.get(a.key);
      const job = jobs.find((j) => String(j.cmid) === String(a.key) && j.status !== "cancelled") || null;
      const status = a.moodleDone || job?.status === "submitted" ? "submitted" : w?.status || (w?.files?.length ? "ready" : "todo");
      return { ...a, work: w, job, status };
    }).sort((a, b) => (a.status === "submitted") - (b.status === "submitted") || String(a.due || "9999").localeCompare(String(b.due || "9999")));
  }
  // מה עוד פתוח: לא הוגש, והמועד עוד לא עבר (או שאין מועד)
  const isOpen = (a) => a.status !== "submitted" && (!a.due || new Date(a.due) > Date.now());
  async function openCount() { return (await all()).filter(isOpen).length; }

  async function saveWork(key, patch) {
    const id = workId(key);
    const w = (await store.getItem(id)) || { id, type: "assign-work", key, files: [], status: "todo" };
    Object.assign(w, patch, { updated: new Date().toISOString() });
    await store.putItem(w);
    return w;
  }

  // מה קורה עם ההגשה למודל
  function jobLine(a) {
    const j = a.job; if (!j) return "";
    const L = {
      queued: `⏳ מחכה למחשב: המחבר בכרום יעלה את <b>${esc(j.file_name)}</b> למודל (תוך כמה דקות כשהמחשב דלוק) <button type="button" class="link" data-cancel="${esc(j.id)}">ביטול</button>`,
      uploading: `⬆️ מעלה למודל עכשיו…`,
      draft: `✅ <b>${esc(j.file_name)}</b> נמצא במודל כטיוטה. נשאר רק להיכנס למודל וללחוץ "הגשת המטלה"${a.url ? ` – <a href="${esc(a.url)}" target="_blank" rel="noopener">לפתיחה</a>` : ""}`,
      submitted: `✅ הוגש במודל: <b>${esc(j.file_name)}</b>`,
      failed: `❌ לא הצליח: ${esc(j.result || "תקלה")}. אפשר לנסות שוב`,
    }[j.status];
    return L ? `<p class="notice small ${j.status === "failed" ? "alert" : ""}">${L}${j.result && j.status !== "failed" ? `<br><span class="muted">במודל: ${esc(j.result)}</span>` : ""}</p>` : "";
  }

  // כפתורי העבודה (מצב, הקובץ שלי, העלאה למודל) – משותפים לכרטיס ולמסך המטלה
  function workControls(a) {
    const files = a.work?.files || [];
    return `<div class="as-status">${Object.entries(STATUS).map(([k, l]) => `<button type="button" class="as-st ${a.status === k ? "on" : ""}" data-st="${k}" aria-pressed="${a.status === k}">${l}</button>`).join("")}</div>
      ${jobLine(a)}
      <div class="as-files">${files.map((f, i) => `<span class="pb-chip">📎 ${esc(f.name)} <span class="small muted">${fmtSize(f.size)}</span> <button type="button" class="link" data-open="${i}">פתיחה</button> <button type="button" class="link" data-rm="${i}" aria-label="הסרה">✕</button></span>`).join("")}</div>
      <div class="row">
        <label class="btn small-btn">📎 ${files.length ? "עוד קובץ" : "הקובץ שלי"}<input type="file" data-up hidden accept=".pdf,.docx,.doc,.pptx,.xlsx,.txt,.zip,.jpg,.jpeg,.png"></label>
        <button type="button" class="btn ghost small-btn" data-moodle ${files.length && /^\d+$/.test(a.key) && !["queued", "uploading"].includes(a.job?.status) ? "" : "disabled"}>🚀 להעלות למודל</button>
      </div>`;
  }

  function card(a) {
    return `<article class="as-card ${a.status}" data-key="${esc(a.key)}">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <span style="min-width:0;flex:1"><a class="as-name" href="#assign-${esc(a.key)}">${esc(a.name)}</a><br><span class="small muted">${a.section ? esc(a.section) + " · " : ""}${a.due ? `עד <bdi>${fmtWhen(a.due)}</bdi>` : "בלי מועד במודל"}</span></span>
        ${a.due && a.status !== "submitted" ? `<span class="cd ${urgency(a.due)}">${left(a.due)}</span>` : ""}
      </div>
      ${workControls(a)}
      <div class="row"><a class="btn ghost small-btn" href="#assign-${esc(a.key)}">📖 ההוראות והפרטים ←</a>${a.url ? `<a class="small muted" href="${esc(a.url)}" target="_blank" rel="noopener" style="align-self:center">פתיחה במודל ↗</a>` : ""}</div>
    </article>`;
  }

  // מסך מטלה בתוך Clearly: ההוראות של המרצה, הקבצים המצורפים, והגשה – בלי לקפוץ למודל
  async function detail(key) {
    const a = (await all()).find((x) => x.key === key);
    if (!a) { view.innerHTML = `<div class="page"><p class="muted">המטלה לא נמצאה. אולי כבר אינה פתוחה.</p><a href="#assignments">לכל המטלות</a></div>`; return; }
    const attach = a.attach || [];
    view.innerHTML = `<div class="page" style="max-width:760px">
      <h1 style="font-size:28px;margin-top:8px">${esc(a.name)}</h1>
      <p class="muted">${esc(a.course)}${a.section ? " · " + esc(a.section) : ""}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin:4px 0 6px">
        ${a.due ? `<span class="chip">⏰ עד <bdi>${fmtWhen(a.due)}</bdi></span>${a.status !== "submitted" ? `<span class="cd ${urgency(a.due)}">${left(a.due)}</span>` : ""}` : '<span class="chip">בלי מועד במודל</span>'}
        ${a.status === "submitted" ? '<span class="chip ok">✅ הוגש</span>' : ""}
      </div>
      <section class="card" style="display:grid;gap:10px">
        <h2 style="font-size:19px;margin:0">📖 מה צריך לעשות</h2>
        ${a.intro ? `<div class="as-intro" style="white-space:pre-wrap">${esc(a.intro)}</div>`
          : `<p class="muted">ההוראות ייקראו מהמודל אוטומטית בבדיקה הבאה של המחבר בכרום (צריך שהמחשב יהיה דלוק פעם אחת). בינתיים אפשר <a href="${esc(a.url || "#")}" target="_blank" rel="noopener">לפתוח במודל</a>.</p>`}
        ${attach.length ? `<div class="as-files">${attach.map((f, i) => `<button type="button" class="pb-chip" data-afile="${i}">📎 ${esc(f.name)}</button>`).join("")}</div>` : ""}
      </section>
      <section class="card" style="display:grid;gap:10px;margin-top:14px">
        <h2 style="font-size:19px;margin:0">📤 ההגשה שלי</h2>
        <div class="as-card ${a.status}" data-key="${esc(a.key)}" style="border:0;padding:0">${workControls(a)}</div>
        <p class="small muted">העוזר יכול להסביר ולבדוק, אבל לא כותב עבודה להגשה במקומכם. ההעלאה למודל נעשית דרך המחבר בכרום, ואתם לוחצים שם "הגשת המטלה".</p>
      </section>
    </div>`;
    bind([a]);
    view.querySelectorAll("[data-afile]").forEach((b) => (b.onclick = async () => {
      const f = attach[+b.dataset.afile];
      b.disabled = true;
      try { window.open(await api.assignmentFileUrl(f.path), "_blank", "noopener"); }
      catch { toast("הקובץ עוד לא מוכן. נסו שוב אחרי בדיקה של המחבר במחשב"); }
      finally { b.disabled = false; }
    }));
  }

  async function page() {
    const list = await all();
    const open = list.filter(isOpen), rest = list.filter((a) => !isOpen(a));
    const byCourse = new Map();
    for (const a of open) { if (!byCourse.has(a.course)) byCourse.set(a.course, []); byCourse.get(a.course).push(a); }
    view.innerHTML = `<div class="page" style="max-width:860px">
      <h1 style="font-size:30px">📝 הגשת עבודות ${open.length ? `<span class="chip new">${open.length} פתוחות</span>` : ""}</h1>
      <section class="soft as-how"><b>איך זה עובד</b>
        <ol class="small"><li>כל המטלות מהמודל מופיעות כאן לפי קורסים, עם כמה זמן נשאר.</li>
        <li>מצרפים את הקובץ שהכנתם (העבודה נשמרת במכשיר שלכם).</li>
        <li>"להעלות למודל" – המחבר לכרום במחשב שם את הקובץ במטלה (בדרך כלל כטיוטה), ואתם רק לוחצים שם "הגשת המטלה".</li></ol>
        <p class="small muted">העוזר החכם יכול להסביר את המטלה, לבדוק ולתת הערות – אבל לא כותב עבודה להגשה במקומכם. זה הכלל באוניברסיטה.</p></section>
      ${[...byCourse].map(([c, l]) => `<section><h2 style="font-size:20px">${esc(c)} <span class="chip">${l.length}</span></h2><div class="as-list">${l.map(card).join("")}</div></section>`).join("")}
      ${open.length ? "" : `<section class="soft"><h2 style="font-size:20px;margin:0">🎉 אין עבודות פתוחות</h2><p class="small muted">${list.length ? "כל מה שהיה פתוח הוגש או שהמועד עבר." : "כשמרצה יפתח מטלה במודל, היא תופיע כאן לבד (דרך החיבור למודל)."}</p></section>`}
      ${rest.length ? `<details class="soft"><summary><b>הוגשו / עבר המועד (${rest.length})</b></summary><div class="as-list" style="margin-top:10px">${rest.map(card).join("")}</div></details>` : ""}
    </div>`;
    bind(list);
  }

  function bind(list) {
    const find = (el) => list.find((a) => a.key === el.closest("[data-key]").dataset.key);
    view.querySelectorAll("[data-st]").forEach((b) => (b.onclick = async () => { await saveWork(find(b).key, { status: b.dataset.st }); toast(b.dataset.st === "submitted" ? "✅ סומן כהוגש" : "נשמר"); page(); ctx.onChange?.(); }));
    view.querySelectorAll("[data-up]").forEach((inp) => (inp.onchange = async () => {
      const a = find(inp), f = inp.files?.[0]; inp.value = "";
      if (!f) return;
      if (f.size > MAX_FILE) return toast("הקובץ גדול מדי (עד 25MB)");
      const files = [...(a.work?.files || []), { name: f.name, type: f.type, size: f.size, blob: f, at: new Date().toISOString() }].slice(-5);
      await saveWork(a.key, { files, status: a.status === "submitted" ? "submitted" : "ready" });
      toast("הקובץ נשמר ✓"); page(); ctx.onChange?.();
    }));
    view.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => {
      const a = find(b), files = [...(a.work?.files || [])]; files.splice(+b.dataset.rm, 1);
      await saveWork(a.key, { files, status: files.length ? a.status : "working" }); page(); ctx.onChange?.();
    }));
    view.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => {
      const f = find(b).work.files[+b.dataset.open];
      window.open(URL.createObjectURL(f.blob), "_blank", "noopener");
    }));
    view.querySelectorAll("[data-moodle]").forEach((b) => (b.onclick = async () => {
      const a = find(b), f = a.work?.files?.slice(-1)[0];
      if (!f) return toast("קודם מצרפים את הקובץ");
      const okGo = confirm(`להעלות את "${f.name}" למטלה "${a.name}" במודל?\n\nבדרך כלל הקובץ נשמר במודל כטיוטה, ואתם לוחצים שם "הגשת המטלה".\nשימו לב: במטלות מסוימות השמירה היא כבר ההגשה הסופית – העלו רק את הגרסה הסופית.\n\nההעלאה נעשית דרך המחבר לכרום במחשב שלכם (צריך שהמחשב יהיה דלוק).`);
      if (!okGo) return;
      b.disabled = true; b.textContent = "מעלה…";
      try { await api.submitAssignment({ cmid: a.key, name: a.name, course: a.course, file: new File([f.blob], f.name, { type: f.type }) }); toast("✓ נשלח. המחבר במחשב יעלה למודל תוך כמה דקות"); page(); }
      catch (e) { toast(e.message); b.disabled = false; b.textContent = "🚀 להעלות למודל"; }
    }));
    view.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = async () => { try { await api.cancelSubmission(b.dataset.cancel); toast("בוטל"); page(); } catch (e) { toast(e.message); } }));
    // בזמן שמחכים למחשב – מתעדכנים לבד
    clearTimeout(bind._t);
    if (list.some((a) => ["queued", "uploading"].includes(a.job?.status))) bind._t = setTimeout(() => { if (location.hash === "#assignments") page(); }, 20000);
  }

  return { page, detail, openCount, all };
}
