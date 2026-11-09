// משלים לשיעורים במערכת השעות מיקום ומרצה מהמערכת של האוניברסיטה.
// ההתאמה: יום+שעה+קורס, ואם אין – יום+שעה (שם הקורס אצלנו יכול להיות שונה מהשם המלא), ואם אין – יום+קורס.
// מחזירה true אם משהו הושלם.
export function fillFromUni(local, uni) {
  let filled = false;
  for (const x of local || []) {
    if (x.place && x.lecturer) continue;
    const dayRows = (uni || []).filter((y) => +y.day === +x.day);
    const s = dayRows.find((y) => y.start === x.start && y.course === x.course) || dayRows.find((y) => y.start === x.start) || dayRows.find((y) => y.course === x.course);
    if (!s) continue;
    if (s.place && !x.place) { x.place = s.place; filled = true; }
    if (s.lecturer && !x.lecturer) { x.lecturer = s.lecturer; filled = true; }
  }
  return filled;
}
