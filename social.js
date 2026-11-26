// 👥 השכבה החברתית – אמיתית, מול השרת (api.js): הרשמה וכניסה, חברים באישור הדדי, "אותה כיתה"
// (שיתוף סיכומים בין חברים באישור של שניהם), הודעות (ראשי + בקשות), פספסתי שיעור, פיד, פרופיל.
// בנוסף: מסנכרן לאפליקציה את הסיכומים מהשרת (שלי + של חברים מאותה כיתה) ואת ההתראות.
import { mdToHtml } from "./md.js";
import { INSTITUTIONS } from "./institutions.js";

export function initSocial(ctx) {
  const { view, $, esc, toast, prefs, store, api } = ctx;
  const VIS = { friends: "👥 כל החברים שלי", course_friends: "🎓 החברים שלי מהקורס", course: "🏫 כל מי שרשום לקורס", public: "🌍 כולם" };
  // הסבר קצר מתחת לכל אפשרות – שהכותב יידע בדיוק למי זה הולך
  const VIS_HINT = {
    friends: "רק מי שאישר/ת כחבר/ה",
    course_friends: "רק חברים שרשומים לקורס שבחרת",
    course: "כל מי שכתב את הקורס בפרופיל שלו – גם מי שלא מכיר/ה אותך. הרישום לקורס לא מאומת",
    public: "כל מי שמשתמש באפליקציה",
  };
  const UNIS = [...INSTITUTIONS, "אחר"];
  const COLORS = ["#DB2777", "#4649CF", "#16A34A", "#6D28D9", "#EA580C", "#0891B2", "#CA8A04", "#475569"];
  const color = (id = "") => COLORS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
  const people = new Map(); // מטמון פרופילים לפי id
  const meId = () => api.user()?.id;
  const nameOf = (id) => people.get(id)?.full_name?.trim() || (people.get(id)?.username ? "@" + people.get(id).username : "משתמש/ת");   // בלי שם מלא – שם המשתמש
  const unameOf = (id) => people.get(id)?.username || "";
  const AV_OK = /^https:\/\/islplhnlvaukixaglxof\.supabase\.co\/storage\/v1\/object\/public\/avatars\//;
  const avatar = (id, big = false) => { const u = people.get(id)?.avatar_url; return u && AV_OK.test(u) ? `<img class="av av-img${big ? " big" : ""}" src="${esc(u)}" alt="" loading="lazy">` : `<span class="av${big ? " big" : ""}" style="background:${color(id)}" aria-hidden="true">${esc((people.get(id)?.full_name || "?")[0])}</span>`; };
  const when = (t) => new Date(t).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const myCourses = () => prefs.get()?.courses || api.profile()?.courses || [];
  // קישור בטוח – כמו הבדיקה בשרת: https, בלי פורט ובלי סיסמה, הדומיין עצמו או תת-דומיין אחד בלבד (www.instagram.com)
  const safeLink = (url, host) => { try {
    const u = new URL(url), h = u.hostname, sub = h.endsWith("." + host) ? h.slice(0, -(host.length + 1)) : null;
    const hostOk = h === host || (sub !== null && /^[a-z0-9-]+$/.test(sub));
    return u.protocol === "https:" && !u.username && !u.password && !u.port && hostOk ? u.href : "";
  } catch { return ""; } };
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
  function signup(mode = "signup", notice = "") {
    const isUp = mode === "signup";
    view.innerHTML = `<div class="page" style="max-width:560px">
      <a class="back-btn" href="welcome/">→ חזרה לדף הפתיחה</a>
      ${notice ? `<p class="notice alert" role="alert">${esc(notice)}</p>` : ""}
      <p class="eyebrow">ברוכים הבאים ל-Clearly</p>
      <h1 style="font-size:30px">${isUp ? "יצירת חשבון" : "כניסה לחשבון"}</h1>
      ${isUp ? '<p class="muted"><b>Early Access:</b> Clearly נפתח בהדרגה. נרשמים עכשיו, וכשמגיע התור שלך מקבלים מייל ונכנסים.</p>' : ""}
      <form id="sgForm" class="card" style="display:grid;gap:12px" novalidate>
        ${isUp ? `<label>שם משתמש (ייחודי – ככה חברים ימצאו אותך)<input id="sgUser" required autocomplete="username" dir="ltr" placeholder="guy_s" autocapitalize="none"></label>
        <span class="small muted" id="sgUserHint">אותיות באנגלית, מספרים, _ ונקודה</span>
        <label>שם מלא<input id="sgName" required autocomplete="name"></label>
        <label>מוסד לימודים<select id="sgUni">${UNIS.map((u) => `<option>${u}</option>`).join("")}</select></label>
        <label>תואר ושנה<input id="sgDeg" placeholder="למשל: כלכלה ומנהל, שנה א"></label>` : ""}
        <label>${isUp ? "מייל אישי – להתחברות ולשחזור סיסמה" : "המייל האישי שאיתו נרשמת"}<input id="sgMail" type="email" required dir="ltr" autocomplete="email" placeholder="name@gmail.com"></label>
        ${isUp ? `<label>מייל של מוסד הלימודים – לאימות ולחיבור למודל<input id="sgUniMail" type="email" required dir="ltr" autocomplete="off" placeholder="name@msmail.ariel.ac.il"></label>
        <span class="small muted">המייל של המוסד לא מוצג לאף אחד. מיילים מאיתנו (כמו שחזור סיסמה) מגיעים למייל האישי.</span>` : ""}
        <label>סיסמה${isUp ? " (8 תווים לפחות)" : ""}<input id="sgPass" type="password" required ${isUp ? 'minlength="8"' : ""} autocomplete="${isUp ? "new-password" : "current-password"}"></label>
        ${isUp ? '<label>אימות סיסמה – אותה סיסמה שוב<input id="sgPass2" type="password" required minlength="8" autocomplete="new-password"></label>' : ""}
        ${isUp ? `<label>יום הולדת (לא חובה – חברים יקבלו תזכורת)<input id="sgBday" type="date"></label>
        <details class="sg-links"><summary>רשתות חברתיות (לא חובה)</summary>
          <p class="small muted">מה שתמלאו יופיע כאייקון קטן בפרופיל. אפשר גם להוסיף או לשנות אחר כך ב"עריכת פרופיל".</p>
          <label>אינסטגרם<input id="sgIg" type="url" dir="ltr" autocomplete="off" placeholder="https://instagram.com/..."></label>
          <label>לינקדאין<input id="sgLi" type="url" dir="ltr" autocomplete="off" placeholder="https://linkedin.com/in/..."></label>
          <label>Solution (הרשת של הסטארטאפים)<input id="sgSol" type="url" dir="ltr" autocomplete="off" placeholder="https://www.solution.community/..."></label>
        </details>
        <label class="row" style="gap:8px;align-items:flex-start"><input type="checkbox" id="sgTerms" style="width:auto;margin-top:6px"><span class="small">זו <b>גרסת בדיקה</b>. אני מסכים/ה ל<a href="#legal-terms" target="_blank">תנאי השימוש</a> ול<a href="#legal-privacy" target="_blank">מדיניות הפרטיות</a>: הפרופיל, החברים, ההודעות והסיכומים נשמרים בשרת מאובטח באירופה. משתפים רק סיכומים שלי, לא קבצים של מרצים.</span></label>` : ""}
        <button class="btn" type="submit" id="sgGo">${isUp ? "יצירת חשבון" : "כניסה"}</button>
        ${isUp ? "" : `<button class="btn ghost" type="button" id="sgReset">שכחתי סיסמה</button>
        <a href="#" class="small" id="sgHaveCode">יש לי קוד מהמייל</a>
        <div id="sgCodeBox" class="code-box" hidden>
          <label>הקוד מהמייל<input id="sgCode" inputmode="numeric" autocomplete="one-time-code" dir="ltr" maxlength="12" placeholder="123456"></label>
          <button class="btn" type="button" id="sgCodeGo">אישור הקוד</button>
          <p class="small muted" style="margin:0">הקוד נמצא במייל האחרון ששלחנו, מעל הכפתור. הוא עובד פעם אחת.</p>
        </div>`}
      </form>
      <p style="text-align:center"><a href="#" id="sgSwitch">${isUp ? "כבר יש לי חשבון – כניסה" : "אין לי חשבון – הרשמה"}</a></p></div>`;
    $("#sgSwitch").onclick = (e) => { e.preventDefault(); signup(isUp ? "login" : "signup"); };
    if (isUp) {
      let t;
      $("#sgUser").oninput = () => {
        const v = $("#sgUser").value.trim().toLowerCase(); clearTimeout(t);
        if (!/^[a-z0-9_.]{3,20}$/.test(v)) { $("#sgUserHint").textContent = v ? "3–20 תווים: אותיות באנגלית, מספרים, _ ונקודה" : "אותיות באנגלית, מספרים, _ ונקודה"; return; }
        // הבדיקה יכולה לחזור אחרי שכבר עברו מסך (נרשמו מהר) – אז אין איפה לכתוב, ולא כותבים
        const hint = (s) => { const h = $("#sgUserHint"); if (h) h.textContent = s; };
        t = setTimeout(async () => { try { hint((await api.usernameFree(v)) ? "✅ פנוי" : "❌ השם הזה תפוס או שמור – בחרו שם אחר"); } catch (e) { hint(e.message); } }, 400);
      };
    } else {
      // שכחתי סיסמה: לחיצה אחת שולחת מייל אחד. הכפתור ננעל לדקה – כי כל מייל חדש מבטל את הקישור של הקודם
      $("#sgReset").onclick = async () => {
        const bt = $("#sgReset"), m = $("#sgMail").value.trim(); if (!m) return toast("כתבו קודם את המייל");
        if (bt.disabled) return; bt.disabled = true;
        try {
          await api.resetPassword(m);
          toast("שלחנו מייל לאיפוס. פתחו את המייל האחרון – או הקלידו כאן את הקוד שבו");
          $("#sgCodeBox").hidden = false; $("#sgCode").focus();
          let left = 60; bt.textContent = `נשלח ✓ (שוב בעוד ${left})`;
          const t = setInterval(() => { left--; if (!document.body.contains(bt)) return clearInterval(t); if (left <= 0) { clearInterval(t); bt.disabled = false; bt.textContent = "שכחתי סיסמה"; } else bt.textContent = `נשלח ✓ (שוב בעוד ${left})`; }, 1000);
        } catch (e) { bt.disabled = false; toast(e.message); }
      };
    }
    if (!isUp) {
      $("#sgHaveCode").onclick = (e) => { e.preventDefault(); $("#sgCodeBox").hidden = false; $("#sgCode").focus(); };
      // הקוד מהמייל → נכנסים, ומיד בוחרים סיסמה חדשה
      $("#sgCodeGo").onclick = async () => {
        const m = $("#sgMail").value.trim(), c = $("#sgCode").value.replace(/\D/g, "");
        if (!m) return toast("כתבו קודם את המייל");
        if (c.length < 6) return toast("הקלידו את הקוד מהמייל");
        const bt = $("#sgCodeGo"); bt.disabled = true;
        try {
          await api.verifyRecoveryCode(m, c);
          restorePrefs();
          if (location.hash === "#home") dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "#home";
          setTimeout(() => newPasswordModal(), 900);
        } catch (err) { toast(err.message); bt.disabled = false; }
      };
      $("#sgCode").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("#sgCodeGo").click(); } };
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
          const uniMail = $("#sgUniMail").value.trim().toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new Error("כתבו מייל אישי תקין (למשל ג'ימייל)");
          if (/\.ac\.il$/i.test(mail)) throw new Error("בשדה הראשון כותבים את המייל האישי (למשל ג'ימייל). את המייל של המוסד – בשדה השני");
          if (!/^[^@\s]+@[^@\s]+\.ac\.il$/i.test(uniMail)) throw new Error("המייל של מוסד הלימודים צריך להיגמר ב-ac.il");
          // רשתות – לא חובה, אבל מה שמולא חייב להיות קישור אמיתי לאתר הנכון
          const LNK = [["sgIg", "instagram.com", "ig", "קישור אינסטגרם צריך להתחיל ב-https://instagram.com"], ["sgLi", "linkedin.com", "li", "קישור לינקדאין צריך להתחיל ב-https://linkedin.com"], ["sgSol", "solution.community", "solution", "קישור Solution צריך להתחיל ב-https://www.solution.community"]];
          const links = {};
          for (const [id, host, k, msg] of LNK) { const v = $("#" + id).value.trim(); if (!v) continue; const ok = safeLink(v, host); if (!ok) { $(".sg-links").open = true; $("#" + id).focus(); throw new Error(msg); } links[k] = ok; }
          if (!$("#sgTerms").checked) throw new Error("צריך לאשר את התנאים");
          // לפני שנוצר חשבון: השם פנוי, והסיסמה ארוכה מספיק ולא דלפה. מייל כפול – השרת חוסם ("כבר יש חשבון")
          if (!(await api.usernameFree(u))) throw new Error("שם המשתמש תפוס או שמור – בחרו שם אחר");
          await api.checkPassword(pass, $("#sgPass2").value);
          await api.signUp({ email: mail, password: pass, username: u, full_name: name, uni: $("#sgUni").value, degree: $("#sgDeg").value.trim(), birthday: $("#sgBday").value, uni_email: uniMail, links });
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
    prefs.set({ ...p.learn, name: p.full_name.split(" ")[0], inst: p.uni, studyYear: p.study_year || null, courses: p.courses || [], createdAt: p.created_at });
  }
  // השאלון והקורסים נשמרים גם בשרת (בשביל הסיכומים האישיים)
  async function pushPrefs() {
    const p = prefs.get(); if (!p || !api.user()) return;
    const learn = Object.fromEntries(["style", "length", "tone", "hard", "quiz"].filter((k) => p[k]).map((k) => [k, p[k]]));
    if (p.levels && Object.keys(p.levels).length) learn.levels = p.levels;   // רמת קושי 1-5 לכל קורס (לסיכומים ולמבחנים בשרת)
    // שנת הלימודים נשלחת רק אם נבחרה (לא מוחקים שנה ששמורה בשרת)
    const extra = p.studyYear ? { study_year: p.studyYear } : {};
    try { await api.updateMe({ learn, courses: (p.courses || []).slice(0, 40), ...extra }); } catch { /* ננסה בפעם הבאה */ }
  }

  // ---------- גיבוי לשרת של סיכומים שנמצאים רק במכשיר ----------
  // HTML של סיכום ← Markdown (השרת שומר Markdown, והאפליקציה מציגה אותו בכל מכשיר)
  function summaryHtmlToMd(html) {
    const d = document.createElement("div"); d.innerHTML = html || "";
    const inline = (n) => [...n.childNodes].map((c) => c.nodeType === 3 ? c.textContent
      : ["B", "STRONG"].includes(c.nodeName) ? `**${inline(c).trim()}**` : ["I", "EM"].includes(c.nodeName) ? `*${inline(c).trim()}*`
      : c.nodeName === "BR" ? "\n" : c.nodeName === "CODE" ? "`" + c.textContent + "`" : c.nodeType === 1 ? inline(c) : "").join("");
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        const t = c.nodeName;
        if (/^H[1-6]$/.test(t)) out.push("#".repeat(Math.min(+t[1], 4)) + " " + inline(c).trim());
        else if (t === "P") out.push(inline(c).trim());
        else if (t === "UL" || t === "OL") out.push([...c.children].map((li, i) => (t === "OL" ? `${i + 1}. ` : "- ") + inline(li).replace(/\s*\n\s*/g, " ").trim()).join("\n"));
        else if (t === "TABLE") {
          const rows = [...c.querySelectorAll("tr")].map((tr) => [...tr.children].map((td) => inline(td).replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")));
          if (rows.length) out.push([`| ${rows[0].join(" | ")} |`, `|${" --- |".repeat(rows[0].length)}`, ...rows.slice(1).map((r) => `| ${r.join(" | ")} |`)].join("\n"));
        } else if (t === "BLOCKQUOTE") out.push("> " + inline(c).trim());
        else if (t === "HR") out.push("---");
        else if (c.children.length) walk(c);
        else { const x = inline(c).trim(); if (x) out.push(x); }
      }
    };
    walk(d);
    return out.filter(Boolean).join("\n\n");
  }
  const normT = (t) => String(t || "").replace(/[\s"'״׳–-]+/g, " ").trim().toLowerCase();
  async function backupLocal(local, rows, mine) {
    const refs = new Set(rows.map((r) => r.source_ref).filter(Boolean));
    const titles = new Set(rows.filter((r) => r.owner === mine).map((r) => normT(r.title)));
    const quizzes = local.filter((x) => x.type === "quiz");
    let n = 0;
    for (const s of local) {
      if (s.type !== "summary" || s.id.startsWith("srv-") || s.from || s.demo || s.id.startsWith("demo")) continue;
      if (refs.has("local:" + s.id) || titles.has(normT(s.title))) continue;   // כבר בשרת
      const md = summaryHtmlToMd(s.html); if (!md) continue;
      const q = (quizzes.find((x) => x.summaryId === s.id)?.questions || []).filter((x) => x?.q && Array.isArray(x.options));
      await api.backupSummary({ ref: ("local:" + s.id).slice(0, 256), course: s.course || "כללי", title: s.title || "סיכום", md: md.slice(0, 300000), date: /^\d{4}-\d{2}-\d{2}/.test(s.date || "") ? s.date.slice(0, 10) : null, quiz: q });
      n++;
    }
    return n;
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
      await store.putItem({ id, type: "summary", course: r.course || "כללי", title: r.title, date: r.created_at.slice(0, 10), html: mdToHtml(r.md), from, fromId: from ? r.owner : null, server: true, ref: r.source_ref || null, ...(/^דף נוסחאות/.test(r.title || "") ? { kind: "formulas" } : {}),
        source: r.source_ref?.startsWith("rec:") ? "recording" : r.source, lessonDate: rec?.startedAt?.slice(0, 10) || (r.source_ref?.startsWith("rec:") ? r.created_at.slice(0, 10) : null) });
      if (Array.isArray(r.quiz) && r.quiz.length) {
        const qid = "srvq-" + r.id; keep.add(qid);
        await store.putItem({ id: qid, type: "quiz", summaryId: id, course: r.course || "כללי", title: r.title, questions: r.quiz.filter((q) => q?.q && Array.isArray(q.options)), from });
      }
    }
    // סיכומים שנמצאים רק במכשיר (למשל מיובאים מ-Drive) נשמרים גם בשרת: לא הולכים לאיבוד ומופיעים בכל מכשיר
    try { await backupLocal(local, rows, mine); } catch { /* ננסה בסנכרון הבא */ }
    // מה שנמחק בשרת (או ששיתוף בוטל) – יורד גם מהמכשיר
    for (const x of local) if ((x.id.startsWith("srv-") || x.id.startsWith("srvq-")) && !keep.has(x.id)) await store.deleteItem(x.id);
    return fresh;
  }

  // ---------- סנכרון: התראות מהשרת -> תיבת ההודעות (🔔) ----------
  const NOTE = {
    friend_request: (n) => ({ icon: "👋", title: `${nameOf(n.actor)} שלח/ה לך בקשת חברות`, body: "לאישור בפרופיל", link: "#social-friends" }),
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
      if (ex) { ex.kind ??= n.kind; if (ex.read && !n.read_at) readBack.push(n.id); continue; }
      const item = { id, kind: n.kind, ...f(n), at: n.created_at, read: !!n.read_at };
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
      ${p.title ? `<h2 style="font-size:18px;margin:0">${p.md ? "📄 " : ""}${esc(p.title)}</h2>` : ""}${p.body ? `<p class="post-body">${esc(p.body)}</p>` : ""}
      ${mediaHtml(p, d)}
      ${p.md ? `<details><summary class="small"><b>לקריאת הסיכום</b></summary><div class="md-body" style="margin-top:8px">${mdToHtml(p.md)}</div></details>` : ""}
      <div class="post-a"><button type="button" data-like aria-pressed="${liked}">${liked ? "❤️" : "🤍"} <bdi>${nLikes}</bdi></button>
        <button type="button" data-cmt>💬 <bdi>${cmts.length}</bdi></button>
        <button type="button" data-save aria-pressed="${saved}">${saved ? "🔖 נשמר" : "🔖 שמירה"}</button></div>
      <div class="post-c" hidden>${cmts.map((c) => `<p class="small cmt"><span><b>${esc(nameOf(c.author))}:</b> ${esc(c.body)}</span>${c.author === meId() ? "" : `<button class="link" type="button" data-crep="${c.id}" data-who="${c.author}" aria-label="דיווח על התגובה">⚠️</button>`}</p>`).join("")}
        <form class="cmt-form" data-cform><input type="text" placeholder="הוספת תגובה…" aria-label="תגובה" maxlength="500" enterkeyhint="send"><button class="btn" type="submit">שליחה</button></form></div>
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
  // 3 הפוסטים האחרונים – לדף הראשי (עם לייק/תגובה, כמו בפיד)
  async function latestPosts(el, n = 3) {
    const d = await feedData(); d.ps = d.ps.slice(0, n);
    if (d.ps.length) renderPosts(el, d, () => latestPosts(el, n));
    return d.ps.length;
  }
  async function feed() {
    busy();
    try {
      const [d, bd] = await Promise.all([feedData(), api.birthdays()]);
      const today = new Date().toLocaleDateString("en-CA").slice(5);
      const midnight = new Date(new Date().toDateString());
      const soon = bd.filter((b) => { const n = (new Date(midnight.getFullYear() + "-" + b.birthday.slice(5) + "T00:00") - midnight) / 864e5; return n > 0 && n <= 7; });
      view.innerHTML = `<div class="page"><h1 class="vh">הפיד שלי</h1>${subnav("social")}
        ${bd.filter((b) => b.birthday.slice(5) === today).map((b) => `<div class="bday"><span>🎂 היום יום ההולדת של <b>${esc(b.full_name)}</b>!</span><a class="btn ghost" href="#dm-${esc(b.username)}">שליחת ברכה</a></div>`).join("")}
        ${soon.length ? `<p class="small muted">🎈 ימי הולדת בשבוע הקרוב: ${soon.map((b) => esc(b.full_name)).join(", ")}</p>` : ""}
        <button class="btn" type="button" id="newPost">➕ פוסט חדש</button>
        <div class="feed" id="feed"></div></div>`;
      renderPosts($("#feed"), d, feed);
      $("#newPost").onclick = publishModal;
    } catch (e) { fail(e); }
  }

  // ---------- סיסמה חדשה (אחרי הקישור "שכחתי סיסמה" במייל) ----------
  function newPasswordModal() {
    const m = modal(`<h2>בחירת סיסמה חדשה</h2>
      <p class="small muted">לפחות 8 תווים. נבדוק גם שהיא לא דלפה ברשת.</p>
      <label>סיסמה חדשה<input type="password" id="npPass" autocomplete="new-password" minlength="8"></label>
      <label>אימות סיסמה – אותה סיסמה שוב<input type="password" id="npPass2" autocomplete="new-password" minlength="8"></label>
      <div class="row"><button class="btn" type="button" id="npGo">שמירה</button></div>`);
    $("#npGo", m).onclick = async () => {
      $("#npGo", m).disabled = true;
      try { await api.changePassword($("#npPass", m).value, $("#npPass2", m).value); m.remove(); toast("הסיסמה עודכנה ✓ את/ה מחובר/ת"); }
      catch (e) { toast(e.message); $("#npGo", m).disabled = false; }
    };
  }

  // ---------- חלונות ----------
  function modal(html) {
    document.getElementById("socModal")?.remove();
    const back = document.activeElement;
    document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="socModal" role="dialog" aria-modal="true"><div class="card">${html}</div></div>`);
    const m = document.getElementById("socModal");
    const h = m.querySelector("h2"); if (h) { h.id = "socModalT"; m.setAttribute("aria-labelledby", "socModalT"); }
    const close = () => { m.remove(); document.removeEventListener("keydown", esc_); back?.focus?.(); };
    // Esc סוגר – אבל לא חלון שכבר כתבו בו משהו (שטיוטה של פוסט לא תימחק)
    function esc_(e) { if (e.key === "Escape" && document.body.contains(m) && ![...m.querySelectorAll("textarea, input[type=text], input:not([type])")].some((x) => x.value.trim() && x.defaultValue !== x.value)) close(); }
    document.addEventListener("keydown", esc_);
    m.onclick = (e) => { if (e.target === m || e.target.closest("[data-x]")) close(); };
    setTimeout(() => m.querySelector("button, input, select, textarea, a[href]")?.focus(), 0);
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
      <fieldset class="vis"><legend>מי יראה?</legend>${Object.entries(VIS).map(([k, l]) => `<label><input type="radio" name="vis" value="${k}" ${k === def ? "checked" : ""}> ${l}<br><span class="small muted">${VIS_HINT[k]}</span></label>`).join("")}</fieldset>
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
      const vis = $('input[name="vis"]:checked', m).value;
      if ((vis === "course" || vis === "course_friends") && !($("#pbCourse", m).value || sm?.course)) return toast("בחרו לאיזה קורס הפוסט");
      $("#pbGo", m).disabled = true; $("#pbGo", m).textContent = "מעלה…";
      try {
        const post = { course: $("#pbCourse", m).value || sm?.course || "", title: sm ? sm.title.slice(0, 200) : "", body, md: sm ? htmlToMd(sm.html).slice(0, 20000) : "", visibility: vis };
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
      ${courses.length > 1 ? `<div class="row" style="justify-content:flex-start;margin:0 0 6px"><button class="btn ghost small-btn" id="shAll" type="button">בחר הכל</button></div>` : ""}
      <fieldset class="vis"><legend>הקורסים שלי לשתף</legend>${courses.map((c) => `<label><input type="checkbox" value="${esc(c)}" ${mine.includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("") || '<p class="small muted">אין לך קורסים ברשימה (הגדרות ← לימודים)</p>'}</fieldset>
      <div class="row"><button class="btn" id="shGo" type="button">שמירה</button><button class="btn ghost" data-x type="button">אחר כך</button></div>`);
    // "בחר הכל": מסמן את כל הקורסים בלחיצה אחת (וכשהכול מסומן – "נקה הכל")
    const boxes = [...m.querySelectorAll("fieldset input[type=checkbox]")], allBtn = $("#shAll", m);
    const paintAll = () => { if (allBtn) allBtn.textContent = boxes.every((b) => b.checked) ? "נקה הכל" : "בחר הכל"; };
    if (allBtn) { paintAll(); allBtn.onclick = () => { const on = !boxes.every((b) => b.checked); boxes.forEach((b) => (b.checked = on)); paintAll(); }; boxes.forEach((b) => b.addEventListener("change", paintAll)); }
    $("#shGo", m).onclick = async () => {
      const want = [...m.querySelectorAll("fieldset input:checked")].map((i) => i.value);
      try {
        for (const c of want.filter((c) => !mine.includes(c))) await api.share(friendId, c);
        for (const c of mine.filter((c) => !want.includes(c))) await api.unshare(friendId, c);
        m.remove(); toast(want.length ? "השיתוף נשמר ✓" : "השיתוף בוטל"); api.track("share");
        syncSummaries().catch(() => {});
        if ($("#profFriends")) friends($("#profFriends"));
        else if ($("#friendsOnly")) friendsListPage(true);   // "רק החברים" נשאר רק חברים
      } catch (e) { toast(e.message); }
    };
  }

  // ---------- חברים ----------
  async function friends(host = null) {
    if (!host) { location.hash = "#social-friends"; return; }
    const again = () => friends(host);
    try {
      const g = await graph();
      const row = (id, btns, sub = "") => `<div class="item">${avatar(id)}<a href="#u-${esc(unameOf(id))}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><span class="t">${esc(nameOf(id))}</span><br><span class="small muted"><span dir="ltr">@${esc(unameOf(id))}</span>${sub}</span></a>${btns}</div>`;
      const shareSub = (id) => { const a = g.iShare(id).length, b = g.theyShare(id).length; return a && b ? " · 🎓 אותה כיתה" : b ? " · 🎓 משתף/ת איתך – שתפו בחזרה" : a ? " · 🎓 מחכה שגם הוא/היא ישתף" : ""; };
      host.innerHTML = `${g.incoming.length ? `<section style="display:grid;gap:8px"><h2 style="font-size:18px;margin:0">🙋 בקשות חברות חדשות (${g.incoming.length})</h2>${g.incoming.map((f) => row(f.requester, `<button class="btn" data-ok="${f.id}" data-who="${f.requester}" type="button">אישור</button><button class="btn ghost" data-no="${f.id}" type="button">לא עכשיו</button>`)).join("")}</section>` : ""}
        <section class="soft" style="display:grid;gap:10px"><h2 style="font-size:18px;margin:0">הוספת חבר/ה</h2>
          <form class="fr-form" id="frForm"><input type="text" id="frQ" dir="ltr" placeholder="שם המשתמש של החבר/ה" aria-label="שם משתמש של החבר/ה" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send"><button class="btn" type="submit">➕ שליחת בקשה</button></form>
          <p class="small muted">החבר/ה צריך/ה לאשר. השם שלך: <b dir="ltr">@${esc(api.profile()?.username || "")}</b></p>
          <div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn" type="button" id="frShare">📨 הזמינו חברים ל-Clearly</button><span class="small muted">שולחים קישור אישי (בוואטסאפ או בהודעה). מי שנרשם דרכו שולח לך בקשת חברות, ואת/ה מאשר/ת.</span></div>
        </section>
        <section class="soft" id="frSuggest" style="display:grid;gap:8px"><p class="small muted" style="margin:0">טוען הצעות לחברים…</p></section>
        ${g.outgoing.length ? `<section style="display:grid;gap:8px"><h2 style="font-size:18px;margin:0">ממתינים לאישור</h2>${g.outgoing.map((f) => row(f.addressee, `<button class="btn ghost" data-no="${f.id}" type="button">ביטול</button>`)).join("")}</section>` : ""}
        <section style="display:grid;gap:8px"><h2 style="font-size:18px;margin:0">החברים שלי (${g.friends.length})</h2>${g.friends.map((f) => { const id = g.other(f); return row(id, `<button class="btn ghost" data-share="${id}" type="button" aria-label="אותה כיתה">🎓</button><a class="btn ghost" href="#dm-${esc(unameOf(id))}" aria-label="הודעה">💬</a>`, shareSub(id)); }).join("") || '<p class="muted small">עוד אין חברים. הוסיפו לפי שם משתמש 👆</p>'}</section>`;
      $("#frForm").onsubmit = async (e) => {
        e.preventDefault();
        const u = $("#frQ").value.trim().replace(/^@/, "").toLowerCase(); if (!u) return toast("כתבו קודם את שם המשתמש של החבר/ה");
        try {
          const p = await api.findUser(u);
          if (!p) return toast("לא מצאנו משתמש בשם הזה");
          if (p.id === meId()) return toast("זה את/ה 🙂");
          if (g.fr.some((f) => g.other(f) === p.id)) return toast("כבר חברים או שיש בקשה פתוחה");
          await api.requestFriend(p.id); people.set(p.id, p);
          toast(`הבקשה נשלחה ל${p.full_name}`); api.track("friend_request"); again();
        } catch (err) { toast(err.message); }
      };
      // אנשים שאולי תכירו (הסדר בשרת): קורס+מוסד+שנה, קורס+מוסד, קורס, מוסד, ואז כולם
      api.suggestPeople(30).then((list) => {
        const box = $("#frSuggest"); if (!box) return;
        if (!list.length) { box.remove(); return; }
        list.forEach((p) => people.set(p.id, { ...p, ...(people.get(p.id) || {}), avatar_url: p.avatar_url }));
        const why = (p) => p.same_uni && p.shared ? `${esc(p.uni)} · ${p.shared} ${p.shared === 1 ? "קורס משותף" : "קורסים משותפים"}` : p.same_uni ? esc(p.uni) : p.shared ? `${p.shared} ${p.shared === 1 ? "קורס משותף" : "קורסים משותפים"}` : esc(p.uni || "");
        box.innerHTML = `<h2 style="font-size:18px;margin:0">👋 אנשים שאולי תכירו</h2>${list.map((p) => `<div class="item">${avatar(p.id)}<a href="#u-${esc(p.username)}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><span class="t">${esc(p.full_name)}</span><br><span class="small muted">${why(p)}</span></a><button class="btn small-btn" type="button" data-sug="${esc(p.id)}" aria-label="שליחת בקשת חברות ל${esc(p.full_name)}">+ הוספה</button></div>`).join("")}`;
        box.querySelectorAll("[data-sug]").forEach((b) => (b.onclick = async () => {
          b.disabled = true;
          try { await api.requestFriend(b.dataset.sug); b.textContent = "✓ נשלחה בקשה"; toast("נשלחה בקשת חברות"); }
          catch (e) { b.disabled = false; toast(e.message); }
        }));
      }).catch(() => $("#frSuggest")?.remove());
      $("#frShare").onclick = () => {
        // קישור אישי: מי שנרשם דרכו שולח בקשת חברות אליך (מאושרת על ידך), בלי לקרוא אנשי קשר
        const url = `${location.origin}${location.pathname}?app=1&ref=${encodeURIComponent(api.profile()?.username || "")}`;
        const text = "היי! אני משתמש/ת ב-Clearly: סיכומים אוטומטיים מכל מה שבמודל, מבחנים ויומן שיעורים. הצטרפו דרך הקישור ונהיה חברים (כרגע בהרשמה מוקדמת):";
        if (navigator.share) navigator.share({ title: "Clearly", text, url }).catch(() => {});
        else { navigator.clipboard?.writeText(`${text}\n${url}`).then(() => toast("הקישור הועתק. אפשר להדביק בוואטסאפ"), () => toast(url)); }
        api.track("invite_share");
      };
      host.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => {
        try { await api.acceptFriend(+b.dataset.ok); toast("אתם חברים עכשיו 🙌"); await again(); shareModal(b.dataset.who); } catch (e) { toast(e.message); }
      }));
      host.querySelectorAll("[data-no]").forEach((b) => (b.onclick = async () => { try { await api.removeFriend(+b.dataset.no); again(); } catch (e) { toast(e.message); } }));
      host.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => shareModal(b.dataset.share, g)));
    } catch (e) { host.innerHTML = `<p class="notice alert">${esc(e.message || e)}</p>`; }
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
      view.innerHTML = `<div class="page" style="max-width:720px"><h1 class="vh">ההודעות שלי</h1>${subnav("messages")}
        <div class="row"><a class="btn ${box === "req" ? "ghost" : ""}" href="#messages">שיחות</a><a class="btn ghost" href="#groups" id="groupsBtn" hidden>👥 קבוצות</a><a class="btn ${box === "req" ? "" : "ghost"}" href="#messages-req">📥 לא מחברים${reqs.length ? ` (${reqs.length})` : ""}</a></div>
        ${box === "req" ? '<h2 style="font-size:20px;margin:0">הודעות מאנשים שאינם חברים שלך</h2><p class="small muted">הם לא יודעים שקראת עד שתענה/י. כדי לענות לוחצים "↩️ לענות", והשיחה עוברת להודעות הרגילות.</p>' : ""}
        <div class="list">${list.map(([o, ms]) => { const m = ms.at(-1), un = ms.some((x) => x.recipient === me && !x.read_at); return box === "req" ? `<div class="item">${avatar(o)}<a href="#u-${esc(unameOf(o))}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><span class="t">${esc(nameOf(o))}</span><br><span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(plainBody(m.body))}</span></a><button class="btn small-btn" type="button" data-reply="${esc(o)}" data-u="${esc(unameOf(o))}">↩️ לענות</button></div>` : `<a class="item" href="#dm-${esc(unameOf(o))}">${avatar(o)}<span style="flex:1;min-width:0"><span class="t">${esc(nameOf(o))}</span>${un ? ' <span class="chip new">חדש</span>' : ""}<br><span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.sender === me ? "את/ה: " : ""}${esc(plainBody(m.body))}</span></span><span class="small muted">${when(m.created_at)}</span></a>`; }).join("") || `<p class="muted">${box === "req" ? "אין הודעות מאנשים שהם לא חברים" : "אין כאן הודעות"}</p>`}</div>
        ${box === "req" ? "" : `<section class="soft"><div class="row" style="justify-content:space-between"><h2 style="font-size:18px;margin:0">הודעה חדשה לחבר/ה</h2><button class="tool" type="button" id="dmFind" aria-label="חיפוש מישהו לשלוח לו הודעה" aria-expanded="false">🔍</button></div>
          <div id="dmFindBox" hidden style="margin-top:8px"><input type="search" id="dmFindQ" placeholder="שם או @שם משתמש" aria-label="חיפוש לפי שם" autocomplete="off" autocapitalize="none" spellcheck="false"><div class="list" id="dmFindRes" style="margin-top:8px"></div></div><div class="stories" style="margin-top:8px">${[...t.friendIds].map((id) => `<a class="story" href="#dm-${esc(unameOf(id))}">${avatar(id)}<span class="small">${esc(nameOf(id).split(" ")[0])}</span></a>`).join("") || '<p class="small muted">עוד אין חברים</p>'}</div><p class="small muted">לוחצים על 🔍 ומחפשים כל אחד לפי שם, גם מי שאינו חבר.</p></section>`}</div>`;
      // ↩️ לענות למי שאינו חבר: השיחה עוברת להודעות הרגילות
      view.querySelectorAll("[data-reply]").forEach((b) => (b.onclick = async () => { try { await api.acceptChat(b.dataset.reply); location.hash = "#dm-" + b.dataset.u; } catch (e) { toast(e.message); } }));
      // 🔍 חיפוש כל משתמש לפי שם – ושולחים לו הודעה (גם אם אינו חבר; אצלו זה נכנס ל"לא מחברים")
      if ($("#dmFind")) {
        $("#dmFind").onclick = () => { const bx = $("#dmFindBox"); bx.hidden = !bx.hidden; $("#dmFind").setAttribute("aria-expanded", String(!bx.hidden)); if (!bx.hidden) $("#dmFindQ").focus(); };
        let tm = 0;
        $("#dmFindQ").oninput = () => { clearTimeout(tm); tm = setTimeout(async () => {
          const q = $("#dmFindQ").value.trim(), res = $("#dmFindRes"); if (!res) return;
          if (q.replace(/^@/, "").length < 2) { res.innerHTML = ""; return; }
          try {
            const list = await api.searchPeople(q); list.forEach((p) => people.set(p.id, { ...(people.get(p.id) || {}), ...p }));
            res.innerHTML = list.map((p) => `<a class="item" href="#dm-${esc(p.username)}">${avatar(p.id)}<span style="flex:1;min-width:0"><span class="t">${esc(p.full_name)}</span>${t.friendIds.has(p.id) ? ' <span class="chip ok">חבר/ה</span>' : ""}<br><span class="small muted"><span dir="ltr">@${esc(p.username)}</span>${p.uni ? " · " + esc(p.uni) : ""}</span></span><span class="small go">💬</span></a>`).join("") || '<p class="small muted">לא מצאנו אף אחד בשם הזה</p>';
          } catch (e) { res.innerHTML = `<p class="small muted">${esc(e.message)}</p>`; }
        }, 300); };
      }
      // כפתור הקבוצות מופיע רק כשהקבוצות באמת קיימות בשרת
      groupsReady().then((ok) => { const b = $("#groupsBtn"); if (b) b.hidden = !ok; });
    } catch (e) { fail(e); }
  }
  // ---------- 👥 קבוצות (כמו וואטסאפ) + קבוצת כיתה לכל קורס ----------
  // מי שלא בקבוצה רואה רק: שם, מנהל/ת וכמה חברים – לא את רשימת החברים. נכנסים בבקשה שהמנהל/ת מאשר/ת.
  // עד שהטבלאות של הקבוצות נוצרות בשרת – הודעה ידידותית במקום שגיאה טכנית
  const notReady = (e) => /PGRST202|Could not find the function|schema cache/i.test(String(e?.message || e) + (e?.code || ""));
  let groupsOk = null;
  async function groupsReady() { if (groupsOk !== null) return groupsOk; try { await api.groupDirectory(); groupsOk = true; } catch (e) { groupsOk = !notReady(e); } return groupsOk; }
  const soon = () => { view.innerHTML = `<div class="page" style="max-width:720px"><h1 class="vh">קבוצות</h1>${subnav("messages")}<section class="card" style="text-align:center"><span style="font-size:42px">👥</span><h2>קבוצות – בקרוב</h2><p class="muted">עוד רגע אפשר יהיה לפתוח קבוצות עם חברים ולהצטרף לקבוצת הכיתה.</p><a class="btn ghost" href="#messages">חזרה להודעות</a></section></div>`; };
  async function groups() {
    busy();
    try {
      let all;
      try { all = await api.groupDirectory(); groupsOk = true; } catch (e) { if (notReady(e)) { groupsOk = false; return soon(); } throw e; }
      const mine = all.filter((g) => g.am_member);
      const myCourses = prefs.get()?.courses || [];
      const classFor = (c) => all.filter((g) => g.kind === "class" && g.course === c);
      const row = (g) => `<a class="item" href="#g-${esc(g.id)}"><span class="av" style="background:${color(g.id)}" aria-hidden="true">${g.kind === "class" ? "🎓" : "👥"}</span><span style="flex:1;min-width:0"><span class="t">${esc(g.name)}</span><br><span class="small muted">${g.last_body ? esc(g.last_body.slice(0, 60)) : `${g.member_count} חברים`}</span></span>${g.unread ? `<span class="chip new">${g.unread}</span>` : ""}</a>`;
      const joinBtn = (g) => g.am_member ? `<a class="btn ghost small-btn" href="#g-${esc(g.id)}">לקבוצה</a>` : g.requested ? '<span class="chip">⏳ ממתין לאישור</span>' : `<button class="btn small-btn" type="button" data-join="${esc(g.id)}">בקשה להצטרף</button>`;
      view.innerHTML = `<div class="page" style="max-width:720px"><h1 class="vh">קבוצות</h1>${subnav("messages")}
        <div class="row"><a class="btn ghost" href="#messages">שיחות</a><a class="btn" href="#groups">👥 קבוצות</a></div>
        <button class="btn" type="button" id="newGroup">➕ קבוצה חדשה</button>
        <section><h2 style="font-size:20px">הקבוצות שלי</h2><div class="list" style="margin-top:8px">${mine.map(row).join("") || '<p class="muted">עוד אין לך קבוצות. פותחים קבוצה עם חברים, או מצטרפים לקבוצת הכיתה למטה.</p>'}</div></section>
        <section><h2 style="font-size:20px">🎓 קבוצות הכיתה בקורסים שלי</h2><p class="small muted">רואים רק את שם הקבוצה, מי מנהל/ת אותה וכמה חברים בה. כדי להיכנס – שולחים בקשה למנהל/ת.</p>
          <div class="list" style="margin-top:8px">${myCourses.map((c) => { const gs = classFor(c); return gs.length ? gs.map((g) => `<div class="item"><span class="av" style="background:${color(g.id)}" aria-hidden="true">🎓</span><span style="flex:1;min-width:0"><span class="t">${esc(g.name)}</span><br><span class="small muted">מנהל/ת: ${esc(g.admin_name)} · 👥 ${g.member_count} בקבוצה</span></span>${joinBtn(g)}</div>`).join("") : `<div class="item"><span class="av" style="background:var(--grid)" aria-hidden="true">🎓</span><span style="flex:1;min-width:0"><span class="t">${esc(c)}</span><br><span class="small muted">עוד אין קבוצת כיתה לקורס הזה</span></span><button class="btn ghost small-btn" type="button" data-newclass="${esc(c)}">➕ לפתוח</button></div>`; }).join("")}</div></section></div>`;
      view.querySelectorAll("[data-join]").forEach((b) => (b.onclick = async () => { try { await api.groupRequest(b.dataset.join); toast("הבקשה נשלחה למנהל/ת הקבוצה"); groups(); } catch (e) { toast(e.message); } }));
      const create = (course = "") => {
        const t = graphCache;
        const m = modal(`<h2>${course ? "🎓 קבוצת כיתה חדשה" : "👥 קבוצה חדשה"}</h2>
          <label>שם הקבוצה<input id="gName" maxlength="60" value="${esc(course)}"></label>
          ${course ? `<p class="small muted">קבוצת כיתה לקורס <b>${esc(course)}</b>. כל מי שלומד את הקורס יראה אותה ויוכל לבקש להצטרף. את/ה המנהל/ת.</p>` : `<fieldset class="vis"><legend>מי בקבוצה?</legend>${(t?.friendIds || []).map((id) => `<label class="row small" style="gap:8px"><input type="checkbox" value="${esc(id)}" style="width:auto"> ${esc(nameOf(id))}</label>`).join("") || '<p class="small muted">עוד אין לך חברים. אפשר לפתוח קבוצה ולהוסיף אחר כך.</p>'}</fieldset>`}
          <div class="row"><button class="btn" type="button" id="gGo">יצירה</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
        $("#gGo", m).onclick = async () => {
          const name = $("#gName", m).value.trim(); if (!name) return toast("כתבו שם לקבוצה");
          try { const id = await api.groupCreate({ name, kind: course ? "class" : "group", course: course || null, members: [...m.querySelectorAll("input[type=checkbox]:checked")].map((x) => x.value) }); m.remove(); location.hash = "g-" + id; } catch (e) { toast(e.message); }
        };
      };
      let graphCache = null;
      graph().then(async (g) => { const me = meId(); const ids = g.friends.map((f) => (f.requester === me ? f.addressee : f.requester)); await remember(ids).catch(() => {}); graphCache = { ...g, friendIds: ids }; }).catch(() => {});
      $("#newGroup").onclick = () => create();
      view.querySelectorAll("[data-newclass]").forEach((b) => (b.onclick = () => create(b.dataset.newclass)));
    } catch (e) { fail(e); }
  }
  async function group(id) {
    busy();
    try {
      let g;
      try { g = await api.groupView(id); } catch (e) { if (notReady(e)) return soon(); throw e; }
      if (!g) { view.innerHTML = '<div class="page"><p>הקבוצה לא נמצאה.</p><a class="btn ghost" href="#groups">לקבוצות</a></div>'; return; }
      const me = meId();
      if (!g.am_member) {
        view.innerHTML = `<div class="page" style="max-width:720px"><section class="card" style="display:grid;gap:10px;text-align:center"><span style="font-size:42px">${g.kind === "class" ? "🎓" : "👥"}</span><h1 style="font-size:26px">${esc(g.name)}</h1>
          <p class="muted">מנהל/ת: <b>${esc(g.admin_name)}</b> · 👥 ${g.member_count} בקבוצה</p><p class="small muted">את רשימת החברים וההודעות רואים רק אחרי שמצטרפים.</p>
          ${g.requested ? '<span class="chip" style="justify-self:center">⏳ הבקשה ממתינה לאישור</span>' : '<button class="btn" type="button" id="gJoin" style="justify-self:center">בקשה להצטרף</button>'}</section></div>`;
        $("#gJoin") && ($("#gJoin").onclick = async () => { await api.groupRequest(id); toast("הבקשה נשלחה"); group(id); });
        return;
      }
      await remember([...g.members.map((x) => x.user_id), ...g.messages.map((x) => x.sender), ...g.requests.map((x) => x.user_id)]);
      const isAdmin = g.admin === me;
      view.innerHTML = `<div class="page dm" style="max-width:720px"><h1 class="vh">${esc(g.name)}</h1>
        <div class="row" style="justify-content:space-between"><span class="row"><span class="av" style="background:${color(g.id)}" aria-hidden="true">${g.kind === "class" ? "🎓" : "👥"}</span><span><b>${esc(g.name)}</b><br><span class="small muted">👥 ${g.member_count} · ${g.members.slice(0, 4).map((x) => esc(nameOf(x.user_id).split(" ")[0])).join(", ")}${g.member_count > 4 ? "…" : ""}</span></span></span><button class="btn ghost small-btn" type="button" id="gInfo">חברי הקבוצה</button></div>
        ${isAdmin && g.requests.length ? `<section class="soft"><b>🙋 בקשות להצטרף (${g.requests.length})</b><div class="list" style="margin-top:8px">${g.requests.map((r) => `<div class="item">${avatar(r.user_id)}<span style="flex:1">${esc(nameOf(r.user_id))}</span><button class="btn small-btn" type="button" data-ok="${esc(r.user_id)}">אישור</button><button class="btn ghost small-btn" type="button" data-no="${esc(r.user_id)}">דחייה</button></div>`).join("")}</div></section>` : ""}
        <div class="dm-log" id="gLog">${g.messages.map((m, i) => `<div class="bubble ${m.sender === me ? "me" : "bot"}" tabindex="0" data-i="${i}">${m.sender === me ? "" : `<b class="small">${esc(nameOf(m.sender))}</b><br>`}${msgBody(m.body)}</div>`).join("") || '<p class="muted small">עוד אין הודעות. כתבו משהו ראשון 🙂</p>'}</div>
        <div class="reply-bar" id="gReply" hidden></div>
        <form class="chat-form" id="gForm"><textarea id="gIn" rows="1" placeholder="הודעה לקבוצה…" aria-label="הודעה לקבוצה" maxlength="2000"></textarea><button class="btn" type="submit">שליחה</button></form></div>`;
      const log = $("#gLog"); log.scrollTop = log.scrollHeight;
      const reply = replyState($("#gReply"), $("#gIn"));
      bindMsgActions(log, (i) => g.messages[i], { reply, mine: (m) => m.sender === me,
        privately: (m) => { const u = unameOf(m.sender); if (!u) return toast("לא מצאנו את המשתמש"); try { sessionStorage.setItem("dmQuote:" + m.sender, `${g.name}: ${plainBody(m.body)}`); } catch { /* */ } location.hash = "#dm-" + u; },
        report: (m) => reportModal({ target: m.sender, what: "הודעה בקבוצה", after: null }) });
      $("#gForm").onsubmit = async (e) => { e.preventDefault(); const v = $("#gIn").value.trim(); if (!v) return; try { await api.groupSend(id, reply.wrap(v)); group(id); } catch (er) { toast(er.message); } };
      $("#gInfo").onclick = () => { const m = modal(`<h2>👥 ${esc(g.name)}</h2><div class="list">${g.members.map((x) => `<a class="item" href="#u-${esc(unameOf(x.user_id))}">${avatar(x.user_id)}<span>${esc(nameOf(x.user_id))}${x.user_id === g.admin ? ' <span class="chip">מנהל/ת</span>' : ""}</span></a>`).join("")}</div><button class="btn ghost" data-x type="button">סגירה</button>`); };
      view.querySelectorAll("[data-ok],[data-no]").forEach((b) => (b.onclick = async () => { try { await api.groupDecide(id, b.dataset.ok || b.dataset.no, !!b.dataset.ok); group(id); } catch (e) { toast(e.message); } }));
    } catch (e) { fail(e); }
  }
  // ---------- הודעה עם ציטוט: השורה הראשונה "> ..." היא ההודעה שעליה עונים ----------
  const QUOTE = /^> (.{1,200})\n/;
  const plainBody = (b) => String(b || "").replace(QUOTE, "");
  const msgBody = (b) => { const m = String(b || "").match(QUOTE); return m ? `<span class="quote">${esc(m[1])}</span>${esc(plainBody(b))}` : esc(b); };
  // שורת "תגובה ל..." מעל תיבת הכתיבה
  function replyState(bar, input) {
    let q = "";
    const paint = () => { if (!q) input.maxLength = 2000; bar.hidden = !q; bar.innerHTML = q ? `<span class="small">↩️ תגובה ל: <b>${esc(q)}</b></span><button class="link" type="button" aria-label="ביטול התגובה">✕</button>` : ""; if (q) bar.querySelector("button").onclick = () => { q = ""; paint(); }; };
    const fit = () => { input.maxLength = q ? 2000 - q.length - 3 : 2000; };
    return { set(t) { q = String(t).replace(/\s+/g, " ").trim().slice(0, 80); paint(); fit(); input.focus(); }, clear() { q = ""; paint(); fit(); },
      wrap: (v) => { if (!q) return v; const room = 2000 - v.length - 3; return room >= 5 ? `> ${q.slice(0, room)}\n${v}` : v; } };
  }
  // תפריט להודעה: לחיצה ארוכה (טלפון/טאבלט), לחצן ימני (מחשב), מקלדת; משיכה ימינה = תגובה מהירה
  function bindMsgActions(log, get, { reply, mine, privately, report }) {
    const open = (el, x, y) => {
      const m = get(+el.dataset.i); if (!m) return;
      if (msgMenuClose) { if (Date.now() - msgMenuAt < 600) return; msgMenuClose(); }   // אנדרואיד: לחיצה ארוכה שולחת גם contextmenu
      document.getElementById("msgMenu")?.remove();
      const own = mine(m);
      document.body.insertAdjacentHTML("beforeend", `<div class="msg-menu" id="msgMenu" role="menu" aria-label="פעולות על ההודעה">
        <button role="menuitem" type="button" data-a="reply">↩️ תגובה</button><button role="menuitem" type="button" data-a="copy">📋 העתקה</button>
        ${privately && !own ? '<button role="menuitem" type="button" data-a="priv">💬 תגובה בפרטי</button>' : ""}${report && !own ? '<button role="menuitem" type="button" data-a="rep">⚠️ דיווח</button>' : ""}</div>`);
      const mm = document.getElementById("msgMenu"), r = el.getBoundingClientRect();
      const px = x ?? (r.left + r.width / 2), py = y ?? r.bottom;
      mm.style.left = Math.max(8, Math.min(innerWidth - mm.offsetWidth - 8, px - mm.offsetWidth / 2)) + "px";
      mm.style.top = Math.max(8, Math.min(innerHeight - mm.offsetHeight - 8, py + 6)) + "px";
      let done = false;
      const close = (refocus = true) => { if (done) return; done = true; msgMenuClose = null; mm.remove(); document.removeEventListener("pointerdown", out, true); document.removeEventListener("keydown", key); removeEventListener("scroll", quiet, true); removeEventListener("hashchange", quiet); if (refocus && document.body.contains(el)) el.focus?.({ preventScroll: true }); };
      const quiet = () => close(false);
      const out = (e) => { if (!mm.contains(e.target)) close(false); };
      const key = (e) => {
        if (e.key === "Escape") return close();
        const its = [...mm.querySelectorAll("button")], i = its.indexOf(document.activeElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); its[(i + (e.key === "ArrowDown" ? 1 : -1) + its.length) % its.length].focus(); }
        if (e.key === "Tab") { e.preventDefault(); close(); }
      };
      msgMenuClose = close; msgMenuAt = Date.now();
      setTimeout(() => { if (done) return; document.addEventListener("pointerdown", out, true); document.addEventListener("keydown", key); addEventListener("scroll", quiet, true); addEventListener("hashchange", quiet); }, 0);
      mm.querySelector("button").focus({ preventScroll: true });
      mm.onclick = async (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return; close();
        if (a === "reply") reply.set(plainBody(m.body));
        if (a === "copy") { try { await navigator.clipboard.writeText(plainBody(m.body)); toast("ההודעה הועתקה"); } catch { toast("לא הצלחתי להעתיק"); } }
        if (a === "priv") privately(m);
        if (a === "rep") report(m);
      };
    };
    log.querySelectorAll(".bubble[data-i]").forEach((el) => {
      el.oncontextmenu = (e) => { e.preventDefault(); open(el, e.clientX, e.clientY); };
      el.onkeydown = (e) => { if (e.key === "Enter" || e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); open(el); } };
      let t0 = null, sx = 0, sy = 0, timer = 0, moved = false;
      el.addEventListener("touchstart", (e) => { const p = e.touches[0]; sx = p.clientX; sy = p.clientY; t0 = Date.now(); moved = false; timer = setTimeout(() => { if (!moved) { navigator.vibrate?.(15); open(el); } }, 500); }, { passive: true });
      el.addEventListener("touchmove", (e) => {
        const p = e.touches[0], dx = p.clientX - sx, dy = p.clientY - sy;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { moved = true; clearTimeout(timer); }
        if (dx > 0 && Math.abs(dy) < 30 && dx > Math.abs(dy) * 2) el.style.transform = `translateX(${Math.min(dx, 70)}px)`;
      }, { passive: true });
      el.addEventListener("touchend", (e) => {
        clearTimeout(timer); const dx = (e.changedTouches[0]?.clientX || sx) - sx, dy = (e.changedTouches[0]?.clientY || sy) - sy;
        el.style.transform = "";
        if (dx > 60 && Math.abs(dy) < 30 && dx > Math.abs(dy) * 2) { const m = get(+el.dataset.i); if (m) reply.set(plainBody(m.body)); }
      });
    });
  }
  // ---------- הכותרת של הפרופיל: תמונה גדולה (או רקע כחול עם האות הראשונה), שם, תואר ושנה, מוסד ----------
  const ICO = {
    // גלגל שיניים (כמו ⚙️) – לא שמש
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    cam: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    dots: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  };
  // אייקונים קטנים של רשתות (רק מה שמולא). בתצוגה "איך רואים אותי" – לא לחיצים
  const ICO_IG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r="1" fill="#fff" stroke="none"/></svg>';
  function linksHtml(p, { preview = false } = {}) {
    const name = esc((p.full_name || "").split(" ")[0]);
    const L = [
      [safeLink(p.ig, "instagram.com"), "ig", ICO_IG, `האינסטגרם של ${name}`],
      [safeLink(p.li, "linkedin.com"), "li", "in", `הלינקדאין של ${name}`],
      [safeLink(p.solution, "solution.community"), "sol", '<img src="icons/solution.png" alt="" width="30" height="30">', `ה-Solution של ${name}`],
    ].filter(([u]) => u);
    if (!L.length) return "";
    return `<div class="plinks">${L.map(([u, k, ico, lbl]) => preview
      ? `<span class="plink ${k}" role="img" aria-label="${lbl}">${ico}</span>`
      : `<a class="plink ${k}" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${lbl}" title="${lbl}">${ico}</a>`).join("")}</div>`;
  }
  // שורה אחת: התיאור מימין, האייקונים משמאל
  const bioRow = (text, links, cls = "") => (text || links ? `<div class="pbio-row">${text ? `<p class="prof-bio ${cls}">${text}</p>` : "<span></span>"}${links}</div>` : "");
  function heroHtml(p, { mine, top, actions }) {
    const u = p.avatar_url && AV_OK.test(p.avatar_url) ? p.avatar_url : "";
    const year = mine && p.study_year ? api.STUDY_YEARS[p.study_year - 1] : "";
    const sub = [p.degree, year].filter(Boolean).map(esc).join(" · ");
    return `<section class="phero${u ? "" : " nophoto"}" aria-label="${esc(p.full_name)}">
      ${u ? `<img class="phero-img phero-blur" src="${esc(u)}" alt="" aria-hidden="true"><img class="phero-img phero-main" src="${esc(u)}" alt="${mine ? "תמונת הפרופיל שלך" : "תמונת הפרופיל של " + esc(p.full_name)}">` : `<div class="phero-center"><span class="phero-initial" aria-hidden="true">${esc((p.full_name || "?").trim()[0] || "?")}</span>${mine ? '<button class="phero-add" type="button" id="heroAddPhoto">הוספת תמונה</button>' : ""}</div>`}
      <span class="phero-shade" aria-hidden="true"></span>
      <div class="phero-top">${top}</div>
      <div class="phero-bottom"><div class="phero-info"><h1>${esc(p.full_name)}</h1>${sub ? `<p>${sub}</p>` : ""}${p.uni ? `<p class="phero-uni">${ICO.pin}${esc(p.uni)}</p>` : ""}</div>
        <div class="phero-actions">${actions}</div></div>
    </section>`;
  }
  // ---------- התאמת התמונה: הגדלה (פס או צביטה) וגרירה. מחזיר JPEG בפרופורציה של הכותרת ----------
  function photoAdjust(src) {
    return new Promise((resolve) => {
      const back = document.activeElement;
      document.body.insertAdjacentHTML("beforeend", `<div class="padj" id="padj" role="dialog" aria-modal="true" aria-labelledby="padjT">
        <div class="padj-bar"><button class="padj-txt" type="button" data-a="cancel">ביטול</button><h2 id="padjT">התאמת התמונה</h2><button class="padj-save" type="button" data-a="save">שמירה</button></div>
        <div class="padj-frame" id="padjF" tabindex="0" role="img" aria-label="התמונה. חיצים מזיזים, פלוס ומינוס מגדילים ומקטינים"><img id="padjI" alt="התמונה שלך" draggable="false"><span class="phero-shade" aria-hidden="true"></span><span class="padj-name">${esc(api.profile()?.full_name || "")}</span></div>
        <p class="padj-hint">גוררים כדי למקם · צובטים או משתמשים בפס כדי להגדיל · במקלדת: חיצים ו־+/−</p>
        <label class="padj-zoom"><span>הגדלה <b id="padjZ">100%</b></span><input type="range" id="padjR" min="100" max="300" step="1" value="100" aria-label="הגדלה"></label>
        <button class="padj-txt" type="button" data-a="reset">איפוס</button></div>`);
      const box = document.getElementById("padj"), F = document.getElementById("padjF"), I = document.getElementById("padjI"), R = document.getElementById("padjR");
      const st = { z: 1, x: 0, y: 0, base: 1, iw: 1, ih: 1 };
      const W = () => F.clientWidth, H = () => F.clientHeight;
      const clamp = () => { const dw = st.iw * st.base * st.z, dh = st.ih * st.base * st.z, mx = Math.max(0, (dw - W()) / 2), my = Math.max(0, (dh - H()) / 2); st.x = Math.max(-mx, Math.min(mx, st.x)); st.y = Math.max(-my, Math.min(my, st.y)); };
      const paint = () => { clamp(); const dw = st.iw * st.base * st.z, dh = st.ih * st.base * st.z; I.style.width = dw + "px"; I.style.height = dh + "px"; I.style.left = (W() - dw) / 2 + st.x + "px"; I.style.top = (H() - dh) / 2 + st.y + "px"; R.value = Math.round(st.z * 100); document.getElementById("padjZ").textContent = Math.round(st.z * 100) + "%"; };
      const done = (v) => { box.remove(); removeEventListener("keydown", key); if (String(src).startsWith("blob:")) URL.revokeObjectURL(src); (back && back !== document.body && document.body.contains(back) ? back : document.getElementById("heroCam"))?.focus?.(); resolve(v); };
      const key = (e) => {
        if (e.key === "Escape") return done(null);
        if (e.key === "Tab") { const f = [...box.querySelectorAll("button, input, [tabindex='0']")]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
      };
      // מקלדת על המסגרת: חיצים מזיזים 12px, + ו־− מגדילים ומקטינים
      F.onkeydown = (e) => {
        const mv = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
        if (mv) { e.preventDefault(); st.x += mv[0]; st.y += mv[1]; paint(); }
        else if (e.key === "+" || e.key === "=") { e.preventDefault(); st.z = Math.min(3, st.z + 0.1); paint(); }
        else if (e.key === "-" || e.key === "_") { e.preventDefault(); st.z = Math.max(1, st.z - 0.1); paint(); }
      };
      addEventListener("keydown", key);
      I.crossOrigin = "anonymous";
      I.onload = () => { st.iw = I.naturalWidth; st.ih = I.naturalHeight; st.base = Math.max(W() / st.iw, H() / st.ih); paint(); };
      I.onerror = () => { toast("לא הצלחתי לפתוח את התמונה"); done(null); };
      I.src = src;
      R.oninput = () => { st.z = R.value / 100; paint(); };
      // גרירה באצבע/עכבר, וצביטה בשתי אצבעות
      const pts = new Map(); let start = null;
      F.onpointerdown = (e) => { F.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = { z: st.z, x: st.x, y: st.y, pts: new Map([...pts].map(([k, v]) => [k, { ...v }])) }; };
      F.onpointermove = (e) => {
        if (!pts.has(e.pointerId) || !start) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const a = [...pts.values()], s0 = [...start.pts.values()];
        if (a.length >= 2 && s0.length >= 2) { const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y); st.z = Math.max(1, Math.min(3, start.z * d(a[0], a[1]) / Math.max(1, d(s0[0], s0[1])))); }
        else { const p0 = start.pts.get(e.pointerId), zf = (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) * (parseFloat(getComputedStyle(document.body).zoom) || 1); if (p0) { st.x = start.x + (e.clientX - p0.x) / zf; st.y = start.y + (e.clientY - p0.y) / zf; } }
        paint();
      };
      const up = (e) => { pts.delete(e.pointerId); start = pts.size ? { z: st.z, x: st.x, y: st.y, pts: new Map([...pts].map(([k, v]) => [k, { ...v }])) } : null; };
      F.onpointerup = up; F.onpointercancel = up;
      F.onwheel = (e) => { e.preventDefault(); st.z = Math.max(1, Math.min(3, st.z * (e.deltaY < 0 ? 1.06 : 0.94))); paint(); };
      box.onclick = async (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
        if (a === "cancel") return done(null);
        if (a === "reset") { st.z = 1; st.x = 0; st.y = 0; return paint(); }
        // שמירה: חותכים בדיוק את מה שבמסגרת, 720×830, JPEG (עד ~500KB)
        const k = st.base * st.z, dw = st.iw * k, dh = st.ih * k;
        const sx = ((dw - W()) / 2 - st.x) / k, sy = ((dh - H()) / 2 - st.y) / k, sw = W() / k, sh = H() / k;
        const cv = document.createElement("canvas"); cv.width = 720; cv.height = 830;
        try {
          cv.getContext("2d").drawImage(I, sx, sy, sw, sh, 0, 0, 720, 830);
          let q = 0.86, blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", q));
          while (blob && blob.size > 480000 && q > 0.5) { q -= 0.12; blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", q)); }
          done(blob);
        } catch { toast("לא הצלחתי לשמור את החיתוך"); done(null); }
      };
      setTimeout(() => box.querySelector("[data-a=save]").focus(), 0);
    });
  }
  let msgMenuClose = null, msgMenuAt = 0, moreOut = null;
  // חץ קטן ליד השם: פותח/סוגר תפריט
  function bindMore(btn, menu) {
    btn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); if (!menu.hidden) menu.querySelector("button")?.focus(); };
    if (moreOut) document.removeEventListener("click", moreOut);
    moreOut = (e) => { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); } };
    document.addEventListener("click", moreOut);
    menu.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); } });
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
      view.innerHTML = `<div class="page dm" style="max-width:720px"><h1 class="vh">שיחה עם ${esc(p.full_name)}</h1>
        <div class="dm-head"><a class="row" href="#u-${esc(p.username)}" style="color:inherit;text-decoration:none">${avatar(p.id)}<span><b>${esc(p.full_name)}</b><br><span class="small muted" dir="ltr">@${esc(p.username)}</span></span></a>
          <span class="more-wrap"><button class="more-btn" type="button" id="dmMore" aria-label="עוד אפשרויות" aria-expanded="false" aria-controls="dmMenu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
          <span class="more-menu" id="dmMenu" hidden><button type="button" id="dmBlock">🚫 חסימה</button><button type="button" id="dmReport">⚠️ דיווח</button></span></span></div>
        <div id="dmReq"></div><div class="dm-log" id="dmLog"><p class="muted small">טוען…</p></div>
        <div class="reply-bar" id="dmReply" hidden></div>
        <form class="chat-form" id="dmForm"><textarea id="dmIn" rows="1" placeholder="הודעה…" aria-label="הודעה" maxlength="2000"></textarea><button class="btn" type="submit">שליחה</button></form>
        <p class="small muted hint-msg">לחיצה ארוכה, משיכה ימינה או לחצן ימני על הודעה (במקלדת: Enter): תגובה או העתקה</p></div>`;
      bindMore($("#dmMore"), $("#dmMenu"));
      const reply = replyState($("#dmReply"), $("#dmIn"));
      { let q = null; try { q = sessionStorage.getItem("dmQuote:" + p.id); sessionStorage.removeItem("dmQuote:" + p.id); } catch { /* */ } if (q) reply.set(q); }
      let shown = -1;
      const draw = async () => {
        const t = await threads(), ms = t.by.get(p.id) || [], req = ms.length > 0 && t.isReq(p.id);
        if (!req && ms.some((m) => m.recipient === meId() && !m.read_at)) api.markRead(p.id).catch(() => {});
        $("#dmReq").innerHTML = req ? `<div class="notice">${esc(p.full_name)} עוד לא חבר/ה שלך ורוצה לשלוח לך הודעה.<div class="row" style="margin-top:8px"><button class="btn" id="dmOk" type="button">אישור</button><button class="btn ghost" id="dmDel" type="button">מחיקה</button></div></div>` : "";
        if ($("#dmOk")) $("#dmOk").onclick = async () => { await api.acceptChat(p.id); draw(); };
        if ($("#dmDel")) $("#dmDel").onclick = async () => { await api.deleteChatFrom(p.id); location.hash = "#messages-req"; };
        if (ms.length === shown) return;
        shown = ms.length;
        $("#dmLog").innerHTML = ms.map((m, i) => `<div class="bubble ${m.sender === p.id ? "bot" : "me"}" tabindex="0" data-i="${i}">${msgBody(m.body)}</div>`).join("") || '<p class="muted small">עוד אין הודעות. תגידו היי 👋</p>';
        bindMsgActions($("#dmLog"), (i) => ms[i], { reply, mine: (m) => m.sender !== p.id, report: (m) => { reportModal({ target: p.id, what: "הודעה", after: null }); setTimeout(() => { const t = $("#rrTxt"); if (t) t.value = ("ההודעה: " + plainBody(m.body)).slice(0, 300); }, 50); } });
        $("#dmLog").scrollTop = $("#dmLog").scrollHeight;
      };
      $("#dmIn").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#dmForm").requestSubmit(); } };
      $("#dmForm").onsubmit = async (e) => {
        e.preventDefault(); const v = $("#dmIn").value.trim(); if (!v) return toast("כתבו הודעה קודם");
        try { await api.sendMessage(p.id, reply.wrap(v)); $("#dmIn").value = ""; reply.clear(); api.track("message"); await draw(); } catch (err) { toast(err.message); }
      };
      $("#dmBlock").onclick = async () => { if (!confirm(`לחסום את ${p.full_name}? לא תקבלו ממנו/ה הודעות.`)) return; await api.block(p.id); toast("נחסם/ה"); location.hash = "#messages"; };
      $("#dmReport").onclick = async () => { await api.report({ target: p.id, reason: "דיווח מהודעות" }); toast("תודה, הדיווח נשלח לבדיקה"); };
      await draw();
      // בודקים הודעות חדשות כל 8 שניות, כל עוד המסך פתוח
      dmTimer = setInterval(() => { if (here() && document.visibilityState === "visible") draw().catch(() => {}); else if (!here()) clearInterval(dmTimer); }, 8000);
    } catch (e) { fail(e); }
  }

  // ---------- פספסתי שיעור ----------
  async function missed() {
    busy();
    let g = null; try { g = await graph(); } catch { /* בלי אינטרנט */ }
    const fr = g ? g.friends.map((f) => g.other(f)) : [];
    const AUD = [["friends", "👥 כל החברים"], ["course_friends", "🎓 החברים שבקורס"], ["picked", "✋ לבחור חברים"], ["course", "🏫 כל מי שבקורס"]];
    const HINT = { friends: "כל החברים שלך יקבלו התראה.", course_friends: "רק חברים שלומדים את הקורס הזה.", picked: "רק החברים שתסמנו למטה.", course: "כל מי שלומד את הקורס הזה במוסד שלך ב-Clearly – גם מי שעוד לא חבר שלך." };
    view.innerHTML = `<div class="page">
      <h1 style="font-size:30px">🙋 פספסתי שיעור</h1>
      <section class="card" style="display:grid;gap:12px"><h2>לא הייתי בשיעור</h2>
        <label>איזה קורס?<select id="msC">${myCourses().map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>איזה תאריך?<input type="date" id="msD" value="${new Date().toLocaleDateString("en-CA")}"></label>
        <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font-weight:700;margin-bottom:6px">למי לשלוח?</legend>
          <div class="chips-row" style="flex-wrap:wrap">${AUD.map(([k, l], i) => `<button type="button" class="chip-btn ${i ? "" : "on"}" data-aud="${k}" aria-pressed="${!i}">${l}</button>`).join("")}</div>
          <p class="small muted" id="msHint" aria-live="polite">${HINT.friends}</p>
          <div id="msPick" class="list" hidden>${fr.map((id) => `<label class="item" style="cursor:pointer"><input type="checkbox" value="${esc(id)}" style="width:auto"> <span class="t">${esc(nameOf(id))}</span></label>`).join("") || '<p class="small muted">עוד אין חברים. <a href="#social-friends">הוספת חברים</a></p>'}</div>
        </fieldset>
        <button class="btn" type="button" id="msGo">📨 שליחת הבקשה</button></section>
      <section class="soft" style="display:grid;gap:8px"><h2 style="font-size:18px;margin:0">עוד דרכים להשלים</h2>
        <a class="item" href="#upload"><span><span class="t">📄 העלאת המצגת של השיעור</span><br><span class="small muted">ותקבלו סיכום אישי לפי השאלון שלך</span></span></a>
        <a class="item" href="#social-friends"><span><span class="t">🎓 אותה כיתה</span><br><span class="small muted">חברים שמשתפים איתך את הקורס – הסיכומים שלהם אצלך אוטומטית</span></span></a></section></div>`;
    let aud = "friends";
    view.querySelectorAll("[data-aud]").forEach((b) => (b.onclick = () => {
      aud = b.dataset.aud;
      view.querySelectorAll("[data-aud]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      $("#msHint").textContent = HINT[aud]; $("#msPick").hidden = aud !== "picked";
    }));
    $("#msGo").onclick = async () => {
      const c = $("#msC").value; if (!c) return toast("הוסיפו קורסים בהגדרות ← לימודים");
      const picked = [...view.querySelectorAll("#msPick input:checked")].map((x) => x.value);
      if (aud === "picked" && !picked.length) return toast("סמנו לפחות חבר/ה אחד/ת");
      try { await api.missed(c, $("#msD").value, aud, picked); toast("✅ הבקשה נשלחה"); api.track("missed"); } catch (e) { toast(e.message); }
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
      const priv = await api.isPrivate(p.id);
      const locked = (!f || f.status !== "accepted") && priv;
      const d = locked ? { ps: [] } : await feedData((x) => x.author === p.id);
      const first = esc(p.full_name.split(" ")[0]);
      const rel = !f ? `<button class="phero-btn blue" type="button" id="add">${ICO.plus}הוספת חבר</button>`
        : f.status === "accepted" ? `<button class="phero-btn" type="button" id="relMenu" aria-haspopup="dialog">${ICO.check}חברים</button>`
        : f.requester === meId() ? '<span class="phero-btn" role="status">⏳ ממתין לאישור</span>' : `<button class="phero-btn blue" type="button" id="acc">${ICO.check}אישור הבקשה</button>`;
      const hero = heroHtml(p, { mine: false,
        top: `<button class="phero-circ" type="button" id="pfMore" aria-label="עוד: חסימה או דיווח" aria-haspopup="dialog">${ICO.dots}</button>`,
        actions: `${rel}<a class="phero-btn" href="#dm-${esc(p.username)}">הודעה</a>` });
      // אותה כיתה: קורסים משותפים (רק אם השרת נתן את הקורסים שלו). המוסד כבר כתוב בתמונה – לא חוזרים עליו
      const mine = new Set(myCourses()), common = (p.courses || []).filter((c) => mine.has(c));
      const same = common.length ? `🎓 אתם באותה כיתה ב${common.slice(0, 2).map(esc).join(" וב")}${common.length > 2 ? ` ועוד ${common.length - 2}` : ""}` : "";
      view.innerHTML = `<div class="page hero-page" style="max-width:760px">${hero}<div class="phero-sheet">
        ${bioRow(p.bio ? esc(p.bio) : "", linksHtml(p))}
        <div class="row pchips" style="gap:8px"><span class="chip">${priv ? "🔒 חשבון סגור" : "🌍 חשבון פתוח"}</span>${same ? `<span class="chip">${same}</span>` : ""}</div>
        ${locked ? `<section class="plock"><span class="plock-ico" aria-hidden="true">${ICO.lock}</span><h2>החשבון הזה סגור</h2><p class="muted">אחרי שתהיו חברים תוכלו לראות את הפוסטים והסיכומים ש${first} משתף/ת.</p></section>` : `<h2 style="font-size:20px">מה ${first} שיתף/ה</h2><div class="feed" id="pfFeed"></div>`}
      </div></div>`;
      if (!locked) renderPosts($("#pfFeed"), d, () => profileView(username));
      const act = (fn) => async () => { try { await fn(); profileView(username); } catch (e) { toast(e.message); } };
      if ($("#add")) $("#add").onclick = act(async () => { await api.requestFriend(p.id); toast("הבקשה נשלחה"); });
      if ($("#acc")) $("#acc").onclick = act(async () => { await api.acceptFriend(f.id); toast("אתם חברים 🙌"); });
      const more = () => {
        const m = modal(`<h2>${esc(p.full_name)}</h2><div class="list">
          ${f?.status === "accepted" ? '<button class="item" type="button" id="mShr">🎓 אותה כיתה – שיתוף סיכומים</button><button class="item" type="button" id="mUnf">➖ הסרה מהחברים</button>' : ""}
          <button class="item" type="button" id="mBlk">🚫 חסימה</button><button class="item" type="button" id="mRep">⚠️ דיווח</button></div><button class="btn ghost" data-x type="button">ביטול</button>`);
        if ($("#mShr", m)) $("#mShr", m).onclick = () => { m.remove(); shareModal(p.id, g); };
        if ($("#mUnf", m)) $("#mUnf", m).onclick = () => { m.remove(); if (confirm("להסיר מהחברים? גם השיתוף בקורסים יפסיק.")) act(async () => { for (const c of g.iShare(p.id)) await api.unshare(p.id, c); await api.removeFriend(f.id); })(); };
        $("#mBlk", m).onclick = () => { m.remove(); if (confirm(`לחסום את ${p.full_name}?`)) act(async () => { await api.block(p.id); toast("נחסם/ה"); })(); };
        $("#mRep", m).onclick = () => { m.remove(); act(async () => { await api.report({ target: p.id, reason: "דיווח מהפרופיל" }); toast("תודה, הדיווח נשלח"); })(); };
      };
      $("#pfMore").onclick = more;
      if ($("#relMenu")) $("#relMenu").onclick = more;
    } catch (e) { fail(e); }
  }
  // הגעה מהתראה "משתף/ת איתך": פותחים את חלון השיתוף
  async function shareFrom(username) { const p = await api.findUser(username); if (p) { people.set(p.id, p); shareModal(p.id); } }

  // ---------- הפרופיל שלי (באזור הפרופיל) ----------
  async function myProfile() {
    const me = api.profile(); if (!me) return { hero: "", bio: "" };
    people.set(me.id, me);
    const g = await graph();
    const n = g.friends.length;
    const hero = heroHtml(me, {
      mine: true,
      top: `<a class="phero-pill" href="#profile-view">${ICO.eye}איך רואים אותי</a><a class="phero-circ" href="#settings" aria-label="הגדרות">${ICO.gear}</a><button class="phero-circ" type="button" id="heroCam" aria-label="${me.avatar_url ? "תמונת הפרופיל – החלפה, התאמה או הסרה" : "הוספת תמונת פרופיל"}">${ICO.cam}</button><input type="file" id="meAvatar" accept="image/*" hidden>`,
      actions: `<button class="phero-btn" type="button" id="meEdit">${ICO.pen}עריכת פרופיל</button><a class="phero-btn" href="#friends-list">👥 ${n === 1 ? "חבר אחד" : n + " חברים"}</a>`,
    });
    const bio = bioRow(`${me.bio ? esc(me.bio) : "עוד לא כתבת משהו על עצמך"}${me.is_private ? ' <span class="chip">🔒 חשבון סגור</span>' : ""}`, linksHtml(me), me.bio ? "" : "muted");
    return { hero, bio };
  }
  // ---------- "איך רואים אותי": הפרופיל שלי כמו שמי שעוד לא חבר שלי רואה אותו ----------
  async function viewAs() {
    busy();
    try {
      const me = api.profile(); if (!me) { location.hash = "#home"; return; }
      people.set(me.id, me);
      const first = esc((me.full_name || "").split(" ")[0]);
      const priv = !!me.is_private;
      const hero = heroHtml(me, { mine: false, top: "",
        actions: `<span class="phero-btn blue" aria-disabled="true">${ICO.plus}הוספת חבר</span><span class="phero-btn" aria-disabled="true">הודעה</span>` });
      // חשבון סגור: מי שלא חבר לא רואה תיאור, רשתות ופוסטים (כמו בשרת)
      view.innerHTML = `<div class="page hero-page viewas" style="max-width:760px" data-noback>
        <div class="viewas-bar" role="status"><span>${ICO.eye}כך אחרים רואים את הפרופיל שלך</span><a class="viewas-back" href="#profile" id="vaBack">חזרה</a></div>
        ${hero}<div class="phero-sheet">
        ${priv ? "" : bioRow(me.bio ? esc(me.bio) : "", linksHtml(me, { preview: true }))}
        <div class="row pchips" style="gap:8px"><span class="chip">${priv ? "🔒 חשבון סגור" : "🌍 חשבון פתוח"}</span></div>
        ${priv ? `<section class="plock"><span class="plock-ico" aria-hidden="true">${ICO.lock}</span><h2>החשבון הזה סגור</h2><p class="muted">אחרי שתהיו חברים תוכלו לראות את הפוסטים והסיכומים ש${first} משתף/ת.</p></section>`
          : `<h2 style="font-size:20px">מה ${first} שיתף/ה</h2><div class="feed" id="vaFeed" inert></div>`}
        <p class="small muted" style="text-align:center">${priv ? "כך רואה אותך מי שעוד לא חבר שלך. חברים רואים גם את התיאור, הרשתות והפוסטים." : "זו רק תצוגה – הכפתורים כאן לא לחיצים. פוסטים ששיתפת רק עם חברים לא מופיעים כאן, ופוסט לקורס רואה רק מי שלומד אותו."} את המלגות, הזכויות וה-AI רואה רק את/ה.</p>
      </div></div>`;
      // כמו בשרת (can_see_post): מי שלא חבר רואה רק פוסטים לכולם, ופוסטים לקורס – רק אם הוא לומד אותו. "לחברים" – לא
      if (!priv) renderPosts($("#vaFeed"), await feedData((x) => x.author === me.id && (x.visibility === "public" || x.visibility === "course")), () => viewAs());
    } catch (e) { fail(e); }
  }
  // התראות של חברים (בקשה חדשה, אישרו אותך, לייק, תגובה, שיתוף) – למעלה בפרופיל
  async function paintProfNotes() {
    const el = $("#profNotes"); if (!el) return;
    const items = (await ctx.socialItems?.()) || [];
    const shown = items.slice(0, 6);
    if (!shown.length) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<h2 style="font-size:18px;margin:0">🔔 חדש אצלך</h2><div class="list" style="margin-top:8px">${shown.map((x) => `<a class="item msg ${x.read ? "" : "unread"}" href="${esc(x.link || "#profile")}"><span class="micon">${x.icon}</span><span style="min-width:0;flex:1"><span class="t">${esc(x.title)}</span>${x.body ? `<br><span class="small muted">${x.body}</span>` : ""}</span><span class="small muted"><bdi>${new Date(x.at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</bdi></span></a>`).join("")}</div>`;
    await ctx.markSocialRead?.();
    document.querySelectorAll(".prof-n").forEach((n) => { n.hidden = true; n.textContent = ""; });
  }
  async function bindMyProfile() {
    if ($("#meEdit")) $("#meEdit").onclick = editMe;
    const pick = () => $("#meAvatar")?.click();
    const save = async (src) => {
      const blob = await photoAdjust(src); if (!blob) return;
      try { toast("שומר את התמונה…"); await api.setAvatar(blob); people.set(meId(), api.profile()); toast("✓ התמונה עודכנה"); dispatchEvent(new HashChangeEvent("hashchange")); }
      catch (err) { toast("לא הצלחתי לשמור את התמונה: " + (err.message || "")); }
    };
    if ($("#meAvatar")) $("#meAvatar").onchange = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) save(URL.createObjectURL(f)); };
    if ($("#heroAddPhoto")) $("#heroAddPhoto").onclick = pick;
    if ($("#heroCam")) $("#heroCam").onclick = () => {
      const url = api.profile()?.avatar_url;
      if (!url) return pick();
      const m = modal(`<h2>תמונת הפרופיל</h2><div class="list"><button class="item" type="button" id="avNew">📷 תמונה חדשה</button><button class="item" type="button" id="avFit">🔍 התאמת התמונה (הגדלה ומיקום)</button><button class="item" type="button" id="avDel">🗑️ הסרת התמונה</button></div><button class="btn ghost" data-x type="button">ביטול</button>`);
      $("#avNew", m).onclick = () => { m.remove(); pick(); };
      $("#avFit", m).onclick = () => { m.remove(); save(url); };
      $("#avDel", m).onclick = async () => { m.remove(); if (!confirm("להסיר את תמונת הפרופיל?")) return; try { await api.removeAvatar(); people.set(meId(), api.profile()); dispatchEvent(new HashChangeEvent("hashchange")); } catch (err) { toast(err.message); } };
    };
  }
  // ---------- רק החברים (מהכפתור "N חברים" בפרופיל) – בלי בקשות, הוספה או "חדש אצלך" ----------
  async function friendsListPage(refresh = false) {
    if (!refresh) busy();
    try {
      const g = await graph();
      const ids = g.friends.map((f) => g.other(f)); await remember(ids);
      const shareSub = (id) => { const a = g.iShare(id).length, b = g.theyShare(id).length; return a && b ? " · 🎓 אותה כיתה" : ""; };
      const list = `<div id="friendsOnly" style="display:grid;gap:8px">${ids.map((id) => `<div class="item">${avatar(id)}<a href="#u-${esc(unameOf(id))}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><span class="t">${esc(nameOf(id))}</span><br><span class="small muted"><span dir="ltr">@${esc(unameOf(id))}</span>${shareSub(id)}</span></a><button class="btn ghost" data-share="${id}" type="button" aria-label="אותה כיתה – שיתוף סיכומים">🎓</button><a class="btn ghost" href="#dm-${esc(unameOf(id))}" aria-label="הודעה ל${esc(nameOf(id))}">💬</a></div>`).join("") || '<p class="muted">עוד אין חברים. <a href="#social-friends">להוספת חברים</a></p>'}</div>`;
      // רענון אחרי שיתוף: מחליפים רק את הרשימה (כפתור החזרה והכותרת נשארים)
      if (refresh && $("#friendsOnly")) $("#friendsOnly").outerHTML = list;
      else view.innerHTML = `<div class="page" style="max-width:760px"><h1 style="font-size:30px">👥 החברים שלי (${ids.length})</h1>${list}</div>`;
      view.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => shareModal(b.dataset.share, g)));
    } catch (e) { fail(e); }
  }
  // ---------- דף החברים (משלו): חדש אצלך, בקשות, הוספה, אנשים שאולי תכירו, ממתינים, החברים שלי ----------
  async function friendsPage() {
    view.innerHTML = `<div class="page" style="max-width:760px"><h1 style="font-size:30px">👥 החברים שלי</h1>
      <section class="soft" id="profNotes" hidden></section>
      <div id="profFriends" style="display:grid;gap:16px"><p class="muted small">טוען…</p></div></div>`;
    paintProfNotes().catch(() => {});
    await friends($("#profFriends"));
  }
  // מה שפרסמתי / אהבתי / שמורים (דף נפרד, מההגדרות)
  async function bindMyContent(tab = "posts") {
    const el = $("#meFeed"); if (!el) return;
    try {
      const me = meId();
      const sv = new Set((await api.saves()).map((s) => s.post));
      let liked = new Set();
      if (tab === "liked") { const all = await api.posts(); liked = new Set((await api.likes(all.map((p) => p.id))).filter((l) => l.user_id === me).map((l) => l.post)); }
      const d = await feedData((p) => (tab === "posts" ? p.author === me : tab === "saved" ? sv.has(p.id) : liked.has(p.id)));
      renderPosts(el, d, () => bindMyContent(tab));
    } catch (e) { el.innerHTML = `<p class="notice alert">${esc(e.message)}</p>`; }
  }
  function editMe() {
    const me = api.profile();
    const m = modal(`<h2>עריכת פרופיל</h2>
      <label>שם מלא<input id="eName" value="${esc(me.full_name)}" maxlength="60"></label>
      <label>על עצמי<textarea id="eBio" rows="3" maxlength="300">${esc(me.bio)}</textarea></label>
      <label>מוסד<select id="eUni">${UNIS.map((u) => `<option ${u === me.uni ? "selected" : ""}>${u}</option>`).join("")}</select></label>
      <label>תואר ושנה<input id="eDeg" value="${esc(me.degree)}" maxlength="80"></label>
      <label>שנת לימודים (בשביל "אנשים שאולי תכירו")<select id="eYear"><option value="">לא נבחר</option>${api.STUDY_YEARS.map((y, i) => `<option value="${i + 1}" ${i + 1 === me.study_year ? "selected" : ""}>${y}</option>`).join("")}</select></label>
      <label>מייל של מוסד הלימודים (רק את/ה רואה)<input id="eUniMail" type="email" dir="ltr" value="${esc(me.uni_email || "")}" placeholder="name@msmail.ariel.ac.il"></label>
      <p class="small muted">המייל האישי (להתחברות ולשחזור סיסמה): <b dir="ltr">${esc(api.user()?.email || "")}</b></p>
      <label>יום הולדת<input id="eBday" type="date" value="${esc(me.birthday || "")}"></label>
      <label>קישור לאינסטגרם<input id="eIg" dir="ltr" value="${esc(me.ig)}" placeholder="https://instagram.com/..."></label>
      <label>קישור ללינקדאין<input id="eLi" dir="ltr" value="${esc(me.li)}" placeholder="https://linkedin.com/in/..."></label>
      ${"solution" in me ? `<label>קישור ל-Solution (הרשת של הסטארטאפים)<input id="eSol" dir="ltr" value="${esc(me.solution)}" placeholder="https://www.solution.community/..."></label>` : ""}
      <div class="row"><button class="btn" id="eGo" type="button">שמירה</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
    $("#eGo", m).onclick = async () => {
      const ig = $("#eIg", m).value.trim(), li = $("#eLi", m).value.trim();
      if (ig && !safeLink(ig, "instagram.com")) return toast("קישור אינסטגרם צריך להתחיל ב-https://instagram.com");
      if (li && !safeLink(li, "linkedin.com")) return toast("קישור לינקדאין צריך להתחיל ב-https://linkedin.com");
      // Solution: רק אם העמודה קיימת בשרת (אחרת השדה לא מוצג בכלל)
      const sol = $("#eSol", m)?.value.trim() || "";
      if (sol && !safeLink(sol, "solution.community")) return toast("קישור Solution צריך להתחיל ב-https://www.solution.community");
      const solField = $("#eSol", m) ? { solution: safeLink(sol, "solution.community") } : {};
      const uniMail = $("#eUniMail", m).value.trim().toLowerCase();
      if (uniMail && !/^[^@\s]+@[^@\s]+\.ac\.il$/i.test(uniMail)) return toast("המייל של מוסד הלימודים צריך להיגמר ב-ac.il");
      try {
        await api.updateMe({ full_name: $("#eName", m).value.trim() || me.full_name, bio: $("#eBio", m).value.trim(), uni: $("#eUni", m).value, degree: $("#eDeg", m).value.trim(), birthday: $("#eBday", m).value || null, ig: safeLink(ig, "instagram.com"), li: safeLink(li, "linkedin.com"), uni_email: uniMail || null, study_year: +$("#eYear", m).value || null, ...solField });
        const pr = prefs.get(); if (pr) { pr.studyYear = +$("#eYear", m).value || null; prefs.set(pr); }
        m.remove(); toast("נשמר ✓"); dispatchEvent(new HashChangeEvent("hashchange"));
      } catch (e) { toast(e.message); }
    };
  }

  // העלאת קובץ -> סיכום אישי, ומיד מכניסים אותו לספרייה במכשיר
  async function upload(file, course) { const r = await api.summarizeFile(file, course); await syncSummaries(); return r; }

  return { summaryHtmlToMd, newPasswordModal, upload, latestPosts, groups, group, feed, friends, friendsPage, friendsListPage, paintProfNotes, missed, signup, messages, dm, myProfile, viewAs, bindMyProfile, bindMyContent, editMe, counts, syncSummaries, syncNotifications, pushPrefs, restorePrefs, shareFrom, profile: profileView };
}
