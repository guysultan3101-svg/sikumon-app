// 👥 השכבה החברתית – עיצוב לדוגמה בלבד. כל המשתמשים והפוסטים כאן מדומים ונשמרים רק במכשיר.
// כשנחבר שרת (Supabase), אותם מסכים יעבדו מול חשבונות אמיתיים: הרשמה, חברים באישור הדדי, פיד, פרופיל.

export function initSocial(ctx) {
  const { view, $, esc, toast, store } = ctx;
  const KEY = "sikumon-social-demo";
  const today = new Date();
  const mmdd = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // ---------- משתמשים מדומים ----------
  const USERS = {
    noa_k: { name: "נועה כהן", uni: "אריאל", degree: "כלכלה ומנהל, שנה א", bday: mmdd(today), bio: "מסכמת מיקרו וסטטיסטיקה. מכורה לקפה ☕", ig: "https://instagram.com/", li: "", color: "#DB2777" },
    "itay.levi": { name: "איתי לוי", uni: "אריאל", degree: "כלכלה ומנהל, שנה א", bday: "03-14", bio: "מילואימניק 🎖️ משלים פערים ביחד איתכם", ig: "", li: "https://linkedin.com/", color: "#2563EB" },
    maya_b: { name: "מאיה ברק", uni: "אריאל", degree: "כלכלה ומנהל, שנה א", bday: mmdd(new Date(Date.now() + 2 * 864e5)), bio: "דפי נוסחאות זה האהבה שלי", ig: "https://instagram.com/", li: "", color: "#16A34A" },
    daniel_r: { name: "דניאל רוזן", uni: "אריאל", degree: "כלכלה ומנהל, שנה ב", bday: "07-02", bio: "עובד 30 שעות בשבוע ולומד בלילות", ig: "", li: "https://linkedin.com/", color: "#6D28D9" },
    "shira.g": { name: "שירה גבאי", uni: "בן-גוריון", degree: "הנדסת תעשייה וניהול", bday: "11-20", bio: "", ig: "https://instagram.com/", li: "https://linkedin.com/", color: "#EA580C" },
  };
  const POSTS = [
    { id: "p1", by: "noa_k", course: "מבוא לכלכלה מיקרו", title: "סיכום שיעור 4 – גמישות הביקוש", text: "כל הנוסחאות של הגמישות + 3 דוגמאות מהשיעור. המרצה אמר שזה בטוח במבחן ⭐", when: "לפני שעה", vis: "course", likes: 23, comments: [["maya_b", "הצלת אותי, לא הייתי בשיעור 🙏"], ["daniel_r", "אפשר גם את התרגול?"]] },
    { id: "ad1", sponsored: true, by: "מכללה לתארים מתקדמים", title: "יום פתוח – תואר שני בכלכלה", text: "הרשמה מוקדמת לסטודנטים בשנה א־ב, כולל מלגות למילואימניקים.", cta: "לפרטים" },
    { id: "p2", by: "maya_b", course: "סטטיסטיקה א", title: "דף נוסחאות – סטטיסטיקה תיאורית", text: "ממוצע, חציון, סטיית תקן, ואיך לזכור מתי מחלקים ב-n-1.", when: "לפני 3 שעות", vis: "friends", likes: 41, comments: [["noa_k", "שומרת 🔖"]] },
    { id: "p3", by: "itay.levi", course: "יסודות החשבונאות", title: "חזרתי ממילואים – מה פספסתי?", text: "מי שהיה בשיעורים 2–3, אשמח לסיכום. מחזיר בפודקאסט 🎧", when: "אתמול", vis: "course", likes: 12, comments: [["noa_k", "שלחתי לך בפרטי ❤️"]], ask: true },
    { id: "p4", by: "shira.g", course: "מבוא לסטטיסטיקה", title: "טיפ למבחן: לקרוא את השאלה פעמיים", text: "50% מהטעויות שלי בבוחן היו כי לא קראתי עד הסוף.", when: "לפני יומיים", vis: "public", likes: 87, comments: [] },
  ];
  const STORIES = [
    ["noa_k", "2 שעות מיקרו 🔥"], ["maya_b", "סיימתי בוחן 92"], ["itay.levi", "חזרתי ממילואים"], ["daniel_r", "לומד עכשיו 📚"],
  ];
  const VIS = { friends: "👥 חברים", course: "🎓 כל הקורס", public: "🌍 כולם" };

  // ---------- המצב שלי (במכשיר) ----------
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch { return {}; } };
  const set = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* מצב פרטי */ } };
  const st = () => {
    const s = get();
    s.friends ??= ["noa_k", "maya_b", "itay.levi"];
    s.incoming ??= ["daniel_r"];
    s.pending ??= [];
    s.liked ??= {}; s.saved ??= {}; s.myPosts ??= []; s.sent ??= [];
    return s;
  };
  const user = (id) => USERS[id] || (get().me?.username === id ? { ...get().me, color: "#0F172A" } : null);
  const avatar = (id, big = false) => {
    const u = user(id) || { name: "?" , color: "#475569" };
    return `<span class="av${big ? " big" : ""}" style="background:${u.color}" aria-hidden="true">${esc((u.name || id)[0])}</span>`;
  };
  // קישור לאינסטגרם/לינקדאין: רק https ורק לאתרים האלה
  const safeLink = (url, host) => { try { const u = new URL(url); return u.protocol === "https:" && (u.hostname === host || u.hostname.endsWith("." + host)) ? u.href : ""; } catch { return ""; } };

  const DEMO = `<p class="notice">🧪 <b>עיצוב לדוגמה.</b> המשתמשים והפוסטים כאן מדומים, ושום דבר לא נשלח לאף אחד. ככה זה ייראה כשנחבר שרת.</p>`;
  const subnav = (cur) => `<nav class="snav" aria-label="חברים">${[["social", "📰 פיד"], ["social-friends", "👥 חברים"], ["social-missed", "🙋 פספסתי שיעור"], ["me", "🙂 הפרופיל שלי"]].map(([h, l]) => `<a href="#${h}" ${cur === h ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  const needMe = () => {
    if (get().me) return false;
    view.innerHTML = `<div class="page">${DEMO}<section class="card" style="display:grid;gap:12px"><h1 style="font-size:28px">👥 חברים ושיתוף</h1>
      <p>שולחים סיכום לחבר שפספס, רואים מה כל הקורס מסכם, ומבקשים עזרה כשלא הייתם בשיעור.</p>
      <p class="muted small">צריך חשבון כדי שחברים יוכלו למצוא אתכם.</p><a class="btn" href="#signup">יצירת חשבון (דוגמה)</a></section></div>`;
    return true;
  };

  // ---------- הרשמה ----------
  function signup() {
    view.innerHTML = `<div class="page" style="max-width:560px">${DEMO}
      <h1 style="font-size:30px">יצירת חשבון</h1>
      <button class="btn ghost" id="sgGoogle" type="button"><b style="color:#4285F4">G</b> המשך עם Google</button>
      <p class="muted small" style="text-align:center">או</p>
      <form id="sgForm" class="card" style="display:grid;gap:12px" novalidate>
        <label>שם משתמש (ייחודי – ככה חברים ימצאו אתכם)<input id="sgUser" required pattern="[a-z0-9_.]{3,20}" autocomplete="username" dir="ltr" placeholder="guy_s"></label>
        <span class="small muted" id="sgUserHint">אותיות באנגלית, מספרים, _ ונקודה</span>
        <label>שם מלא<input id="sgName" required autocomplete="name"></label>
        <label>מייל של האוניברסיטה<input id="sgMail" type="email" required dir="ltr" autocomplete="email" placeholder="name@msmail.ariel.ac.il"></label>
        <span class="small muted">רק סטודנטים אמיתיים נכנסים: נשלח קוד אימות למייל הזה.</span>
        <label>סיסמה<input id="sgPass" type="password" required minlength="8" autocomplete="new-password"></label>
        <label>יום הולדת (לא חובה – חברים יקבלו תזכורת)<input id="sgBday" type="date"></label>
        <label class="row" style="gap:8px;align-items:flex-start"><input type="checkbox" id="sgRes" style="width:auto;margin-top:6px"><span>🎖️ אני משרת/ת מילואים פעיל/ה – <b>20% הנחה</b></span></label>
        <div id="sgResInfo" class="soft small" hidden>
          <b>איך זה עובד:</b> ההנחה מתחילה מיד. בתוך 30 יום מעלים אישור "משרת מילואים פעיל" (מאתר המילואים או מהיחידה).
          <br>🔒 <b>הפרטיות שלכם:</b> מסתירים את מספר תעודת הזהות לפני ההעלאה. בודקים את האישור ומוחקים אותו. אצלנו נשמר רק "מאומת עד תאריך X".
          <br>אם לא יגיע אישור, מהחודש הבא המחיר חוזר לרגיל, בלי חיוב רטרואקטיבי.
        </div>
        <label class="row" style="gap:8px;align-items:flex-start"><input type="checkbox" id="sgTerms" required style="width:auto;margin-top:6px"><span class="small">קראתי ואני מסכים/ה לתנאים ולמדיניות הפרטיות. משתפים רק סיכומים שכתבתי בעצמי, לא קבצים של מרצים.</span></label>
        <label class="row" style="gap:8px;align-items:flex-start"><input type="checkbox" id="sgAds" style="width:auto;margin-top:6px"><span class="small">אשמח לקבל הצעות מותאמות לסטודנטים (קורסים, תארים, משרות). לא חובה.</span></label>
        <button class="btn" type="submit">יצירת חשבון</button>
      </form></div>`;
    $("#sgRes").onchange = () => ($("#sgResInfo").hidden = !$("#sgRes").checked);
    $("#sgUser").oninput = () => {
      const v = $("#sgUser").value.trim().toLowerCase();
      $("#sgUserHint").textContent = !v ? "אותיות באנגלית, מספרים, _ ונקודה" : !/^[a-z0-9_.]{3,20}$/.test(v) ? "3–20 תווים: אותיות באנגלית, מספרים, _ ונקודה" : USERS[v] ? "❌ השם הזה תפוס" : "✅ פנוי";
    };
    $("#sgGoogle").onclick = () => { toast("בגרסה האמיתית: חלון של Google, ואז בוחרים שם משתמש ומאמתים מייל אוניברסיטה"); };
    $("#sgForm").onsubmit = (e) => {
      e.preventDefault();
      const u = $("#sgUser").value.trim().toLowerCase(), mail = $("#sgMail").value.trim();
      if (!/^[a-z0-9_.]{3,20}$/.test(u) || USERS[u]) return toast("בחרו שם משתמש פנוי");
      if (!$("#sgName").value.trim()) return toast("חסר שם מלא");
      if (!/@[^@]+\.ac\.il$/i.test(mail)) return toast("צריך מייל של מוסד אקדמי (נגמר ב-ac.il)");
      if ($("#sgPass").value.length < 8) return toast("סיסמה של 8 תווים לפחות");
      if (!$("#sgTerms").checked) return toast("צריך לאשר את התנאים");
      const s = st();
      // בדוגמה לא שומרים סיסמה בכלל
      s.me = { username: u, name: $("#sgName").value.trim(), uni: "אריאל", degree: "כלכלה ומנהל, שנה א", bio: "", ig: "", li: "", bday: $("#sgBday").value.slice(5) || "", ads: $("#sgAds").checked };
      if ($("#sgRes").checked) s.reservist = { since: new Date().toISOString().slice(0, 10), verified: false };
      set(s);
      toast("החשבון נוצר (דוגמה) 🎉");
      location.hash = "#social";
    };
  }

  // ---------- פיד ----------
  function postCard(p, s) {
    if (p.sponsored) return `<article class="post sponsored"><div class="post-h"><span class="av" style="background:#475569">📢</span><span><b>${esc(p.by)}</b><br><span class="small muted">תוכן ממומן</span></span></div>
      <h3>${esc(p.title)}</h3><p>${esc(p.text)}</p><button class="btn ghost" type="button" data-ad>${esc(p.cta)}</button></article>`;
    const u = user(p.by) || { name: p.by };
    const liked = !!s.liked[p.id], saved = !!s.saved[p.id];
    return `<article class="post" data-post="${esc(p.id)}">
      <div class="post-h">${avatar(p.by)}<span style="min-width:0;flex:1"><a href="#u-${encodeURIComponent(p.by)}"><b>${esc(u.name)}</b></a> <span class="small muted">@${esc(p.by)}</span><br><span class="small muted">${esc(p.course)} · ${esc(p.when)} · ${VIS[p.vis] || ""}</span></span></div>
      <h3>${p.ask ? "🙋 " : "📄 "}${esc(p.title)}</h3><p>${esc(p.text)}</p>
      <div class="post-a"><button type="button" data-like aria-pressed="${liked}">${liked ? "❤️" : "🤍"} <bdi>${p.likes + (liked ? 1 : 0)}</bdi></button>
        <button type="button" data-cmt>💬 <bdi>${p.comments.length}</bdi></button>
        <button type="button" data-save aria-pressed="${saved}">${saved ? "🔖 נשמר" : "🔖 שמירה"}</button>
        <button type="button" data-send>📤 שליחה לחבר</button></div>
      <div class="post-c" hidden>${p.comments.map(([by, t]) => `<p class="small"><b>${esc(user(by)?.name || by)}:</b> ${esc(t)}</p>`).join("")}
        <form class="row" data-cform><input placeholder="תגובה…" aria-label="תגובה" style="flex:1"><button class="btn ghost" type="submit">שליחה</button></form></div>
    </article>`;
  }
  async function feed() {
    if (needMe()) return;
    const s = st();
    const bdays = s.friends.filter((f) => USERS[f]?.bday === mmdd(today));
    const soon = s.friends.filter((f) => { const b = USERS[f]?.bday; if (!b) return false; const d = new Date(today.getFullYear(), +b.slice(0, 2) - 1, +b.slice(3)); const n = (d - today) / 864e5; return n > 0 && n <= 7; });
    const posts = [...s.myPosts, ...POSTS];
    view.innerHTML = `<div class="page">${DEMO}${subnav("social")}
      ${bdays.map((f) => `<div class="bday"><span>🎂 היום יום ההולדת של <b>${esc(USERS[f].name)}</b>!</span> <button class="btn ghost" type="button" data-bday="${esc(f)}">שליחת ברכה</button></div>`).join("")}
      ${soon.length ? `<p class="small muted">🎈 בשבוע הקרוב: ${soon.map((f) => esc(USERS[f].name)).join(", ")}</p>` : ""}
      <div class="stories" aria-label="מה החברים לומדים היום">${STORIES.map(([id, t]) => `<a class="story" href="#u-${encodeURIComponent(id)}">${avatar(id, true)}<span class="small">${esc(t)}</span></a>`).join("")}</div>
      <button class="btn" type="button" id="newPost">➕ שיתוף סיכום</button>
      <div class="feed">${posts.map((p) => postCard(p, s)).join("")}</div></div>`;
    bindFeed(posts);
    $("#newPost").onclick = publishModal;
    view.querySelectorAll("[data-bday]").forEach((b) => (b.onclick = () => { b.disabled = true; b.textContent = "✓ נשלחה ברכה 🎉"; }));
  }
  function bindFeed(posts) {
    view.querySelectorAll("[data-ad]").forEach((b) => (b.onclick = () => toast("פרסומת לדוגמה. המפרסם לא מקבל שום פרט עליכם")));
    view.querySelectorAll("[data-post]").forEach((el) => {
      const p = posts.find((x) => x.id === el.dataset.post);
      const flip = (k) => { const s = st(); s[k][p.id] = !s[k][p.id]; set(s); el.outerHTML = postCard(p, s); bindFeed(posts); };
      el.querySelector("[data-like]").onclick = () => flip("liked");
      el.querySelector("[data-save]").onclick = () => flip("saved");
      el.querySelector("[data-cmt]").onclick = () => { const c = el.querySelector(".post-c"); c.hidden = !c.hidden; };
      el.querySelector("[data-send]").onclick = () => sendModal(p.title);
      el.querySelector("[data-cform]").onsubmit = (e) => {
        e.preventDefault(); const v = e.target.querySelector("input").value.trim(); if (!v) return;
        p.comments.push([get().me.username, v]); const s = st(); set(s); el.outerHTML = postCard(p, s); bindFeed(posts);
        view.querySelector(`[data-post="${p.id}"] .post-c`).hidden = false;
      };
    });
  }

  // ---------- חלונות: פרסום ושליחה ----------
  function modal(html) {
    document.getElementById("socModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="socModal" role="dialog"><div class="card">${html}</div></div>`);
    const m = document.getElementById("socModal");
    m.onclick = (e) => { if (e.target === m || e.target.closest("[data-x]")) m.remove(); };
    return m;
  }
  async function mySummaries() { return (await store.listItems()).filter((x) => x.type === "summary" && x.kind !== "formulas").sort((a, b) => (b.date || "").localeCompare(a.date || "")); }
  async function publishModal() {
    const sums = await mySummaries();
    const m = modal(`<h2>שיתוף סיכום</h2>
      <label>איזה סיכום?<select id="pbSum">${sums.map((x) => `<option value="${esc(x.id)}">${esc(x.course || "")} – ${esc(x.title)}</option>`).join("") || "<option>עוד אין סיכומים</option>"}</select></label>
      <label>כמה מילים (לא חובה)<input id="pbTxt" placeholder="למשל: המרצה אמר שזה במבחן"></label>
      <fieldset class="vis"><legend>מי יראה?</legend>${Object.entries(VIS).map(([k, l], i) => `<label><input type="radio" name="vis" value="${k}" ${i === 0 ? "checked" : ""}> ${l}</label>`).join("")}</fieldset>
      <label class="row small" style="gap:8px;align-items:flex-start"><input type="checkbox" id="pbOwn" style="width:auto;margin-top:5px">זה סיכום שכתבתי בעצמי (לא מצגת או מבחן של המרצה)</label>
      <div class="row"><button class="btn" id="pbGo" type="button">פרסום</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
    $("#pbGo", m).onclick = () => {
      if (!$("#pbOwn", m).checked) return toast("אפשר לשתף רק סיכומים שכתבתם בעצמכם");
      const sm = sums.find((x) => x.id === $("#pbSum", m).value); if (!sm) return toast("אין סיכום לשתף");
      const s = st();
      s.myPosts.unshift({ id: "mine-" + Date.now(), by: s.me.username, course: sm.course || "", title: sm.title, text: $("#pbTxt", m).value.trim(), when: "עכשיו", vis: $('input[name="vis"]:checked', m).value, likes: 0, comments: [] });
      set(s); m.remove(); toast("פורסם (רק אצלך – זו דוגמה)"); feed();
    };
  }
  async function sendModal(title = "") {
    const s = st(); const sums = await mySummaries();
    const m = modal(`<h2>📤 שליחה לחבר</h2>
      ${title ? `<p class="muted">${esc(title)}</p>` : `<label>איזה סיכום?<select id="sdSum">${sums.map((x) => `<option>${esc(x.title)}</option>`).join("")}</select></label>`}
      <fieldset class="vis"><legend>למי?</legend>${s.friends.map((f) => `<label><input type="checkbox" value="${esc(f)}"> ${avatar(f)} ${esc(USERS[f]?.name || f)}</label>`).join("") || "<p class='muted small'>עוד אין חברים</p>"}</fieldset>
      <label>הודעה<input id="sdMsg" value="ראיתי שפספסת, הנה הסיכום 🙂"></label>
      <div class="row"><button class="btn" id="sdGo" type="button">שליחה</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
    $("#sdGo", m).onclick = () => {
      const to = [...m.querySelectorAll("fieldset input:checked")].map((i) => i.value);
      if (!to.length) return toast("בחרו לפחות חבר אחד");
      s.sent.push({ to, title: title || $("#sdSum", m)?.value, at: Date.now() }); set(s);
      m.remove(); toast(`נשלח ל-${to.map((f) => USERS[f]?.name || f).join(", ")} (דוגמה)`);
    };
  }

  // ---------- חברים: חיפוש לפי שם משתמש, בקשה, אישור הדדי ----------
  function friends() {
    if (needMe()) return;
    const s = st();
    const row = (id, btns) => `<div class="item">${avatar(id)}<a href="#u-${encodeURIComponent(id)}" style="flex:1;min-width:0;color:inherit;text-decoration:none"><span class="t">${esc(USERS[id]?.name || id)}</span><br><span class="small muted">@${esc(id)} · ${esc(USERS[id]?.uni || "")}</span></a>${btns}</div>`;
    view.innerHTML = `<div class="page">${DEMO}${subnav("social-friends")}
      <section class="soft" style="display:grid;gap:10px"><h3>הוספת חבר</h3>
        <form class="row" id="frForm"><input id="frQ" dir="ltr" placeholder="שם משתמש, למשל shira.g" aria-label="שם משתמש" style="flex:1"><button class="btn" type="submit">שליחת בקשה</button></form>
        <p class="small muted">החבר צריך לאשר. רק אחרי אישור של שניכם אתם רואים זה את זה כ"חברים". השם שלך: <b dir="ltr">@${esc(s.me.username)}</b> <button class="btn ghost" type="button" id="frShare" style="min-height:32px;padding:2px 10px">שיתוף קישור</button></p>
      </section>
      ${s.incoming.length ? `<section style="display:grid;gap:8px"><h3>בקשות חדשות (${s.incoming.length})</h3>${s.incoming.map((id) => row(id, `<button class="btn" data-ok="${esc(id)}" type="button">אישור</button><button class="btn ghost" data-no="${esc(id)}" type="button">לא עכשיו</button>`)).join("")}</section>` : ""}
      ${s.pending.length ? `<section style="display:grid;gap:8px"><h3>ממתינים לאישור</h3>${s.pending.map((id) => row(id, '<span class="chip">⏳ נשלחה</span>')).join("")}</section>` : ""}
      <section style="display:grid;gap:8px"><h3>החברים שלי (${s.friends.length})</h3>${s.friends.map((id) => row(id, `<button class="btn ghost" data-snd="${esc(id)}" type="button">📤</button>`)).join("")}</section></div>`;
    $("#frForm").onsubmit = (e) => {
      e.preventDefault();
      const id = $("#frQ").value.trim().replace(/^@/, "").toLowerCase();
      if (!USERS[id]) return toast("לא מצאנו משתמש כזה (בדוגמה נסו: shira.g או daniel_r)");
      if (s.friends.includes(id) || s.pending.includes(id)) return toast("כבר חברים או שהבקשה כבר נשלחה");
      s.pending.push(id); set(s); friends();
      // בדוגמה: החבר "מאשר" אחרי כמה שניות
      setTimeout(() => { const t = st(); t.pending = t.pending.filter((x) => x !== id); if (!t.friends.includes(id)) t.friends.push(id); set(t); toast(`🎉 ${USERS[id].name} אישר/ה את הבקשה`); if (location.hash === "#social-friends") friends(); }, 4000);
    };
    $("#frShare").onclick = () => { const t = `הוסיפו אותי בסיכומון: @${s.me.username}`; navigator.share ? navigator.share({ text: t }).catch(() => {}) : (navigator.clipboard?.writeText(t), toast("הועתק")); };
    view.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = () => { s.incoming = s.incoming.filter((x) => x !== b.dataset.ok); s.friends.push(b.dataset.ok); set(s); toast("אתם חברים עכשיו 🙌"); friends(); }));
    view.querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => { s.incoming = s.incoming.filter((x) => x !== b.dataset.no); set(s); friends(); }));
    view.querySelectorAll("[data-snd]").forEach((b) => (b.onclick = () => sendModal()));
  }

  // ---------- פספסתי שיעור ----------
  function missed() {
    if (needMe()) return;
    const courses = ctx.prefs.get()?.courses || [];
    view.innerHTML = `<div class="page">${DEMO}${subnav("social-missed")}
      <section class="card" style="display:grid;gap:12px"><h2>🙋 לא הייתי בשיעור, ואין הקלטה</h2>
        <label>איזה קורס?<select id="msC">${courses.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label>איזה תאריך?<input type="date" id="msD" value="${today.toISOString().slice(0, 10)}"></label>
        <button class="btn" type="button" id="msGo">לבקש מהחברים בקורס</button></section>
      <section class="soft" style="display:grid;gap:8px"><h3>עוד דרכים להשלים</h3>
        <a class="item" href="#notebooks"><span><span class="t">📚 החומר מהמודל</span><br><span class="small muted">מצגת השיעור, ומשם סיכום ופודקאסט עם AI</span></span></a>
        <div class="item"><span><span class="t">🔁 הקבוצה המקבילה</span><br><span class="small muted">אם יש לקורס קבוצה נוספת עם הקלטה, נציע אותה</span></span></div>
        <div class="item"><span><span class="t">🗂️ סיכומים משנים קודמות</span><br><span class="small muted">של אותו קורס ואותו מרצה, מסטודנטים ששיתפו</span></span></div>
      </section><div id="msOut"></div></div>`;
    $("#msGo").onclick = () => {
      $("#msOut").innerHTML = `<section style="display:grid;gap:8px"><h3>✅ הבקשה נשלחה ל-3 חברים מהקורס</h3>
        <div class="item">${avatar("noa_k")}<span style="flex:1"><span class="t">נועה שלחה סיכום</span><br><span class="small muted">"הנה, יש שם גם את הדוגמה מהלוח"</span></span><span class="chip ok">חדש</span></div>
        <div class="item">${avatar("maya_b")}<span style="flex:1"><span class="t">מאיה שלחה 2 תמונות מהלוח</span></span></div>
        <p class="small muted">בגרסה האמיתית: החברים מקבלים התראה, ומה שהם שולחים נכנס ישר למחברת של השיעור אצלכם.</p></section>`;
    };
  }

  // ---------- פרופיל ----------
  function profileView(id) {
    const s = st(); const mine = s.me && id === s.me.username;
    const u = mine ? { ...s.me, color: "#0F172A" } : USERS[id];
    if (!u) { view.innerHTML = `<div class="page">${DEMO}<p>לא מצאנו את @${esc(id)}</p></div>`; return; }
    const ig = safeLink(u.ig, "instagram.com"), li = safeLink(u.li, "linkedin.com");
    const posts = [...s.myPosts, ...POSTS].filter((p) => p.by === id);
    const friend = s.friends.includes(id);
    view.innerHTML = `<div class="page" style="max-width:720px">${DEMO}${mine ? subnav("me") : ""}
      <section class="card prof"><div class="row" style="gap:16px">${avatar(id, true)}<span style="min-width:0;flex:1"><h1 style="font-size:28px">${esc(u.name)}</h1><span class="muted" dir="ltr">@${esc(id)}</span><br><span class="small muted">${esc(u.uni || "")} · ${esc(u.degree || "")}</span></span></div>
        ${u.bio ? `<p>${esc(u.bio)}</p>` : mine ? '<p class="muted">עוד לא כתבת משהו על עצמך</p>' : ""}
        <div class="row">${ig ? `<a class="btn ghost" href="${esc(ig)}" target="_blank" rel="noopener noreferrer">📸 Instagram</a>` : ""}${li ? `<a class="btn ghost" href="${esc(li)}" target="_blank" rel="noopener noreferrer">💼 LinkedIn</a>` : ""}
          ${mine ? '<button class="btn" type="button" id="edit">עריכת פרופיל</button>' : friend ? '<span class="chip ok">✓ חברים</span><button class="btn ghost" type="button" id="snd">📤 שליחת סיכום</button>' : s.pending.includes(id) ? '<span class="chip">⏳ מחכים לאישור</span>' : '<button class="btn" type="button" id="add">➕ בקשת חברות</button>'}</div>
        ${mine && s.reservist ? `<p class="soft small">🎖️ הנחת מילואים 20%: ${s.reservist.verified ? "מאומת" : `פעילה. נשאר להעלות אישור עד ${new Date(Date.parse(s.reservist.since) + 30 * 864e5).toLocaleDateString("he-IL")}`} <button class="btn ghost" type="button" id="resUp" style="min-height:32px;padding:2px 10px">העלאת אישור</button></p>` : ""}
      </section>
      <h2 style="font-size:20px">מה ${mine ? "שיתפתי" : "שיתף/ה"} (${posts.length})</h2>
      <div class="feed">${posts.map((p) => postCard(p, s)).join("") || '<p class="muted">עוד אין</p>'}</div></div>`;
    bindFeed(posts);
    $("#edit") && ($("#edit").onclick = editMe);
    $("#snd") && ($("#snd").onclick = () => sendModal());
    $("#add") && ($("#add").onclick = () => { s.pending.push(id); set(s); toast("הבקשה נשלחה. מחכים לאישור"); profileView(id); });
    if ($("#resUp")) $("#resUp").onclick = () => {
      const m = modal(`<h2>🎖️ העלאת אישור מילואים</h2>
        <ol class="small"><li>מורידים "אישור משרת מילואים פעיל" מאתר המילואים או מקבלים מהיחידה.</li><li><b>מסתירים את מספר תעודת הזהות</b> (מספיק לצלם עם האצבע עליו).</li><li>מעלים כאן. אנחנו בודקים, <b>מוחקים את הקובץ</b>, ושומרים רק "מאומת עד תאריך".</li></ol>
        <input type="file" accept="image/*,application/pdf" id="resFile"><div class="row"><button class="btn" id="resGo" type="button">שליחה לבדיקה</button><button class="btn ghost" data-x type="button">סגירה</button></div>`);
      $("#resGo", m).onclick = () => { if (!$("#resFile", m).files.length) return toast("בחרו קובץ"); m.remove(); toast("בדוגמה הקובץ לא נשלח לשום מקום ✓"); };
    };
  }
  function editMe() {
    const s = st(); const me = s.me;
    const m = modal(`<h2>עריכת פרופיל</h2>
      <label>על עצמי<textarea id="eBio" rows="3" maxlength="200">${esc(me.bio)}</textarea></label>
      <label>תואר ושנה<input id="eDeg" value="${esc(me.degree)}"></label>
      <label>קישור לאינסטגרם<input id="eIg" dir="ltr" value="${esc(me.ig)}" placeholder="https://instagram.com/..."></label>
      <label>קישור ללינקדאין<input id="eLi" dir="ltr" value="${esc(me.li)}" placeholder="https://linkedin.com/in/..."></label>
      <div class="row"><button class="btn" id="eGo" type="button">שמירה</button><button class="btn ghost" data-x type="button">ביטול</button></div>`);
    $("#eGo", m).onclick = () => {
      const ig = $("#eIg", m).value.trim(), li = $("#eLi", m).value.trim();
      if (ig && !safeLink(ig, "instagram.com")) return toast("קישור אינסטגרם צריך להתחיל ב-https://instagram.com");
      if (li && !safeLink(li, "linkedin.com")) return toast("קישור לינקדאין צריך להתחיל ב-https://linkedin.com");
      Object.assign(me, { bio: $("#eBio", m).value.trim(), degree: $("#eDeg", m).value.trim(), ig, li }); set(s); m.remove(); profileView(me.username);
    };
  }

  // פעמון: ימי הולדת של חברים היום (להודעות באפליקציה)
  function birthdaysToday() { const s = get(); if (!s.me) return []; return (s.friends || ["noa_k", "maya_b", "itay.levi"]).filter((f) => USERS[f]?.bday === mmdd(today)).map((f) => USERS[f].name); }

  return {
    feed, friends, missed, signup, birthdaysToday,
    me: () => (needMe() ? null : profileView(get().me.username)),
    profile: (id) => profileView(id),
  };
}
