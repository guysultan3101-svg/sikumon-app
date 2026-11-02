// ⚙️ הגדרות: לימודים, AI, מנוי (כולל ביטול), חשבון, פרטיות, התראות, נגישות, ומידע משפטי.
// מה שתלוי בשרת (מנוי, חשבון, חסימות) מוצג כדוגמה; נגישות, AI, "איך אני לומד/ת" והורדת המידע עובדים באמת.

export function initSettings(ctx) {
  const { view, $, esc, toast, prefs, store, ai, social, onboardingQuestions, version } = ctx;

  // ---------- נגישות: גודל טקסט ומצב כהה (נשמר במכשיר, מופעל בכל פתיחה) ----------
  function applyUI() {
    const ui = prefs.get()?.ui || {};
    document.documentElement.dataset.theme = ui.theme && ui.theme !== "auto" ? ui.theme : "";
    if (!document.documentElement.dataset.theme) delete document.documentElement.dataset.theme;
    document.body.style.zoom = ui.size && ui.size !== 1 ? ui.size : "";
    document.documentElement.classList.toggle("calm", !!ui.calm);
  }
  const saveP = (fn) => { const p = prefs.get() || {}; fn(p); prefs.set(p); };

  const SECTIONS = [["study", "📚 לימודים"], ["ai", "🤖 AI"], ["sub", "💳 מנוי"], ["account", "👤 חשבון"], ["privacy", "🔒 פרטיות ובטיחות"], ["notify", "🔔 התראות"], ["access", "♿ נגישות ותצוגה"], ["legal", "📄 מידע ותמיכה"]];
  const toggle = (id, label, on, sub = "") => `<label class="set-row"><span>${label}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><input type="checkbox" class="switch" id="${id}" ${on ? "checked" : ""}></label>`;
  const select = (id, label, opts, val) => `<label class="set-row"><span>${label}</span><select id="${id}" style="width:auto;max-width:55%">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;

  function page(section) {
    const p = prefs.get() || {};
    const ui = p.ui || {}, priv = p.privacy || {}, nt = p.notify || {};
    const s = social.state();
    const res = s.reservist;
    const renew = new Date(Date.now() + 23 * 864e5).toLocaleDateString("he-IL");
    view.innerHTML = `<div class="page settings" style="max-width:760px">
      <h1 style="font-size:32px">⚙️ הגדרות</h1>
      <nav class="snav" aria-label="חלקי ההגדרות">${SECTIONS.map(([k, l]) => `<a href="#settings-${k}" ${section === k ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>

      <section class="soft set" id="set-study"><h2>📚 לימודים</h2>
        <h3>איך אני לומד/ת</h3><p class="small muted">הסיכומים, המבחנים והעוזר מותאמים לפי התשובות כאן. אפשר לשנות בכל רגע.</p>
        ${onboardingQuestions.map((q) => select("lq-" + q.id, q.q, q.options.map((o) => [o, o]), p[q.id] || "")).join("")}
        <label class="set-row" style="display:grid"><span>הקורסים שלי (שורה לכל קורס)</span><textarea id="setCourses" rows="5">${esc((p.courses || []).join("\n"))}</textarea></label>
        <div class="row"><button class="btn ghost" type="button" id="saveCourses">שמירת הקורסים</button><a class="btn ghost" href="#timetable">🕘 מערכת השעות</a><a class="btn ghost" href="#summaries">🔗 חיבור למודל</a></div>
      </section>

      <section class="soft set" id="set-ai"><h2>🤖 AI: העוזר, "שאל את השיעור" ו"הסבר נוסף"</h2>
        <p>מחברים את <b>Gemini של גוגל במסלול החינמי</b>, בלי כרטיס אשראי. הוא יכול גם לחפש באינטרנט, עד 500 חיפושים ביום.</p>
        <ol class="small"><li>נכנסים ל-<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> עם חשבון גוגל <b>פרטי</b> (חשבונות של מוסד לימודים חוסמים את זה לפעמים).</li><li>לוחצים "Create API key" ומעתיקים.</li><li>מדביקים כאן ולוחצים "שמירה".</li></ol>
        <p class="small muted">המפתח נשמר רק במכשיר הזה. במסלול החינמי גוגל רשאית להשתמש בשאלות כדי לשפר את המערכות שלה. לכן לא כותבים לעוזר פרטים אישיים, רק שאלות על החומר.</p>
        <p class="small">מצב: <b id="gState">${ai.getGeminiKey() ? "✅ Gemini מחובר" : ai.getKey() ? "✅ Claude מחובר" : "לא מחובר"}</b></p>
        <div class="row"><input type="password" id="gKey" autocomplete="off" spellcheck="false" placeholder="AIza…" style="flex:1;min-width:200px;direction:ltr"><button class="btn" type="button" id="gSave">שמירה</button><button class="btn ghost" type="button" id="gTest" ${ai.hasAI() ? "" : "disabled"}>בדיקה</button><button class="btn ghost" type="button" id="gDel" ${ai.getGeminiKey() ? "" : "disabled"}>הסרה</button></div>
        <details class="small"><summary>אפשרות נוספת: Claude (בתשלום לפי שימוש)</summary>
          <p class="muted">אם מחובר Gemini, משתמשים בו. Claude משמש רק כשאין Gemini.</p>
          <div class="row" style="margin-top:6px"><input type="password" id="aiKey" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" style="flex:1;min-width:200px;direction:ltr"><button class="btn ghost" type="button" id="aiSave">שמירה</button><button class="btn ghost" type="button" id="aiDel" ${ai.getKey() ? "" : "disabled"}>הסרה</button></div></details>
      </section>

      <section class="soft set" id="set-sub"><h2>💳 מנוי</h2>
        <p class="notice">🧪 דוגמה: בתקופת הבדיקות האפליקציה בחינם, ושום דבר לא מחויב.</p>
        <div class="set-row"><span>התוכנית שלי</span><b>סיכומון חודשי</b></div>
        <div class="set-row"><span>מחיר</span><b>₪XX לחודש${res ? " · 🎖️ 20% הנחת מילואים" : ""}</b></div>
        <div class="set-row"><span>החידוש הבא</span><b>${renew}</b></div>
        ${res ? `<div class="set-row"><span>הנחת מילואים</span><span>${res.verified ? "✅ מאומת" : `⏳ ממתין לאישור עד ${new Date(Date.parse(res.since) + 30 * 864e5).toLocaleDateString("he-IL")}`} <a href="#u-${encodeURIComponent(s.me?.username || "")}" id="resLink">העלאת אישור</a></span></div>` : `<div class="set-row"><span>🎖️ משרת/ת מילואים?</span><button class="btn ghost" type="button" id="resOn">לקבלת 20% הנחה</button></div>`}
        <div class="row"><button class="btn ghost" type="button" id="receipts">🧾 קבלות וחשבוניות</button><button class="btn ghost" type="button" id="payMethod">אמצעי תשלום</button></div>
        <button class="btn danger" type="button" id="cancelSub">ביטול המנוי</button>
        <p class="small muted">ביטול אפשר בכל רגע, כאן באפליקציה, בלי לחייג ובלי דמי ביטול. הביטול נכנס לתוקף תוך 3 ימי עסקים לכל היותר, וממשיכים להשתמש עד סוף התקופה ששולמה. בתוך 14 יום מההרשמה אפשר לבטל ולקבל החזר כספי לפי חוק הגנת הצרכן.${/iPad|iPhone/.test(navigator.userAgent) ? " אם המנוי נקנה דרך App Store, מבטלים בהגדרות של האייפון ← השם שלך ← מינויים." : ""}</p>
      </section>

      <section class="soft set" id="set-account"><h2>👤 חשבון</h2>
        <div class="set-row"><span>שם משתמש</span><b dir="ltr">@${esc(s.me?.username || "")}</b></div>
        <div class="row"><button class="btn ghost" type="button" id="editProf">עריכת פרופיל</button><button class="btn ghost" type="button" id="chMail">שינוי מייל</button><button class="btn ghost" type="button" id="chPass">שינוי סיסמה</button><button class="btn ghost" type="button" id="linkG">חיבור חשבון Google</button></div>
        <div class="row"><button class="btn ghost" type="button" id="exportData">⬇️ הורדת כל המידע שלי</button><button class="btn ghost" type="button" id="logout">יציאה מהחשבון</button></div>
        <button class="btn danger" type="button" id="delAcc">מחיקת החשבון</button>
        <p class="small muted">מחיקת החשבון מוחקת את הפרופיל, החברים, ההודעות והפוסטים שלך. המחברות, ההקלטות והסיכומים נשארים במכשיר, אלא אם מסמנים למחוק גם אותם.</p>
      </section>

      <section class="soft set" id="set-privacy"><h2>🔒 פרטיות ובטיחות</h2>
        ${select("pvProfile", "מי רואה את הפרופיל שלי", [["all", "כולם"], ["uni", "רק סטודנטים מהמוסד שלי"], ["friends", "רק חברים"]], priv.profile || "all")}
        ${select("pvPosts", "ברירת מחדל לפוסט חדש", [["friends", "👥 חברים"], ["course", "🎓 כל הקורס"], ["public", "🌍 כולם"]], priv.posts || "friends")}
        ${select("pvMsg", "מי יכול לשלוח לי הודעה", [["all", "כולם (מי שאינו חבר נכנס ל'בקשות')"], ["friends", "רק חברים"]], priv.msg || "all")}
        ${toggle("pvBday", "להציג את יום ההולדת שלי לחברים", priv.bday !== false)}
        ${toggle("pvOnline", "להראות לחברים כשאני לומד/ת עכשיו", priv.online !== false)}
        ${toggle("pvAds", "פרסומות מותאמות לתואר ולשנה שלי", !!priv.ads, "המפרסמים לא מקבלים שום פרט עליך. כבוי = פרסומות כלליות.")}
        ${toggle("pvMkt", "דיוור שיווקי (מבצעים, קורסים, משרות)", !!(priv.mkt ?? s.me?.ads), "אפשר להסיר בכל רגע, גם מהקישור שבכל הודעה.")}
        <h3>חסומים (${s.blocked.length})</h3>
        <div class="list">${s.blocked.map((id) => `<div class="item"><span dir="ltr">@${esc(id)}</span><button class="btn ghost" type="button" data-unblock="${esc(id)}">ביטול חסימה</button></div>`).join("") || '<p class="small muted">אין משתמשים חסומים</p>'}</div>
        <p class="small muted">על כל פוסט, הודעה ומשתמש יש "דיווח" ו"חסימה". דיווחים נבדקים תוך 24 שעות.</p>
      </section>

      <section class="soft set" id="set-notify"><h2>🔔 התראות</h2>
        ${[["exams", "מבחנים והגשות"], ["summaries", "סיכום או פודקאסט חדש"], ["moodle", "חדש במודל"], ["brief", "☀️ הודעת הבוקר"], ["msgs", "הודעות מחברים"], ["reqs", "בקשות חברות"], ["missed", "חבר פספס שיעור ומבקש עזרה"], ["bdays", "🎂 ימי הולדת של חברים"], ["likes", "לייקים ותגובות"]].map(([k, l]) => toggle("nt-" + k, l, nt[k] !== false)).join("")}
        ${toggle("nt-quiet", "שקט בלילה (23:00–07:00)", nt.quiet !== false)}
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

  function confirmModal(html, onOk, okLabel = "אישור", danger = true) {
    document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="setModal" role="dialog"><div class="card">${html}<div class="row"><button class="btn ${danger ? "danger" : ""}" type="button" id="mOk">${okLabel}</button><button class="btn ghost" type="button" id="mNo">חזרה</button></div></div></div>`);
    const m = document.getElementById("setModal");
    $("#mNo", m).onclick = () => m.remove();
    $("#mOk", m).onclick = () => { if (onOk(m) !== false) m.remove(); };
  }

  function bind() {
    // איך אני לומד/ת: נשמר מיד
    onboardingQuestions.forEach((q) => ($("#lq-" + q.id).onchange = (e) => { saveP((p) => (p[q.id] = e.target.value)); toast("נשמר ✓"); }));
    $("#saveCourses").onclick = () => { const c = $("#setCourses").value.split("\n").map((x) => x.trim()).filter(Boolean); if (!c.length) return toast("צריך לפחות קורס אחד"); saveP((p) => (p.courses = c)); toast("הקורסים נשמרו ✓"); };
    // AI
    $("#gSave").onclick = () => { const k = $("#gKey").value.trim(); if (!/^AIza[\w-]{20,}$/.test(k)) return toast("זה לא נראה כמו מפתח של גוגל (מתחיל ב-AIza)"); ai.setGeminiKey(k); $("#gKey").value = ""; toast("Gemini חובר ✓"); page("ai"); };
    $("#gDel").onclick = () => { ai.setGeminiKey(""); toast("המפתח הוסר"); page("ai"); };
    $("#gTest").onclick = async () => { $("#gTest").disabled = true; $("#gState").textContent = "בודק…"; try { const r = await ai.testKey(); $("#gState").textContent = "✅ עובד (" + r.slice(0, 20) + ")"; } catch (e) { $("#gState").textContent = "❌ " + e.message; } $("#gTest").disabled = false; };
    $("#aiSave").onclick = () => { const k = $("#aiKey").value.trim(); if (!k.startsWith("sk-ant-")) return toast("זה לא נראה כמו מפתח של Anthropic (מתחיל ב-sk-ant-)"); ai.setKey(k); toast("נשמר"); page("ai"); };
    $("#aiDel").onclick = () => { ai.setKey(""); page("ai"); };
    // מנוי (דוגמה)
    $("#receipts").onclick = $("#payMethod").onclick = () => toast("יופיע אחרי שנחבר תשלומים");
    $("#resOn") && ($("#resOn").onclick = () => { const s = social.state(); s.reservist = { since: new Date().toISOString().slice(0, 10), verified: false }; social.save(s); toast("ההנחה הופעלה. יש 30 יום להעלות אישור"); page("sub"); });
    $("#cancelSub").onclick = () => confirmModal(`<h2>לבטל את המנוי?</h2><p>המנוי לא יתחדש. אפשר להמשיך להשתמש עד ${new Date(Date.now() + 23 * 864e5).toLocaleDateString("he-IL")}, והמחברות והסיכומים שלך נשארים.</p><label>למה עוזבים? (לא חובה)<select id="why"><option>—</option><option>יקר מדי</option><option>לא משתמש/ת מספיק</option><option>חסר לי משהו</option><option>סיימתי את הסמסטר</option></select></label>`, () => toast("המנוי בוטל (דוגמה). נשלח אישור ביטול למייל"), "כן, לבטל");
    // חשבון
    $("#editProf").onclick = () => social.editMe();
    $("#chMail").onclick = $("#chPass").onclick = $("#linkG").onclick = () => toast("יעבוד אחרי שנחבר את השרת");
    $("#exportData").onclick = exportData;
    $("#logout").onclick = () => confirmModal("<h2>לצאת מהחשבון?</h2><p>המחברות והסיכומים נשארים במכשיר.</p>", () => { social.logout(); location.hash = "#home"; }, "יציאה", false);
    $("#delAcc").onclick = () => confirmModal(`<h2>מחיקת החשבון</h2><p>הפרופיל, החברים, ההודעות והפוסטים יימחקו לצמיתות.</p>
      <label class="row small" style="gap:8px"><input type="checkbox" id="delAll" style="width:auto"> למחוק גם את כל המחברות, ההקלטות והסיכומים מהמכשיר</label>
      <label>כדי לאשר, כתבו <b>מחיקה</b><input id="delTxt" autocomplete="off"></label>`, (m) => {
      if ($("#delTxt", m).value.trim() !== "מחיקה") { toast('כתבו "מחיקה" כדי לאשר'); return false; }
      social.deleteAccount();
      if ($("#delAll", m).checked) { try { localStorage.clear(); } catch { /* */ } indexedDB.deleteDatabase("sikumon"); setTimeout(() => location.reload(), 300); return; }
      toast("החשבון נמחק"); location.hash = "#home";
    }, "מחיקה לצמיתות");
    // פרטיות
    const pv = (id, key, val) => ($("#" + id).onchange = (e) => saveP((p) => { (p.privacy ??= {})[key] = val ? val(e.target) : e.target.value; }));
    pv("pvProfile", "profile"); pv("pvPosts", "posts"); pv("pvMsg", "msg");
    [["pvBday", "bday"], ["pvOnline", "online"], ["pvAds", "ads"], ["pvMkt", "mkt"]].forEach(([id, k]) => pv(id, k, (t) => t.checked));
    view.querySelectorAll("[data-unblock]").forEach((b) => (b.onclick = () => { const s = social.state(); s.blocked = s.blocked.filter((x) => x !== b.dataset.unblock); social.save(s); page("privacy"); }));
    // התראות
    view.querySelectorAll('[id^="nt-"]').forEach((t) => (t.onchange = () => saveP((p) => { (p.notify ??= {})[t.id.slice(3)] = t.checked; })));
    // נגישות
    $("#uiSize").onchange = (e) => { saveP((p) => ((p.ui ??= {}).size = +e.target.value)); applyUI(); };
    $("#uiTheme").onchange = (e) => { saveP((p) => ((p.ui ??= {}).theme = e.target.value)); applyUI(); };
    $("#uiCalm").onchange = (e) => { saveP((p) => ((p.ui ??= {}).calm = e.target.checked)); applyUI(); };
  }

  // הורדת כל המידע שלי (חוק הגנת הפרטיות): קובץ JSON עם הכול, בלי קובצי הקול
  async function exportData() {
    toast("מכין את הקובץ…");
    const strip = (o) => { const c = { ...o }; delete c.blob; return c; };
    const data = {
      exportedAt: new Date().toISOString(), prefs: prefs.get(), social: social.state(),
      library: (await store.listItems()).filter((x) => x.type !== "pod-audio").map(strip),
      notebooks: (await store.listLessons()).map((l) => ({ ...l, thumb: undefined })),
      recordings: (await store.listRecordings()).map((r) => ({ id: r.id, course: r.course, startedAt: r.startedAt, marks: r.marks })),
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
