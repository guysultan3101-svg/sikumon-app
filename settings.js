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
        ${aiCard("gemini", "🆓 Gemini של גוגל", "חינם, בלי כרטיס אשראי, עם מפתח אישי של גוגל.",
          `<ol class="small"><li>נכנסים ל-<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> עם חשבון גוגל <b>פרטי</b> (חשבון של מוסד לימודים חוסם את זה לפעמים).</li><li>לוחצים "Create API key", מעתיקים ומדביקים כאן.</li></ol>
          <p class="small muted">במסלול החינמי גוגל רשאית להשתמש בשאלות לשיפור המערכות שלה, אז לא כותבים פרטים אישיים.</p>`, "AIza…")}
        ${aiCard("openai", "💬 ChatGPT", "מפתח API של OpenAI. בתשלום לפי שימוש (סנטים לשאלה), ונפרד ממנוי ChatGPT Plus.",
          `<p class="small">יוצרים מפתח ב-<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>.</p>`, "sk-…")}
        ${ai.builtIn() ? "</div></details>" : ""}
        <p class="small muted">למה אי אפשר פשוט "להתחבר עם המנוי" של ChatGPT או Gemini? החברות לא מאפשרות לאפליקציות אחרות להשתמש במנויים. מפתח API הוא הדרך המותרת להשתמש ב-AI שלך מתוך אפליקציה אחרת.</p>
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
        ${select("pvPosts", "ברירת מחדל לפוסט חדש", [["friends", "👥 כל החברים שלי"], ["course_friends", "🎓 החברים שלי מהקורס"], ["course", "🏫 כל מי שרשום לקורס"], ["public", "🌍 כולם"]], priv.posts || "friends")}
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
        <a class="item" href="#legal-support"><span><span class="t">✉️ תמיכה ויצירת קשר</span><br><span class="small muted">מייל לתמיכה, משוב ובדיקת מכשיר</span></span></a><a class="item" href="#diag"><span><span class="t">🩺 בדיקת מכשיר</span><br><span class="small muted">דוח לשליחה כשמשהו לא עובד</span></span></a></div>
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
    $("#chPass").onclick = () => confirmModal(`<h2>שינוי סיסמה</h2><label>סיסמה חדשה (12 תווים לפחות)<input type="password" id="newPass" autocomplete="new-password"></label>`, async (m) => {
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

  // ---------- מסמכים משפטיים (לפני השקה בתשלום – לעבור עם עורך/ת דין ולהשלים את פרטי העסק) ----------
  const SUPPORT = "guysultan3101@gmail.com";
  const UPDATED = "3.11.2026";
  const mail = `<a href="mailto:${SUPPORT}">${SUPPORT}</a>`;
  const LEGAL = {
    privacy: ["מדיניות פרטיות", `
      <p class="small muted">עודכן לאחרונה: ${UPDATED}</p>
      <p>המדיניות מסבירה איזה מידע אנחנו אוספים בסיכומון, למה, עם מי הוא משותף, ומה הזכויות שלכם. היא נכתבה לפי חוק הגנת הפרטיות, התשמ"א–1981, ותקנותיו (כולל תיקון 13).</p>
      <h3>מי אחראי על המידע</h3>
      <p>סיכומון מופעל על ידי גיא סולטן (עוסק פטור מס' <b>[יושלם]</b>). פניות בנושא פרטיות: ${mail}.</p>
      <h3>איזה מידע נאסף</h3>
      <ul>
        <li><b>חשבון:</b> שם, שם משתמש, מייל של מוסד הלימודים, מוסד ותואר, ויום הולדת (רק אם בחרתם למלא).</li>
        <li><b>העדפות לימוד:</b> התשובות לשאלון "איך אני לומד/ת" ורשימת הקורסים.</li>
        <li><b>תוכן שיצרתם:</b> סיכומים, פוסטים, תמונות וקבצים שהעליתם, תגובות, הודעות, חברויות ושיתופי "אותה כיתה".</li>
        <li><b>שימוש:</b> אילו מסכים פתחתם ומתי (בלי התוכן עצמו), ומספר השאלות לעוזר והסיכומים בכל יום.</li>
        <li><b>במכשיר בלבד:</b> מחברות, הקלטות של שיעורים ומפתחות AI אישיים נשמרים רק במכשיר שלכם ולא נשלחים אלינו.</li>
      </ul>
      <p>אין חובה חוקית למסור את המידע, אבל בלי חשבון לא ניתן להשתמש בשירות.</p>
      <h3>למה המידע משמש</h3>
      <ul>
        <li>כדי להפעיל את השירות: לכתוב לכם סיכומים אישיים, להציג תוכן לחברים שבחרתם, לשלוח התראות.</li>
        <li>כדי לשפר את האפליקציה (נתוני שימוש מצרפיים).</li>
        <li>כדי לשמור על בטיחות: טיפול בדיווחים, חסימות ומניעת שימוש לרעה.</li>
        <li>לא נשלח דיוור שיווקי בלי הסכמה מפורשת, ולא מוכרים מידע לאף אחד.</li>
      </ul>
      <h3>עם מי המידע משותף</h3>
      <ul>
        <li><b>משתמשים אחרים:</b> רק מה שבחרתם לשתף, ורק עם מי שבחרתם. הפרופיל הציבורי כולל שם, שם משתמש, מוסד, תואר, תיאור וקישורים שהוספתם. יום ההולדת מוצג רק לחברים.</li>
        <li><b>ספקי שירות</b>, רק לצורך הפעלת השירות: Supabase (אחסון ושרת, באירופה), Google Gemini (כתיבת סיכומים ותשובות של העוזר), GitHub Pages (אירוח האתר).</li>
        <li><b>קבצים לסיכום</b> נשלחים לעיבוד ולא נשמרים אצלנו. נשמר רק הסיכום.</li>
        <li><b>רשויות</b>, רק אם החוק מחייב.</li>
      </ul>
      <h3>העברת מידע לחו"ל</h3>
      <p>השרתים נמצאים באיחוד האירופי, שרמת ההגנה על מידע בו הוכרה בישראל. עיבוד ה-AI נעשה בשרתי Google.</p>
      <h3>כמה זמן שומרים</h3>
      <p>כל עוד החשבון פעיל. במחיקת חשבון, המידע נמחק מהשרתים, למעט מה שחובה לשמור לפי חוק. גיבויים טכניים נמחקים תוך 30 יום.</p>
      <h3>הזכויות שלכם</h3>
      <ul>
        <li><b>לעיין</b> במידע ו<b>להוריד</b> אותו: הגדרות ← חשבון ← "הורדת כל המידע שלי".</li>
        <li><b>לתקן</b>: עריכת פרופיל, או פנייה אלינו.</li>
        <li><b>למחוק</b>: הגדרות ← חשבון ← "מחיקת החשבון". המחיקה מיידית.</li>
        <li>לפנות אלינו בכל שאלה: ${mail}. נענה תוך 30 יום.</li>
      </ul>
      <h3>אבטחה</h3>
      <p>הגישה למידע מוגבלת בשרת לפי הרשאות (כל משתמש רואה רק את מה שמותר לו), התקשורת מוצפנת (HTTPS), והסיסמאות נשמרות מוצפנות. אנחנו לא רואים ולא שומרים את הסיסמה שלכם ל-Moodle. במקרה של אירוע אבטחה חמור נודיע לכם ולרשות להגנת הפרטיות כנדרש.</p>
      <h3>קטינים</h3>
      <p>השירות מיועד לסטודנטים בני 18 ומעלה.</p>`],
    terms: ["תנאי שימוש", `
      <p class="small muted">עודכן לאחרונה: ${UPDATED}</p>
      <h3>מי אנחנו</h3>
      <p>סיכומון מופעל על ידי גיא סולטן, עוסק פטור מס' <b>[יושלם]</b>. יצירת קשר: ${mail}. השימוש בשירות מהווה הסכמה לתנאים האלה ולמדיניות הפרטיות.</p>
      <h3>מה השירות</h3>
      <p>כלי ללימוד אישי: סיכומים בעזרת בינה מלאכותית מקבצים שיש לכם גישה חוקית אליהם, מבחנים, מחברות, יומן, עוזר AI ורשת חברתית לסטודנטים. סיכומים ותשובות של AI עלולים לכלול טעויות, ואינם תחליף לחומר הרשמי של הקורס. אין אחריות לציונים או להחלטות שמתקבלות על סמך התוכן.</p>
      <h3>החשבון שלכם</h3>
      <ul><li>חשבון אחד לאדם, עם פרטים נכונים. אין להעביר או לשתף חשבון.</li><li>אתם אחראים לשמור על הסיסמה.</li><li>גיל מינימלי: 18.</li></ul>
      <h3>תוכן שאתם מעלים</h3>
      <ul>
        <li>מעלים ומשתפים רק תוכן שלכם או שמותר לכם לשתף. <b>אסור לשתף מצגות, מבחנים, הקלטות או חומרים של מרצים ושל המוסד</b>, אלא בהיתר.</li>
        <li>התוכן נשאר שלכם. אתם נותנים לנו רישיון להציג אותו למי שבחרתם ולעבד אותו כדי להפעיל את השירות.</li>
        <li>הקלטת שיעורים: רק לשימוש אישי, ולפי כללי המוסד והסכמת המרצה.</li>
      </ul>
      <h3>התנהגות בקהילה</h3>
      <ul><li>אסור: הטרדה, בריונות, אלימות, גזענות, תוכן מיני, ספאם, התחזות, פרסום מידע אישי של אחרים, או כל תוכן לא חוקי.</li>
        <li>על כל פוסט, תגובה, הודעה ומשתמש יש "דיווח" ו"חסימה". דיווחים נבדקים תוך 24 שעות.</li>
        <li>אנחנו רשאים להסיר תוכן ולהשעות או לסגור חשבונות שמפרים את התנאים.</li></ul>
      <h3>זכויות יוצרים</h3>
      <p>חושבים שתוכן בסיכומון מפר זכויות שלכם? כתבו ל-${mail} עם פרטי התוכן והבעלות, ונטפל בהקדם.</p>
      <h3>מחיר, מנוי וביטול</h3>
      <p>בתקופת הבדיקות השירות חינם, עם מגבלה יומית על סיכומים ושאלות לעוזר. אם יוצע מנוי בתשלום: אפשר יהיה לבטל אותו בכל עת באפליקציה, באותה דרך שבה נרשמתם, בלי דמי ביטול, והביטול ייכנס לתוקף תוך 3 ימי עסקים. ביטול עסקה בתוך 14 יום לפי חוק הגנת הצרכן, התשמ"א–1981. <b>[מדיניות המחיר וההחזרים תושלם לפני תחילת הגבייה]</b></p>
      <h3>זמינות ושינויים</h3>
      <p>השירות ניתן "כפי שהוא" (AS IS) ועשוי להשתנות או להיפסק. על שינוי מהותי בתנאים נודיע מראש באפליקציה.</p>
      <h3>סימני מסחר</h3>
      <p>סיכומון אינו קשור, ממומן או מאושר על ידי Moodle, Google, Supabase או מוסד לימודים כלשהו.</p>
      <h3>דין וסמכות</h3>
      <p>על התנאים חל הדין הישראלי. סמכות השיפוט לבתי המשפט המוסמכים בישראל.</p>`],
    access: ["הצהרת נגישות", `
      <p class="small muted">עודכן לאחרונה: ${UPDATED}</p>
      <p>אנחנו רוצים שסיכומון יהיה נוח לכל אחד ואחת, כולל אנשים עם מוגבלות. האפליקציה נבנתה בהתאם לתקן הישראלי 5568 (המבוסס על הנחיות WCAG 2.0 ברמה AA) ולתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג–2013.</p>
      <h3>מה עשינו</h3>
      <ul>
        <li>אפשר להגדיל טקסט ולבחור מצב כהה או בהיר: הגדרות ← נגישות ותצוגה.</li>
        <li>אפשרות "פחות אנימציות", והאפליקציה מכבדת את הגדרת "הפחתת תנועה" של המכשיר.</li>
        <li>ניווט מלא במקלדת, עם סימון ברור של המיקוד, וקישור "דילוג לתוכן".</li>
        <li>תוויות לכל כפתור ושדה, ותיאורים לקוראי מסך (VoiceOver, TalkBack, NVDA).</li>
        <li>ניגודיות צבעים של 4.5:1 לפחות בטקסט.</li>
        <li>הקראה בקול של כל סיכום, ואפשרות להדפיס אותו או לשמור כ-PDF.</li>
        <li>עברית מימין לשמאל, ותמיכה בהגדלת המסך.</li>
      </ul>
      <h3>מה עוד לא מושלם</h3>
      <ul><li>כתב יד במחברות נשמר כציור, ולכן אינו נקרא בקורא מסך. אפשר לעבור ל"הקלדה" באותו שיעור.</li><li>תוכן שמשתמשים מעלים (תמונות וקבצים) תלוי במי שהעלה אותו.</li></ul>
      <h3>נתקלתם בבעיה?</h3>
      <p>רכז הנגישות: גיא סולטן, ${mail}. כתבו לנו מה לא עבד, ובאיזה מכשיר. נחזור אליכם תוך 14 יום.</p>`],
    support: ["תמיכה ויצירת קשר", `
      <p>יש שאלה, תקלה או רעיון? אנחנו כאן.</p>
      <div class="list"><a class="item" href="mailto:${SUPPORT}?subject=${encodeURIComponent("סיכומון – פנייה")}"><span><span class="t">✉️ ${SUPPORT}</span><br><span class="small muted">נחזור אליכם תוך 2 ימי עסקים</span></span></a>
      <a class="item" href="#feedback"><span><span class="t">💬 משוב על האפליקציה</span><br><span class="small muted">4 שאלות קצרות, נשלח ישר אלינו</span></span></a>
      <a class="item" href="#diag"><span><span class="t">🩺 בדיקת מכשיר</span><br><span class="small muted">דוח שעוזר לנו להבין תקלה</span></span></a></div>
      <p class="small muted">דיווח על תוכן או משתמש: בכפתור ⋯ / ⚠️ שליד הפוסט, התגובה או ההודעה. בנושא פרטיות ומחיקת מידע: ראו <a href="#legal-privacy">מדיניות הפרטיות</a>.</p>`],
  };
  function legal(k) {
    const [t, body] = LEGAL[k] || LEGAL.terms;
    view.innerHTML = `<div class="page" style="max-width:720px"><h1 style="font-size:30px">${t}</h1><article class="md-body">${body}</article><a href="#settings-legal">חזרה להגדרות</a></div>`;
  }

  return { page, legal, applyUI };
}
