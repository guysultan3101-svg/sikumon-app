// משלים לשיעורים במערכת השעות מיקום ומרצה מהמערכת של האוניברסיטה.
// ההתאמה: יום+שעה+קורס, ואם אין – יום+שעה (שם הקורס אצלנו יכול להיות שונה מהשם המלא), ואם אין – יום+קורס.
// מחזירה true אם משהו הושלם.
export function fillFromUni(local, uni) {
  let filled = false;
  for (const x of local || []) {
    const dayRows = (uni || []).filter((y) => +y.day === +x.day);
    const s = dayRows.find((y) => y.start === x.start && y.course === x.course) || dayRows.find((y) => y.start === x.start) || dayRows.find((y) => y.course === x.course);
    if (!s) continue;
    // השם הרשמי (כמו במודל): כך "חומרים לשיעור" וזום נמצאים גם כשאצלנו הקורס נקרא אחרת ("מיקרו" / "מבוא לכלכלה מיקרו")
    if (s.course && s.course !== x.course && x.uniCourse !== s.course) { x.uniCourse = s.course; filled = true; }
    if (x.place && x.lecturer) continue;
    if (s.place && !x.place) { x.place = s.place; filled = true; }
    if (s.lecturer && !x.lecturer) { x.lecturer = s.lecturer; filled = true; }
  }
  return filled;
}

// התאמת שם קורס לשם שקיים ברשימה (למשל השמות של חומרי המודל): זהה → זהה אחרי ניקוי → מכיל → הכי הרבה מילים משותפות.
// "תרגיל" חייב להתאים בשני הצדדים, כדי ש"מיקרו" לא יתחבר ל"מיקרו-תרגיל".
const clean = (t) => String(t || "").replace(/["'״׳()\[\]]/g, "").replace(/[-–_.,:/]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const isEx = (t) => /תרגיל|תרגול/.test(t);
const words = (t) => clean(t).replace(/תרגיל|תרגול/g, " ").split(" ").filter((w) => w.length > 1);
export function matchCourse(name, keys) {
  if (!name || !keys?.length) return null;
  if (keys.includes(name)) return name;
  const n = clean(name), ex = isEx(name), same = keys.filter((k) => isEx(k) === ex);
  const eq = same.find((k) => clean(k) === n); if (eq) return eq;
  const nw = words(name);
  // "א" / "ב" (חלק הקורס): אם מופיע בשני השמות – חייב להיות זהה
  const lvl = (t) => (clean(t).replace(/תרגיל|תרגול/g, " ").match(/(?:^|\s)([א-ת])(?=\s|$)/) || [])[1] || "";
  const nl = lvl(name);
  let best = null, score = 0;
  for (const k of same) {
    if (nl && lvl(k) && lvl(k) !== nl) continue;
    const kw = words(k);
    const common = nw.filter((w) => kw.some((x) => x === w || (w.length > 3 && (x.startsWith(w.slice(0, -1)) || w.startsWith(x.slice(0, -1)))))).length;
    const sc = common / Math.max(1, Math.min(nw.length, kw.length));
    if (sc > score) { score = sc; best = k; }
  }
  return score >= 0.99 || (score >= 0.6 && nw.length >= 1) ? best : null;
}
