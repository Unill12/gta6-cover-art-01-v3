// Vice Lights Studio — editor wiring: state, uploads, panel picking,
// drag-to-pan cropping, sliders, layout/grade pickers and PNG export.
// All photos are read on this machine (FileReader); nothing is uploaded.

import { LAYOUTS, GRADES, EXPORT_SIZES, defaultState, renderCover, exportCoverPng, panelAt, panelRects } from './cover.js';

const $ = (sel) => document.querySelector(sel);
const state = defaultState();
let selected = 0;
let dragging = null; // {x, y, ox, oy} in cover pixels while panning
const samples = {}; // name -> loaded Image

const preview = $('#preview');
const pctx = preview.getContext('2d');

function currentSize() {
  return { w: preview.clientWidth, h: preview.clientHeight };
}

function draw() {
  const { w, h } = currentSize();
  // No layout yet (e.g. the editor is hidden in a ?shot= cover scene):
  // nothing to draw, and drawing a 0-size canvas throws.
  if (!w || !h) return;
  preview.width = w * window.devicePixelRatio;
  preview.height = h * window.devicePixelRatio;
  const off = document.createElement('canvas');
  renderCover(off, state, preview.width, preview.height);
  pctx.clearRect(0, 0, preview.width, preview.height);
  pctx.drawImage(off, 0, 0);
  highlightSelected();
  // The drop hint only matters while the selected panel is still empty.
  document.querySelector('#drop-hint').style.display = state.panels[selected].photo ? 'none' : 'block';
}

function highlightSelected() {
  const box = $('#panel-outline');
  const { w, h } = currentSize();
  const dpr = window.devicePixelRatio;
  const rects = panelRects(state.layout, preview.width, preview.height);
  const r = rects[selected];
  if (!r) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.style.left = `${r.x / dpr}px`;
  box.style.top = `${r.y / dpr}px`;
  box.style.width = `${r.w / dpr}px`;
  box.style.height = `${r.h / dpr}px`;
}


// Local copy of the rect math lives in cover.js (panelRects, imported above).

function syncControls() {
  const crop = state.panels[selected];
  $('#zoom').value = crop.zoom;
  $('#zoom-val').textContent = `${Math.round(crop.zoom * 100)}%`;
  $('#ox').value = crop.ox;
  $('#oy').value = crop.oy;
  $('#flip').checked = crop.flip;
  $('#panel-label').textContent = `Panel ${selected + 1} of ${LAYOUTS[state.layout].panels.length}`;
  document.querySelectorAll('#layout-row button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grade-row button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadSample(name) {
  if (!samples[name]) {
    const img = new Image();
    img.src = `assets/${name}.jpg`;
    await img.decode();
    samples[name] = img;
  }
  return samples[name];
}

function applyPhotoToSelected(img) {
  const crop = state.panels[selected];
  crop.photo = img;
  crop.zoom = 1.0;
  crop.ox = 0;
  crop.oy = 0;
  crop.flip = false;
  syncControls();
  draw();
}

function bindButtons(rowId, attr, apply) {
  document.querySelectorAll(`#${rowId} button`).forEach((b) => {
    b.addEventListener('click', () => {
      apply(b.dataset[attr]);
      syncControls();
      draw();
    });
  });
}

function init() {
  // Layout + grade pickers.
  bindButtons('layout-row', 'layout', (v) => {
    state.layout = v;
    selected = 0;
  });
  bindButtons('grade-row', 'grade', (v) => { state.grade = v; });

  // Text fields.
  $('#title').addEventListener('input', (e) => { state.title = e.target.value; draw(); });
  $('#subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; draw(); });
  $('#callout1').addEventListener('input', (e) => { state.callouts[0].text = e.target.value; draw(); });
  $('#callout2').addEventListener('input', (e) => { state.callouts[1].text = e.target.value; draw(); });

  // Crop sliders.
  $('#zoom').addEventListener('input', (e) => {
    state.panels[selected].zoom = parseFloat(e.target.value);
    $('#zoom-val').textContent = `${Math.round(state.panels[selected].zoom * 100)}%`;
    draw();
  });
  $('#ox').addEventListener('input', (e) => { state.panels[selected].ox = parseFloat(e.target.value); draw(); });
  $('#oy').addEventListener('input', (e) => { state.panels[selected].oy = parseFloat(e.target.value); draw(); });
  $('#flip').addEventListener('change', (e) => { state.panels[selected].flip = e.target.checked; draw(); });

  // Upload: file picker + drag & drop onto the preview.
  $('#upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    applyPhotoToSelected(await loadImageFile(file));
    e.target.value = '';
  });
  const wrap = $('#preview-wrap');
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.classList.add('dragging'); });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('dragging'));
  wrap.addEventListener('drop', async (e) => {
    e.preventDefault();
    wrap.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) applyPhotoToSelected(await loadImageFile(file));
  });

  // Click a panel to select it; drag inside it to pan the photo.
  preview.addEventListener('pointerdown', (e) => {
    const rect = preview.getBoundingClientRect();
    const x = (e.clientX - rect.left) * window.devicePixelRatio;
    const y = (e.clientY - rect.top) * window.devicePixelRatio;
    const hit = panelAt(state, x, y, preview.width, preview.height);
    if (hit >= 0) {
      selected = hit;
      const crop = state.panels[selected];
      dragging = { x, y, ox: crop.ox, oy: crop.oy };
      preview.setPointerCapture(e.pointerId);
      syncControls();
      draw();
    }
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = preview.getBoundingClientRect();
    const x = (e.clientX - rect.left) * window.devicePixelRatio;
    const y = (e.clientY - rect.top) * window.devicePixelRatio;
    const crop = state.panels[selected];
    const panelW = preview.width;
    crop.ox = Math.max(-0.5, Math.min(0.5, dragging.ox + (x - dragging.x) / panelW));
    crop.oy = Math.max(-0.5, Math.min(0.5, dragging.oy + (y - dragging.y) / panelW));
    $('#ox').value = crop.ox;
    $('#oy').value = crop.oy;
    draw();
  });
  preview.addEventListener('pointerup', () => { dragging = null; });

  // Sample photos.
  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', async () => {
      applyPhotoToSelected(await loadSample(b.dataset.sample));
    });
  });
  $('#fill-samples').addEventListener('click', async () => {
    const beach = await loadSample('beach');
    const city = await loadSample('city');
    const n = LAYOUTS[state.layout].panels.length;
    for (let i = 0; i < n; i++) {
      state.panels[i].photo = i % 2 === 0 ? beach : city;
      state.panels[i].zoom = 1.0;
      state.panels[i].ox = 0;
      state.panels[i].oy = 0;
    }
    draw();
  });

  // Export: one button per post size, downloads a real PNG.
  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', async () => {
      const size = EXPORT_SIZES[parseInt(b.dataset.export, 10)];
      b.disabled = true;
      b.textContent = 'Rendering…';
      try {
        const blob = await exportCoverPng(state, size);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vice-lights-cover-${size.w}x${size.h}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        $('#export-status').textContent = `Saved ${size.w}×${size.h} PNG (${Math.round(blob.size / 1024)} KB).`;
      } finally {
        b.disabled = false;
        b.textContent = size.label;
      }
    });
  });

  window.addEventListener('resize', draw);
  syncControls();
  draw();
}

// Fill the editor with the two sample photos on first load so the first
// thing a user sees is a finished-looking poster, not empty slots.
async function boot() {
  init();
  const beach = await loadSample('beach');
  const city = await loadSample('city');
  state.panels[0].photo = beach;
  state.panels[1].photo = city;
  state.panels[2].photo = beach;
  draw();
  // Signal to shots.js (?shot=editor) that the editor is ready.
  window.__viceReady = true;
}

boot();
