// מנוע ההקלטה: מקליט מהמיקרופון, שומר חתיכה כל דקה במכשיר (IndexedDB),
// מחזיק את המסך דולק, ומזהה אם ההקלטה נקטעה (למשל כשיוצאים מהאפליקציה באייפד).

const DB_NAME = "sikumon";
const CHUNK_MS = 60_000;
const ROLL_MS = 12 * 60_000; // אורך קטע: 12 דקות (~5–9MB)

// ---------- אחסון במכשיר ----------
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore("recordings", { keyPath: "id" });
        const chunks = db.createObjectStore("chunks", { autoIncrement: true });
        chunks.createIndex("byRec", "recId");
      }
      // גרסה 2: שיעורים (מחברת לכל שיעור: כתב יד, הקלדה והקלטות)
      if (e.oldVersion < 2) db.createObjectStore("lessons", { keyPath: "id" });
      // גרסה 3: ספרייה (סיכומים ומבחנים) והיסטוריית מבחנים
      if (e.oldVersion < 3) { db.createObjectStore("library", { keyPath: "id" }); db.createObjectStore("attempts", { keyPath: "id" }); }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => (dbPromise = null); // iOS סוגר לפעמים את החיבור ברקע
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    // בקשת קריאה מחזירה את הערך (גם אם הוא ריק), ולא את אובייקט הבקשה עצמו
    t.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    t.onerror = () => reject(t.error);
  });
}

export const store = {
  saveRecording: (rec) => tx("recordings", "readwrite", (s) => s.put(rec)),
  getRecording: (id) => tx("recordings", "readonly", (s) => s.get(id)),
  listRecordings: () => tx("recordings", "readonly", (s) => s.getAll()),
  addChunk: (chunk) => tx("chunks", "readwrite", (s) => s.add(chunk)),
  saveLesson: (l) => tx("lessons", "readwrite", (s) => s.put({ ...l, updatedAt: new Date().toISOString() })),
  putLessonRaw: (l) => tx("lessons", "readwrite", (s) => s.put(l)),   // שמירה בלי לשנות את זמן העדכון (לסנכרון)
  getLesson: (id) => tx("lessons", "readonly", (s) => s.get(id)),
  listLessons: () => tx("lessons", "readonly", (s) => s.getAll()),
  deleteLesson: (id) => tx("lessons", "readwrite", (s) => s.delete(id)),
  putItem: (it) => tx("library", "readwrite", (s) => s.put(it)),
  getItem: (id) => tx("library", "readonly", (s) => s.get(id)),
  listItems: () => tx("library", "readonly", (s) => s.getAll()),
  deleteItem: (id) => tx("library", "readwrite", (s) => s.delete(id)),
  addAttempt: (a) => tx("attempts", "readwrite", (s) => s.put(a)),
  listAttempts: () => tx("attempts", "readonly", (s) => s.getAll()),
  async chunksOf(recId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("chunks").objectStore("chunks").index("byRec").getAll(recId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async deleteRecording(id) {
    const db = await openDb();
    const t = db.transaction(["recordings", "chunks"], "readwrite");
    t.objectStore("recordings").delete(id);
    const idx = t.objectStore("chunks").index("byRec");
    idx.openKeyCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
      const c = e.target.result;
      if (c) { t.objectStore("chunks").delete(c.primaryKey); c.continue(); }
    };
    return new Promise((resolve) => { t.oncomplete = resolve; });
  },
};

// מחבר את החתיכות של כל קטע הקלטה לקובץ אחד שאפשר לנגן
export async function segmentsOf(rec) {
  const chunks = await store.chunksOf(rec.id);
  const bySeg = new Map();
  for (const c of chunks) {
    if (!bySeg.has(c.segment)) bySeg.set(c.segment, []);
    bySeg.get(c.segment).push(c);
  }
  return [...bySeg.entries()].sort((a, b) => a[0] - b[0]).map(([seg, list]) => {
    list.sort((a, b) => a.seq - b.seq);
    return { segment: seg, blob: new Blob(list.map((c) => c.blob), { type: rec.mime }), chunks: list.length };
  });
}

// הקלטה שנשארה "מקליט" כי האפליקציה נסגרה באמצע: מסמנים כנקטעה (מה שנשמר עד אז נשאר)
export async function recoverOrphans(activeId) {
  for (const r of await store.listRecordings()) {
    if ((r.status === "recording" || r.status === "stopping") && r.id !== activeId) {
      r.status = "paused";
      r.interruptions = [...(r.interruptions || []), { at: new Date().toISOString(), what: "האפליקציה נסגרה באמצע ההקלטה" }];
      await store.saveRecording(r);
    }
  }
}

// ---------- בחירת פורמט ----------
function pickMime() {
  const options = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac"];
  if (typeof MediaRecorder === "undefined") return null;
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
}

export function support() {
  return {
    mic: !!navigator.mediaDevices?.getUserMedia,
    recorder: typeof MediaRecorder !== "undefined",
    mime: pickMime(),
    wakeLock: "wakeLock" in navigator,
    display: !!navigator.mediaDevices?.getDisplayMedia,
    secure: window.isSecureContext,
    standalone: window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  };
}

// ---------- המקליט ----------
export class LessonRecorder extends EventTarget {
  constructor() {
    super();
    this.rec = null; this.stream = null; this.mr = null; this.wake = null;
    this.segment = 0; this.bytes = 0; this.chunkCount = 0;
    this.elapsedBefore = 0; this.segmentStart = 0; this.segActive = false;
    this.analyser = null; this.level = 0; this.lastDataAt = 0; this.watchdog = null;
    this.source = "mic"; this.capture = null; this._disp = null; this._mic = null; this._mixCtx = null;
    this._onVisibility = this._onVisibility.bind(this);
  }

  get running() { return this.mr?.state === "recording"; }
  // הזמן נספר מתחילת הקטע ועד שהוא נעצר או נקטע
  get elapsedMs() { return this.elapsedBefore + (this.segActive ? Date.now() - this.segmentStart : 0); }

  async start(course, lessonId = null, { source = "mic" } = {}) {
    this.source = source;
    const mime = pickMime();
    this.rec = {
      id: "rec-" + Date.now(), course, startedAt: new Date().toISOString(), endedAt: null,
      mime: mime || "audio/webm", segments: 0, durationMs: 0, bytes: 0, interruptions: [],
      device: navigator.userAgent, status: "recording", lessonId, source,
    };
    if (source !== "mic") await this._acquireCapture(); // קול המחשב (זום): שיתוף חלון פעם אחת
    await this._startSegment(); // אם אין אישור/קול, לא נשמרת הקלטה ריקה
    await store.saveRecording(this.rec);
    // מבקשים מהדפדפן לא למחוק את ההקלטות לבד כשחסר מקום
    try { await navigator.storage?.persist?.(); } catch { /* לא חובה */ }
    document.addEventListener("visibilitychange", this._onVisibility);
  }

  async _startSegment() {
    if (this.source === "mic") {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      const track = this.stream.getAudioTracks()[0];
      track.addEventListener("ended", () => this._interrupted("המיקרופון נסגר"));
      // באייפון: שיחת טלפון או Siri "משתיקים" את המיקרופון לזמן מה
      track.addEventListener("mute", () => this._note("המיקרופון הושתק (למשל שיחה נכנסת)"));
    } else {
      this.stream = this.capture; // אותו מקור קול בין הקטעים – בלי לבקש שיתוף שוב כל 12 דקות
    }
    this.mr = new MediaRecorder(this.stream, this.rec.mime ? { mimeType: this.rec.mime, audioBitsPerSecond: 48000 } : undefined);
    const segment = this.segment;
    let seq = 0;
    this.mr.ondataavailable = async (e) => {
      if (!e.data || !e.data.size) return;
      this.lastDataAt = Date.now();
      await store.addChunk({ recId: this.rec.id, segment, seq: seq++, blob: e.data, at: Date.now() });
      this.bytes += e.data.size; this.chunkCount += 1;
      this.rec.bytes = this.bytes;
      this.rec.durationMs = this.elapsedMs;
      await store.saveRecording(this.rec);
      this.dispatchEvent(new Event("saved"));
    };
    this.mr.onstop = () => { this._interrupted("ההקלטה נעצרה"); this.dispatchEvent(new Event("segmentstop")); };
    this.mr.onerror = (e) => this._interrupted("שגיאת הקלטה: " + (e.error?.name || "לא ידוע"));
    this.mr.start(CHUNK_MS);
    // כל 12 דקות מתחילים קטע חדש (הפסקה של שבריר שנייה): כל קטע הוא קובץ קטן שאפשר לתמלל בנפרד
    clearTimeout(this.rollTimer);
    this.rollTimer = setTimeout(() => this.roll(), ROLL_MS);
    this.segmentStart = Date.now(); this.lastDataAt = Date.now(); this.segActive = true;
    this.rec.segments = this.segment + 1;
    // ביטחון: אם הדפדפן לא מסר חתיכה יותר מדקה וחצי, מבקשים אותה ידנית
    clearInterval(this.watchdog);
    this.watchdog = setInterval(() => {
      if (this.running && Date.now() - this.lastDataAt > CHUNK_MS * 1.5) { try { this.mr.requestData(); } catch { /* */ } }
    }, 15_000);
    this._meter();
    await this._keepAwake();
    this.dispatchEvent(new Event("change"));
  }

  _meter() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume?.(); // באייפון ה-AudioContext מתחיל לפעמים "מושהה"
      const src = ctx.createMediaStreamSource(this.stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this._ctx = ctx;
      const data = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        if (!this.running || !this.analyser) return;
        this.analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        this.level = Math.min(1, peak / 64);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch { /* מד עוצמה הוא תוספת, לא חובה */ }
  }

  // קול המחשב (זום/וידאו) דרך שיתוף חלון/לשונית – מחשב בלבד. נרכש פעם אחת ומשמש את כל ההקלטה.
  async _acquireCapture() {
    const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    disp.getVideoTracks().forEach((t) => t.stop()); // את התמונה לא שומרים, רק הקול
    const da = disp.getAudioTracks();
    if (!da.length) { disp.getTracks().forEach((t) => t.stop()); throw Object.assign(new Error("לא סומן שיתוף אודיו. נסו שוב, ובחלון השיתוף סמנו את התיבה 'שיתוף אודיו'."), { code: "noaudio" }); }
    da[0].addEventListener("ended", () => this._interrupted("שיתוף הקול של המחשב הופסק"));
    this._disp = disp;
    if (this.source === "both") {
      this._mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(new MediaStream(da)).connect(dest);
      ctx.createMediaStreamSource(this._mic).connect(dest);
      this._mixCtx = ctx; this.capture = dest.stream;
    } else {
      this.capture = new MediaStream(da);
    }
  }
  _releaseCapture() {
    try { this._disp?.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    try { this._mic?.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    try { this._mixCtx?.close(); } catch { /* */ }
    this._disp = this._mic = this._mixCtx = this.capture = null;
  }

  async _keepAwake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        this.wake = await navigator.wakeLock.request("screen");
        this.dispatchEvent(new Event("change"));
      }
    } catch { this.wake = null; }
  }

  _onVisibility() {
    if (!this.rec || this.rec.status !== "recording") return;
    if (document.visibilityState === "hidden") {
      this._note("האפליקציה ירדה לרקע");
    } else {
      // חזרנו לאפליקציה: אם ההקלטה נעצרה בזמן שהיינו בחוץ, מודיעים כדי שאפשר יהיה להמשיך
      if (!this.running) this._interrupted("ההקלטה נעצרה כשיצאת מהאפליקציה");
      else this._keepAwake();
    }
  }

  // רישום אירוע בלי לעצור
  _note(what) {
    if (!this.rec) return;
    this.rec.interruptions.push({ at: new Date().toISOString(), what });
    store.saveRecording(this.rec);
  }

  // סוגר את המיקרופון ומד העוצמה של הקטע הנוכחי, אחרי שהחתיכה האחרונה נשמרה
  async _closeSegment() {
    clearInterval(this.watchdog); clearTimeout(this.rollTimer);
    if (this.segActive) { this.elapsedBefore = this.elapsedMs; this.segActive = false; }
    if (this.mr && this.mr.state !== "inactive") {
      const done = new Promise((r) => this.addEventListener("segmentstop", r, { once: true }));
      this.mr.stop();
      await done;
      await new Promise((r) => setTimeout(r, 400)); // לתת לחתיכה האחרונה להישמר
    }
    if (this.source === "mic") this.stream?.getTracks().forEach((t) => t.stop()); // קול המחשב משותף בין הקטעים – לא עוצרים כאן
    try { await this._ctx?.close(); } catch { /* */ }
    this._ctx = null; this.analyser = null; this.level = 0;
  }

  _interrupted(reason) {
    if (!this.rec || this.rec.status !== "recording") return;
    if (this.segActive) { this.elapsedBefore = this.elapsedMs; this.segActive = false; }
    clearInterval(this.watchdog);
    this.rec.durationMs = this.elapsedBefore;
    this.rec.status = "paused";
    this.rec.interruptions.push({ at: new Date().toISOString(), what: reason });
    store.saveRecording(this.rec);
    this._releaseCapture();
    this.dispatchEvent(new CustomEvent("interrupted", { detail: reason }));
    this.dispatchEvent(new Event("change"));
  }

  // ⭐ רגע חשוב: נשמר המקום המדויק בהקלטה (קטע + זמן בתוכו)
  mark() {
    if (!this.rec || !this.segActive) return null;
    const m = { seg: this.segment, t: Date.now() - this.segmentStart, at: this.elapsedMs };
    this.rec.marks = [...(this.rec.marks || []), m];
    store.saveRecording(this.rec);
    return m;
  }

  // מעבר שקט לקטע חדש באמצע הקלטה (לא נחשב קטיעה)
  async roll() {
    if (!this.running || this.rec?.status !== "recording") return;
    try { await this.resume(); this.dispatchEvent(new Event("change")); }
    catch { this._interrupted("לא הצלחתי להמשיך את ההקלטה אחרי 12 דקות – לחצו המשך"); }
  }

  async resume() {
    this.rec.status = "stopping"; // סגירת הקטע הקודם היא לא קטיעה
    await this._closeSegment();
    this.segment += 1;
    this.rec.status = "recording";
    try {
      if (this.source !== "mic" && !this.capture) await this._acquireCapture();
      await this._startSegment();
    } catch (e) {
      this.rec.status = "paused";
      throw e;
    }
    await store.saveRecording(this.rec);
  }

  async stop() {
    if (!this.rec) return null;
    document.removeEventListener("visibilitychange", this._onVisibility);
    this.rec.status = "stopping"; // כדי שהעצירה לא תיחשב כקטיעה
    await this._closeSegment();
    this._releaseCapture();
    try { await this.wake?.release(); } catch { /* */ }
    this.rec.status = "done";
    this.rec.endedAt = new Date().toISOString();
    this.rec.durationMs = this.elapsedBefore;
    await store.saveRecording(this.rec);
    const finished = this.rec;
    this.dispatchEvent(new Event("change"));
    return finished;
  }
}
