// Vice Lights Studio — cover renderer (canvas 2D, no dependencies).
// Draws a GTA-style multi-panel poster: photos in panel slots, a colour
// grade, big title lettering, callouts with leader lines, a circular seal
// and a billing block. The editor and the ?shot= scenes both call
// renderCover; the export buttons call it at full post sizes.

export const LAYOUTS = {
  split: {
    name: 'Sunset Split',
    panels: [
      { x: 0.0, y: 0.0, w: 0.58, h: 1.0 },
      { x: 0.58, y: 0.0, w: 0.42, h: 0.5 },
      { x: 0.58, y: 0.5, w: 0.42, h: 0.5 },
    ],
  },
  strip: {
    name: 'Neon Strip',
    panels: [
      { x: 0.0, y: 0.0, w: 1 / 3, h: 1.0 },
      { x: 1 / 3, y: 0.0, w: 1 / 3, h: 1.0 },
      { x: 2 / 3, y: 0.0, w: 1 / 3, h: 1.0 },
    ],
  },
  mosaic: {
    name: 'Vice Mosaic',
    panels: [
      { x: 0.0, y: 0.0, w: 1.0, h: 0.58 },
      { x: 0.0, y: 0.58, w: 1 / 3, h: 0.42 },
      { x: 1 / 3, y: 0.58, w: 1 / 3, h: 0.42 },
      { x: 2 / 3, y: 0.58, w: 1 / 3, h: 0.42 },
    ],
  },
};

export const GRADES = {
  sunset: { name: 'Sunset', filter: 'saturate(1.18) contrast(1.06)', top: 'rgba(255,120,40,0.10)', bottom: 'rgba(255,60,10,0.30)' },
  neon: { name: 'Neon Nights', filter: 'saturate(1.28) contrast(1.05)', top: 'rgba(255,0,170,0.16)', bottom: 'rgba(0,210,255,0.18)' },
  golden: { name: 'Golden Hour', filter: 'saturate(1.12) contrast(1.04)', top: 'rgba(255,200,80,0.16)', bottom: 'rgba(255,150,30,0.22)' },
  noir: { name: 'Vice Noir', filter: 'saturate(0.55) contrast(1.10) brightness(0.92)', top: 'rgba(20,10,40,0.22)', bottom: 'rgba(255,40,120,0.12)' },
};

export const EXPORT_SIZES = [
  { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { label: 'Landscape 1920 × 1080', w: 1920, h: 1080 },
];

export function defaultState() {
  return {
    layout: 'split',
    grade: 'sunset',
    title: 'MIDNIGHT HEIST',
    subtitle: 'Leonida  •  2026',
    seal: 'VICE LIGHTS',
    billing: 'VICE LIGHTS STUDIO  •  A LEONIDA POSTER  •  SHOT ON THE BOULEVARD  •  2026',
    callouts: [
      { text: 'PALMS AT DUSK', ax: 0.24, ay: 0.30, lx: 0.05, ly: 0.09 },
      { text: 'NEON BOULEVARD', ax: 0.74, ay: 0.28, lx: 0.56, ly: 0.07 },
    ],
    // One crop per panel slot: photo is an HTMLImageElement (or null),
    // zoom >= 1, ox/oy shift the crop in fractions of the panel.
    panels: [
      { photo: null, zoom: 1.0, ox: 0, oy: 0, flip: false },
      { photo: null, zoom: 1.0, ox: 0, oy: 0, flip: false },
      { photo: null, zoom: 1.0, ox: 0, oy: 0, flip: false },
      { photo: null, zoom: 1.0, ox: 0, oy: 0, flip: false },
    ],
  };
}

// Panel rectangles in pixels, with a thin gap between panels.
export function panelRects(layout, W, H) {
  const gap = Math.max(3, Math.round(W * 0.006));
  return LAYOUTS[layout].panels.map((p) => ({
    x: Math.round(p.x * W) + (p.x > 0 ? gap / 2 : 0),
    y: Math.round(p.y * H) + (p.y > 0 ? gap / 2 : 0),
    w: Math.round(p.w * W) - (p.x > 0 ? gap / 2 : 0) - (p.x + p.w < 1 ? gap / 2 : 0),
    h: Math.round(p.h * H) - (p.y > 0 ? gap / 2 : 0) - (p.y + p.h < 1 ? gap / 2 : 0),
  }));
}

function drawPhoto(ctx, img, rect, crop, filter) {
  if (!img) {
    // Empty slot: dark placeholder with a dashed frame so the editor
    // still reads as a poster layout before any photo is loaded.
    ctx.save();
    ctx.fillStyle = '#181022';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 ${Math.max(13, Math.round(rect.w * 0.03))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DROP A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * crop.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + crop.ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + crop.oy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (filter) ctx.filter = filter;
  if (crop.flip) {
    ctx.translate(rect.x + rect.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(rect.x + rect.w / 2), 0);
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function applyGrade(ctx, W, H, grade) {
  const g = GRADES[grade];
  const grad = ctx.createLinearGradient(0, 0, W * 0.25, H);
  grad.addColorStop(0, g.top);
  grad.addColorStop(1, g.bottom);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Vignette: darken the corners so the lettering pops.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawCallout(ctx, c, W, H) {
  const ax = c.ax * W;
  const ay = c.ay * H;
  const lx = c.lx * W;
  const ly = c.ly * H;
  const fs = Math.max(13, Math.round(W * 0.016));
  ctx.save();
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  const tw = ctx.measureText(c.text).width;
  const pad = Math.round(fs * 0.55);
  const bx = lx;
  const by = ly - fs / 2 - pad / 2;
  const bw = tw + pad * 2;
  const bh = fs + pad * 1.4;
  // Leader line from the label to the anchor dot.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.beginPath();
  ctx.moveTo(bx + bw / 2, by + bh);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ax, ay, Math.max(4, W * 0.005), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10,6,18,0.78)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.text, bx + pad, by + bh / 2 + 1);
  ctx.restore();
}

function drawSeal(ctx, text, W, H) {
  const r = Math.max(34, Math.round(W * 0.055));
  const cx = W - r - Math.round(W * 0.045);
  const cy = H - r - Math.round(H * 0.075);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(12,6,20,0.72)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, 0, r - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  // Five-point star, raised so the studio name fits beneath it.
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  const sr = r * 0.42;
  const starCy = -r * 0.14;
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? sr : sr * 0.45;
    const px = Math.cos(ang) * rad;
    const py = starCy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.max(9, Math.round(r * 0.17))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, r * 0.56);
  ctx.restore();
}

function drawTitleBlock(ctx, state, W, H) {
  const bandH = Math.round(H * 0.26);
  const bandY = H - bandH;
  const grad = ctx.createLinearGradient(0, bandY - bandH * 0.4, 0, H);
  grad.addColorStop(0, 'rgba(8,4,16,0)');
  grad.addColorStop(0.45, 'rgba(8,4,16,0.55)');
  grad.addColorStop(1, 'rgba(8,4,16,0.88)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY - bandH * 0.4, W, bandH + bandH * 0.4);
  const mx = Math.round(W * 0.05);
  // Shrink the title until it fits left of the seal (bottom-right circle),
  // so long titles never run over the seal or off the right edge.
  const sealR = Math.max(34, Math.round(W * 0.055));
  const sealLeft = W - Math.round(W * 0.045) - sealR * 2;
  const maxTitleW = sealLeft - Math.round(W * 0.02) - mx;
  const titleFont = (s) => `900 ${s}px 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
  let titleSize = Math.round(W * 0.085);
  ctx.font = titleFont(titleSize);
  try { ctx.letterSpacing = '1px'; } catch (e) { /* older canvas: ignore */ }
  const minTitle = Math.round(titleSize * 0.55);
  while (ctx.measureText(state.title.toUpperCase()).width > maxTitleW && titleSize > minTitle) {
    titleSize -= 2;
    ctx.font = titleFont(titleSize);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const titleY = H - Math.round(H * 0.115);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = Math.max(3, titleSize * 0.09);
  ctx.strokeText(state.title.toUpperCase(), mx, titleY);
  const tg = ctx.createLinearGradient(0, titleY - titleSize, 0, titleY);
  tg.addColorStop(0, '#fff7e0');
  tg.addColorStop(0.55, '#ffffff');
  tg.addColorStop(1, '#ffb347');
  ctx.fillStyle = tg;
  ctx.fillText(state.title.toUpperCase(), mx, titleY);
  let subSize = Math.max(13, Math.round(W * 0.021));
  ctx.font = `600 ${subSize}px system-ui, sans-serif`;
  const minSub = Math.max(11, Math.round(subSize * 0.6));
  while (ctx.measureText(state.subtitle).width > maxTitleW && subSize > minSub) {
    subSize -= 1;
    ctx.font = `600 ${subSize}px system-ui, sans-serif`;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(state.subtitle, mx, titleY + subSize + Math.round(H * 0.012));
  // Billing block: tiny caps line along the very bottom.
  const billSize = Math.max(9, Math.round(W * 0.0115));
  ctx.font = `600 ${billSize}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.textAlign = 'center';
  ctx.fillText(state.billing, W / 2, H - Math.round(H * 0.014));
  ctx.restore();
}

// Render the whole cover onto canvas (resized to w x h first).
// state.panels[i].photo must be a loaded HTMLImageElement or null.
export function renderCover(canvas, state, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0817';
  ctx.fillRect(0, 0, w, h);
  const grade = GRADES[state.grade];
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const crop = state.panels[i] || { photo: null, zoom: 1, ox: 0, oy: 0, flip: false };
    drawPhoto(ctx, crop.photo, rect, crop, grade.filter);
  });
  applyGrade(ctx, w, h, state.grade);
  for (const c of state.callouts) {
    if (c.text && c.text.trim()) drawCallout(ctx, c, w, h);
  }
  drawSeal(ctx, state.seal, w, h);
  drawTitleBlock(ctx, state, w, h);
  return canvas;
}

// Export the cover at a post size; resolves with a PNG Blob.
export function exportCoverPng(state, size) {
  const canvas = document.createElement('canvas');
  renderCover(canvas, state, size.w, size.h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Which panel (index) covers point (x, y) in cover coordinates, or -1.
export function panelAt(state, x, y, W, H) {
  const rects = panelRects(state.layout, W, H);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}
