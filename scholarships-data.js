// מלגות – הנתונים. רק ממקורות רשמיים: אתר הגוף המעניק או אתר המוסד (בן-גוריון מפרסם גם מלגות חיצוניות).
// אין כאן DOM – הקובץ ייטען גם בשרת (התראות), ולכן רק נתונים ופונקציות טהורות.
//
// תנאים (req = חובה, pref = יתרון). כל תנאי: { k, v?, n? } · { any: [...] } (מספיק אחד) · { all: [...] } (כולם).
//   k: degree(v) · year(n: עד שנה n) · firstYear · field(v: [..]) · inst(v) · service(v: [combat/support/army/national]) ·
//      discharged(n: עד n שנים מהשחרור) · lone · oleh · ethiopian · haredi · minority · firstGen · periphery · need · deposit ·
//      miluim(n: ימים לפחות)
// win: { open, close } לשנה הנוכחית · usual (טקסט: מתי בדרך כלל) · months: [מחודש, עד חודש] כשאין תאריכים · always.

export const SCH_CHECKED = "19.11.2026";

const MOD = "האגף לחיילים משוחררים ומילואים, משרד הביטחון";
const BGU = (slug) => `https://www.bgu.ac.il/welcome/scholarship/${slug}/`;
const SERVED = ["combat", "support", "army", "national"];          // סיים שירות צבאי או לאומי
const IDF = ["combat", "support", "army"];                          // שירות בצה"ל

export const SCHOLARSHIPS = [
  {
    id: "memadim", name: "ממדים ללימודים", provider: MOD, inst: "all",
    amount: "עד 100% משכר הלימוד האוניברסיטאי (בתשפ\"ז: החזר שנתי של עד 10,372.55 ₪, והשלמה ל-100% בשנה האחרונה)",
    req: [{ any: [{ k: "service", v: ["combat"] }, { all: [{ k: "service", v: IDF }, { any: [{ k: "lone" }, { k: "minority" }, { k: "oleh" }] }] }] }, { k: "discharged", n: 8 }],
    pref: [{ k: "discharged", n: 5 }],
    who: "לוחמים עם תעודת \"שחרור בכבוד – זהב\", ואוכלוסיות ייחודיות ששירתו בצה\"ל ויש להן \"שחרור בכבוד\": חיילים בודדים, בני מיעוטים (ערבים, דרוזים, צ'רקסים), מי שהוגדרו עולים חדשים בשירות, זכאי תשמ\"ש הורים ותשלומי משפחה. עד 5 שנים מהשחרור (עד 8 עם הארכות).",
    volunteer: "בלי התנדבות",
    win: { open: "2026-11-08", close: "2027-08-31" },
    how: "באזור האישי באתר האגף ← הטבות ומלגות ← מלגות ← \"ממדים ללימודים\". מסמכים: אישור לימודים וגיליון תשלומים.",
    apply: "https://www.hachvana.mod.gov.il/org.malan.usc.ui/Login",
    src: { t: MOD, url: "https://www.hachvana.mod.gov.il/MainEducation/HachvanaScholarship/Pages/UniformToStudies.aspx" },
  },
  {
    id: "periphery45", name: "גרים בפריפריה 45", provider: MOD, inst: "all",
    amount: "עד 100% משכר הלימוד של שנה א' (תקרה 12,017 ₪ לפי הדף)",
    req: [{ k: "service", v: SERVED }, { k: "periphery" }, { k: "firstYear" }, { k: "degree", v: "ba" },
      { any: [{ k: "discharged", n: 5 }, { all: [{ k: "discharged", n: 10 }, { any: [{ k: "lone" }, { k: "miluim", n: 1 }] }] }] }],
    who: "משוחררים ומסיימי שירות לאומי-אזרחי, שכתובתם הייתה באזור עדיפות לאומית 5 מתוך 6 השנים שלפני הלימודים. לשנה א' בתואר ראשון. עד 5 שנים מהשחרור (חיילים בודדים ומשרתי מילואים פעילים: עד 10).",
    volunteer: "בלי התנדבות",
    win: { open: "2026-08-03", close: "2026-10-31", usual: "בדרך כלל נפתחת בתחילת אוגוסט ונסגרת בסוף אוקטובר" },
    how: "באזור האישי באתר האגף ← הטבות ומלגות ← מלגות ← \"גרים בפריפריה 45\".",
    apply: "https://www.hachvana.mod.gov.il/org.malan.usc.ui/Login",
    src: { t: MOD, url: "https://www.hachvana.mod.gov.il/MainEducation/HachvanaScholarship/Pages/Perypheria45.aspx" },
  },
  {
    id: "milgo", name: "מיל-go!", provider: "המועצה להשכלה גבוהה", inst: "all",
    amount: "5,000 ₪, 7,500 ₪, 10,000 ₪ או 12,480 ₪ (לפי מדרגה)",
    req: [{ k: "degree", v: "ba" }, { k: "need" }],
    who: "סטודנטים לתואר ראשון ותלמידי מכינות קדם-אקדמיות, לפי קריטריונים סוציו-אקונומיים.",
    volunteer: "—",
    win: { usual: "בשנה שעברה התשובות ניתנו במאי–יוני. מועדי ההגשה לתשפ\"ז עוד לא פורסמו בדף הרשמי" },
    how: "לפי ההנחיות בדף המלגה.",
    src: { t: "אוניברסיטת בן-גוריון – מלגת מיל-go!", url: BGU("milgo") },
  },
  {
    id: "perach", name: "פר\"ח", provider: "פר\"ח – פרויקט חונכות", inst: "all",
    amount: "החל מ-7,000 ₪, ותוספת 2,600 ₪ למשרתי מילואים",
    req: [], pref: [{ k: "miluim", n: 1 }],
    who: "סטודנטים פעילים. חונכות אישית או קבוצתית לתלמידים, בכל הארץ.",
    volunteer: "100 שעות חונכות בשנה (3 שעות בשבוע) ומפגשי רכז",
    win: { open: "2026-09-03" },
    how: "הרשמה באתר פר\"ח.",
    apply: "https://perach-prj.weizmann.ac.il/PerachStudent/Registration",
    src: { t: "אוניברסיטת בן-גוריון – מלגת פר\"ח", url: BGU("perach-scholarship") },
  },
  {
    id: "impact", name: "IMPACT!", provider: "Friends of the IDF (FIDF)", inst: "all",
    amount: "5,000$ לכל שנת לימוד, עד 4 שנים",
    req: [{ k: "service", v: ["combat", "support"] }, { k: "need" }],
    who: "חיילים משוחררים מהמערך הלוחם עם תעודת שחרור זהב או כסף, על בסיס מצב סוציו-אקונומי.",
    volunteer: "—",
    win: { usual: "כל שנה מ-1.3 עד 31.5 (אפשר גם לפני הרישום לאוניברסיטה)", months: [3, 5] },
    how: "באתר IMPACT. שאלות: impact@fidf.org",
    apply: "https://www.fidf.org/impact",
    src: { t: "אוניברסיטת בן-גוריון – מלגת IMPACT", url: BGU("impact") },
  },
  {
    id: "isef", name: "קרן אייסף", provider: "הקרן הבינלאומית לחינוך (ISEF)", inst: "all",
    amount: "מלגה וליווי לתואר ראשון, שני ודוקטורט",
    req: [{ k: "need" }, { any: [{ k: "periphery" }, { k: "firstGen" }] }], pref: [{ k: "firstGen" }, { k: "periphery" }],
    who: "סטודנטים מבטיחים מהפריפריה הכלכלית-חברתית-גיאוגרפית, דור ראשון להשכלה אקדמית, עם דגש על מצב כלכלי.",
    volunteer: "—",
    win: { usual: "ההרשמה לתשפ\"ז נפתחה ביוני 2026 (תאריך סגירה לא פורסם בדף). בדרך כלל נפתחת ביוני" },
    how: "בבן-גוריון: ההרשמה מותנית בהגשת בקשה למלגת דיקן.",
    src: { t: "אוניברסיטת בן-גוריון – קרן אייסף", url: BGU("isef") },
  },
  {
    id: "atidim", name: "עתידים לתעשייה ולהייטק", provider: "עמותת עתידים", inst: "all",
    amount: "77,000 ₪ סבסוד שכר לימוד ומלגות, משרת סטודנט בתעשייה וליווי",
    req: [{ k: "field", v: ["eng", "cs", "phys"] }, { k: "degree", v: "ba" }], pref: [{ k: "firstYear" }],
    who: "נרשמים לשנה א' בתואר ראשון בהנדסה, פיזיקה או מדעי המחשב, או מסיימי סמסטר אביב בציון 75 ומעלה.",
    volunteer: "—",
    win: { usual: "מועדי ההרשמה – בדף התוכנית" },
    how: "לפי ההנחיות בדף התוכנית.",
    src: { t: "אוניברסיטת בן-גוריון – עתידים לתעשייה ולהייטק", url: BGU("atidim-industry-hitech") },
  },
  {
    id: "heseg", name: "קרן הישג", provider: "קרן הישג", inst: "all",
    amount: "10,000 ₪ בשנה לשכר לימוד, ו-1,500 ₪ בחודש לאורך השנה",
    req: [{ k: "lone" }, { k: "service", v: IDF }, { k: "degree", v: "ba" }, { k: "discharged", n: 2 }],
    who: "חיילים משוחררים שהוכרו כחיילים בודדים לפחות חצי מהשירות, עם שירות מלא (בנים 24 חודשים, בנות 12). תחילת לימודים עד שנתיים מהשחרור, תואר ראשון מלא (לא באוניברסיטה הפתוחה). למי שלא הגיש בעבר.",
    volunteer: "—",
    win: { usual: "כל שנה ממרץ עד 30.6 (גם לפני הרישום לאוניברסיטה)", months: [3, 6] },
    how: "טופס באתר הקרן, עם צילום תעודת שחרור, אישור חייל בודד ואישור רישום. טל' 03-7113100",
    src: { t: "אוניברסיטת בן-גוריון – קרן הישג", url: BGU("heseg") },
  },
  {
    id: "rothschild", name: "שגרירי רוטשילד", provider: "שותפויות אדמונד דה רוטשילד", inst: "all",
    amount: "20,000 ₪ בשנה (לימודים ומחייה), תוכנית תלת-שנתית",
    req: [{ k: "degree", v: "ba" }, { k: "periphery" }],
    who: "סטודנטים לתואר ראשון בכל תחומי הלימוד, מהפריפריה החברתית והגיאוגרפית, בתוכנית מנהיגות.",
    volunteer: "התמחות בארגונים חברתיים לאורך 3 שנים",
    win: { open: "2026-06-01", close: "2026-07-31", usual: "בדרך כלל יוני–יולי" },
    how: "הגשת מועמדות באתר התוכנית.",
    src: { t: "אוניברסיטת בן-גוריון – שגרירי רוטשילד", url: BGU("rothschild-ambassadors-program") },
  },
  {
    id: "marom", name: "מרום (יוצאי אתיופיה)", provider: "המועצה להשכלה גבוהה", inst: "all",
    amount: "10,000 ₪ לכל שנת לימודים עד סוף השנים התקניות",
    req: [{ k: "ethiopian" }, { k: "degree", v: "ba" }, { k: "year", n: 2 }],
    who: "יוצאי אתיופיה בשנה א' או ב' בתואר ראשון (אם לא נרשמו קודם).",
    volunteer: "פעילות חברתית דרך פר\"ח",
    win: { open: "2026-09-09" },
    how: "לפי ההנחיות בדף המלגה.",
    src: { t: "אוניברסיטת בן-גוריון – מלגת מרום", url: BGU("marom-scholarship") },
  },
  {
    id: "tene", name: "טנא (בוגרי החינוך החרדי)", provider: "המועצה להשכלה גבוהה, מופעל ע\"י עמותת אלומה", inst: "all",
    amount: "סיוע כלכלי לפי רמת לימודים",
    req: [{ k: "haredi" }, { k: "need" }],
    who: "בוגרי החינוך החרדי, עם תנאי סף כלכלי.",
    volunteer: "—",
    win: { open: "2026-08-15" },
    how: "באתר עמותת אלומה (קישור בדף המלגה).",
    src: { t: "אוניברסיטת בן-גוריון – מלגת טנא", url: BGU("tene-scholarship") },
  },
  {
    id: "aliyah", name: "מינהל הסטודנטים – משרד העלייה והקליטה", provider: "משרד העלייה והקליטה", inst: "all",
    amount: "מלגת שכר לימוד לעד 3 שנות לימוד",
    req: [{ k: "oleh" }],
    who: "סטודנטים עולים.",
    volunteer: "—",
    win: { always: true },
    how: "הגשה כל השנה, באתר מינהל הסטודנטים.",
    src: { t: "אוניברסיטת בן-גוריון – מלגת מינהל הסטודנטים", url: BGU("aliyah-scholarship") },
  },

  // ===== בן-גוריון =====
  {
    id: "bgu-dean", name: "מלגת דיקן הסטודנטים", provider: "אוניברסיטת בן-גוריון", inst: "bgu",
    amount: "לכיסוי שכר לימוד, לפי מצב כלכלי",
    req: [{ k: "inst", v: "bgu" }], pref: [{ k: "need" }],
    who: "סטודנטים בשנות לימוד תקניות, בעיקר על בסיס כלכלי. גם מסלולים למצטייני ספורט, סטודנטים עם מוגבלויות ופעילות חברתית.",
    volunteer: "פעילות חברתית בקהילה (יש פטורים, למשל נשואים עם ילדים – לפי הדף)",
    win: { close: "2026-10-17", usual: "בדרך כלל נפתחת לקראת שנת הלימודים" },
    how: "בקשה מקוונת למלגת דיקן. הרבה מלגות אחרות בבן-גוריון מותנות בה.",
    src: { t: "אוניברסיטת בן-גוריון – מלגת דיקן הסטודנטים", url: BGU("dean-scholarship") },
  },
  {
    id: "bgu-dorms", name: "מלגת מעונות למשרתי מילואים", provider: "אוניברסיטת בן-גוריון", inst: "bgu",
    amount: "350 ₪ בחודש בכפר הסטודנטים",
    req: [{ k: "inst", v: "bgu" }, { any: [{ k: "miluim", n: 1 }, { k: "discharged", n: 3 }] }, { k: "degree", v: "ba" }, { k: "firstYear" }],
    who: "משרתי מילואים פעילים, או מי שסיימו שירות סדיר מאוקטובר 2023, שהתקבלו לתואר ראשון בתשפ\"ז וחתמו על חוזה בכפר הסטודנטים. ל-100 הנרשמים הראשונים.",
    volunteer: "—",
    win: { usual: "נפתחת עם ההרשמה לכפר הסטודנטים. כל הקודם זוכה" },
    how: "פנייה ל-megurim@bgu.ac.il או 08-6472655.",
    src: { t: "אוניברסיטת בן-גוריון – מלגת מעונות למשרתי מילואים", url: BGU("dorms-scholarship") },
  },
  {
    id: "bgu-first", name: "ראשונים לתואר", provider: "אוניברסיטת בן-גוריון וקרן גרוס", inst: "bgu",
    amount: "10,000 ₪ בשנה, ל-3 שנות לימוד (עד 40 מלגות), וליווי אישי",
    req: [{ k: "inst", v: "bgu" }, { k: "degree", v: "ba" }, { k: "firstYear" }, { k: "firstGen" }, { k: "periphery" }, { k: "service", v: SERVED }, { k: "discharged", n: 5 }, { k: "field", v: ["social", "nursing", "mgmt"] }],
    who: "מתחילים תואר ראשון במדעי הרוח, החברה, סיעוד או ניהול. דור ראשון לאקדמיה, מהפריפריה הגיאוגרפית/חברתית (עדיפות לנגב), אחרי שירות צבאי או לאומי מלא, עד 5 שנים מהשחרור.",
    volunteer: "ליווי מהדיקנאט",
    win: { usual: "פתוחה עד מילוי המכסה" },
    how: "הגשה לפי ההנחיות בדף התוכנית.",
    src: { t: "אוניברסיטת בן-גוריון – ראשונים לתואר", url: BGU("first-to-degree") },
  },
  {
    id: "bgu-bbk", name: "מלגת BBK (דור ראשון)", provider: "אוניברסיטת בן-גוריון", inst: "bgu",
    amount: "מלגת שכר לימוד (עד 12 מלגות) וליווי",
    req: [{ k: "inst", v: "bgu" }, { k: "degree", v: "ba" }, { k: "firstGen" }, { k: "firstYear" }, { k: "service", v: SERVED }, { k: "discharged", n: 7 }],
    pref: [{ k: "periphery" }],
    who: "דור ראשון לאקדמיה שמתחילים תואר ראשון בתשפ\"ז, אחרי שירות מלא, עד 7 שנים מהשחרור. מהפריפריה (עדיפות לנגב). בלי כפל מלגות.",
    volunteer: "ליווי מהדיקנאט",
    win: { close: "2026-10-17", usual: "מותנית בבקשה למלגת דיקן" },
    how: "בקשה מקוונת למלגת דיקן.",
    src: { t: "אוניברסיטת בן-גוריון – מלגת BBK", url: BGU("bbk-scholarship") },
  },
  {
    id: "bgu-gross", name: "קרן גרוס לחיילים משוחררים", provider: "אוניברסיטת בן-גוריון וקרן גרוס", inst: "bgu",
    amount: "10,000 ₪ לשנה",
    req: [{ k: "inst", v: "bgu" }, { k: "service", v: SERVED }, { k: "discharged", n: 5 }, { k: "deposit" }],
    who: "חיילים משוחררים (עד 5 שנים מהשחרור) שניצלו מעל 8,000 ₪ מהפיקדון האישי.",
    volunteer: "80 שעות בשנה בקהילה ו-4 סמינרים",
    win: { open: "2026-09-01", close: "2026-11-04", usual: "בדרך כלל ספטמבר–תחילת נובמבר" },
    how: "הרשמה במערכת המחלקה למעורבות חברתית. רכזת: meigal@bgu.ac.il",
    src: { t: "אוניברסיטת בן-גוריון – קרן גרוס", url: BGU("gross-foundation") },
  },
  {
    id: "bgu-moshe", name: "קרן משה – תוכנית מנהיגות", provider: "אוניברסיטת בן-גוריון וקרן משה", inst: "bgu",
    amount: "12,000 ₪ לשנה",
    req: [{ k: "inst", v: "bgu" }, { k: "degree", v: "ba" }], pref: [{ k: "year", n: 2 }],
    who: "סטודנטים לתואר ראשון עם לפחות שנתיים לימודים שנותרו, בעלי רגישות חברתית.",
    volunteer: "120 שעות בשנה בקהילה ו-4 סמינרים",
    win: { open: "2026-05-20", close: "2026-09-15", usual: "בדרך כלל מאמצע מאי עד אמצע ספטמבר" },
    how: "הרשמה במערכת המחלקה למעורבות חברתית.",
    src: { t: "אוניברסיטת בן-גוריון – קרן משה", url: BGU("moshe-foundation") },
  },
  {
    id: "bgu-schulich", name: "מנהיגי שוליך", provider: "קרן שוליך", inst: "bgu",
    amount: "40,000 ₪ לשנת לימודים",
    req: [{ k: "inst", v: "bgu" }, { k: "degree", v: "ba" }, { k: "firstYear" }, { k: "field", v: ["eng", "cs"] }], pref: [{ k: "need" }],
    who: "מתחילים שנה א' בהנדסה או במדעי המחשב. אזרחים ישראלים, שעומדים בשניים מתוך שלושה: ציונים מעל סף הקבלה, צורך כלכלי, רקע מנהיגות/יזמות/מצוינות (פיקוד, מכינה, שנת שירות).",
    volunteer: "תוכנית העשרה",
    win: { close: "2026-10-17", usual: "מותנית בבקשה למלגת דיקן" },
    how: "קודם בקשה למלגת דיקן, ואז בקשה למלגת שוליך.",
    src: { t: "אוניברסיטת בן-גוריון – מלגת מנהיגי שוליך", url: BGU("schulich") },
  },
];

// ===== התאמה (1–10) – פונקציות טהורות, משותפות לאפליקציה ולשרת =====
// a = תשובות: { inst, degree, year (1-4: ד' ומעלה), field, service, discharged (שנים), miluim (ימים), lone, oleh, ethiopian,
//               haredi, minority, firstGen, periphery, need, deposit }. כל תנאי: true / false / null (לא ענית).
export function cond(c, a) {
  if (c.any) { const r = c.any.map((x) => cond(x, a)); return r.includes(true) ? true : r.includes(null) ? null : false; }
  if (c.all) { const r = c.all.map((x) => cond(x, a)); return r.includes(false) ? false : r.includes(null) ? null : true; }
  const v = a[c.k];
  const has = (x) => x !== undefined && x !== null && x !== "";
  switch (c.k) {
    case "inst": case "degree": return has(v) ? v === c.v : null;
    case "field": case "service": return has(v) ? c.v.includes(v) : null;
    case "year": return has(v) ? +v <= c.n : null;
    case "firstYear": return has(a.year) ? +a.year === 1 : null;
    case "discharged": return a.service === "none" ? false : has(v) ? +v <= c.n : null;
    case "miluim": return has(v) ? +v >= c.n : null;
    default: return has(v) ? !!v : null;   // lone, oleh, ethiopian, haredi, minority, firstGen, periphery, need, deposit
  }
}

// ציון: תנאי חובה שלא מתקיים -> 0 (לא מתאים). אחרת 10, פחות 2 על כל תנאי חובה שלא ידוע, פחות 1 על יתרון שלא מתקיים,
// פחות 0.5 על יתרון לא ידוע. אם אף תנאי לא ידוע (לא ענית על שום דבר רלוונטי) – לכל היותר 5, כי אנחנו לא יודעים.
export function score(s, a) {
  const req = (s.req || []).map((c) => cond(c, a)), pref = (s.pref || []).map((c) => cond(c, a));
  if (req.includes(false)) return { score: 0, missing: 0 };
  // "ידוע" = תנאי שענית עליו. המוסד לבדו לא נחשב מידע על ההתאמה (רק מסנן מלגות של מוסד אחר)
  const notInst = (c) => c.k !== "inst";
  const all = [...req, ...pref], known = [...(s.req || []).filter(notInst).map((c) => cond(c, a)), ...(s.pref || []).map((c) => cond(c, a))].filter((x) => x !== null).length;
  let sc = 10;
  sc -= 2 * req.filter((x) => x === null).length;
  sc -= pref.filter((x) => x === false).length;
  sc -= 0.5 * pref.filter((x) => x === null).length;
  if (all.length && known === 0) sc = Math.min(sc, 5);
  if (all.includes(null)) sc = Math.min(sc, 9);   // משהו עוד לא ידוע – לא נותנים 10
  if (!all.length && !Object.keys(a).some((k) => k !== "inst")) sc = Math.min(sc, 5);   // מלגה פתוחה לכולם, אבל עוד לא ענית כלום
  return { score: Math.max(1, Math.min(10, Math.round(sc))), missing: req.filter((x) => x === null).length };
}

// התאריך של היום לפי שעון ישראל (לא UTC)
export function israelDate(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

// מצב ההרשמה היום: open / soon (נפתחת בתוך 30 יום) / closed / unknown / always
export function status(s, now = new Date()) {
  const w = s.win || {}, d = israelDate(now), month = +d.slice(5, 7);
  if (w.always) return { k: "always", t: "אפשר להגיש כל השנה" };
  if (w.open && w.open <= d && (!w.close || d <= w.close)) return { k: "open", t: w.close ? `פתוחה עכשיו, עד ${fmt(w.close)}` : `נפתחה ב-${fmt(w.open)}` };
  if (w.open && d < w.open) { const days = Math.round((Date.parse(w.open) - Date.parse(d)) / 864e5); return { k: days <= 30 ? "soon" : "closed", t: `נפתחת ב-${fmt(w.open)}` }; }
  if (w.close && d > w.close) return { k: "closed", t: `נסגרה ב-${fmt(w.close)}${w.usual ? ". " + w.usual : ""}` };
  if (w.months) {
    const [a, b] = w.months, inside = month >= a && month <= b;
    return inside ? { k: "unknown", t: `${w.usual} – כדאי לבדוק עכשיו בדף` } : { k: "closed", t: `סגורה עכשיו. ${w.usual}` };
  }
  return { k: "unknown", t: w.usual || "מועדי ההגשה – בדף המלגה" };
}
const fmt = (iso) => { const [y, m, dd] = iso.split("-"); return `${+dd}.${+m}.${y.slice(2)}`; };
