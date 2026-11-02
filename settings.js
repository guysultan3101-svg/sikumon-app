// ⚙️ הגדרות: לימודים ("איך אני לומד/ת"), AI, מנוי, חשבון (סיסמה, הורדת המידע, יציאה, מחיקה),
// פרטיות וחסימות, נגישות, ומידע משפטי. הכול אמיתי – מול השרת או נשמר במכשיר.

export function initSettings(ctx) {
  const { view, $, esc, toast, prefs, store, ai, social, api, onboardingQuestions, version } = ctx;

  // ---------- נגישות: גודל טקסט ומצב כהה (נשמר במכשיר, מופעל בכל פתיחה) ----------
  function applyUI() {
    const ui = prefs.get()?.ui || {};
    document.documentElement.dataset.theme = ui.theme && ui.theme !== "auto" ? ui.theme : "";
    if (!document.documentElement.dataset.theme) delete document.documentElement.dataset.theme;
    document.body.style.zoom = ui.size && ui.size !== 1 ? ui.size : "";
    document.documentElement.classList.toggle("calm", !!ui.calm);
  }
  const saveP = (fn) => { const p = prefs.get() || {}; fn(p); prefs.set(p); };

  const SECTIONS = [["study", "📚 לימודים"], ["ai", "🤖 AI"], ["account", "👤 חשבון"], ["privacy", "🔒 פרטיות ובטיחות"], ["access", "♿ נגישות ותצוגה"], ["sub", "💳 מנוי"], ["legal", "📄 מידע ותמיכה"]];
  const toggle = (id, label, on, sub = "") => `<label class="set-row"><span>${label}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><input type="checkbox" class="switch" id="${id}" ${on ? "checked" : ""}></label>`;
  const select = (id, label, opts, val) => `<label class="set-row"><span>${label}</span><select id="${id}" style="width:auto;max-width:55%">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;

  async function page(section) {
    const p = prefs.get() || {};
    const ui = p.ui || {}, priv = p.privacy || {};
    const me = api.profile();
    await ai.loadQuota?.();
    // החסומים שלי (עם שמות)
    let blocked = [];
    try { const bl = await api.blocks(); blocked = bl.length ? await api.profiles(bl.map((b) => b.blocked)) : []; } catch { /* בלי אינטרנט */ }
    view.innerHTML = `<div class="page settings" style="max-width:760px">
      <h1 style="font-size:32px">⚙️ הגדרות</h1>
      <nav class="snav" aria-label="חלקי ההגדרות">${SECTIONS.map(([k, l]) => `<a href="#settings-${k}" ${section === k ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>

      <section class="soft set" id="set-study"><h2>📚 לימודים</h2>
        <h3>איך אני לומד/ת</h3><p class="small muted">הסיכומים, המבחנים והעוזר מותאמים לפי התשובות כאן. אפשר לשנות בכל רגע.</p>
        ${onboardingQuestions.map((q) => select("lq-" + q.id, q.q, q.options.map((o) => [o, o]), p[q.id] || "")).join("")}
        <label class="set-row" style="display:grid"><span>הקורסים שלי (שורה לכל קורס)</span><textarea id="setCourses" rows="5">${esc((p.courses || []).join("\n"))}</textarea></label>
        <div class="row"><button class="btn ghost" type="button" id="saveCourses">שמירת הקורסים</button><a class="btn ghost" href="#timetable">🕘 מערכת השעות</a><a class="btn ghost" href="#summaries">🔗 חיבור למודל</a></div>
      </section>

      <section class="soft set" id="set-ai"><h2>🤖 ה-AI שלי</h2>
        <p>מחברים את ה-AI שלך, וכל השיחות נשארות כאן באפליקציה: העוזר, "שאל את השיעור" ו"הסבר נוסף". אנחנו לא רואים את המפתח, והוא נשמר רק במכשיר הזה.</p>
        <p class="small">בשימוש עכשיו: <b id="gState">${ai.provider() ? ai.PROVIDERS[ai.provider()].name : "עוד לא חיברת"}</b> ${ai.hasAI() ? '<button class="btn ghost" type="button" id="gTest" style="min-height:32px;padding:2px 10px">בדיקה</button>' : ""}</p>
        ${ai.builtIn() ? `<div class="ai-card${ai.provider() === "sikumon" ? " cur" : ""}" data-prov="sikumon">
          <div class="row" style="justify-content:space-between"><h3>🎁 העוזר של סיכומון</h3>${ai.provider() === "sikumon" ? '<span class="chip ok">✓ בשימוש</span>' : '<button class="btn ghost" type="button" data-use="sikumon" style="min-height:32px;padding:2px 10px">להשתמש בזה</button>'}</div>
          <p class="small muted">כלול באפליקציה, בלי להתחבר לשום דבר. בתקופת הבדיקות: ${ai.quota().limit} שאלות ביום (נשארו היום: <b>${Math.max(ai.quota().limit - ai.quota().used, 0)}</b>).</p></div>
          <details class="soft"><summary><b>רוצים בלי הגבלה? חברו AI משלכם</b></summary><div style="display:grid;gap:10px;margin-top:10px">` : ""}
        ${aiCard("gemini", "🆓 Gemini של גוגל", "חינם, בלי כרטיס אשראי. יכול גם לחפש באינטרנט (עד 500 חיפושים ביום).",
          `<ol class="small"><li>נכנסים ל-<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> עם חשבון גוגל <b>פרטי</b> (חשבון של מוסד לימודים חוסם את זה לפעמים).</li><li>לוחצים "Create API key", מעתיקים ומדביקים כאן.</li></ol>
          <p class="small muted">במסלול החינמי גוגל רשאית להשתמש בשאלות לשיפור המערכות שלה, אז לא כותבים פרטים אישיים.</p>`, "AIza…")}
        ${aiCard("openrouter", "🔑 OpenRouter: חשבון אחד לכל ה-AI", "מתחברים בלחיצה, בלי להעתיק מפתח. בוחרים GPT, Claude, Gemini ועוד. יש מודלים חינמיים (עד 50 שאלות ביום), ומודלים בתשלום מהקרדיט שלך.",
          `<button class="btn" type="button" id="orLogin">התחברות עם OpenRouter</button>
          <p class="small muted">באייפד, אם אחרי ההתחברות לא חזרת לכאן מחובר/ת: יוצרים מפתח ב-<a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/settings/keys</a> ומדביקים:</p>`, "sk-or-…")}
        ${aiCard("openai", "💬 ChatGPT", "מפתח API של OpenAI. בתשלום לפי שימוש (סנטים לשאלה), ונפרד ממנוי ChatGPT Plus.",
          `<p class="small">יוצרים מפתח ב-<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>.</p>`, "sk-…")}
        ${aiCard("claude", "✳️ Claude", "מפתח API של Anthropic. בתשלום לפי שימוש, ונפרד ממנוי Claude Pro.",
          `<p class="small">יוצרים מפתח ב-<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>.</p>`, "sk-ant-…")}
        ${ai.builtIn() ? "</div></details>" : ""}
        <p class="small muted">למה אי אפשר פשוט "להתחבר עם המנוי" של ChatGPT, Claude או Gemini? החברות לא מאפשרות לאפליקציות אחרות להשתמש במנויים. מפתח API (או OpenRouter) הוא הדרך המותרת להשתמש ב-AI שלך מתוך אפליקציה אחרת.</p>
      </section>

      <section class="soft set" id="set-sub"><h2>💳 מנוי</h2>
        <div class="set-row"><span>התוכנית שלי</span><b>גרסת בדיקה – חינם</b></div>
        <p class="small muted">בתקופת הבדיקות הכול בחינם ושום דבר לא מחויב. מנוי, ביטול מנוי והנחת מילואים יופיעו כאן כשהאפליקציה תצא רשמית.</p>
      </section>

      <section class="soft set" id="set-account"><h2>👤 חשבון</h2>
        <div class="set-row"><span>שם משתמש</span><b dir="ltr">@${esc(me?.username || "")}</b></div>
        <div class="set-row"><span>מייל</span><b dir="ltr">${esc(api.user()?.email || "")}</b></div>
        <div class="row"><button class="btn ghost" type="button" id="editProf">עריכת פרופיל</button><button class="btn ghost" type="button" id="chPass">שינוי סיסמה</button></div>
        <div class="row"><button class="btn ghost" type="button" id="exportData">⬇️ הורדת כל המידע שלי</button><button class="btn ghost" type="button" id="logout">יציאה מהחשבון</button></div>
        <button class="btn danger" type="button" id="delAcc">מחיקת החשבון</button>
        <p class="small muted">מחיקת החשבון מוחקת לצמיתות מהשרת את הפרופיל, החברים, ההודעות, הסיכומים והפוסטים שלך.</p>
      </section>

      <section class="soft set" id="set-privacy"><h2>🔒 פרטיות ובטיחות</h2>
        ${select("pvPosts", "ברירת מחדל לפוסט חדש", [["friends", "👥 חברים"], ["course", "🎓 כל מי שלומד את הקורס"], ["public", "🌍 כולם"]], priv.posts || "friends")}
        <p class="small muted">יום ההולדת שלך מוצג רק לחברים. הודעה ממי שאינו חבר נכנסת ל"בקשות", והוא לא יודע שקראת עד שתאשר/י. הסיכומים שלך מוצגים רק לחברים ששיתפת איתם קורס ב"אותה כיתה", ורק אם גם הם שיתפו איתך.</p>
        <h3>חסומים (${blocked.length})</h3>
        <div class="list">${blocked.map((b) => `<div class="item"><span dir="ltr">@${esc(b.username)}</span><button class="btn ghost" type="button" data-unblock="${esc(b.id)}">ביטול חסימה</button></div>`).join("") || '<p class="small muted">אין משתמשים חסומים</p>'}</div>
        <p class="small muted">על כל פוסט, הודעה ומשתמש יש "דיווח" ו"חסימה". דיווחים נבדקים תוך 24 שעות.</p>
      </section>

      <section class="soft set" id="set-access"><h2>♿ נגישות ותצוגה</h2>
        ${select("uiSize", "גודל טקסט", [[1, "רגיל"], [1.12, "גדול"], [1.25, "גדול מאוד"]], ui.size || 1)}
        ${select("uiTheme", "מצב תצוגה", [["auto", "לפי המכשיר"], ["light", "בהיר"], ["dark", "כהה"]], ui.theme || "auto")}
        ${toggle("uiCalm", "פחות אנימציות", !!ui.calm)}
        <a class="item" href="#legal-access"><span class="t">הצהרת נגישות</span></a>
      </section>

      <section class="soft set" id="set-legal"><h2>📄 מידע ותמיכה</h2>
        <div class="list"><a class="item" href="#legal-terms"><span class="t">תנאי שימוש</span></a><a class="item" href="#legal-privacy"><span class="t">מדיניות פרטיות</span></a><a class="item" href="#legal-access"><span class="t">הצהרת נגישות</span></a>
        <a class="item" href="#feedback"><span><span class="t">✉️ יצירת קשר ומשוב</span><br><span class="small muted">תקלה, רעיון או בקשה</span></span></a><a class="item" href="#diag"><span><span class="t">🩺 בדיקת מכשיר</span><br><span class="small muted">דוח לשליחה כשמשהו לא עובד</span></span></a></div>
        <p class="small muted">גרסת האפליקציה: <b>${version()}</b></p>
      </section>
    </div>`;
    bind();
    // אחרי שהניתוב גולל לראש הדף – גוללים לחלק שביקשו
    if (section) setTimeout(() => document.getElementById("set-" + section)?.scrollIntoView({ block: "start" }), 60);
  }

  // ---------- כרטיס לכל ספק AI: חיבור, בחירת מודל, "להשתמש בזה", ניתוק ----------
  const KEY_RULES = { gemini: [/^AIza[\w-]{20,}$/, "מפתח של גוגל מתחיל ב-AIza"], openai: [/^sk-[\w-]{20,}$/, "מפתח של OpenAI מתחיל ב-sk-"], openrouter: [/^sk-or-[\w-]{20,}$/, "מפתח של OpenRouter מתחיל ב-sk-or-"], claude: [/^sk-ant-[\w-]{20,}$/, "מפתח של Anthropic מתחיל ב-sk-ant-"] };
  function aiCard(p, title, desc, how, placeholder) {
    const on = !!ai.keyOf(p), cur = ai.provider() === p;
    return `<div class="ai-card${cur ? " cur" : ""}" data-prov="${p}">
      <div class="row" style="justify-content:space-between"><h3>${title}</h3>${on ? (cur ? '<span class="chip ok">✓ בשימוש</span>' : `<button class="btn ghost" type="button" data-use="${p}" style="min-height:32px;padding:2px 10px">להשתמש בזה</button>`) : ""}</div>
      <p class="small muted">${desc}</p>
      ${on ? `<div class="row small">✅ מחובר ${p === "openrouter" || p === "openai" ? `<select data-model="${p}" style="width:auto;max-width:100%;flex:1"><option>טוען מודלים…</option></select>` : ""}<button class="btn ghost" type="button" data-off="${p}" style="min-height:32px;padding:2px 10px">ניתוק</button></div>`
        : `${how}${placeholder ? `<div class="row"><input type="password" data-key="${p}" autocomplete="off" spellcheck="false" placeholder="${placeholder}" style="flex:1;min-width:180px;direction:ltr"><button class="btn" type="button" data-save="${p}">חיבור</button></div>` : ""}`}
    </div>`;
  }
  function bindAI() {
    view.querySelectorAll("[data-save]").forEach((b) => (b.onclick = () => {
      const p = b.dataset.save, k = view.querySelector(`[data-key="${p}"]`).value.trim();
      if (!KEY_RULES[p][0].test(k)) return toast("זה לא נראה כמו מפתח תקין: " + KEY_RULES[p][1]);
      ai.setKeyOf(p, k); ai.setProvider(p); toast("חובר ✓"); page("ai");
    }));
    view.querySelectorAll("[data-use]").forEach((b) => (b.onclick = () => { ai.setProvider(b.dataset.use); page("ai"); }));
    view.querySelectorAll("[data-off]").forEach((b) => (b.onclick = () => { ai.setKeyOf(b.dataset.off, ""); toast("נותק"); page("ai"); }));
    $("#orLogin") && ($("#orLogin").onclick = () => ai.openRouterLogin());
    $("#gTest") && ($("#gTest").onclick = async () => { $("#gTest").disabled = true; $("#gState").textContent = "בודק…"; try { const r = await ai.testKey(); $("#gState").textContent = `✅ ${ai.PROVIDERS[ai.provider()].name} עובד (${r.slice(0, 20)})`; } catch (e) { $("#gState").textContent = "❌ " + e.message; } $("#gTest").disabled = false; });
    // רשימת מודלים לבחירה (OpenRouter: קודם החינמיים)
    view.querySelectorAll("[data-model]").forEach(async (sel) => {
      const p = sel.dataset.model;
      try {
        // קודם חינמיים של חברות מוכרות (טובים יותר בעברית), אחר כך שאר החינמיים, ואז בתשלום
        const rank = (m) => (m.free ? 0 : 2) + (m.free && !/^(google|meta-llama|deepseek|qwen|mistralai|openai)\//.test(m.id) ? 1 : 0);
        const list = (await ai.listModels(p)).sort((a, b) => rank(a) - rank(b));
        if (!ai.modelOf(p) && list.length) ai.setModelOf(p, list[0].id);
        sel.innerHTML = list.map((m) => `<option value="${esc(m.id)}" ${m.id === ai.modelOf(p) ? "selected" : ""}>${m.free ? "🆓 " : ""}${esc(m.name)}</option>`).join("");
        sel.onchange = () => { ai.setModelOf(p, sel.value); toast("המודל נשמר ✓"); };
      } catch (e) { sel.innerHTML = `<option>${esc(e.message)}</option>`; }
    });
  }

  function confirmModal(html, onOk, okLabel = "אישור", danger = true) {
    document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="setModal" role="dialog"><div class="card">${html}<div class="row"><button class="btn ${danger ? "danger" : ""}" type="button" id="mOk">${okLabel}</button><button class="btn ghost" type="button" id="mNo">חזרה</button></div></div></div>`);
    const m = document.getElementById("setModal");
    $("#mNo", m).onclick = () => m.remove();
    $("#mOk", m).onclick = async () => { $("#mOk", m).disabled = true; const r = await onOk(m); if (r !== false) m.remove(); else if (m.isConnected) $("#mOk", m).disabled = false; };
  }

  function bind() {
    // איך אני לומד/ת: נשמר מיד, גם בשרת (הסיכומים האישיים נכתבים לפיו)
    onboardingQuestions.forEach((q) => ($("#lq-" + q.id).onchange = (e) => { saveP((p) => (p[q.id] = e.target.value)); social.pushPrefs(); toast("נשמר ✓ הסיכומים הבאים יותאמו לזה"); }));
    $("#saveCourses").onclick = () => { const c = $("#setCourses").value.split("\n").map((x) => x.trim()).filter(Boolean); if (!c.length) return toast("צריך לפחות קורס אחד"); saveP((p) => (p.courses = c)); social.pushPrefs(); toast("הקורסים נשמרו ✓"); };
    // AI
    bindAI();
    // חשבון
    $("#editProf").onclick = () => social.editMe();
    $("#chPass").onclick = () => confirmModal(`<h2>שינוי סיסמה</h2><label>סיסמה חדשה (8 תווים לפחות)<input type="password" id="newPass" autocomplete="new-password"></label>`, async (m) => {
      try { await api.changePassword($("#newPass", m).value); toast("הסיסמה עודכנה ✓"); m.remove(); } catch (e) { toast(e.message); }
      return false;
    }, "שמירה", false);
    $("#exportData").onclick = exportData;
    $("#logout").onclick = () => confirmModal("<h2>לצאת מהחשבון?</h2><p>המחברות וההקלטות נשארים במכשיר.</p>", async () => { await api.signOut(); location.hash = "#home"; dispatchEvent(new HashChangeEvent("hashchange")); }, "יציאה", false);
    $("#delAcc").onclick = () => confirmModal(`<h2>מחיקת החשבון</h2><p>הפרופיל, החברים, ההודעות, הסיכומים והפוסטים יימחקו מהשרת לצמיתות.</p>
      <label class="row small" style="gap:8px"><input type="checkbox" id="delAll" style="width:auto"> למחוק גם את המחברות וההקלטות מהמכשיר</label>
      <label>כדי לאשר, כתבו <b>מחיקה</b><input id="delTxt" autocomplete="off"></label>`, async (m) => {
      if ($("#delTxt", m).value.trim() !== "מחיקה") { toast('כתבו "מחיקה" כדי לאשר'); return false; }
      try { await api.deleteAccount(); } catch (e) { toast(e.message); return false; }
      if ($("#delAll", m).checked) { try { localStorage.clear(); } catch { /* */ } indexedDB.deleteDatabase("sikumon"); setTimeout(() => location.reload(), 300); return; }
      toast("החשבון נמחק"); location.hash = "#home"; dispatchEvent(new HashChangeEvent("hashchange"));
    }, "מחיקה לצמיתות");
    // פרטיות
    $("#pvPosts").onchange = (e) => saveP((p) => { (p.privacy ??= {}).posts = e.target.value; });
    view.querySelectorAll("[data-unblock]").forEach((b) => (b.onclick = async () => { try { await api.unblock(b.dataset.unblock); page("privacy"); } catch (e) { toast(e.message); } }));
    // נגישות
    $("#uiSize").onchange = (e) => { saveP((p) => ((p.ui ??= {}).size = +e.target.value)); applyUI(); };
    $("#uiTheme").onchange = (e) => { saveP((p) => ((p.ui ??= {}).theme = e.target.value)); applyUI(); };
    $("#uiCalm").onchange = (e) => { saveP((p) => ((p.ui ??= {}).calm = e.target.checked)); applyUI(); };
  }

  // הורדת כל המידע שלי (חוק הגנת הפרטיות): קובץ JSON עם מה שבשרת ומה שבמכשיר, בלי קובצי הקול
  async function exportData() {
    toast("מכין את הקובץ…");
    const strip = (o) => { const c = { ...o }; delete c.blob; return c; };
    const safe = async (fn) => { try { return await fn(); } catch { return null; } };
    const data = {
      exportedAt: new Date().toISOString(), email: api.user()?.email, profile: api.profile(), prefs: prefs.get(),
      server: { summaries: await safe(api.summaries), friendships: await safe(api.friendships), courseShares: await safe(api.shares), messages: await safe(api.messages), posts: (await safe(api.posts))?.filter((x) => x.author === api.user()?.id), notifications: await safe(api.notifications) },
      device: {
        library: (await store.listItems()).filter((x) => x.type !== "pod-audio").map(strip),
        notebooks: (await store.listLessons()).map((l) => ({ ...l, thumb: undefined })),
        recordings: (await store.listRecordings()).map((r) => ({ id: r.id, course: r.course, startedAt: r.startedAt, marks: r.marks })),
      },
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = `sikumon-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- דפים משפטיים (טיוטה – לפני השקה עוברים על זה עם עורך דין) ----------
  const LEGAL = {
    terms: ["תנאי שימוש", `<p><b>טיוטה לגרסת הבדיקה.</b></p><ul><li>סיכומון הוא כלי עזר ללמידה. האחריות על הלמידה ועל ההכנה למבחנים היא של הסטודנט.</li><li>משתפים רק תוכן שכתבתם בעצמכם. אסור לשתף מצגות, מבחנים או קבצים של מרצים ושל המוסד.</li><li>אסור להטריד, לפגוע או לפרסם תוכן לא חוקי. אפשר לדווח ולחסום, ואנחנו מסירים תוכן פוגעני.</li><li>הקלטת שיעורים מותרת רק לשימוש אישי ולפי כללי המוסד והמרצה.</li><li>ביטול מנוי: בכל רגע, באפליקציה, בלי דמי ביטול. בתוך 14 יום – החזר כספי.</li><li>פרטי העסק (שם, מספר עוסק, כתובת): יושלמו לפני ההשקה.</li></ul>`],
    privacy: ["מדיניות פרטיות", `<p><b>טיוטה לגרסת הבדיקה.</b></p><ul><li><b>מה נשמר:</b> שם, שם משתמש, מייל אוניברסיטה, ומה שבחרתם לשתף. בגרסת הבדיקה המחברות וההקלטות נשמרות רק במכשיר שלכם.</li><li><b>AI:</b> שאלות לעוזר נשלחות לספק ה-AI (גוגל או Anthropic) רק כדי לענות עליהן.</li><li><b>אישור מילואים:</b> נבדק ונמחק. נשמר רק "מאומת עד תאריך".</li><li><b>מפרסמים:</b> לא מקבלים שום פרט אישי. אנחנו לא מוכרים מידע.</li><li><b>הזכויות שלכם</b> (חוק הגנת הפרטיות): לעיין במידע, לתקן אותו, להוריד אותו ולמחוק אותו. הכול זמין בהגדרות ← חשבון.</li><li>יצירת קשר בנושא פרטיות: דרך "יצירת קשר ומשוב".</li></ul>`],
    access: ["הצהרת נגישות", `<p>אנחנו עובדים כדי שהאפליקציה תהיה נגישה לכולם, לפי תקן ישראלי 5568 (WCAG 2.0 ברמה AA).</p><ul><li>אפשר להגדיל טקסט ולבחור מצב כהה בהגדרות ← נגישות.</li><li>כל הכפתורים נגישים לקורא מסך ולמקלדת.</li><li>הקראה בקול של סיכומים, ופודקאסט לכל שיעור.</li></ul><p>נתקלתם בבעיית נגישות? כתבו לנו דרך "יצירת קשר ומשוב" ונטפל תוך 14 יום. רכז/ת נגישות ופרטי קשר: יושלמו לפני ההשקה.</p>`],
  };
  function legal(k) {
    const [t, body] = LEGAL[k] || LEGAL.terms;
    view.innerHTML = `<div class="page" style="max-width:720px"><h1 style="font-size:30px">${t}</h1><article class="md-body">${body}</article><a href="#settings-legal">חזרה להגדרות</a></div>`;
  }

  return { page, legal, applyUI };
}
