// 👥 השכבה החברתית – אמיתית, מול השרת (api.js): הרשמה וכניסה, חברים באישור הדדי, "אותה כיתה"
// (שיתוף סיכומים בין חברים באישור של שניהם), הודעות (ראשי + בקשות), פספסתי שיעור, פיד, פרופיל.
// בנוסף: מסנכרן לאפליקציה את הסיכומים מהשרת (שלי + של חברים מאותה כיתה) ואת ההתראות.
import { mdToHtml } from "./md.js";

export function initSocial(ctx) {
  const { view, $, esc, toast, prefs, store, api } = ctx;
  const VIS = { friends: "👥 חברים", course: "🎓 כל מי שלומד את הקורס", public: "🌍 כולם" };
  const UNIS = ["אוניברסיטת אריאל", "אוניברסיטת בן־גוריון", "אוניברסיטת בר־אילן", "אחר"];
  const COLORS = ["#DB2777", "#2563EB", "#16A34A", "#6D28D9", "#EA580C", "#0891B2", "#CA8A04", "#475569"];
  const color = (id = "") => COLORS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
  const people = new Map(); // מטמון פרופילים לפי id
  const meId = () => api.user()?.id;
  const nameOf = (id) => people.get(id)?.full_name || "משתמש/ת";
  const unameOf = (id) => people.get(id)?.username || "";
  const avatar = (id, big = false) => `<span class="av${big ? " big" : ""}" style="background:${color(id)}" aria-hidden="true">${esc((people.get(id)?.full_name || "?")[0])}</span>`;
  const when = (t) => new Date(t).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const myCourses = () => prefs.get()?.courses || api.profile()?.courses || [];
  const safeLink = (url, host) => { try { const u = new URL(url); return u.protocol === "https:" && (u.hostname === host || u.hostname.endsWith("." + host)) ? u.href : ""; } catch { return ""; } };
  const subnav = (cur) => `<nav class="snav" aria-label="חברים">${[["social", "📰 פיד"], ["social-friends", "👥 חברים"], ["messages", "💬 הודעות"]].map(([h, l]) => `<a href="#${h}" ${cur === h ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  const busy = (msg = "טוען…") => { view.innerHTML = `<div class="page"><p class="muted">${msg}</p></div>`; };
  const fail = (e) => { view.innerHTML = `<div class="page"><p class="notice alert">${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">לנסות שוב</button></div>`; };
  async function remember(ids) { const need = [...new Set(ids)].filter((x) => x && !people.has(x)); if (need.length) (await api.profiles(need)).forEach((p) => people.set(p.id, p)); }

  // ---------- מצב החברים ----------
  async function graph() {
    const [fr, sh] = await Promise.all([api.friendships(), api.shares()]);
    const me = meId();
    await remember([...fr.flatMap((f) => [f.requester, f.addressee]), ...sh.flatMap((s) => [s.owner, s.friend])]);
    const other = (f) => (f.requester === me ? f.addressee : f.requester);
    return {
      fr, sh, other,
      friends: fr.filter((f) => f.status === "accepted"),
      incoming: fr.filter((f) => f.status === "pending" && f.addressee === me),
      outgoing: fr.filter((f) => f.status === "pending" && f.requester === me),
      iShare: (id) => sh.filter((s) => s.owner === me && s.friend === id).map((s) => s.course),
      theyShare: (id) => sh.filter((s) => s.owner === id && s.friend === me).map((s) => s.course),
    };
  }

  // ---------- הרשמה / כניסה ----------
  function signup(mode = "signup") {
    const isUp = mode === "signup";
    view.innerHTML = `<div class="page" style="max-width:560px">
      <p class="eyebrow">ברוכים הבאים לסיכומון</p>
      <h1 style="font-size:30px">${isUp ? "יצירת חשבון" : "כניסה לחשבון"}</h1>
      ${isUp ? '<p class="muted">פותחים פרופיל, וממלאים שאלון קצר על איך שאת/ה לומד/ת. ככה הסיכומים מותאמים בדיוק אלייך, וחברים מהקורס יכולים למצוא אותך.</p>' : ""}
      <form id="sgForm" class="card" style="display:grid;gap:12px" novalidate>
        ${isUp ? `<label>שם משתמש (ייחודי – ככה חברים ימצאו אותך)<input id="sgUser" required autocomplete="username" dir="ltr" placeholder="guy_s" autocapitalize="none"></label>
        <span class="small muted" id="sgUserHint">אותיות באנגלית, מספרים, _ ונקודה</span>
        <label>שם מלא<input id="sgName" required autocomplete="name"></label>
        <label>מוסד לימודים<select id="sgUni">${UNIS.map((u) => `<option>${u}</option>`).join("")}</select></label>
        <label>תואר ושנה<input id="sgDeg" placeholder="למשל: כלכלה ומנהל, שנה א"></label>` : ""}
        <label>מייל ${isUp ? "של האוניברסיטה" : ""}<input id="sgMail" type="email" required dir="ltr" autocomplete="email" placeholder="name@msmail.ariel.ac.il"></label>
        <label>סיסמה<input id="sgPass" type="password" required ${isUp ? 'minlength="12"' : ""} autocomplete="${isUp ? "new-password" : "current-password"}"></label>
        ${isUp ? `<label>יום הולדת (לא חובה – חברים יקבלו תזכורת)<input id="sgBday" type="date"></label>
        <label class="row" style="gap:8px;align-items:flex-start"><input type="checkbox" id="sgTerms" style="width:auto;margin-top:6px"><span class="small">זו <b>גרסת בדיקה</b>. אני מסכים/ה ל<a href="#legal-terms" target="_blank">תנאי השימוש</a> ול<a href="#legal-privacy" target="_blank">מדיניות הפרטיות</a>: הפרופיל, החברים, ההודעות והסיכומים נשמרים בשרת מאובטח באירופה. משתפים רק סיכומים שלי, לא קבצים של מרצים.</span></label>` : ""}
        <button class="btn" type="submit" id="sgGo">${isUp ? "יצירת חשבון" : "כניסה"}</button>
        ${isUp ? "" : '<button class="btn ghost" type="button" id="sgReset">שכחתי סיסמה</button>'}
      </form>
      <p style="text-align:center"><a href="#" id="sgSwitch">${isUp ? "כבר יש לי חשבון – כניסה" : "אין לי חשבון – הרשמה"}</a></p></div>`;
    $("#sgSwitch").onclick = (e) => { e.preventDefault(); signup(isUp ? "login" : "signup"); };
    if (isUp) {
      let t;
      $("#sgUser").oninput = () => {
        const v = $("#sgUser").value.trim().toLowerCase(); clearTimeout(t);
        if (!/^[a-z0-9_.]{3,20}$/.test(v)) { $("#sgUserHint").textContent = v ? "3–20 תווים: אותיות באנגלית, מספרים, _ ונקודה" : "אותיות באנגלית, מספרים, _ ונקודה"; return; }
        t = setTimeout(async () => { $("#sgUserHint").textContent = (await api.usernameFree(v)) ? "✅ פנוי" : "❌ השם הזה תפוס"; }, 400);
      };
    } else {
      $("#sgReset").onclick = async () => { const m = $("#sgMail").value.trim(); if (!m) return toast("כתבו קודם את המייל"); try { await api.resetPassword(m); toast("שלחנו קישור לאיפוס למייל"); } catch (e) { toast(e.message); } };
    }
    $("#sgForm").onsubmit = async (e) => {
      e.preventDefault();
      const mail = $("#sgMail").value.trim(), pass = $("#sgPass").value;
      try {
        $("#sgGo").disabled = true;
        if (isUp) {
          const u = $("#sgUser").value.trim().toLowerCase(), name = $("#sgName").value.trim();
          if (!/^[a-z0-9_.]{3,20}$/.test(u)) throw new Error("בחרו שם משתמש תקין");
          if (!name) throw new Error("חסר שם מלא");
          if (!/@[^@]+\.ac\.il$/i.test(mail)) throw new Error("צריך מייל של מוסד אקדמי (נגמר ב-ac.il)");
          if (pass.length < 12) throw new Error("סיסמה של 12 תווים לפחות");
          if (!$("#sgTerms").checked) throw new Error("צריך לאשר את התנאים");
          if (!(await api.usernameFree(u))) throw new Error("שם המשתמש תפוס");
          await api.signUp({ email: mail, password: pass, username: u, full_name: name, uni: $("#sgUni").value, degree: $("#sgDeg").value.trim(), birthday: $("#sgBday").value });
          // השאלון מתחיל מאפס במכשיר הזה
          try { localStorage.removeItem("sikumon-prefs"); } catch { /* */ }
          toast("החשבון נוצר 🎉 עכשיו כמה שאלות קצרות");
        } else {
          await api.signIn(mail, pass);
          restorePrefs();
          toast("ברוך/ה השב/ה 👋");
        }
        api.track(isUp ? "signup" : "login");
        if (location.hash === "#home") dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "#home";
      } catch (err) { toast(err.message); $("#sgGo").disabled = false; }
    };
  }
  // כניסה ממכשיר חדש: מחזירים את התשובות לשאלון ואת הקורסים מהשרת
  function restorePrefs() {
    const p = api.profile(); if (!p || prefs.get()) return;
    if (!p.learn || !Object.keys(p.learn).length) return;
    prefs.set({ ...p.learn, name: p.full_name.split(" ")[0], inst: p.uni, courses: p.courses || [], createdAt: p.created_at });
  }
  // השאלון והקורסים נשמרים גם בשרת (בשביל הסיכומים האישיים)
  async function pushPrefs() {
    const p = prefs.get(); if (!p || !api.user()) return;
    const learn = Object.fromEntries(["style", "length", "tone", "hard", "quiz"].filter((k) => p[k]).map((k) => [k, p[k]]));
    try { await api.updateMe({ learn, courses: (p.courses || []).slice(0, 40) }); } catch { /* ננסה בפעם הבאה */ }
  }

  // ---------- סנכרון: סיכומים מהשרת -> הספרייה במכשיר ----------
  async function syncSummaries() {
    if (!api.user()) return 0;
    const rows = await api.summaries();
    await remember(rows.map((r) => r.owner));
    const mine = meId();
    const local = await store.listItems();
    const keep = new Set();
    let fresh = 0;
    for (const r of rows) {
      const id = "srv-" + r.id; keep.add(id);
      const from = r.owner === mine ? "" : nameOf(r.owner);
      if (!local.some((x) => x.id === id)) fresh++;
      // סיכום של הקלטה (source_ref "rec:<id>"): תאריך השיעור = תאריך ההקלטה, כדי לחשב את מספר השיעור
      const rec = r.source_ref?.startsWith("rec:") ? await store.getRecording(r.source_ref.slice(4)).catch(() => null) : null;
      await store.putItem({ id, type: "summary", course: r.course || "כללי", title: r.title, date: r.created_at.slice(0, 10), html: mdToHtml(r.md), from, server: true,
        source: r.source_ref?.startsWith("rec:") ? "recording" : r.source, lessonDate: rec?.startedAt?.slice(0, 10) || (r.source_ref?.startsWith("rec:") ? r.created_at.slice(0, 10) : null) });
      if (Array.isArray(r.quiz) && r.quiz.length) {
        const qid = "srvq-" + r.id; keep.add(qid);
        await store.putItem({ id: qid, type: "quiz", summaryId: id, course: r.course || "כללי", title: r.title, questions: r.quiz.filter((q) => q?.q && Array.isArray(q.options)), from });
      }
    }
    // מה שנמחק בשרת (או ששיתוף בוטל) – יורד גם מהמכשיר
    for (const x of local) if ((x.id.startsWith("srv-") || x.id.startsWith("srvq-")) && !keep.has(x.id)) await store.deleteItem(x.id);
    return fresh;
  }

  // ---------- סנכרון: התראות מהשרת -> תיבת ההודעות (🔔) ----------
  const NOTE = {
    friend_request: (n) => ({ icon: "👋", title: `${nameOf(n.actor)} שלח/ה לך בקשת חברות`, body: "לאישור בלשונית החברים", link: "#social-friends" }),
    friend_accepted: (n) => ({ icon: "🤝", title: `${nameOf(n.actor)} אישר/ה את בקשת החברות`, body: "אפשר לשתף סיכומים מאותה כיתה", link: "#u-" + unameOf(n.actor) }),
    message: (n) => ({ icon: "💬", title: `הודעה מ${nameOf(n.actor)}`, body: esc(n.data?.preview || ""), link: "#dm-" + unameOf(n.actor) }),
    course_share: (n) => ({ icon: "🎓", title: `${nameOf(n.actor)} משתף/ת איתך סיכומים ב${n.data?.course || ""}`, body: "שתפו גם אתם בחזרה כדי לראות אותם", link: "#share-" + unameOf(n.actor) }),
    summary_ready: (n) => ({ icon: "📚", title: `סיכום חדש: ${n.data?.title || ""}`, body: esc(n.data?.course || ""), link: "#sum-srv-" + n.data?.id }),
    missed: (n) => ({ icon: "🙋", title: `${nameOf(n.actor)} פספס/ה שיעור ב${n.data?.course || ""}`, body: `מ-${n.data?.date || ""}. אפשר לשלוח לו/לה הודעה או לשתף סיכומים`, link: "#dm-" + unameOf(n.actor) }),
    comment: (n) => ({ icon: "💬", title: `${nameOf(n.actor)} הגיב/ה על "${n.data?.title || ""}"`, body: "", link: "#social" }),
    like: (n) => ({ icon: "❤️", title: `${nameOf(n.actor)} אהב/ה את "${n.data?.title || ""}"`, body: "", link: "#social" }),
  };
  async function syncNotifications() {
    if (!api.user()) return [];
    const list = await api.notifications();
    await remember(list.map((n) => n.actor));
    const box = (await store.getItem("inbox")) || { id: "inbox", type: "inbox", items: [] };
    const fresh = [], readBack = [];
    for (const n of list) {
      const id = "sn-" + n.id, f = NOTE[n.kind]; if (!f) continue;
      const ex = box.items.find((x) => x.id === id);
      if (ex) { if (ex.read && !n.read_at) readBack.push(n.id); continue; }
      const item = { id, ...f(n), at: n.created_at, read: !!n.read_at };
      box.items.unshift(item); if (!item.read) fresh.push(item);
    }
    box.items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    await store.putItem(box);
    api.markNotifications(readBack).catch(() => {});
    return fresh;
  }
  // מספרים לתגים: בקשות חברות ממתינות, הודעות שלא נקראו
  async function counts() {
    if (!api.user()) return { requests: 0, unread: 0 };
    const [fr, ms] = await Promise.all([api.friendships(), api.messages()]);
    return { requests: fr.filter((f) => f.status === "pending" && f.addressee === meId()).length, unread: new Set(ms.filter((m) => m.recipient === meId() && !m.read_at).map((m) => m.sender)).size };
  }

  // ---------- פיד ----------
  const fmtSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + "MB" : Math.max(1, Math.round(b / 1e3)) + "KB");
  function mediaHtml(p, d) {
    const items = Array.isArray(p.media) ? p.media : [];
    if (!items.length) return "";
    const imgs = items.filter((m) => /^image\//.test(m.type)), files = items.filter((m) => !/^image\//.test(m.type));
    return `${imgs.length ? `<div class="post-imgs n${Math.min(imgs.length, 4)}">${imgs.map((m) => d.urls[m.path] ? `<a href="${esc(d.urls[m.path])}" target="_blank" rel="noopener"><img src="${esc(d.urls[m.path])}" alt="${esc(m.name)}" loading="lazy"></a>` : "").join("")}</div>` : ""}
      ${files.map((m) => `<a class="post-file" href="${esc(d.urls[m.path] || "#")}" target="_blank" rel="noopener" download="${esc(m.name)}">📎 <span>${esc(m.name)}</span><span class="small muted">${fmtSize(m.size || 0)}</span></a>`).join("")}`;
  }
  function postCard(p, d) {
    const liked = d.likes.some((l) => l.post === p.id && l.user_id === meId());
    const nLikes = d.likes.filter((l) => l.post === p.id).length;
    const saved = d.saves.has(p.id), cmts = d.comments.filter((c) => c.post === p.id), mine = p.author === meId();
    return `<article class="post" data-post="${esc(p.id)}">
      <div class="post-h">${avatar(p.author)}<span style="min-width:0;flex:1"><a href="#u-${esc(unameOf(p.author))}"><b>${esc(nameOf(p.author))}</b></a> <span class="small muted" dir="ltr">@${esc(unameOf(p.author))}</span><br><span class="small muted">${esc(p.course)}${p.course ? " · " : ""}${when(p.created_at)} · ${VIS[p.visibility]}</span></span>
        ${mine ? '<button class="tool" type="button" data-del aria-label="מחיקת הפוסט">🗑️</button>' : '<button class="tool" type="button" data-menu aria-label="דיווח או חסימה">⋯</button>'}</div>
      ${p.title ? `<h3>${p.md ? "📄 " : ""}${esc(p.title)}</h3>` : ""}${p.body ? `<p class="post-body">${esc(p.body)}</p>` : ""}
      ${mediaHtml(p, d)}
      ${p.md ? `<details><summary class="small"><b>לקריאת הסיכום</b></summary><div class="md-body" style="margin-top:8px">${mdToHtml(p.md)}</div></details>` : ""}
      <div class="post-a"><button type="button" data-like aria-pressed="${liked}">${liked ? "❤️" : "🤍"} <bdi>${nLikes}</bdi></button>
        <button type="button" data-cmt>💬 <bdi>${cmts.length}</bdi></button>
        <button type="button" data-save aria-pressed="${saved}">${saved ? "🔖 נשמר" : "🔖 שמירה"}</button></div>
      <div class="post-c" hidden>${cmts.map((c) => `<p class="small cmt"><span><b>${esc(nameOf(c.author))}:</b> ${esc(c.body)}</span>${c.author === meId() ? "" : `<button class="link" type="button" data-crep="${c.id}" data-who="${c.author}" aria-label="דיווח על התגובה">⚠️</button>`}</p>`).join("")}
        <form class="row" data-cform><input placeholder="תגובה…" aria-label="תגובה" maxlength="500" style="flex:1"><button class="btn ghost" type="submit">שליחה</button></form></div>
    </article>`;
  }
  async function feedData(filter) {
    const [all, bl] = await Promise.all([api.posts(), api.blocks()]);
    const blocked = new Set(bl.map((b) => b.blocked));
    let ps = all.filter((p) => !blocked.has(p.author)); // חסמתי? לא רואים את הפוסטים שלו
    if (filter) ps = ps.filter(filter);
    const ids = ps.map((p) => p.id);
    const [likes, sv, comments, urls] = await Promise.all([api.likes(ids), api.saves(), api.comments(ids), api.mediaUrls(ps.flatMap((p) => (Array.isArray(p.media) ? p.media : []).map((m) => m.path)))]);
    await remember([...ps.map((p) => p.author), ...comments.map((c) => c.author)]);
    return { ps, likes, saves: new Set(sv.map((s) => s.post)), comments: comments.filter((c) => !blocked.has(c.author)), urls };
  }
  // דיווח / חסימה – על כל פוסט, תגובה והודעה (חובה בפלטפורמה עם תוכן של משתמשים)
  function reportModal({ target, post, what, after }) {
    const m = modal(`<h2>⚠️ דיווח על ${what}</h2>
      <fieldset class="vis"><legend>מה הבעיה?</legend>${["הטרדה או פגיעה", "תוכן לא הולם", "ספאם או פרסומת", "חומר של מרצה / זכויות יוצרים", "מידע אישי של מישהו אחר", "אחר"].map((r, i) => `<label><input type="radio" name="rr" value="${r}" ${i ? "" : "checked"}> ${r}</label>`).join("")}</fieldset>
      <label>פרטים (לא חובה)<input id="rrTxt" maxlength="300"></label>
      <label class="row small" style="gap:8px"><input type="checkbox" id="rrBlock" style="width:auto"> גם לחסום את ${esc(nameOf(target))}</label>
      <p class="small muted">הדיווח נשלח אלינו בלבד, והמשתמש לא יודע מי דיווח. בודקים כל דיווח תוך 24 שעות.</p>
      <div class="row"><button class="btn" id="rrGo" type="button">שליחת דיווח</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
    $("#rrGo", m).onclick = async () => {
      try {
        const reason = `${what}: ${$('input[name="rr"]:checked', m).value}${$("#rrTxt", m).value.trim() ? " – " + $("#rrTxt", m).value.trim() : ""}`;
        await api.report({ target, post, reason: reason.slice(0, 500) });
        if ($("#rrBlock", m).checked) await api.block(target);
        m.remove(); toast($("#rrBlock", m).checked ? "הדיווח נשלח והמשתמש נחסם" : "תודה, הדיווח נשלח לבדיקה"); after?.();
      } catch (e) { toast(e.message); }
    };
  }
  function postMenu(p, again) {
    const m = modal(`<h2>${esc(nameOf(p.author))}</h2>
      <div class="list"><button class="item" type="button" id="pmRep">⚠️ דיווח על הפוסט</button><button class="item" type="button" id="pmBlock">🚫 חסימת ${esc(nameOf(p.author))}</button><a class="item" href="#u-${esc(unameOf(p.author))}">👤 לפרופיל</a></div>
      <button class="btn ghost" data-x type="button">סגירה</button>`);
    $("#pmRep", m).onclick = () => { m.remove(); reportModal({ target: p.author, post: p.id, what: "פוסט", after: again }); };
    $("#pmBlock", m).onclick = async () => { if (!confirm(`לחסום את ${nameOf(p.author)}? לא תראו את הפוסטים וההודעות שלו/ה.`)) return; await api.block(p.author); m.remove(); toast("נחסם/ה"); again(); };
  }
  function renderPosts(el, d, again) {
    el.innerHTML = d.ps.map((p) => postCard(p, d)).join("") || '<p class="muted">עוד אין כאן פוסטים. שתפו משהו ראשון 🙂</p>';
    el.querySelectorAll("[data-post]").forEach((a) => {
      const id = a.dataset.post, p = d.ps.find((x) => x.id === id);
      const run = async (fn) => { try { await fn(); again(); } catch (e) { toast(e.message); } };
      a.querySelector("[data-like]").onclick = () => run(() => api.like(id, !d.likes.some((l) => l.post === id && l.user_id === meId())));
      a.querySelector("[data-save]").onclick = () => run(() => api.save(id, !d.saves.has(id)));
      a.querySelector("[data-cmt]").onclick = () => { const c = a.querySelector(".post-c"); c.hidden = !c.hidden; };
      a.querySelector("[data-cform]").onsubmit = (e) => { e.preventDefault(); const v = e.target.querySelector("input").value.trim(); if (v) run(() => api.comment(id, v)); };
      const del = a.querySelector("[data-del]"), menu = a.querySelector("[data-menu]");
      if (del) del.onclick = () => { if (confirm("למחוק את הפוסט?")) run(() => api.deletePost(id, Array.isArray(p.media) ? p.media : [])); };
      if (menu) menu.onclick = () => postMenu(p, again);
      a.querySelectorAll("[data-crep]").forEach((b) => (b.onclick = () => reportModal({ target: b.dataset.who, post: id, what: "תגובה", after: again })));
    });
  }
  async function feed() {
    busy();
    try {
      const [d, bd] = await Promise.all([feedData(), api.birthdays()]);
      const today = new Date().toLocaleDateString("en-CA").slice(5);
      const midnight = new Date(new Date().toDateString());
      const soon = bd.filter((b) => { const n = (new Date(midnight.getFullYear() + "-" + b.birthday.slice(5) + "T00:00") - midnight) / 864e5; return n > 0 && n <= 7; });
      view.innerHTML = `<div class="page">${subnav("social")}
        ${bd.filter((b) => b.birthday.slice(5) === today).map((b) => `<div class="bday"><span>🎂 היום יום ההולדת של <b>${esc(b.full_name)}</b>!</span><a class="btn ghost" href="#dm-${esc(b.username)}">שליחת ברכה</a></div>`).join("")}
        ${soon.length ? `<p class="small muted">🎈 ימי הולדת בשבוע הקרוב: ${soon.map((b) => esc(b.full_name)).join(", ")}</p>` : ""}
        <button class="btn" type="button" id="newPost">➕ פוסט חדש</button>
        <div class="feed" id="feed"></div></div>`;
      renderPosts($("#feed"), d, feed);
      $("#newPost").onclick = publishModal;
    } catch (e) { fail(e); }
  }

  // ---------- חלונות ----------
  function modal(html) {
    document.getElementById("socModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="socModal" role="dialog"><div class="card">${html}</div></div>`);
    const m = document.getElementById("socModal");
    m.onclick = (e) => { if (e.target === m || e.target.closest("[data-x]")) m.remove(); };
    return m;
  }
  async function mySummaries() { return (await store.listItems()).filter((x) => x.type === "summary" && x.kind !== "formulas" && !x.from).sort((a, b) => (b.date || "").localeCompare(a.date || "")); }
  // פוסט חדש, כמו באינסטגרם: טקסט, תמונות וקבצים, ואם רוצים – גם סיכום שלכם
  async function publishModal() {
    const sums = await mySummaries();
    const def = prefs.get()?.privacy?.posts || "friends";
    let files = [];
    const m = modal(`<h2>פוסט חדש</h2>
      <label>מה רציתם לשתף?<textarea id="pbTxt" rows="3" maxlength="1000" placeholder="למשל: מישהו הבין את שאלה 4 בתרגיל? / טיפ למבחן במיקרו"></textarea></label>
      <div class="row"><label class="btn ghost">🖼️ תמונות<input type="file" id="pbImg" accept="image/*" multiple hidden></label><label class="btn ghost">📎 קבצים<input type="file" id="pbFile" accept=".pdf,.pptx,.docx,.xlsx,.txt" multiple hidden></label></div>
      <div id="pbPrev" class="pb-prev"></div>
      <label>לצרף סיכום (לא חובה)<select id="pbSum"><option value="">בלי סיכום</option>${sums.map((x) => `<option value="${esc(x.id)}">${esc(x.course || "")} – ${esc(x.title)}</option>`).join("")}</select></label>
      <label>קורס (לא חובה)<select id="pbCourse"><option value="">—</option>${myCourses().map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
      <fieldset class="vis"><legend>מי יראה?</legend>${Object.entries(VIS).map(([k, l]) => `<label><input type="radio" name="vis" value="${k}" ${k === def ? "checked" : ""}> ${l}</label>`).join("")}</fieldset>
      <label class="row small" style="gap:8px;align-items:flex-start"><input type="checkbox" id="pbOwn" style="width:auto;margin-top:5px">התוכן שלי, ומותר לי לשתף אותו (לא מצגות, מבחנים או הקלטות של מרצים)</label>
      <div class="row"><button class="btn" id="pbGo" type="button">פרסום</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
    const drawPrev = () => {
      $("#pbPrev", m).innerHTML = files.map((f, i) => `<span class="pb-chip">${/^image\//.test(f.type) ? "🖼️" : "📎"} ${esc(f.name)} <button type="button" class="link" data-rm="${i}" aria-label="הסרה">✕</button></span>`).join("");
      m.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { files.splice(+b.dataset.rm, 1); drawPrev(); }));
    };
    const addFiles = async (list) => {
      try { files = [...files, ...(await api.preparePostFiles([...list]))].slice(0, 6); if (list.length + files.length > 6) toast("עד 6 קבצים בפוסט"); drawPrev(); }
      catch (e) { toast(e.message); }
    };
    $("#pbImg", m).onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
    $("#pbFile", m).onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
    $("#pbSum", m).onchange = () => { const sm = sums.find((x) => x.id === $("#pbSum", m).value); if (sm?.course) $("#pbCourse", m).value = myCourses().includes(sm.course) ? sm.course : ""; };
    $("#pbGo", m).onclick = async () => {
      const body = $("#pbTxt", m).value.trim(), sm = sums.find((x) => x.id === $("#pbSum", m).value);
      if (!body && !files.length && !sm) return toast("כתבו משהו, הוסיפו תמונה או צרפו סיכום");
      if (!$("#pbOwn", m).checked) return toast("צריך לאשר שהתוכן שלכם ומותר לשתף אותו");
      $("#pbGo", m).disabled = true; $("#pbGo", m).textContent = "מעלה…";
      try {
        const post = { course: $("#pbCourse", m).value || sm?.course || "", title: sm ? sm.title.slice(0, 200) : "", body, md: sm ? htmlToMd(sm.html).slice(0, 20000) : "", visibility: $('input[name="vis"]:checked', m).value };
        if (files.length) await api.addPostWithMedia(post, files); else await api.addPost(post);
        m.remove(); toast("פורסם ✓"); api.track("post"); feed();
      } catch (e) { toast(e.message); $("#pbGo", m).disabled = false; $("#pbGo", m).textContent = "פרסום"; }
    };
  }
  // HTML של סיכום -> Markdown פשוט (לפוסט)
  function htmlToMd(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const out = [];
    doc.body.querySelectorAll("h1,h2,h3,h4,p,li,tr,blockquote").forEach((el) => {
      if (el.closest("li") && el.tagName !== "LI") return;
      const t = el.textContent.trim(); if (!t) return;
      if (/^H\d$/.test(el.tagName)) out.push("## " + t);
      else if (el.tagName === "LI") out.push("- " + t);
      else if (el.tagName === "TR") out.push("| " + [...el.children].map((c) => c.textContent.trim()).join(" | ") + " |");
      else out.push(t);
    });
    return out.join("\n");
  }

  // ---------- "אותה כיתה": בוחרים אילו קורסים לשתף עם חבר ----------
  async function shareModal(friendId, g0) {
    const g = g0 || (await graph());
    const mine = g.iShare(friendId), theirs = g.theyShare(friendId);
    // הקורסים שלי + שמות הקורסים מהמודל שיש לי בהם סיכומים (השמות במודל לפעמים שונים ממה שהוקלד)
    const sumCourses = (await mySummaries()).map((x) => x.course).filter(Boolean);
    const courses = [...new Set([...myCourses(), ...sumCourses, ...mine])];
    const m = modal(`<h2>🎓 אותה כיתה עם ${esc(nameOf(friendId))}</h2>
      <p class="small">מסמנים קורסים שלומדים ביחד. הסיכומים שלך בקורסים האלה יופיעו אצל ${esc(nameOf(friendId))}, <b>רק אם גם הוא/היא ישתף/תשתף איתך</b>. אפשר לבטל בכל רגע.</p>
      ${theirs.length ? `<p class="notice small">✅ ${esc(nameOf(friendId))} כבר משתף/ת איתך: <b>${theirs.map(esc).join(", ")}</b></p>` : `<p class="small muted">${esc(nameOf(friendId))} עוד לא שיתף/ה איתך קורסים.</p>`}
      <fieldset class="vis"><legend>הקורסים שלי לשתף</legend>${courses.map((c) => `<label><input type="checkbox" value="${esc(c)}" ${mine.includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("") || '<p class="small muted">אין לך קורסים ברשימה (הגדרות ← לימודים)</p>'}</fieldset>
      <div class="row"><button class="btn" id="shGo" type="button">שמירה</button><button class="btn ghost" data-x type="button">אחר כך</button></div>`);
    $("#shGo", m).onclick = async () => {
      const want = [...m.querySelectorAll("fieldset input:checked")].map((i) => i.value);
      try {
        for (const c of want.filter((c) => !mine.includes(c))) await api.share(friendId, c);
        for (const c of mine.filter((c) => !want.includes(c))) await api.unshare(friendId, c);
        m.remove(); toast(want.length ? "השיתוף נשמר ✓" : "השיתוף בוטל"); api.track("share");
        syncSummaries().catch(() => {});
        if (location.hash === "#social-friends") friends();
      } catch (e) { toast(e.message); }
    };
  }

  // ---------- חברים ----------
  async function friends() {
    busy();
    try {
      const g = await graph();
      const row = (id, btns, sub = "") => `<div class="item">${avatar(id)}<a href="#u-${esc(unameOf(id))}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><span class="t">${esc(nameOf(id))}</span><br><span class="small muted"><span dir="ltr">@${esc(unameOf(id))}</span>${sub}</span></a>${btns}</div>`;
      const shareSub = (id) => { const a = g.iShare(id).length, b = g.theyShare(id).length; return a && b ? " · 🎓 אותה כיתה" : b ? " · 🎓 משתף/ת איתך – שתפו בחזרה" : a ? " · 🎓 מחכה שגם הוא/היא ישתף" : ""; };
      view.innerHTML = `<div class="page">${subnav("social-friends")}
        <section class="soft" style="display:grid;gap:10px"><h3>הוספת חבר/ה</h3>
          <form class="row" id="frForm"><input id="frQ" dir="ltr" placeholder="שם משתמש" aria-label="שם משתמש" autocapitalize="none" style="flex:1"><button class="btn" type="submit">שליחת בקשה</button></form>
          <p class="small muted">החבר/ה צריך/ה לאשר. השם שלך: <b dir="ltr">@${esc(api.profile()?.username || "")}</b> <button class="btn ghost" type="button" id="frShare" style="min-height:32px;padding:2px 10px">שיתוף השם</button></p>
        </section>
        ${g.incoming.length ? `<section style="display:grid;gap:8px"><h3>בקשות חדשות (${g.incoming.length})</h3>${g.incoming.map((f) => row(f.requester, `<button class="btn" data-ok="${f.id}" data-who="${f.requester}" type="button">אישור</button><button class="btn ghost" data-no="${f.id}" type="button">לא עכשיו</button>`)).join("")}</section>` : ""}
        ${g.outgoing.length ? `<section style="display:grid;gap:8px"><h3>ממתינים לאישור</h3>${g.outgoing.map((f) => row(f.addressee, `<button class="btn ghost" data-no="${f.id}" type="button">ביטול</button>`)).join("")}</section>` : ""}
        <section style="display:grid;gap:8px"><h3>החברים שלי (${g.friends.length})</h3>${g.friends.map((f) => { const id = g.other(f); return row(id, `<button class="btn ghost" data-share="${id}" type="button" aria-label="אותה כיתה">🎓</button><a class="btn ghost" href="#dm-${esc(unameOf(id))}" aria-label="הודעה">💬</a>`, shareSub(id)); }).join("") || '<p class="muted small">עוד אין חברים. הוסיפו לפי שם משתמש 👆</p>'}</section></div>`;
      $("#frForm").onsubmit = async (e) => {
        e.preventDefault();
        const u = $("#frQ").value.trim().replace(/^@/, "").toLowerCase(); if (!u) return;
        try {
          const p = await api.findUser(u);
          if (!p) return toast("לא מצאנו משתמש בשם הזה");
          if (p.id === meId()) return toast("זה את/ה 🙂");
          if (g.fr.some((f) => g.other(f) === p.id)) return toast("כבר חברים או שיש בקשה פתוחה");
          await api.requestFriend(p.id); people.set(p.id, p);
          toast(`הבקשה נשלחה ל${p.full_name}`); api.track("friend_request"); friends();
        } catch (err) { toast(err.message); }
      };
      $("#frShare").onclick = () => { const t = `הוסיפו אותי בסיכומון: @${api.profile()?.username}\n${location.origin + location.pathname}`; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else { navigator.clipboard?.writeText(t); toast("הועתק"); } };
      view.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => {
        try { await api.acceptFriend(+b.dataset.ok); toast("אתם חברים עכשיו 🙌"); await friends(); shareModal(b.dataset.who); } catch (e) { toast(e.message); }
      }));
      view.querySelectorAll("[data-no]").forEach((b) => (b.onclick = async () => { try { await api.removeFriend(+b.dataset.no); friends(); } catch (e) { toast(e.message); } }));
      view.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => shareModal(b.dataset.share, g)));
    } catch (e) { fail(e); }
  }

  // ---------- הודעות ----------
  async function threads() {
    const [ms, acc, bl, g] = await Promise.all([api.messages(), api.chatAccepts(), api.blocks(), graph()]);
    const me = meId(), blocked = new Set(bl.map((b) => b.blocked)), accepted = new Set(acc.map((a) => a.other));
    const friendIds = new Set(g.friends.map(g.other));
    const by = new Map();
    for (const m of ms) { const o = m.sender === me ? m.recipient : m.sender; if (!blocked.has(o)) { if (!by.has(o)) by.set(o, []); by.get(o).push(m); } }
    await remember([...by.keys()]);
    const isReq = (o) => !friendIds.has(o) && !accepted.has(o) && (by.get(o) || []).every((m) => m.sender === o);
    return { by, isReq, friendIds };
  }
  async function messages(box = "main") {
    busy();
    try {
      const t = await threads(), me = meId();
      const all = [...t.by.entries()].sort((a, b) => b[1].at(-1).created_at.localeCompare(a[1].at(-1).created_at));
      const reqs = all.filter(([o]) => t.isReq(o)), main = all.filter(([o]) => !t.isReq(o));
      const list = box === "req" ? reqs : main;
      view.innerHTML = `<div class="page" style="max-width:720px">${subnav("messages")}
        <div class="row"><a class="btn ${box === "req" ? "ghost" : ""}" href="#messages">ראשי</a><a class="btn ${box === "req" ? "" : "ghost"}" href="#messages-req">בקשות${reqs.length ? ` (${reqs.length})` : ""}</a></div>
        ${box === "req" ? '<p class="small muted">הודעות ממי שאינו חבר שלך. הוא לא יודע שקראת עד שתאשר/י.</p>' : ""}
        <div class="list">${list.map(([o, ms]) => { const m = ms.at(-1), un = ms.some((x) => x.recipient === me && !x.read_at); return `<a class="item" href="#dm-${esc(unameOf(o))}">${avatar(o)}<span style="flex:1;min-width:0"><span class="t">${esc(nameOf(o))}</span>${un ? ' <span class="chip new">חדש</span>' : ""}<br><span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.sender === me ? "את/ה: " : ""}${esc(m.body)}</span></span><span class="small muted">${when(m.created_at)}</span></a>`; }).join("") || '<p class="muted">אין כאן הודעות</p>'}</div>
        ${box === "req" ? "" : `<section class="soft"><h3>הודעה חדשה לחבר/ה</h3><div class="stories" style="margin-top:8px">${[...t.friendIds].map((id) => `<a class="story" href="#dm-${esc(unameOf(id))}">${avatar(id)}<span class="small">${esc(nameOf(id).split(" ")[0])}</span></a>`).join("") || '<p class="small muted">עוד אין חברים</p>'}</div><p class="small muted">אפשר גם לשלוח הודעה למי שאינו חבר – מהפרופיל שלו.</p></section>`}</div>`;
    } catch (e) { fail(e); }
  }
  let dmTimer = null;
  async function dm(username) {
    clearInterval(dmTimer);
    busy();
    try {
      const p = await api.findUser(username);
      if (!p) { view.innerHTML = `<div class="page"><p>לא מצאנו את @${esc(username)}</p></div>`; return; }
      people.set(p.id, p);
      const here = () => decodeURIComponent(location.hash.slice(1)) === "dm-" + username;
      view.innerHTML = `<div class="page dm" style="max-width:720px">
        <a class="row" href="#u-${esc(p.username)}" style="color:inherit;text-decoration:none">${avatar(p.id)}<span><b>${esc(p.full_name)}</b><br><span class="small muted" dir="ltr">@${esc(p.username)}</span></span></a>
        <div id="dmReq"></div><div class="dm-log" id="dmLog"><p class="muted small">טוען…</p></div>
        <form class="chat-form" id="dmForm"><textarea id="dmIn" rows="1" placeholder="הודעה…" aria-label="הודעה" maxlength="2000"></textarea><button class="btn" type="submit">שליחה</button></form>
        <div class="row"><button class="btn ghost" type="button" id="dmBlock">🚫 חסימה</button><button class="btn ghost" type="button" id="dmReport">⚠️ דיווח</button></div></div>`;
      let shown = -1;
      const draw = async () => {
        const t = await threads(), ms = t.by.get(p.id) || [], req = ms.length > 0 && t.isReq(p.id);
        if (!req && ms.some((m) => m.recipient === meId() && !m.read_at)) api.markRead(p.id).catch(() => {});
        $("#dmReq").innerHTML = req ? `<div class="notice">${esc(p.full_name)} עוד לא חבר/ה שלך ורוצה לשלוח לך הודעה.<div class="row" style="margin-top:8px"><button class="btn" id="dmOk" type="button">אישור</button><button class="btn ghost" id="dmDel" type="button">מחיקה</button></div></div>` : "";
        if ($("#dmOk")) $("#dmOk").onclick = async () => { await api.acceptChat(p.id); draw(); };
        if ($("#dmDel")) $("#dmDel").onclick = async () => { await api.deleteChatFrom(p.id); location.hash = "#messages-req"; };
        if (ms.length === shown) return;
        shown = ms.length;
        $("#dmLog").innerHTML = ms.map((m) => `<div class="bubble ${m.sender === p.id ? "bot" : "me"}">${esc(m.body)}${m.sender === p.id ? `<button class="link msg-rep" type="button" data-mrep="${m.id}" aria-label="דיווח על ההודעה">⚠️</button>` : ""}</div>`).join("") || '<p class="muted small">עוד אין הודעות. תגידו היי 👋</p>';
        $("#dmLog").querySelectorAll("[data-mrep]").forEach((b) => (b.onclick = () => { const msg = ms.find((x) => String(x.id) === b.dataset.mrep); reportModal({ target: p.id, what: "הודעה", after: null }); setTimeout(() => { const t = $("#rrTxt"); if (t && msg) t.value = ("ההודעה: " + msg.body).slice(0, 300); }, 0); }));
        $("#dmLog").scrollTop = $("#dmLog").scrollHeight;
      };
      $("#dmIn").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#dmForm").requestSubmit(); } };
      $("#dmForm").onsubmit = async (e) => {
        e.preventDefault(); const v = $("#dmIn").value.trim(); if (!v) return;
        try { await api.sendMessage(p.id, v); $("#dmIn").value = ""; api.track("message"); await draw(); } catch (err) { toast(err.message); }
      };
      $("#dmBlock").onclick = async () => { if (!confirm(`לחסום את ${p.full_name}? לא תקבלו ממנו/ה הודעות.`)) return; await api.block(p.id); toast("נחסם/ה"); location.hash = "#messages"; };
      $("#dmReport").onclick = async () => { await api.report({ target: p.id, reason: "דיווח מהודעות" }); toast("תודה, הדיווח נשלח לבדיקה"); };
      await draw();
      // בודקים הודעות חדשות כל 8 שניות, כל עוד המסך פתוח
      dmTimer = setInterval(() => { if (here() && document.visibilityState === "visible") draw().catch(() => {}); else if (!here()) clearInterval(dmTimer); }, 8000);
    } catch (e) { fail(e); }
  }

  // ---------- פספסתי שיעור ----------
  function missed() {
    view.innerHTML = `<div class="page">
      <h1 style="font-size:30px">🙋 פספסתי שיעור</h1>
      <section class="soft small"><b>איך זה עובד:</b><ol class="steps" style="margin:6px 0 0"><li>בוחרים קורס ותאריך.</li><li>כל החברים שלך מקבלים התראה "פספס/ה שיעור".</li><li>מי שהיה בשיעור שולח לך הודעה, או משתף איתך את הקורס ב"אותה כיתה" – ואז הסיכומים שלו נכנסים אצלך לבד.</li></ol></section>
      <section class="card" style="display:grid;gap:12px"><h2>לא הייתי בשיעור</h2>
        <label>איזה קורס?<select id="msC">${myCourses().map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>איזה תאריך?<input type="date" id="msD" value="${new Date().toLocaleDateString("en-CA")}"></label>
        <button class="btn" type="button" id="msGo">לבקש מהחברים</button></section>
      <section class="soft" style="display:grid;gap:8px"><h3>עוד דרכים להשלים</h3>
        <a class="item" href="#upload"><span><span class="t">📄 העלאת המצגת של השיעור</span><br><span class="small muted">מהמודל או ממישהו מהכיתה – ותקבלו סיכום אישי לפי השאלון שלך</span></span></a>
        <a class="item" href="#social-friends"><span><span class="t">🎓 אותה כיתה</span><br><span class="small muted">חברים שמשתפים איתך את הקורס – הסיכומים שלהם אצלך אוטומטית</span></span></a></section></div>`;
    $("#msGo").onclick = async () => {
      const c = $("#msC").value; if (!c) return toast("הוסיפו קורסים בהגדרות ← לימודים");
      try { await api.missed(c, $("#msD").value); toast("✅ הבקשה נשלחה לחברים שלך"); api.track("missed"); } catch (e) { toast(e.message); }
    };
  }

  // ---------- פרופיל של מישהו אחר ----------
  async function profileView(username) {
    busy();
    try {
      const p = await api.findUser(username);
      if (!p) { view.innerHTML = `<div class="page"><p>לא מצאנו את @${esc(username)}</p></div>`; return; }
      if (p.id === meId()) { location.hash = "#profile"; return; }
      people.set(p.id, p);
      const g = await graph();
      const f = g.fr.find((x) => g.other(x) === p.id);
      const d = await feedData((x) => x.author === p.id);
      const ig = safeLink(p.ig, "instagram.com"), li = safeLink(p.li, "linkedin.com");
      const rel = !f ? '<button class="btn" type="button" id="add">➕ בקשת חברות</button>'
        : f.status === "accepted" ? '<span class="chip ok">✓ חברים</span><button class="btn ghost" type="button" id="shr">🎓 אותה כיתה</button>'
        : f.requester === meId() ? '<span class="chip">⏳ מחכים לאישור</span>' : '<button class="btn" type="button" id="acc">אישור בקשת החברות</button>';
      view.innerHTML = `<div class="page" style="max-width:720px">
        <section class="card prof"><div class="row" style="gap:16px">${avatar(p.id, true)}<span style="min-width:0;flex:1"><h1 style="font-size:28px">${esc(p.full_name)}</h1><span class="muted" dir="ltr">@${esc(p.username)}</span><br><span class="small muted">${esc(p.uni)}${p.degree ? " · " + esc(p.degree) : ""}</span></span></div>
          ${p.bio ? `<p>${esc(p.bio)}</p>` : ""}
          <div class="row">${ig ? `<a class="btn ghost" href="${esc(ig)}" target="_blank" rel="noopener noreferrer">📸 Instagram</a>` : ""}${li ? `<a class="btn ghost" href="${esc(li)}" target="_blank" rel="noopener noreferrer">💼 LinkedIn</a>` : ""}
            ${rel}<a class="btn ghost" href="#dm-${esc(p.username)}">💬 הודעה</a></div>
          <div class="row"><button class="btn ghost" type="button" id="blk">🚫 חסימה</button><button class="btn ghost" type="button" id="rep">⚠️ דיווח</button>${f ? '<button class="btn ghost" type="button" id="unf">הסרה מהחברים</button>' : ""}</div></section>
        <h2 style="font-size:20px">מה ${esc(p.full_name.split(" ")[0])} שיתף/ה</h2><div class="feed" id="pfFeed"></div></div>`;
      renderPosts($("#pfFeed"), d, () => profileView(username));
      const act = (fn) => async () => { try { await fn(); profileView(username); } catch (e) { toast(e.message); } };
      if ($("#add")) $("#add").onclick = act(async () => { await api.requestFriend(p.id); toast("הבקשה נשלחה"); });
      if ($("#acc")) $("#acc").onclick = act(async () => { await api.acceptFriend(f.id); toast("אתם חברים 🙌"); });
      if ($("#shr")) $("#shr").onclick = () => shareModal(p.id, g);
      if ($("#unf")) $("#unf").onclick = () => { if (confirm("להסיר מהחברים? גם השיתוף בקורסים יפסיק.")) act(async () => { for (const c of g.iShare(p.id)) await api.unshare(p.id, c); await api.removeFriend(f.id); })(); };
      $("#blk").onclick = () => { if (confirm(`לחסום את ${p.full_name}?`)) act(async () => { await api.block(p.id); toast("נחסם/ה"); })(); };
      $("#rep").onclick = act(async () => { await api.report({ target: p.id, reason: "דיווח מהפרופיל" }); toast("תודה, הדיווח נשלח"); });
    } catch (e) { fail(e); }
  }
  // הגעה מהתראה "משתף/ת איתך": פותחים את חלון השיתוף
  async function shareFrom(username) { const p = await api.findUser(username); await friends(); if (p) { people.set(p.id, p); shareModal(p.id); } }

  // ---------- הפרופיל שלי (באזור הפרופיל) ----------
  async function myProfile(tab = "posts") {
    const me = api.profile(); if (!me) return "";
    people.set(me.id, me);
    const ig = safeLink(me.ig, "instagram.com"), li = safeLink(me.li, "linkedin.com");
    const g = await graph();
    const tabs = [["posts", "📝 שפרסמתי"], ["liked", "❤️ אהבתי"], ["saved", "🔖 שמורים"]];
    return `<section class="card prof"><div class="row" style="gap:16px">${avatar(me.id, true)}<span style="min-width:0;flex:1"><h1 style="font-size:28px">${esc(me.full_name)}</h1><span class="muted" dir="ltr">@${esc(me.username)}</span><br><span class="small muted">${esc(me.uni)}${me.degree ? " · " + esc(me.degree) : ""}</span></span></div>
      ${me.bio ? `<p>${esc(me.bio)}</p>` : '<p class="muted">עוד לא כתבת משהו על עצמך</p>'}
      <div class="row">${ig ? `<a class="btn ghost" href="${esc(ig)}" target="_blank" rel="noopener noreferrer">📸 Instagram</a>` : ""}${li ? `<a class="btn ghost" href="${esc(li)}" target="_blank" rel="noopener noreferrer">💼 LinkedIn</a>` : ""}
        <button class="btn" type="button" id="meEdit">עריכת פרופיל</button><a class="btn ghost" href="#settings">⚙️ הגדרות</a></div>
      <p class="small muted">👥 ${g.friends.length} חברים · <a href="#social-friends">לרשימה</a></p></section>
      <nav class="snav" aria-label="התוכן שלי">${tabs.map(([k, l]) => `<a href="#profile${k === "posts" ? "" : "-" + k}" ${tab === k ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
      ${tab !== "posts" ? '<p class="small muted">🔒 רק את/ה רואה את הרשימה הזו</p>' : ""}
      <div class="feed" id="meFeed"><p class="muted small">טוען…</p></div>`;
  }
  async function bindMyProfile(tab = "posts") {
    if ($("#meEdit")) $("#meEdit").onclick = editMe;
    const el = $("#meFeed"); if (!el) return;
    try {
      const me = meId();
      const sv = new Set((await api.saves()).map((s) => s.post));
      let liked = new Set();
      if (tab === "liked") { const all = await api.posts(); liked = new Set((await api.likes(all.map((p) => p.id))).filter((l) => l.user_id === me).map((l) => l.post)); }
      const d = await feedData((p) => (tab === "posts" ? p.author === me : tab === "saved" ? sv.has(p.id) : liked.has(p.id)));
      renderPosts(el, d, () => bindMyProfile(tab));
    } catch (e) { el.innerHTML = `<p class="notice alert">${esc(e.message)}</p>`; }
  }
  function editMe() {
    const me = api.profile();
    const m = modal(`<h2>עריכת פרופיל</h2>
      <label>שם מלא<input id="eName" value="${esc(me.full_name)}" maxlength="60"></label>
      <label>על עצמי<textarea id="eBio" rows="3" maxlength="300">${esc(me.bio)}</textarea></label>
      <label>מוסד<select id="eUni">${UNIS.map((u) => `<option ${u === me.uni ? "selected" : ""}>${u}</option>`).join("")}</select></label>
      <label>תואר ושנה<input id="eDeg" value="${esc(me.degree)}" maxlength="80"></label>
      <label>יום הולדת<input id="eBday" type="date" value="${esc(me.birthday || "")}"></label>
      <label>קישור לאינסטגרם<input id="eIg" dir="ltr" value="${esc(me.ig)}" placeholder="https://instagram.com/..."></label>
      <label>קישור ללינקדאין<input id="eLi" dir="ltr" value="${esc(me.li)}" placeholder="https://linkedin.com/in/..."></label>
      <div class="row"><button class="btn" id="eGo" type="button">שמירה</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
    $("#eGo", m).onclick = async () => {
      const ig = $("#eIg", m).value.trim(), li = $("#eLi", m).value.trim();
      if (ig && !safeLink(ig, "instagram.com")) return toast("קישור אינסטגרם צריך להתחיל ב-https://instagram.com");
      if (li && !safeLink(li, "linkedin.com")) return toast("קישור לינקדאין צריך להתחיל ב-https://linkedin.com");
      try {
        await api.updateMe({ full_name: $("#eName", m).value.trim() || me.full_name, bio: $("#eBio", m).value.trim(), uni: $("#eUni", m).value, degree: $("#eDeg", m).value.trim(), birthday: $("#eBday", m).value || null, ig: safeLink(ig, "instagram.com"), li: safeLink(li, "linkedin.com") });
        m.remove(); toast("נשמר ✓"); dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (e) { toast(e.message); }
    };
  }

  // העלאת קובץ -> סיכום אישי, ומיד מכניסים אותו לספרייה במכשיר
  async function upload(file, course) { const r = await api.summarizeFile(file, course); await syncSummaries(); return r; }

  return { upload, feed, friends, missed, signup, messages, dm, myProfile, bindMyProfile, editMe, counts, syncSummaries, syncNotifications, pushPrefs, restorePrefs, shareFrom, profile: profileView };
}
