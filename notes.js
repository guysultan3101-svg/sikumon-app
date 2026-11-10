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
  pick: {},   // בחירת תמונה
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

export const newPage = (bg = "lines") => ({ id: "p" + Date.now() + Math.random().toString(36).slice(2, 6), bg, strokes: [], image: null, images: [] });

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
// איפה התמונה יושבת בעמוד: x, y, w כחלק מרוחב/גובה העמוד (הגובה לפי יחס התמונה)
export const imgBoxOf = (page) => page.imgBox || { x: 0, y: 0, w: 1 };
function drawPageImage(ctx, page, im) {
  const b = imgBoxOf(page);
  const w = PAGE_W * b.w, h = w * im.height / im.width;
  ctx.drawImage(im, PAGE_W * b.x, PAGE_H * b.y, w, h);
}

// ---------- תמונות כאובייקטים (כמו ב-Notability) ----------
// כל תמונה בעמוד: {id, src, nw, nh, cx, cy, w, rot, crop:{x,y,w,h}, locked}
// cx,cy = מרכז בקואורדינטות העמוד, w = רוחב ביחידות עמוד, rot = סיבוב ברדיאנים, crop = חלק מהתמונה המקורית (0..1)
const MIN_W = 60;
const arOf = (o) => (o.crop.w * o.nw) / (o.crop.h * o.nh);   // יחס רוחב/גובה של החלק הנראה
const hOf = (o) => o.w / arOf(o);
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
let _idn = 0;
const newId = () => "i" + Date.now().toString(36) + (++_idn);
const snap = (o) => JSON.parse(JSON.stringify(o));
async function drawObjs(ctx, page) {
  for (const o of page.images || []) {
    const im = await loadImage(o.src), W = o.w, H = hOf(o);
    ctx.save(); ctx.translate(o.cx, o.cy); ctx.rotate(o.rot);
    ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.clip();
    ctx.drawImage(im, o.crop.x * o.nw, o.crop.y * o.nh, o.crop.w * o.nw, o.crop.h * o.nh, -W / 2, -H / 2, W, H);
    ctx.restore();
  }
}

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
    this.isel = null; this._penAt = 0; this._touches = new Map(); this._pinch = null; this._migrating = new WeakSet();
    this.zoom = 1;
    this._ro = new ResizeObserver(() => this.layout());
    this.render();
  }

  // בונה את העמודים על המסך
  render() {
    this.isel = null;
    this.host.innerHTML = "";
    for (const p of this.pages) p.images ||= [];
    this.views = this.pages.map((page, i) => this._makeView(page, i));
    this._ro.disconnect();
    this.views.forEach((v) => this._ro.observe(v.sheet));
    this.layout();
    this._migrate();
  }

  _makeView(page, i) {
    const sheet = document.createElement("div");
    sheet.className = "sheet bg-" + page.bg;
    sheet.innerHTML = `<canvas class="base"></canvas><canvas class="live"></canvas><span class="pno">${i + 1}</span>`;
    this.host.appendChild(sheet);
    const v = { page, sheet, base: sheet.querySelector(".base"), live: sheet.querySelector(".live"), scale: 1 };
    this._renderImgs(v);
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
    if (this.isel) this._posSel();
  }

  // ---------- תמונות: ציור, בחירה, גרירה, שינוי גודל, סיבוב וחיתוך ----------
  // תמונה ישנה (שדה image בעמוד, שקף מ-PDF) הופכת לאובייקט. שקפים ננעלים כדי שלא יזוזו בטעות
  async _migrate() {
    for (const p of this.pages) {
      if (!p.image || this._migrating.has(p)) continue;
      this._migrating.add(p);
      try {
        const im = await loadImage(p.image), b = p.imgBox;
        const w = b ? b.w * PAGE_W : PAGE_W, h = (w * im.height) / im.width;
        p.images ||= [];
        p.images.push({ id: newId(), src: p.image, nw: im.width, nh: im.height, cx: (b ? b.x * PAGE_W : 0) + w / 2, cy: (b ? b.y * PAGE_H : 0) + h / 2, w, rot: 0, crop: { x: 0, y: 0, w: 1, h: 1 }, locked: !b });
        p.image = null; p.imgBox = null;
        const v = this.views.find((x) => x.page === p); if (v) this._renderImgs(v);
        this.dispatchEvent(new Event("change"));
      } catch { /* תמונה פגומה: משאירים כמו שהיא */ }
    }
  }
  _obj(v, id) { return v.page.images.find((o) => o.id === id); }
  _renderImgs(v) {
    v.sheet.querySelectorAll(".pimg").forEach((e) => e.remove());
    const before = v.base;
    for (const o of v.page.images) {
      const el = document.createElement("div"); el.className = "pimg"; el.dataset.id = o.id;
      const im = document.createElement("img"); im.alt = "תמונה בעמוד"; im.draggable = false; im.src = o.src; el.appendChild(im);
      v.sheet.insertBefore(el, before); this._placeImg(el, o);
    }
  }
  _placeImg(el, o) {
    const c = o.crop;
    el.style.left = ((o.cx - o.w / 2) / PAGE_W) * 100 + "%"; el.style.top = ((o.cy - hOf(o) / 2) / PAGE_H) * 100 + "%";
    el.style.width = (o.w / PAGE_W) * 100 + "%"; el.style.aspectRatio = String(arOf(o)); el.style.transform = `rotate(${o.rot}rad)`;
    const im = el.firstChild; im.style.width = 100 / c.w + "%"; im.style.left = (-c.x / c.w) * 100 + "%"; im.style.top = (-c.y / c.h) * 100 + "%";
  }
  _hit(v, x, y) {
    const list = v.page.images;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i], [lx, ly] = rot2(x - o.cx, y - o.cy, -o.rot);
      if (Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= hOf(o) / 2) return o;
    }
    return null;
  }
  _tapAt(v, x, y) { const o = this._hit(v, x, y); if (o) this._select(v, o.id); else this._deselect(); }

  _select(v, id, mode = "move") {
    if (this.isel && (this.isel.v !== v || this.isel.id !== id)) this._deselect(true);
    this.isel = { v, id, mode };
    this._buildSel();
    this.dispatchEvent(new Event("selection"));
  }
  _deselect(silent) {
    if (!this.isel) return;
    const { v } = this.isel; this.isel = null;
    v.sheet.querySelectorAll(".imgsel,.immenu").forEach((e) => e.remove());
    if (!silent) this.dispatchEvent(new Event("selection"));
  }
  _buildSel() {
    const { v, id, mode } = this.isel, o = this._obj(v, id);
    v.sheet.querySelectorAll(".imgsel,.immenu").forEach((e) => e.remove());
    if (!o) { this.isel = null; return; }
    const w = document.createElement("div");
    w.className = "imgsel" + (o.locked ? " locked" : "") + (mode === "crop" ? " cropping" : "");
    let html = mode === "crop" ? `<img class="ghost" alt="" draggable="false" src="${o.src}">` : "";
    if (!o.locked) {
      const hs = mode === "crop" ? ["tl", "tr", "bl", "br", "t", "b", "l", "r"] : ["tl", "tr", "bl", "br"];
      html += hs.map((h) => `<i class="hd hd-${h}" data-h="${h}"></i>`).join("");
      if (mode !== "crop") html += `<i class="hd hd-rot" data-h="rot"></i>`;
    }
    w.innerHTML = html;
    v.sheet.appendChild(w);
    const m = document.createElement("div"); m.className = "immenu";
    m.innerHTML = o.locked
      ? `<button type="button" data-act="lock">🔓 שחרור</button><button type="button" data-act="del">🗑️ מחיקה</button>`
      : mode === "crop"
        ? `<button type="button" data-act="crop">✓ סיום חיתוך</button><button type="button" data-act="reset">↺ איפוס</button>`
        : `<button type="button" data-act="crop">✂️ חיתוך</button><button type="button" data-act="rot90">⟳</button><button type="button" data-act="dup">⧉ שכפול</button><button type="button" data-act="lock">🔒 נעילה</button><button type="button" data-act="del">🗑️</button>`;
    v.sheet.appendChild(m);
    m.addEventListener("pointerdown", (e) => e.stopPropagation());
    m.addEventListener("click", (e) => { const a = e.target.closest("[data-act]")?.dataset.act; if (a) this._menuAct(a); });
    if (!o.locked) this._bindSel(w, v, id);
    this._posSel();
  }
  _posSel() {
    const { v, id, mode } = this.isel, o = this._obj(v, id); if (!o) return;
    const w = v.sheet.querySelector(".imgsel"), m = v.sheet.querySelector(".immenu"); if (!w || !m) return;
    const s = v.sheet.clientWidth / PAGE_W, W = o.w * s, H = hOf(o) * s;
    w.style.cssText = `left:${o.cx * s - W / 2}px;top:${o.cy * s - H / 2}px;width:${W}px;height:${H}px;transform:rotate(${o.rot}rad)`;
    if (mode === "crop") {
      const fw = (o.w / o.crop.w) * s, fh = fw * (o.nh / o.nw), g = w.querySelector(".ghost");
      g.style.cssText = `width:${fw}px;height:${fh}px;left:${-o.crop.x * fw}px;top:${-o.crop.y * fh}px`;
    }
    const c = Math.abs(Math.cos(o.rot)), sn = Math.abs(Math.sin(o.rot)), ey = (sn * W + c * H) / 2;
    let top = o.cy * s - ey - 58; if (top < 4) top = o.cy * s + ey + 14;
    const half = (m.offsetWidth || 260) / 2, sw = v.sheet.clientWidth;
    m.style.top = Math.min(top, v.sheet.clientHeight - 50) + "px";
    m.style.left = Math.max(half + 4, Math.min(sw - half - 4, o.cx * s)) + "px";
  }
  _refreshImg(v, o) { const el = v.sheet.querySelector(`.pimg[data-id="${o.id}"]`); if (el) this._placeImg(el, o); if (this.isel) this._posSel(); }
  // שינוי של תמונה נשמר כפעולה אחת שאפשר לבטל
  _commit(v, before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this._push({ type: "img", page: v.page.id, id: after.id, before, after: snap(after) });
  }
  _imgSet(v, id, sn) {
    const arr = v.page.images, i = arr.findIndex((o) => o.id === id);
    if (!sn) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = snap(sn); else arr.push(snap(sn));
    this._renderImgs(v);
    if (this.isel?.id === id) { if (!sn) this._deselect(); else this._buildSel(); }
  }
  _menuAct(a) {
    const { v, id } = this.isel, o = this._obj(v, id); if (!o) return;
    const before = snap(o);
    if (a === "crop") { this.isel.mode = this.isel.mode === "crop" ? "move" : "crop"; this._buildSel(); return; }
    if (a === "reset") {
      // חזרה לתמונה המלאה: החלק הנראה נשאר במקומו והתמונה נפתחת סביבו
      const c = o.crop, fw = o.w / c.w, fh = fw * (o.nh / o.nw), H = hOf(o);
      const [sx, sy] = rot2(fw / 2 - c.x * fw - o.w / 2, fh / 2 - c.y * fh - H / 2, o.rot);
      o.cx += sx; o.cy += sy; o.w = fw; o.crop = { x: 0, y: 0, w: 1, h: 1 };
      this._refreshImg(v, o); this._commit(v, before, o); this._buildSel(); return; }
    if (a === "rot90") { o.rot += Math.PI / 2; this._refreshImg(v, o); this._commit(v, before, o); return; }
    if (a === "lock") { o.locked = !o.locked; this.isel.mode = "move"; this._commit(v, before, o); this._buildSel(); return; }
    if (a === "dup") {
      const d = snap(o); d.id = newId(); d.cx += 40; d.cy += 40; d.locked = false;
      v.page.images.push(d); this._renderImgs(v);
      this._push({ type: "img", page: v.page.id, id: d.id, before: null, after: snap(d) });
      this._select(v, d.id); return;
    }
    if (a === "del") { this._imgSet(v, id, null); this._push({ type: "img", page: v.page.id, id, before, after: null }); }
  }
  _bindSel(w, v, id) {
    let g = null;
    const pt = (e) => { const r = v.sheet.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * PAGE_W, ((e.clientY - r.top) / r.height) * PAGE_H]; };
    w.addEventListener("pointerdown", (e) => {
      const o = this._obj(v, id); if (!o) return;
      e.preventDefault(); e.stopPropagation();
      try { w.setPointerCapture(e.pointerId); } catch { /* */ }
      g = { h: e.target.dataset?.h || "move", before: snap(o), last: pt(e), id: e.pointerId };
    });
    w.addEventListener("pointermove", (e) => {
      if (!g || e.pointerId !== g.id) return;
      const o = this._obj(v, id); if (!o) return;
      const [px, py] = pt(e), dx = px - g.last[0], dy = py - g.last[1]; g.last = [px, py];
      const h = g.h;
      if (h === "move") { o.cx += dx; o.cy += dy; }
      else if (h === "rot") {
        let a = Math.atan2(py - o.cy, px - o.cx) + Math.PI / 2;
        for (const q of [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI, 1.5 * Math.PI, 2 * Math.PI]) if (Math.abs(a - q) < 0.07) a = q; // נצמד לזוויות ישרות
        o.rot = a;
      } else if (this.isel.mode === "crop") {
        const [ldx, ldy] = rot2(dx, dy, -o.rot), c = o.crop, fw = o.w / c.w, fh = fw * (o.nh / o.nw), H = c.h * fh, MN = 40;
        let shx = 0, shy = 0;
        if (h.includes("l")) { const d = Math.max(-c.x * fw, Math.min(o.w - MN, ldx)); c.x += d / fw; c.w -= d / fw; o.w -= d; shx += d / 2; }
        if (h.includes("r")) { const d = Math.max(MN - o.w, Math.min((1 - c.x - c.w) * fw, ldx)); c.w += d / fw; o.w += d; shx += d / 2; }
        if (h.includes("t")) { const d = Math.max(-c.y * fh, Math.min(H - MN, ldy)); c.y += d / fh; c.h -= d / fh; shy += d / 2; }
        if (h.includes("b")) { const d = Math.max(MN - H, Math.min((1 - c.y - c.h) * fh, ldy)); c.h += d / fh; shy += d / 2; }
        const [wx, wy] = rot2(shx, shy, o.rot); o.cx += wx; o.cy += wy;
      } else {
        // שינוי גודל מהפינה: הפינה שממול נשארת במקום והיחס נשמר
        const ar = arOf(o), sx = h.includes("r") ? 1 : -1, sy = h.includes("b") ? 1 : -1, W = o.w, H = W / ar;
        const [ax, ay] = rot2(-sx * W / 2, -sy * H / 2, o.rot), A = [o.cx + ax, o.cy + ay];
        const [lx, ly] = rot2(px - A[0], py - A[1], -o.rot);
        const nW = Math.max(MIN_W, Math.min(3000, (lx * sx + ly * sy * ar) / 2)), nH = nW / ar;
        const [cx2, cy2] = rot2(sx * nW / 2, sy * nH / 2, o.rot);
        o.w = nW; o.cx = A[0] + cx2; o.cy = A[1] + cy2;
      }
      o.cx = Math.min(PAGE_W, Math.max(0, o.cx)); o.cy = Math.min(PAGE_H, Math.max(0, o.cy)); // מרכז התמונה תמיד נשאר בתוך הדף
      this._refreshImg(v, o);
    });
    const end = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const o = this._obj(v, id), before = g.before; g = null;
      if (o) this._commit(v, before, o);
    };
    w.addEventListener("pointerup", end); w.addEventListener("pointercancel", end);
  }

  // הוספת תמונה לעמוד שמול העיניים: נבחרת מיד, ואפשר לגרור, להגדיל, לסובב ולחתוך
  async addImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const im = await loadImage(url);
      const k = Math.min(1, 1600 / Math.max(im.width, im.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
      const v = this.views[this.currentIndex()] || this.views[0];
      const r = v.sheet.getBoundingClientRect();
      let w = Math.min(640, PAGE_W * 0.7); const asp = cv.width / cv.height;
      if (w / asp > PAGE_H * 0.7) w = PAGE_H * 0.7 * asp;
      const vy = Math.min(0.8, Math.max(0.2, (innerHeight / 2 - r.top) / r.height)) * PAGE_H;
      const o = { id: newId(), src: cv.toDataURL("image/jpeg", 0.82), nw: cv.width, nh: cv.height, cx: PAGE_W / 2, cy: Math.max(w / asp / 2, Math.min(PAGE_H - w / asp / 2, vy)), w, rot: 0, crop: { x: 0, y: 0, w: 1, h: 1 }, locked: false };
      v.page.images.push(o); this._renderImgs(v);
      this._push({ type: "img", page: v.page.id, id: o.id, before: null, after: snap(o) });
      this._select(v, o.id);
      return v.sheet;
    } finally { URL.revokeObjectURL(url); }
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

    const pinchMid = () => { const [a, b] = [...this._touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), my: (a.y + b.y) / 2 }; };
    let momentum = 0;
    c.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "pen") this._penAt = performance.now();
      if (e.pointerType === "pen" && !this.penOnly) { this.setPenOnly(true); }
      cancelAnimationFrame(momentum);
      // מצב "רק עט": האצבע גוללת את הדף ולא כותבת (כמו ב-Notability). שתי אצבעות = הגדלה והקטנה
      if (e.pointerType === "touch" && this.penOnly) {
        if (cur || performance.now() - this._penAt < 700) return; // כף יד על המסך בזמן כתיבה: מתעלמים
        try { c.setPointerCapture(e.pointerId); } catch { /* */ }
        this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._touches.size === 2) { scroll = null; this._pinch = { ...pinchMid(), z: this.zoom || 1, top: this.host.getBoundingClientRect().top + window.scrollY }; return; }
        if (this._touches.size > 2) return;
        scroll = { y: e.clientY, top: window.scrollY, id: e.pointerId, t: performance.now(), moved: false, vy: 0, ly: e.clientY, lt: performance.now() };
        return;
      }
      if (e.button > 0) return;
      e.preventDefault();
      if (this.isel) this._deselect();
      try { c.setPointerCapture(e.pointerId); } catch { /* */ }
      const [x, y] = toPage(e);
      if (this.tool === "pick") { const o = this._hit(v, x, y); if (o) this._select(v, o.id); return; }
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
      if (e.pointerType === "pen") this._penAt = performance.now(); // גם כשהעט רק מרחף: כף היד לא תגלול
      if (e.pointerType === "touch" && this._touches.has(e.pointerId)) {
        this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._pinch && this._touches.size === 2) {
          const { d, my } = pinchMid(), p = this._pinch;
          if (!p.busy) {
            p.busy = true;
            requestAnimationFrame(() => {
              p.busy = false;
              const old = this.host.getBoundingClientRect().width, z = this.setZoom(p.z * (d / p.d)), k = this.host.getBoundingClientRect().width / old;
              const rel = window.scrollY + my - p.top; window.scrollTo(0, p.top + rel * k - my); p.top = this.host.getBoundingClientRect().top + window.scrollY; void z;
            });
          }
          return;
        }
      }
      if (scroll && e.pointerId === scroll.id) {
        const now = performance.now(), dt = now - scroll.lt;
        if (dt > 0) { scroll.vy = 0.7 * scroll.vy + 0.3 * ((e.clientY - scroll.ly) / dt); scroll.ly = e.clientY; scroll.lt = now; }
        if (Math.abs(e.clientY - scroll.y) > 8) scroll.moved = true;
        window.scrollTo(0, scroll.top - (e.clientY - scroll.y)); return;
      }
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
        const n = cur.points.length, qx = cur.points[n - 3], qy = cur.points[n - 2];
        if (Math.hypot(x - qx, y - qy) < 1.2) continue; // מסננים רעידות
        // החלקה עדינה: הקו נראה יציב יותר, בלי "שיניים" בכתב יד מהיר
        const k = ev.pointerType === "pen" ? 0.75 : 0.55, sx = qx + (x - qx) * k, sy = qy + (y - qy) * k;
        cur.points.push(Math.round(sx * 10) / 10, Math.round(sy * 10) / 10, Math.round(pressureOf(ev) * 100) / 100);
      }
      if (!cur.erasing && !raf) raf = requestAnimationFrame(paintLive);
    });

    const end = (e) => {
      if (e.pointerType === "pen") this._penAt = performance.now();
      if (e.pointerType === "touch" && this._touches.has(e.pointerId)) {
        this._touches.delete(e.pointerId);
        if (this._touches.size < 2) this._pinch = null;
      }
      if (scroll && e.pointerId === scroll.id) {
        const s = scroll; scroll = null;
        if (!s.moved && performance.now() - s.t < 450) { const [x, y] = toPage(e); this._tapAt(v, x, y); return; } // נגיעה קצרה: בחירת תמונה
        let vy = s.vy;   // גלילה עם תנופה, כמו באפליקציות רגילות
        const glide = () => { if (Math.abs(vy) < 0.03) return; window.scrollBy(0, -vy * 16); vy *= 0.94; momentum = requestAnimationFrame(glide); };
        if (performance.now() - s.lt < 80) glide();
        return;
      }
      if (!cur) return;
      if (cur.erasing) {
        if (cur.removed.length) this._push({ type: "erase", page: v.page.id, removed: cur.removed });
      } else if (cur.lasso) {
        const strokes = v.page.strokes.filter((st) => { for (let k = 0; k < st.points.length; k += 3) if (inPoly(st.points[k], st.points[k + 1], cur.pts)) return true; return false; });
        this.sel = strokes.length ? { v, strokes } : null;
        // לאסו שהוא רק נגיעה (בלי להקיף) על תמונה = בחירת התמונה
        if (!strokes.length) { const xs = cur.pts.filter((_, k) => !(k % 2)), ys = cur.pts.filter((_, k) => k % 2); if (Math.max(...xs) - Math.min(...xs) < 12 && Math.max(...ys) - Math.min(...ys) < 12) { const o = this._hit(v, xs[0], ys[0]); if (o) this._select(v, o.id); } }
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
  clearSelection() { const v = this.sel?.v; this.sel = null; v?.paintLive?.(); this._deselect(true); this.dispatchEvent(new Event("selection")); }
  deleteSelection() {
    if (this.isel) { this._menuAct("del"); return; }
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
    if (a.type === "img") { this._imgSet(v, a.id, reverse ? a.before : a.after); return; }
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

  // ---------- הגדלה / הקטנה (רוחב הדפים ביחס למסך) ----------
  setZoom(z) {
    this.zoom = Math.min(2.5, Math.max(0.6, Math.round(z * 100) / 100));
    this.host.style.width = this.zoom * 100 + "%";
    this.host.style.marginInline = this.zoom < 1 ? "auto" : "";
    this.layout();
    this.dispatchEvent(new Event("zoom"));
    return this.zoom;
  }
  // העמוד שהכי קרוב למרכז המסך
  currentIndex() {
    let best = 0, dist = Infinity;
    this.views.forEach((v, i) => { const r = v.sheet.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < dist) { dist = d; best = i; } });
    return best;
  }
  // סוג הדף: blank (חלק), lines (שורות), grid (משבצות)
  setPageBg(i, bg) {
    const v = this.views[i]; if (!v) return;
    v.page.bg = bg; v.sheet.className = "sheet bg-" + bg;
    this.dispatchEvent(new Event("change"));
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
      drawPageImage(ctx, page, im);
    }
    await drawObjs(ctx, page);
    for (const st of page.strokes) drawStroke(ctx, st);
    return new Promise((r) => cv.toBlob(r, "image/png"));
  }

  isEmpty() { return this.pages.every((p) => !p.strokes.length && !p.image && !p.images?.length); }
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
      drawPageImage(ctx, page, im);
  }
  await drawObjs(ctx, page);
  for (const st of page.strokes) drawStroke(ctx, st);
  return cv.toDataURL("image/jpeg", 0.72);
}
