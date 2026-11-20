// Vice Lights Studio — ?shot= scene driver for screenshots.
// The maker takes screenshots through these scenes so every shot is a
// deterministic render of the app itself, never an edit or a composite:
//   ?shot=cover            best cover, landscape (first screenshot)
//   ?shot=editor           editor with photos loaded, panels + controls
//   ?shot=cover-square     square cover, another layout + grade
//   ?shot=cover-portrait   portrait cover, third layout + grade
// Each scene sets document.title to "shot-ready" once drawn, so the
// screenshot script knows when to capture.

import { defaultState, renderCover } from './cover.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) document.documentElement.dataset.shot = shot;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function markReady() {
  document.title = 'shot-ready';
  document.documentElement.dataset.shotReady = '1';
}

function waitForEditor() {
  return new Promise((resolve) => {
    const tick = () => {
      if (window.__viceReady) resolve();
      else setTimeout(tick, 50);
    };
    tick();
    setTimeout(resolve, 10000); // never block the shot forever
  });
}

async function renderCoverScene(layout, grade, title, subtitle) {
  document.body.classList.add('cover-scene');
  const beach = await loadImage('assets/beach.jpg');
  const city = await loadImage('assets/city.jpg');
  const state = defaultState();
  state.layout = layout;
  state.grade = grade;
  state.title = title;
  state.subtitle = subtitle;
  const n = { split: 3, strip: 3, mosaic: 4 }[layout];
  for (let i = 0; i < n; i++) {
    state.panels[i].photo = i % 2 === 0 ? beach : city;
  }
  const canvas = document.createElement('canvas');
  canvas.id = 'shot-canvas';
  document.body.appendChild(canvas);
  const fit = () => {
    renderCover(canvas, state, window.innerWidth, window.innerHeight);
  };
  fit();
  window.addEventListener('resize', fit);
  markReady();
}

async function editorScene() {
  await waitForEditor();
  // Pick a different layout + grade from the default so the editor shot
  // shows the mosaic with a sunset grade and the samples already filled.
  const layoutBtn = document.querySelector('#layout-row button[data-layout="mosaic"]');
  if (layoutBtn) layoutBtn.click();
  const gradeBtn = document.querySelector('#grade-row button[data-grade="sunset"]');
  if (gradeBtn) gradeBtn.click();
  // The mosaic has four panels; fill all of them so no empty slot shows.
  const fillBtn = document.querySelector('#fill-samples');
  if (fillBtn) fillBtn.click();
  const title = document.querySelector('#title');
  if (title) {
    title.value = 'VICE LIGHTS';
    title.dispatchEvent(new Event('input'));
  }
  // The sample fill runs async; let it land before signalling ready.
  await new Promise((r) => setTimeout(r, 300));
  markReady();
}

if (shot === 'cover') {
  renderCoverScene('split', 'neon', 'MIDNIGHT HEIST', 'Leonida  •  2026');
} else if (shot === 'cover-square') {
  renderCoverScene('strip', 'golden', 'BOULEVARD QUEEN', 'Vice City  •  Golden Hour');
} else if (shot === 'cover-portrait') {
  renderCoverScene('mosaic', 'noir', 'NEON BOULEVARD', 'After dark in Leonida');
} else if (shot === 'editor') {
  editorScene();
}
