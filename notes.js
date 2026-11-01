// מנוע כתב היד: עמודי מחברת עם עט (רגיש ללחץ של Apple Pencil), מרקר, מחק ו"בטל".
// כל עמוד שומר קווים בקואורדינטות קבועות (1000×1400), כך שהם נראים אותו דבר בכל גודל מסך.
// בהשראת PencilKit: ברגע שמזוהה עט, האצבע גוללת ולא כותבת (אפשר לשנות).

export const PAGE_W = 1000, PAGE_H = 1400;
const LINE_GAP = 35; // מרווח בין שורות במחברת

export const TOOLS = {
  pen: { alpha: 1, width: 3, pressure: true },
  marker: { alpha: 0.45, width: 22, pressure: false },
  eraser: {},
};
export const COLORS = ["#0F172A", "#2563EB", "#DC2626", "#16A34A"];
export const MARKER_COLORS = ["#FDE047", "#86EFAC", "#F9A8D4", "#93C5FD"];

export const newPage = (bg = "lines") => ({ id: "p" + Date.now() + Math.random().toString(36).slice(2, 6), bg, strokes: [], image: null });

// ---------- ציור קו ----------
// נקודות שמורות כרצף שטוח: x, y, לחץ, x, y, לחץ...
function drawStroke(ctx, st) {
  const pts = st.points;
  if (pts.length < 3) return;
  ctx.save();
  ctx.globalAlpha = st.alpha;
  ctx.strokeStyle = st.color; ctx.fillStyle = st.color;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (!st.pressure) {
    // מרקר / עט בלי לחץ: מסלול אחד חלק
    ctx.lineWidth = st.width;
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 3; i < pts.length - 3; i += 3) {
      ctx.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 3]) / 2, (pts[i + 1] + pts[i + 4]) / 2);
    }
    ctx.lineTo(pts[pts.length - 3], pts[pts.length - 2]);
    if (pts.length === 3) ctx.lineTo(pts[0] + 0.1, pts[1]);
    ctx.stroke();
  } else {
    // עט עם לחץ: כל קטע בעובי משלו
    if (pts.length === 3) { ctx.beginPath(); ctx.arc(pts[0], pts[1], st.width * (0.4 + pts[2]) / 2, 0, Math.PI * 2); ctx.fill(); }
    let px = pts[0], py = pts[1];
    for (let i = 3; i < pts.length; i += 3) {
      const mx = (pts[i - 3] + pts[i]) / 2, my = (pts[i - 2] + pts[i + 1]) / 2;
      ctx.lineWidth = st.width * (0.4 + pts[i + 2]);
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.quadraticCurveTo(pts[i - 3], pts[i - 2], mx, my);
      ctx.stroke();
      px = mx; py = my;
    }
    ctx.lineWidth = st.width * (0.4 + pts[pts.length - 1]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(pts[pts.length - 3], pts[pts.length - 2]); ctx.stroke();
  }
  ctx.restore();
}

// רקע העמוד (שורות / משבצות / חלק) – לייצוא לתמונה
function drawPaper(ctx, bg) {
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  if (bg === "blank") return;
  ctx.strokeStyle = "#D5DEF2"; ctx.lineWidth = 1.5;
  for (let y = LINE_GAP * 2; y < PAGE_H; y += LINE_GAP) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); ctx.stroke(); }
  if (bg === "grid") for (let x = LINE_GAP; x < PAGE_W; x += LINE_GAP) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PAGE_H); ctx.stroke(); }
}

const loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

// ---------- העורך: כל העמודים של שיעור אחד ----------
export class InkEditor extends EventTarget {
  constructor(host, pages) {
    super();
    this.host = host;
    this.pages = pages.length ? pages : [newPage()];
    this.tool = "pen"; this.color = COLORS[0]; this.markerColor = MARKER_COLORS[0]; this.size = 1;
    this.undoStack = []; this.redoStack = [];
    try { this.penOnly = localStorage.getItem("sikumon-pen-only") === "1"; } catch { this.penOnly = false; }
    this.views = [];
    this._ro = new ResizeObserver(() => this.layout());
    this.render();
  }

  // בונה את העמודים על המסך
  render() {
    this.host.innerHTML = "";
    this.views = this.pages.map((page, i) => this._makeView(page, i));
    this._ro.disconnect();
    this.views.forEach((v) => this._ro.observe(v.sheet));
    this.layout();
  }

  _makeView(page, i) {
    const sheet = document.createElement("div");
    sheet.className = "sheet bg-" + page.bg;
    sheet.innerHTML = `${page.image ? `<img alt="תמונה בעמוד ${i + 1}" src="${page.image}">` : ""}<canvas class="base"></canvas><canvas class="live"></canvas><span class="pno">${i + 1}</span>`;
    this.host.appendChild(sheet);
    const v = { page, sheet, base: sheet.querySelector(".base"), live: sheet.querySelector(".live"), scale: 1 };
    this._bindPointer(v);
    return v;
  }

  layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const v of this.views) {
      const w = v.sheet.clientWidth; if (!w) continue;
      const h = w * PAGE_H / PAGE_W;
      for (const c of [v.base, v.live]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      v.scale = (w * dpr) / PAGE_W;
      this._redraw(v);
    }
  }

  _redraw(v) {
    const ctx = v.base.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, v.base.width, v.base.height);
    ctx.setTransform(v.scale, 0, 0, v.scale, 0, 0);
    for (const st of v.page.strokes) drawStroke(ctx, st);
  }

  // ---------- קלט: עט, אצבע ועכבר ----------
  _bindPointer(v) {
    const c = v.live;
    let cur = null, scroll = null, raf = 0;
    const toPage = (e) => {
      const r = c.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * PAGE_W, ((e.clientY - r.top) / r.height) * PAGE_H];
    };
    const pressureOf = (e) => (e.pointerType === "pen" ? Math.max(0.05, e.pressure || 0.5) : 0.5);
    const paintLive = () => {
      raf = 0;
      const ctx = c.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      if (cur) { ctx.setTransform(v.scale, 0, 0, v.scale, 0, 0); drawStroke(ctx, cur); }
    };

    c.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "pen" && !this.penOnly) { this.setPenOnly(true); }
      // מצב "רק עט": האצבע גוללת את הדף ולא כותבת (כמו ב-Notability)
      if (e.pointerType === "touch" && this.penOnly) { scroll = { y: e.clientY, top: window.scrollY, id: e.pointerId }; return; }
      if (e.button > 0) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const [x, y] = toPage(e);
      if (this.tool === "eraser") { cur = { erasing: true, removed: [] }; this._eraseAt(v, x, y, cur); return; }
      const t = TOOLS[this.tool];
      cur = {
        tool: this.tool, color: this.tool === "marker" ? this.markerColor : this.color, alpha: t.alpha,
        width: t.width * [0.6, 1, 1.8][this.size], pressure: t.pressure && e.pointerType === "pen",
        points: [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pressureOf(e) * 100) / 100],
      };
      if (!raf) raf = requestAnimationFrame(paintLive);
    });

    c.addEventListener("pointermove", (e) => {
      if (scroll && e.pointerId === scroll.id) { window.scrollTo(0, scroll.top - (e.clientY - scroll.y)); return; }
      if (!cur) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const [x, y] = toPage(ev);
        if (cur.erasing) { this._eraseAt(v, x, y, cur); continue; }
        const n = cur.points.length;
        if (Math.hypot(x - cur.points[n - 3], y - cur.points[n - 2]) < 1.2) continue; // מסננים רעידות
        cur.points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pressureOf(ev) * 100) / 100);
      }
      if (!cur.erasing && !raf) raf = requestAnimationFrame(paintLive);
    });

    const end = (e) => {
      if (scroll && e.pointerId === scroll.id) { scroll = null; return; }
      if (!cur) return;
      if (cur.erasing) {
        if (cur.removed.length) this._push({ type: "erase", page: v.page.id, removed: cur.removed });
      } else {
        v.page.strokes.push(cur);
        drawStroke(v.base.getContext("2d"), cur);
        this._push({ type: "add", page: v.page.id, stroke: cur });
      }
      cur = null;
      paintLive();
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  }

  // מחק "וקטורי": מוחק קו שלם שנוגעים בו
  _eraseAt(v, x, y, cur) {
    const r = 14 * (this.size + 1);
    const strokes = v.page.strokes;
    let hit = false;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const p = strokes[i].points, w = strokes[i].width / 2 + r;
      for (let k = 0; k < p.length; k += 3) {
        if (Math.abs(p[k] - x) < w && Math.abs(p[k + 1] - y) < w && Math.hypot(p[k] - x, p[k + 1] - y) < w) {
          cur.removed.push({ i, stroke: strokes[i] });
          strokes.splice(i, 1); hit = true; break;
        }
      }
    }
    if (hit) this._redraw(v);
  }

  // ---------- בטל / בצע שוב ----------
  _push(action) { this.undoStack.push(action); this.redoStack = []; this._changed(); }
  _view(pageId) { return this.views.find((v) => v.page.id === pageId); }
  undo() {
    const a = this.undoStack.pop(); if (!a) return;
    this._apply(a, true); this.redoStack.push(a); this._changed();
  }
  redo() {
    const a = this.redoStack.pop(); if (!a) return;
    this._apply(a, false); this.undoStack.push(a); this._changed();
  }
  _apply(a, reverse) {
    if (a.type === "addpage") {
      if (reverse) this.pages = this.pages.filter((p) => p.id !== a.pageObj.id);
      else this.pages.splice(a.index, 0, a.pageObj);
      this.render(); return;
    }
    const v = this._view(a.page); if (!v) return;
    const s = v.page.strokes;
    if (a.type === "add") { if (reverse) s.splice(s.lastIndexOf(a.stroke), 1); else s.push(a.stroke); }
    if (a.type === "erase") {
      if (reverse) [...a.removed].reverse().forEach(({ i, stroke }) => s.splice(i, 0, stroke));
      else a.removed.forEach(({ stroke }) => s.splice(s.indexOf(stroke), 1));
    }
    this._redraw(v);
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  _changed() { this.dispatchEvent(new Event("change")); }

  setPenOnly(on) {
    this.penOnly = on;
    try { localStorage.setItem("sikumon-pen-only", on ? "1" : "0"); } catch { /* */ }
    this.dispatchEvent(new Event("penonly"));
  }

  // ---------- עמודים ----------
  addPage(bg, image = null) {
    const p = newPage(bg); p.image = image;
    const index = this.pages.length;
    this.pages.push(p);
    this.render();
    this._push({ type: "addpage", pageObj: p, index });
    return this.views[index].sheet;
  }

  // תמונה (צילום לוח / שקף) נכנסת כעמוד חדש שאפשר לכתוב עליו; מוקטנת כדי לא למלא את המכשיר
  async addImagePage(file) {
    const url = URL.createObjectURL(file);
    try {
      const im = await loadImage(url);
      const max = 1600, k = Math.min(1, max / Math.max(im.width, im.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      return this.addPage("blank", cv.toDataURL("image/jpeg", 0.82));
    } finally { URL.revokeObjectURL(url); }
  }

  // ייצוא עמוד לתמונה (לשיתוף)
  async pageToBlob(page) {
    const cv = document.createElement("canvas");
    cv.width = PAGE_W * 1.5; cv.height = PAGE_H * 1.5;
    const ctx = cv.getContext("2d");
    ctx.scale(1.5, 1.5);
    drawPaper(ctx, page.bg);
    if (page.image) {
      const im = await loadImage(page.image);
      const k = Math.min(PAGE_W / im.width, PAGE_H / im.height);
      ctx.drawImage(im, (PAGE_W - im.width * k) / 2, 0, im.width * k, im.height * k);
    }
    for (const st of page.strokes) drawStroke(ctx, st);
    return new Promise((r) => cv.toBlob(r, "image/png"));
  }

  isEmpty() { return this.pages.every((p) => !p.strokes.length && !p.image); }
  destroy() { this._ro.disconnect(); }
}
