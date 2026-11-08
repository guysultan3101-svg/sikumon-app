// עד 3 מבחנים ביום. מבחן נוסף נפתח אחרי ששיתפת את Clearly עם חבר/ה (כל שיתוף = עוד מבחן אחד היום).
// נספר במכשיר. מבחן לדוגמה לא נספר.
const KEY = "sikumon-quiz-day";
const FREE = 3;
const LINK = "https://clearlyapp.io";
const today = () => new Date().toLocaleDateString("en-CA");

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); if (v.d === today()) return v; } catch { /* */ }
  return { d: today(), n: 0, bonus: 0 };
}
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ } }

export function quizzesLeft() { const v = load(); return Math.max(0, FREE + v.bonus - v.n); }

// לפני שמתחילים מבחן: true = מתחילים (והמבחן נספר), false = לא עכשיו
export async function takeQuizSlot() {
  const v = load();
  if (v.n < FREE + v.bonus) { v.n += 1; save(v); return true; }
  return unlockModal();
}

function unlockModal() {
  return new Promise((resolve) => {
    document.getElementById("qlModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="modal" id="qlModal" role="dialog" aria-modal="true" aria-labelledby="qlT"><div class="card" style="display:grid;gap:12px;max-width:440px">
      <h2 id="qlT">🎯 עשית ${FREE} מבחנים היום</h2>
      <p>רוצה עוד מבחן? שתפו את Clearly עם חבר/ה מהכיתה, וכל שיתוף פותח לכם מבחן נוסף היום.</p>
      <p class="small muted" id="qlMsg" aria-live="polite"></p>
      <div class="row"><button class="btn" type="button" id="qlShare">📤 שיתוף עם חבר/ה</button><button class="btn ghost" type="button" id="qlNo">לא עכשיו</button></div></div></div>`);
    const m = document.getElementById("qlModal");
    const done = (ok) => { m.remove(); document.removeEventListener("keydown", esc); resolve(ok); };
    const esc = (e) => { if (e.key === "Escape") done(false); };
    document.addEventListener("keydown", esc);
    const grant = () => { const v = load(); v.bonus += 1; v.n += 1; save(v); };
    document.getElementById("qlNo").onclick = () => done(false);
    document.getElementById("qlShare").onclick = async () => {
      const text = "מצאתי אפליקציה שמסכמת לבד את השיעורים מהמודל ועושה מבחנים. נסו:";
      if (navigator.share) {
        try { await navigator.share({ title: "Clearly", text, url: LINK }); grant(); done(true); }
        catch { /* ביטלו את השיתוף – לא נפתח מבחן */ }
        return;
      }
      try { await navigator.clipboard.writeText(`${text} ${LINK}`); } catch { /* */ }
      document.getElementById("qlMsg").textContent = "הקישור הועתק. שלחו אותו לחבר/ה בוואטסאפ, והמבחן נפתח.";
      grant();
      setTimeout(() => done(true), 1800);
    };
    document.getElementById("qlShare").focus();
  });
}
