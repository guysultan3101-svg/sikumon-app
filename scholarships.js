// מלגות: שאלון קצר (נשמר בחשבון בשרת, פרטי – בלי ת"ז), ציון התאמה 1–10 לכל מלגה, ומצב ההרשמה (פתוחה / מתי נפתחת).
import { SCHOLARSHIPS, SCH_CHECKED, score, status } from "./scholarships-data.js";
import { instKey } from "./rights.js";

const FIELDS = [["eng", "הנדסה"], ["cs", "מדעי המחשב"], ["phys", "פיזיקה / מדעים מדויקים"], ["social", "מדעי החברה / הרוח"], ["nursing", "סיעוד"], ["health", "מקצועות בריאות אחרים"], ["mgmt", "ניהול / כלכלה"], ["other", "אחר"]];
const SERVICE = [["combat", "לוחם/ת (תעודת שחרור זהב)"], ["support", "תומך/ת לחימה (תעודת שחרור כסף)"], ["army", "שירות צבאי אחר"], ["national", "שירות לאומי / אזרחי"], ["none", "לא שירתתי"]];
const FLAGS = [["periphery", "גרתי בפריפריה / באזור עדיפות לאומית"], ["firstGen", "דור ראשון לאקדמיה (להורים אין תואר)"], ["need", "יש לי קושי כלכלי"], ["lone", "הייתי חייל/ת בודד/ה"], ["oleh", "עולה חדש/ה"], ["ethiopian", "יוצא/ת אתיופיה"], ["haredi", "בוגר/ת החינוך החרדי"], ["minority", "בן/בת החברה הערבית, הדרוזית או הצ'רקסית"], ["deposit", "ניצלתי יותר מ-8,000 ₪ מהפיקדון האישי (חיילים משוחררים)"]];
const ORDER = { open: 0, always: 1, soon: 2, unknown: 3, closed: 4 };

export function initScholarships({ view, $, esc, toast, prefs, api }) {
  const answers = () => {
    const p = api.profile() || {};
    const a = { ...(p.scholar || {}) };
    a.inst = instKey(prefs.get()?.inst || p.uni || "") || a.inst || null;
    return a;
  };

  function page() {
    const a = answers();
    const filled = Object.keys(api.profile()?.scholar || {}).length > 0;
    const yn = (id, label) => `<label class="field">${label}<select id="sc_${id}"><option value="">לא ענית</option><option value="1" ${a[id] === true ? "selected" : ""}>כן</option><option value="0" ${a[id] === false ? "selected" : ""}>לא</option></select></label>`;
    view.innerHTML = `<div class="page" style="max-width:820px">
      <h1 style="font-size:clamp(28px,5vw,40px)">🎓 מלגות</h1>
      <p class="muted">מלגות ממקורות רשמיים בלבד, עם ציון התאמה מ-1 עד 10 ומתי מגישים. אנחנו לא מגישים בשמך ולא מבטיחים שתקבל/י מלגה.</p>
      <details class="card" id="scForm" ${filled ? "" : "open"}>
        <summary><b>ספר/י לנו קצת עלייך</b> <span class="small muted">(נשמר בחשבון שלך, רק את/ה רואה. בלי תעודת זהות)</span></summary>
        <div class="grid2" style="margin-top:10px">
          <label class="field">תואר<select id="sc_degree"><option value="">לא ענית</option><option value="ba" ${a.degree === "ba" ? "selected" : ""}>תואר ראשון</option><option value="ma" ${a.degree === "ma" ? "selected" : ""}>תואר שני</option></select></label>
          <label class="field">באיזו שנה בתואר?<select id="sc_year"><option value="">לא ענית</option>${[[1, "שנה א'"], [2, "שנה ב'"], [3, "שנה ג'"], [4, "שנה ד' ומעלה"]].map(([v, t]) => `<option value="${v}" ${+a.year === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label class="field">תחום לימודים<select id="sc_field"><option value="">לא ענית</option>${FIELDS.map(([v, t]) => `<option value="${v}" ${a.field === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label class="field">שירות<select id="sc_service"><option value="">לא ענית</option>${SERVICE.map(([v, t]) => `<option value="${v}" ${a.service === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label class="field">כמה שנים עברו מהשחרור?<input id="sc_discharged" type="number" min="0" inputmode="numeric" value="${a.discharged ?? ""}" placeholder="למשל 2"></label>
          <label class="field">ימי מילואים בשנה האחרונה<input id="sc_miluim" type="number" min="0" inputmode="numeric" value="${a.miluim ?? ""}" placeholder="0 אם לא"></label>
        </div>
        <fieldset class="vis" style="margin-top:8px"><legend class="small muted">מה מתאים לך? (כן / לא / לא לענות)</legend>
          <div class="grid2">${FLAGS.map(([id, t]) => yn(id, t)).join("")}</div>
        </fieldset>
        <div class="row"><button class="btn" id="scSave" type="button">שמירה והצגת המלגות שלי</button><button class="btn ghost small-btn" id="scClear" type="button">מחיקת התשובות</button></div>
      </details>
      <div class="row" style="flex-wrap:wrap;gap:12px;margin:10px 0">
        <label><input type="checkbox" id="scOpen"> רק פתוחות עכשיו</label>
        <label><input type="checkbox" id="scAll"> להציג גם מלגות שלא מתאימות לי</label>
      </div>
      <div id="scList" aria-live="polite"></div>
      <p class="small muted" style="margin-top:18px">מידע ממקורות רשמיים, נבדק ${SCH_CHECKED}. הסכומים והמועדים משתנים מדי שנה – תמיד לבדוק בקישור למקור לפני הגשה. ההגשה עצמה נעשית אצל הגוף המעניק.</p>
    </div>`;
    const read = () => {
      const g = (id) => $("#sc_" + id).value;
      const yb = (id) => (g(id) === "" ? null : g(id) === "1");
      const n = (id) => (g(id) === "" ? null : Math.max(0, +g(id)));
      const out = { degree: g("degree") || null, year: n("year"), field: g("field") || null, service: g("service") || null, discharged: n("discharged"), miluim: n("miluim") };
      FLAGS.forEach(([id]) => (out[id] = yb(id)));
      return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null));
    };
    const paint = () => list({ ...read(), inst: a.inst });
    view.querySelectorAll("#scForm select, #scForm input").forEach((i) => i.addEventListener("input", paint));
    $("#scOpen").onchange = paint; $("#scAll").onchange = paint;
    $("#scSave").onclick = async () => {
      const ans = read();
      try { await api.updateMe({ scholar: ans }); toast("נשמר ✓"); $("#scForm").open = false; $("#scList").scrollIntoView({ behavior: "smooth", block: "start" }); }
      catch (e) { toast("לא הצלחנו לשמור: " + e.message); }
      paint();
    };
    $("#scClear").onclick = async () => {
      try { await api.updateMe({ scholar: null }); toast("התשובות נמחקו"); page(); }
      catch (e) { toast("לא הצלחנו למחוק – נסו שוב. " + (e.message || "")); }   // לא אומרים "נמחק" אם לא נמחק
    };
    paint();
  }

  function card(s, r, st) {
    const badge = r.score ? `<span class="chip ${r.score >= 7 ? "ok" : ""}" title="ציון התאמה">התאמה ${r.score}/10</span>` : '<span class="chip warn">לא מתאים לפי התשובות</span>';
    const stc = st.k === "open" || st.k === "always" ? "ok" : st.k === "soon" ? "" : "";
    return `<article class="card" style="display:grid;gap:6px${r.score >= 7 && (st.k === "open" || st.k === "always") ? ";border-color:var(--green)" : ""}">
      <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><h3 style="margin:0;font-size:19px">${esc(s.name)}</h3><span class="row" style="gap:6px">${badge}<span class="chip ${stc}">${esc(st.t)}</span></span></div>
      <p class="small muted" style="margin:0">${esc(s.provider)}</p>
      <p style="margin:0"><b>כמה:</b> ${esc(s.amount)}</p>
      <p style="margin:0"><b>למי:</b> ${esc(s.who)}</p>
      ${s.volunteer && s.volunteer !== "—" ? `<p style="margin:0"><b>התנדבות:</b> ${esc(s.volunteer)}</p>` : ""}
      ${r.missing ? `<p class="small muted" style="margin:0">חסרות ${r.missing} תשובות בשאלון כדי לדעת בוודאות אם המלגה מתאימה.</p>` : ""}
      <p style="margin:0"><b>איך מגישים:</b> ${esc(s.how)}</p>
      <p class="small muted" style="margin:0">${s.apply ? `<a href="${esc(s.apply)}" target="_blank" rel="noopener">להגשה</a> · ` : ""}מקור: <a href="${esc(s.src.url)}" target="_blank" rel="noopener">${esc(s.src.t)}</a> · נבדק ${SCH_CHECKED}</p>
    </article>`;
  }

  function list(a) {
    const onlyOpen = $("#scOpen").checked, all = $("#scAll").checked;
    const rows = SCHOLARSHIPS.map((s) => ({ s, r: score(s, a), st: status(s) }))
      .filter(({ s, r, st }) => (all || r.score > 0) && (!onlyOpen || st.k === "open" || st.k === "always") && (s.inst === "all" || s.inst === a.inst || all))
      .sort((x, y) => (y.r.score - x.r.score) || (ORDER[x.st.k] - ORDER[y.st.k]));
    const note = a.inst === "ariel" ? '<p class="notice" style="margin:0 0 10px">המלגות של אוניברסיטת אריאל עצמה יתווספו בקרוב. בינתיים – כל המלגות הארציות.</p>' : "";
    $("#scList").innerHTML = note + (rows.length ? `<div style="display:grid;gap:10px">${rows.map(({ s, r, st }) => card(s, r, st)).join("")}</div>` : '<p class="notice">לא מצאנו מלגות שמתאימות לסינון. נסו לבטל את "רק פתוחות עכשיו" או לסמן "להציג גם מלגות שלא מתאימות".</p>');
  }

  return { page };
}
