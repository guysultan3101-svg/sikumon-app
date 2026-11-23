// מעקב לחיצות לדאשבורד של המוצר (רק לגיא): איזה כפתור + באיזה מסך. בלי שום תוכן.
// אף פעם לא שולחים טקסט מהמסך (גם לא aria-label) – כי לפעמים יש בו שם של אדם, קורס או סיכום.
// שולחים רק: מזהה קבוע של כפתור (id), סוג המסך שהקישור מוביל אליו, או סוג הכפתור (data-…) / המחלקה שלו.
// הלחיצות נאספות ונשלחות במנות (כל 20 שניות, וכשסוגרים/מחליפים אפליקציה) – לא בקשה על כל לחיצה.
import { URL_, ANON, token, user } from "./api.js";

// מסכים קבועים שיש בשם שלהם "-" (כל השאר עם "-" = מסך עם מזהה/שם → נשמר רק הסוג, למשל "sum-*")
const STATIC = new Set(["social-friends", "messages-req", "quiz-new", "profile-liked", "profile-saved", "exam-focus", "missed-lesson", "settings-ai", "settings-study", "settings-account", "settings-privacy", "settings-access", "legal-terms", "legal-privacy", "legal-access"]);
export function route(h) {
  let r = String(h || "").replace(/^#/, "").split("?")[0] || "home";
  try { r = decodeURIComponent(r); } catch { /* */ }
  if (STATIC.has(r)) return r;
  if (r.includes("-")) { const pre = r.split("-")[0]; return /^[a-z]{1,16}$/.test(pre) ? pre + "-*" : "other"; }
  return /^[a-z]{1,20}$/.test(r) ? r : "other";
}
const safeId = (s) => /^[a-zA-Z][a-zA-Z_]{1,24}$/.test(s || "");   // מזהים קבועים בלבד (בלי ספרות/מזהים דינמיים)
export function label(el) {
  if (safeId(el.id)) return "#" + el.id;
  const href = el.getAttribute("href");
  if (href && href.startsWith("#")) return "→" + route(href);
  if (href) return "→link";
  const ds = Object.keys(el.dataset || {}).find((k) => /^[a-z][a-zA-Z]{0,20}$/.test(k));
  if (ds) return "[" + ds + "]";
  const cls = [...el.classList].find((c) => /^[a-z][a-z-]{1,20}$/.test(c) && !/^(btn|link|small|ghost|item|card|small-btn|chip)$/.test(c)) || [...el.classList][0];
  const base = el.tagName.toLowerCase() + (cls && /^[a-z][a-z-]{1,20}$/.test(cls) ? "." + cls : "");
  // כפתור בלי שם: מוסיפים את האזור שבו הוא נמצא (מזהה קבוע של אזור אב), למשל "button.opt@aiPanel"
  let a = el.parentElement; while (a && !safeId(a.id)) a = a.parentElement;
  return a && a.id !== "view" ? `${base}@${a.id}` : base;
}

let q = [];
async function flush(keep = false) {
  if (!q.length || !user() || !token()) return;
  const names = q.splice(0, 50);
  try {
    await fetch(`${URL_}/rest/v1/rpc/track_events`, {
      method: "POST", keepalive: keep,
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + token() },
      body: JSON.stringify({ p_names: names }),
    });
  } catch { /* בלי אינטרנט – מוותרים, זה רק סטטיסטיקה */ }
}
document.addEventListener("click", (e) => {
  const el = e.target.closest?.("a, button, [role=button], summary, label.btn");
  if (!el || !user()) return;
  if (/^#admin/.test(location.hash)) return;   // לא אוספים בעמוד הניהול
  q.push(`click:${route(location.hash)}|${label(el)}`.slice(0, 60));
  if (q.length >= 40) flush();
}, { capture: true, passive: true });
setInterval(flush, 20000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
