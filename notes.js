// מנוע כתב היד: עמודי מחברת עם עט (רגיש ללחץ של Apple Pencil), מרקר, מחק ו"בטל".
// כל עמוד שומר קווים בקואורדינטות קבועות (1000×1400), כך שהם נראים אותו דבר בכל גודל מסך.
// בהשראת PencilKit: ברגע שמזוהה עט, האצבע גוללת ולא כותבת (אפשר לשנות).

export const PAGE_W = 1000, PAGE_H = 1400;
const LINE_GAP = 35; // מרווח בין שורות במחברת

export const TOOLS = {
  pen: { alpha: 1, width: 3, pressure: true },
  marker: { alpha: 0.45, width: 22, pressure: false },
  eraser: {},
  line: { alpha: 1, width: 3, shape: true },
  rect: { alpha: 1, width: 3, shape: true },
  ellipse: { alpha: 1, width: 3, shape: true },
  arrow: { alpha: 1, width: 3, shape: true },
  lasso: {},
};

// צורה מוכנה: נקודות צפופות לאורך קווים ישרים (ככה גם המחק "תופס" אותה בכל מקום)
function dense(path, step = 8) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i], [x1, y1] = path[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 0.5);
  }
  const [lx, ly] = path[path.length - 1];
  out.push(lx, ly, 0.5);
  return out;
}
function makeShape(c) {
  const { x0, y0, x1, y1 } = c;
  let path;
  if (c.shape === "line") path = [[x0, y0], [x1, y1]];
  else if (c.shape === "rect") path = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  else if (c.shape === "ellipse") {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    path = Array.from({ length: 49 }, (_, k) => [cx + rx * Math.cos((k / 48) * 2 * Math.PI), cy + ry * Math.sin((k / 48) * 2 * Math.PI)]);
  } else {
    const a = Math.atan2(y1 - y0, x1 - x0), h = 22 + c.width * 2;
    const h1 = [x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45)], h2 = [x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45)];
    path = [[x0, y0], [x1, y1], h1, [x1, y1], h2];
  }
  return { tool: c.shape, color: c.color, alpha: 1, width: c.width, pressure: false, poly: true, points: dense(path) };
}
const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
function bbox(strokes) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const st of strokes) for (let k = 0; k < st.points.length; k += 3) { a = Math.min(a, st.points[k]); b = Math.min(b, st.points[k + 1]); c = Math.max(c, st.points[k]); d = Math.max(d, st.points[k + 1]); }
  return { x: a - 12, y: b - 12, w: c - a + 24, h: d - b + 24 };
}
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
  if (st.poly) {
    ctx.lineWidth = st.width;
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 3; i < pts.length; i += 3) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke(); ctx.restore(); return;
  }
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
      ctx.setTransform(v.scale, 0, 0, v.scale, 0, 0);
      if (cur?.shape) drawStroke(ctx, makeShape(cur));
      else if (cur?.lasso) { ctx.setLineDash([10, 8]); ctx.strokeStyle = "#2563EB"; ctx.lineWidth = 2.5; ctx.beginPath(); cur.pts.forEach((q, k) => (k % 2 ? 0 : k ? ctx.lineTo(q, cur.pts[k + 1]) : ctx.moveTo(q, cur.pts[1]))); ctx.stroke(); ctx.setLineDash([]); }
      else if (cur && !cur.erasing && !cur.moving) drawStroke(ctx, cur);
      if (this.sel?.v === v && this.sel.strokes.length) {
        const b = bbox(this.sel.strokes); this.sel.box = b;
        ctx.setLineDash([8, 6]); ctx.strokeStyle = "#2563EB"; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
      }
    };
    v.paintLive = paintLive;

    c.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "pen" && !this.penOnly) { this.setPenOnly(true); }
      // מצב "רק עט": האצבע גוללת את הדף ולא כותבת (כמו ב-Notability)
      if (e.pointerType === "touch" && this.penOnly) { scroll = { y: e.clientY, top: window.scrollY, id: e.pointerId }; return; }
      if (e.button > 0) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const [x, y] = toPage(e);
      if (this.tool === "eraser") { cur = { erasing: true, removed: [] }; this._eraseAt(v, x, y, cur); return; }
      if (this.tool === "lasso") {
        const b = this.sel?.v === v && this.sel.box;
        // לחיצה בתוך הבחירה = גרירה; בחוץ = לאסו חדש
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) cur = { moving: true, lx: x, ly: y, dx: 0, dy: 0 };
        else { this.clearSelection(); cur = { lasso: true, pts: [x, y] }; }
        if (!raf) raf = requestAnimationFrame(paintLive);
        return;
      }
      const t = TOOLS[this.tool];
      if (t.shape) { cur = { shape: this.tool, x0: x, y0: y, x1: x, y1: y, color: this.color, width: t.width * [0.6, 1, 1.8][this.size] }; if (!raf) raf = requestAnimationFrame(paintLive); return; }
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
        if (cur.shape) { cur.x1 = x; cur.y1 = y; continue; }
        if (cur.lasso) { cur.pts.push(x, y); continue; }
        if (cur.moving) {
          const dx = x - cur.lx, dy = y - cur.ly; cur.lx = x; cur.ly = y; cur.dx += dx; cur.dy += dy;
          this._translate(this.sel.strokes, dx, dy); this._redraw(v); continue;
        }
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
      } else if (cur.lasso) {
        const strokes = v.page.strokes.filter((st) => { for (let k = 0; k < st.points.length; k += 3) if (inPoly(st.points[k], st.points[k + 1], cur.pts)) return true; return false; });
        this.sel = strokes.length ? { v, strokes } : null;
        this.dispatchEvent(new Event("selection"));
      } else if (cur.moving) {
        if (cur.dx || cur.dy) this._push({ type: "move", page: v.page.id, strokes: [...this.sel.strokes], dx: cur.dx, dy: cur.dy });
      } else if (cur.shape) {
        const st = makeShape(cur);
        if (Math.hypot(cur.x1 - cur.x0, cur.y1 - cur.y0) > 6) { v.page.strokes.push(st); drawStroke(v.base.getContext("2d"), st); this._push({ type: "add", page: v.page.id, stroke: st }); }
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

  _translate(strokes, dx, dy) { for (const st of strokes) for (let k = 0; k < st.points.length; k += 3) { st.points[k] += dx; st.points[k + 1] += dy; } }
  clearSelection() { const v = this.sel?.v; this.sel = null; v?.paintLive?.(); this.dispatchEvent(new Event("selection")); }
  deleteSelection() {
    if (!this.sel) return;
    const { v, strokes } = this.sel;
    const removed = strokes.map((st) => ({ i: v.page.strokes.indexOf(st), stroke: st })).sort((a, b) => b.i - a.i);
    removed.forEach(({ i }) => v.page.strokes.splice(i, 1));
    this._push({ type: "erase", page: v.page.id, removed });
    this.clearSelection(); this._redraw(v);
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
    if (a.type === "move") this._translate(a.strokes, reverse ? -a.dx : a.dx, reverse ? -a.dy : a.dy);
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

// ---------- ייבוא PDF (למשל מ-Notability) ----------
// pdf.js נטען רק כשצריך. עמוד ארוך (Notability גולל ברצף) נחתך לעמודי מחברת.
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    sc.onload = res; sc.onerror = () => rej(new Error("צריך אינטרנט כדי לפתוח PDF"));
    document.head.appendChild(sc);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}
export async function pdfToPages(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let k = 1; k <= doc.numPages; k++) {
    const pg = await doc.getPage(k);
    const vp = pg.getViewport({ scale: 1200 / pg.getViewport({ scale: 1 }).width });
    const sliceH = Math.round(vp.width * PAGE_H / PAGE_W);
    // מציירים פרוסה אחרי פרוסה, כדי לא לחרוג מגודל הקנבס המותר באייפד
    for (let y = 0; y < vp.height; y += sliceH) {
      const h = Math.min(sliceH, Math.ceil(vp.height - y));
      if (h < 60) break;
      const cv = document.createElement("canvas");
      cv.width = Math.round(vp.width); cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, 0, -y] }).promise;
      pages.push({ ...newPage("blank"), image: cv.toDataURL("image/jpeg", 0.8) });
    }
  }
  if (!pages.length) throw new Error("ה-PDF ריק");
  return pages;
}

// תמונה קטנה של העמוד הראשון – לכרטיס במסך המחברות
export async function makeThumb(page) {
  if (!page) return null;
  const W = 240, H = Math.round(240 * PAGE_H / PAGE_W);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.scale(W / PAGE_W, H / PAGE_H);
  drawPaper(ctx, page.bg);
  if (page.image) {
    const im = await loadImage(page.image);
    const k = Math.min(PAGE_W / im.width, PAGE_H / im.height);
    ctx.drawImage(im, (PAGE_W - im.width * k) / 2, 0, im.width * k, im.height * k);
  }
  for (const st of page.strokes) drawStroke(ctx, st);
  return cv.toDataURL("image/jpeg", 0.72);
}
