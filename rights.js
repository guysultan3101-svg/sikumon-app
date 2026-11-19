// מרכז הזכויות: חיפוש, שאלון "מה נכון לגביך" והמוסד שלך ראשון.
// התשובות לשאלון נשמרות רק במכשיר (מידע רגיש – הריון, מילואים), לא נשלחות לשרת, ונמחקות ביציאה מהחשבון.
import { RIGHTS, TOPICS, WHO, INSTITUTIONS_RIGHTS, RIGHTS_CHECKED } from "./rights-data.js";

export const RIGHTS_KEY = "clearly-rights";
const MIL = ["miluim", "combat", "career", "spouse"];   // מי שצריך למלא ימי מילואים
const load = () => { try { return JSON.parse(localStorage.getItem(RIGHTS_KEY) || "{}"); } catch { return {}; } };
const save = (s) => { try { localStorage.setItem(RIGHTS_KEY, JSON.stringify(s)); } catch { /* */ } };

// הימים כמו שהמוסדות סופרים: ימי הסמסטר הם חלק מימי השנה, וימי השנה חלק מהמצטבר.
// בלי סימון מילואים/קבע/בן זוג – לא מתחשבים בימים בכלל.
// כל שדה: { v: מספר, exact: האם הסטודנט מילא אותו }. שדה שלא מולא אבל נגזר משדה קטן ממנו (סמסטר -> שנה -> מצטבר)
// הוא רק "לפחות v": אפשר לדעת ממנו שמדרגה של "v ומעלה" מתקיימת, אבל לא לפסול מדרגות גבוהות יותר.
export function daysOf(s) {
  if (!(s.who || []).some((w) => MIL.includes(w))) return {};
  const n = (v) => (v == null || v === "" ? null : +v);
  const sem = n(s.sem), year = n(s.year), cum = n(s.cum);
  const f = (own, low) => (own != null ? { v: Math.max(own, low ?? -1), exact: true } : low != null ? { v: low, exact: false } : null);
  const fs = f(sem, null), fy = f(year, sem), fc = f(cum, fy?.v ?? null);
  return { sem: fs, year: fy, cum: fc, pre60: !!s.pre60, combat: (s.who || []).includes("combat") };
}

// תנאי מדרגה: true = מתאים, false = בטוח לא מתאים, null = חסר מידע (לא מסתירים).
// when = רשימת חלופות; בכל חלופה כל התנאים צריכים להתקיים.
export function matchWhen(when, s) {
  if (!when) return null;
  const d = daysOf(s);
  const res = when.map((w) => {
    let unknown = false;
    for (const k of ["sem", "year", "cum"]) {
      if (!w[k]) continue;
      const x = d[k], [lo, hi] = w[k];
      if (!x) { unknown = true; continue; }
      if (hi != null && x.v > hi) return false;            // כבר "לפחות" יותר מהתקרה – בטוח לא
      if (x.exact) { if (x.v < lo) return false; continue; }
      if (x.v >= lo && hi == null) continue;               // "לפחות v" ו-v מספיק למדרגה בלי תקרה
      unknown = true;                                     // אולי כן, אולי לא – לא מסתירים ולא מסמנים
    }
    if (w.pre60 && !d.pre60) { if (d.sem == null && d.cum == null) unknown = true; else return false; }
    if (w.combat && !d.combat) return false;
    return unknown ? null : true;
  });
  return res.includes(true) ? true : res.includes(null) ? null : false;
}

// חיפוש סלחני לעברית: בלי ניקוד, גרשיים ואותיות סופיות, בלי י/ו (כתיב מלא/חסר: "היריון" = "הריון"),
// ועם שורש בסיסי ("מלגה" מוצא "מלגות"). כל המילים צריכות להופיע.
const FIN = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const skel = (t) => String(t || "").toLowerCase().replace(/[֑-ׇ]/g, "").replace(/["'׳״`]/g, "").replace(/[ךםןףץ]/g, (c) => FIN[c]).replace(/[יו]/g, "");
export function searchMatch(q, text) {
  const words = String(q || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = skel(text);
  return words.every((w) => {
    let t = String(w).replace(/[֑-ׇ"'׳״`]/g, "");
    if (t.length >= 4 && /(ות|ים)$/.test(t)) t = t.slice(0, -2); else if (t.length >= 4 && /[הת]$/.test(t)) t = t.slice(0, -1);
    const k = skel(t);
    return k ? hay.includes(k) : true;
  });
}

export function instKey(name) {
  for (const [k, v] of Object.entries(INSTITUTIONS_RIGHTS)) if (v.match.test(name || "")) return k;
  return null;
}

// מה מוצג: מסננים לפי נושא/חיפוש/מי את/ה/תואר/ימים. במדרגות של אותה קבוצה (rank) – רק הגבוהה שמתאימה מסומנת ✓,
// והנמוכות ממנה (שהגבוהה מחליפה) לא מוצגות.
export function visible(s) {
  const who = s.who || [];
  const rows = RIGHTS.filter((r) => {
    if (s.topic && r.topic !== s.topic) return false;
    if (s.q && !searchMatch(s.q, r.t + " " + r.p.join(" ") + " " + (r.how || ""))) return false;
    if (who.length && !r.who.some((w) => who.includes(w))) return false;
    if (r.degree && s.degree && r.degree !== s.degree) return false;
    if (matchWhen(r.when, s) === false) return false;
    return true;
  // ברירת מחדל (לא בחרו תואר) = תואר ראשון, הנפוץ. כרטיס של תואר שני מקבל ✓ רק אחרי שבחרו "תואר שני"
  }).map((r) => ({ r, ok: matchWhen(r.when, s) === true && (!r.degree || r.degree === (s.degree || "ba")) }));
  const best = {};
  for (const x of rows) if (x.ok && x.r.rank) { const [g, n] = x.r.rank; best[g] = Math.max(best[g] ?? -1, n); }
  return rows.filter((x) => !(x.ok && x.r.rank && x.r.rank[1] < best[x.r.rank[0]]));
}

export function initRights({ view, $, esc, prefs, api }) {
  function page() {
    const s = load();
    const myInstName = prefs.get()?.inst || api.profile()?.uni || "";
    const mine = instKey(myInstName);
    const milOn = (s.who || []).some((w) => MIL.includes(w));
    view.innerHTML = `<div class="page" style="max-width:820px">
      <h1 style="font-size:clamp(28px,5vw,40px)">⚖️ הזכויות שלי</h1>
      <p class="muted">מה מגיע לך כסטודנט/ית: מילואים, הריון ולידה, מפונים ועוד. לכל זכות יש מקור ותאריך בדיקה.</p>
      <label class="field">חיפוש<input type="search" id="rtQ" placeholder="למשל: מועד מיוחד, פטור, תוספת זמן" value="${esc(s.q || "")}" autocomplete="off"></label>
      <details class="card" id="rtForm" ${s.who?.length ? "" : "open"}>
        <summary><b>מה נכון לגביך?</b> <span class="small muted">(נשמר רק במכשיר שלך, ונמחק כשיוצאים מהחשבון)</span></summary>
        <fieldset class="vis" style="margin-top:10px"><legend class="small muted">סמנו את כל מה שמתאים</legend>
          ${WHO.map((w) => `<label><input type="checkbox" name="rtWho" value="${w.id}" ${(s.who || []).includes(w.id) ? "checked" : ""}> ${esc(w.t)}</label>`).join("")}
        </fieldset>
        <label class="field">איזה תואר?<select id="rtDeg"><option value="ba">תואר ראשון</option><option value="ma" ${s.degree === "ma" ? "selected" : ""}>תואר שני</option></select></label>
        <div class="grid2" id="rtDays" style="margin-top:8px"${milOn ? "" : " hidden"}>
          <label class="field">ימי מילואים בסמסטר הנוכחי<input type="number" inputmode="numeric" min="0" id="rtSem" value="${s.sem ?? ""}" placeholder="למשל 25"></label>
          <label class="field">ימי מילואים בשנת הלימודים הזו<input type="number" inputmode="numeric" min="0" id="rtYear" value="${s.year ?? ""}" placeholder="למשל 40"></label>
          <label class="field">ימי מילואים במצטבר מאז 7.10.23 (או מאז שהתחלת ללמוד, אם זה מאוחר יותר)<input type="number" inputmode="numeric" min="0" id="rtCum" value="${s.cum ?? ""}" placeholder="למשל 120"></label>
          <label style="align-self:end"><input type="checkbox" id="rtPre" ${s.pre60 ? "checked" : ""}> שירתתי 60+ ימים ב-3 החודשים שלפני תחילת השנה</label>
        </div>
        <div class="row"><button class="btn small-btn" id="rtShow" type="button">להציג את הזכויות שלי ↓</button><button class="btn ghost small-btn" id="rtClear" type="button">ניקוי</button></div>
      </details>
      <div class="row" id="rtTopics" role="group" aria-label="נושאים" style="flex-wrap:wrap;gap:6px;margin:10px 0">
        <button class="chip" type="button" data-t="" aria-pressed="${!s.topic}">הכול</button>
        ${TOPICS.map((t) => `<button class="chip" type="button" data-t="${t.id}" aria-pressed="${s.topic === t.id}">${esc(t.t)}</button>`).join("")}
      </div>
      <div id="rtList" aria-live="polite"></div>
      <p class="small muted" style="margin-top:18px">מידע כללי, לא ייעוץ משפטי. מה שקובע הוא הנוהל של המוסד – תמיד אפשר לבדוק בקישור למקור. נבדק לאחרונה: ${RIGHTS_CHECKED}. מצאתם טעות? <a href="#feedback">ספרו לנו</a>.</p>
    </div>`;
    const read = () => {
      const num = (id) => { const v = $(id).value.trim(); return v === "" ? null : Math.max(0, +v); };
      const st = { ...load(), q: $("#rtQ").value.trim(), who: [...view.querySelectorAll('[name="rtWho"]:checked')].map((i) => i.value), degree: $("#rtDeg").value, sem: num("#rtSem"), year: num("#rtYear"), cum: num("#rtCum"), pre60: $("#rtPre").checked };
      save(st); return st;
    };
    const paint = () => { const st = read(); $("#rtDays").hidden = !(st.who || []).some((w) => MIL.includes(w)); list(st, mine, myInstName); };
    $("#rtShow").onclick = () => { $("#rtForm").open = false; $("#rtTopics").scrollIntoView({ behavior: "smooth", block: "start" }); };
    view.querySelectorAll("#rtForm input, #rtForm select").forEach((i) => i.addEventListener("input", paint));
    $("#rtQ").addEventListener("input", paint);
    $("#rtClear").onclick = () => { save({}); page(); };
    view.querySelectorAll("#rtTopics .chip").forEach((b) => (b.onclick = () => {
      const st = load(); st.topic = b.dataset.t || ""; save(st);
      view.querySelectorAll("#rtTopics .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      paint();
    }));
    paint();
  }

  const link = (c) => c.mail ? `<a href="mailto:${esc(c.mail)}">${esc(c.t)}</a>` : `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.t)}</a>`;
  function card({ r, ok }) {
    return `<article class="card" style="display:grid;gap:6px${ok ? ";border-color:var(--green)" : ""}">
      <h3 style="margin:0;font-size:18px">${esc(r.t)} ${ok ? '<span class="chip ok">✓ מתאים לך</span>' : ""}</h3>
      <ul style="margin:0;padding-inline-start:20px">${r.p.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${r.how ? `<p style="margin:0"><b>איך מממשים:</b> ${esc(r.how)}</p>` : ""}
      <p class="small muted" style="margin:0">מקור: <a href="${esc(r.src.url)}" target="_blank" rel="noopener">${esc(r.src.t)}</a> · נבדק ${RIGHTS_CHECKED}</p>
    </article>`;
  }

  function list(s, mine, myInstName) {
    const rows = visible(s);
    const none = '<p class="muted" style="margin:0">אין כאן זכויות שמתאימות לסינון שבחרת.</p>';
    const section = (title, items, extra = "", always = false) => items.length || always ? `<section style="display:grid;gap:10px;margin-top:14px"><h2 style="font-size:22px;margin:0">${title}</h2>${extra}${items.length ? items.map(card).join("") : none}</section>` : "";
    const of = (k) => rows.filter((x) => x.r.inst === k);
    const contacts = (k) => `<p class="small" style="margin:0">${INSTITUTIONS_RIGHTS[k].contacts.map(link).join("<br>")}</p>`;
    let html = "";
    if (mine) html += section(`🏛️ ${esc(INSTITUTIONS_RIGHTS[mine].name)} – המוסד שלך`, of(mine), contacts(mine), true);
    else if (myInstName && myInstName !== "אחר") html += `<p class="notice" style="margin-top:14px">את הזכויות המפורטות של <b>${esc(myInstName)}</b> נוסיף בהמשך. עד אז – הזכויות שחלות על כולם למטה, ודיקנט הסטודנטים של המוסד שלך.</p>`;
    html += section("🇮🇱 לכל הסטודנטים בארץ", of("all"));
    const otherHtml = Object.keys(INSTITUTIONS_RIGHTS).filter((k) => k !== mine).map((k) => section(`🏛️ ${esc(INSTITUTIONS_RIGHTS[k].name)}`, of(k), contacts(k))).join("");
    if (otherHtml) html += `<details style="margin-top:14px"><summary><b>מוסדות אחרים</b></summary>${otherHtml}</details>`;
    $("#rtList").innerHTML = rows.length ? html : `<p class="notice" style="margin-top:14px">לא מצאנו זכויות שמתאימות. נסו מילה אחרת, נושא "הכול", או נקו את השאלון.</p>`;
  }

  return { page };
}
