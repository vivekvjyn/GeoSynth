let countries = {};
let queue = [];
let currentIndex = -1;
let isPlaying = false;
let shuffleMode = false;

const COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4',
  '#a66cff', '#00d2ff', '#ff9a3c', '#c9e4de', '#ff5e78'
];

const seekBar = document.getElementById('audioSeekBar');
const playPauseBtn = document.getElementById('playPauseBtn');
const nowPlaying = document.getElementById('nowPlaying');
const queueList = document.getElementById('queueList');
const queueEmpty = document.getElementById('queueEmpty');
const trackCounter = document.getElementById('trackCounter');
const speedSlider = document.getElementById('speedSlider');
const volumeSlider = document.getElementById('volumeSlider');
const filterSlider = document.getElementById('filterSlider');
const speedVal = document.getElementById('speedVal');
const volumeVal = document.getElementById('volumeVal');
const filterVal = document.getElementById('filterVal');
const countriesVisitedEl = document.getElementById('countriesVisited');
const distanceTraveledEl = document.getElementById('distanceTraveled');
const timeElapsedEl = document.getElementById('timeElapsed');

function getColorForIndex(i) { return COLORS[i % COLORS.length]; }
function getColorForCode(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) { h = ((h << 5) - h) + code.charCodeAt(i); h |= 0; }
  return COLORS[Math.abs(h) % COLORS.length];
}
function isCountrySelected(code) { return queue.findIndex(q => q.code === code); }

let audioCtx = null;
let sourceNode = null;
let gainNode = null;
let filterNode = null;
let currentAudioBuffer = null;
let currentStartTime = 0;
let currentOffset = 0;
let segmentDuration = 0;
let segmentDistance = 0;
let sessionTraveled = 0;
let animFrameId = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = parseFloat(filterSlider.value);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = parseFloat(volumeSlider.value) / 100;
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }
  return audioCtx;
}

function haversineDistance(c1, c2) {
  const R = 6371;
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLng = (c2.lng - c1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTotalDistance() {
  let total = 0;
  for (let i = 0; i < queue.length - 1; i++) {
    const c1 = countries[queue[i].code];
    const c2 = countries[queue[i + 1].code];
    if (c1 && c2) total += haversineDistance(c1, c2);
  }
  return total;
}

function getTraveledDistance() {
  let dist = 0;
  for (let i = 0; i < currentIndex; i++) {
    const c1 = countries[queue[i].code];
    const c2 = countries[queue[i + 1].code];
    if (c1 && c2) dist += haversineDistance(c1, c2);
  }
  if (currentIndex >= 0 && currentIndex < queue.length - 1) {
    const c1 = countries[queue[currentIndex].code];
    const c2 = countries[queue[currentIndex + 1].code];
    if (c1 && c2) dist += haversineDistance(c1, c2) * currentFraction;
  }
  return dist;
}

function interpolatePos(c1, c2, t) {
  return { lat: c1.lat + (c2.lat - c1.lat) * t, lng: c1.lng + (c2.lng - c1.lng) * t };
}

function updateDistanceDisplay() {
  countriesVisitedEl.textContent = visitedCount;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

let speedDebounce = null;
speedSlider.addEventListener('input', () => {
  speedVal.textContent = speedSlider.value + ' km/s';
  updateDistanceDisplay();
  if (isPlaying && currentIndex >= 0 && currentIndex < queue.length - 1) {
    clearTimeout(speedDebounce);
    speedDebounce = setTimeout(() => regenerateFromCurrent(), 300);
  }
});

volumeSlider.addEventListener('input', () => {
  volumeVal.textContent = volumeSlider.value + '%';
  if (gainNode) gainNode.gain.value = parseFloat(volumeSlider.value) / 100;
});

filterSlider.addEventListener('input', () => {
  filterVal.textContent = filterSlider.value + ' Hz';
  if (filterNode) filterNode.frequency.value = parseFloat(filterSlider.value);
});

const container = document.getElementById('globe-container');
const globe = Globe()
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
  .polygonCapColor(d => {
    const code = d.properties.iso_a2 || '';
    const idx = isCountrySelected(code);
    if (idx >= 0) return getColorForCode(code) + '99';
    return 'rgba(200, 200, 200, 0.08)';
  })
  .polygonSideColor(() => 'rgba(200, 200, 200, 0.05)')
  .polygonStrokeColor(d => {
    const code = d.properties.iso_a2 || '';
    const idx = isCountrySelected(code);
    if (idx >= 0) return getColorForCode(code);
    return 'rgba(255, 255, 255, 0.3)';
  })
  .polygonLabel(d => {
    const code = d.properties.iso_a2 || '';
    const name = countries[code] ? countries[code].name : code;
    return '<div style="background:#161b22;color:#e6edf3;padding:6px 10px;border-radius:6px;font-size:13px">' + name + '</div>';
  })
  .onPolygonClick(handlePolygonClick)
  .polygonAltitude(0.005)
  .arcColor(d => d.color)
  .arcStroke(0.6)
  .arcDashLength(0.4)
  .arcDashGap(0.2)
  .arcDashAnimateTime(1500)
  .pointsData([])
  .pointLat(d => d.lat)
  .pointLng(d => d.lng)
  .pointColor(() => '#ff3b3b')
  .pointAltitude(0.03)
  .pointRadius(0.5);

globe(container);
globe.width(container.clientWidth);
globe.height(container.clientHeight);
globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);

window.addEventListener('resize', () => {
  globe.width(container.clientWidth);
  globe.height(container.clientHeight);
});

fetch('/static/data/countries.json')
  .then(r => r.json())
  .then(data => {
    countries = data;
    return fetch('/static/data/countries.geojson');
  })
  .then(r => r.json())
  .then(geo => { globe.polygonsData(geo.features); });

function handlePolygonClick(feature) {
  if (!feature || !feature.properties) return;
  const code = feature.properties.iso_a2 || '';
  if (!code || code === '-1') return;
  const name = countries[code] ? countries[code].name : code;
  addToQueue(code, name);
}

function updatePolygons() { globe.polygonsData([...globe.polygonsData()]); }

function updateArcs() {
  if (queue.length < 2) { globe.arcsData([]); return; }
  const arcs = [];
  for (let i = 0; i < queue.length - 1; i++) {
    const c1 = countries[queue[i].code];
    const c2 = countries[queue[i + 1].code];
    if (!c1 || !c2) continue;
    arcs.push({
      startLat: c1.lat, startLng: c1.lng,
      endLat: c2.lat, endLng: c2.lng,
      color: i === currentIndex ? '#ff3b3b' : [getColorForCode(queue[i].code), getColorForCode(queue[i + 1].code)]
    });
  }
  globe.arcsData(arcs);
}

function getArcPosition(c1, c2, t) {
  const lat1 = c1.lat * Math.PI / 180, lng1 = c1.lng * Math.PI / 180;
  const lat2 = c2.lat * Math.PI / 180, lng2 = c2.lng * Math.PI / 180;
  const x = Math.cos(lat1) * Math.cos(lng1) * (1 - t) + Math.cos(lat2) * Math.cos(lng2) * t;
  const y = Math.cos(lat1) * Math.sin(lng1) * (1 - t) + Math.cos(lat2) * Math.sin(lng2) * t;
  const z = Math.sin(lat1) * (1 - t) + Math.sin(lat2) * t;
  return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI, lng: Math.atan2(y, x) * 180 / Math.PI };
}

function updatePlayhead() {
  if (currentIndex < 0 || currentIndex >= queue.length - 1) { globe.pointsData([]); return; }
  const c1 = countries[queue[currentIndex].code];
  const c2 = countries[queue[currentIndex + 1].code];
  if (!c1 || !c2) return;
  const pos = getArcPosition(c1, c2, currentFraction);
  globe.pointsData([{ lat: pos.lat, lng: pos.lng }]);
}

let currentFraction = 0;
let visitedCount = 0;

async function fetchSegmentAudio(lat1, lng1, lat2, lng2) {
  const resp = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat1, lng1, lat2, lng2,
      speed: parseFloat(speedSlider.value),
      volume: 1.0
    })
  });
  const blob = await resp.blob();
  const arrayBuf = await blob.arrayBuffer();
  const ctx = getAudioCtx();
  return await ctx.decodeAudioData(arrayBuf);
}

function playBuffer(buffer, offset) {
  if (sourceNode) { try { sourceNode.stop(); sourceNode.disconnect(); } catch(e) {} }
  const ctx = getAudioCtx();
  sourceNode = ctx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.connect(filterNode);
  sourceNode.onended = () => {
    if (isPlaying && currentFraction >= 0.99) nextCountry();
  };
  sourceNode.start(0, offset);
  currentStartTime = ctx.currentTime - offset;
  segmentDuration = buffer.duration;
}

function getElapsed() {
  const ctx = getAudioCtx();
  if (!isPlaying) return currentOffset;
  return ctx.currentTime - currentStartTime;
}

function seekToFraction(frac) {
  if (!currentAudioBuffer) return;
  currentFraction = frac;
  const offset = frac * segmentDuration;
  currentOffset = offset;
  playBuffer(currentAudioBuffer, offset);
}

async function regenerateFromCurrent() {
  if (currentIndex < 0 || currentIndex >= queue.length - 1) return;
  const c1 = countries[queue[currentIndex].code];
  const c2 = countries[queue[currentIndex + 1].code];
  if (!c1 || !c2) return;

  const wasPlaying = isPlaying;

  currentAudioBuffer = await fetchSegmentAudio(c1.lat, c1.lng, c2.lat, c2.lng);
  segmentDuration = currentAudioBuffer.duration;

  if (wasPlaying) {
    const fraction = Math.min(currentFraction, 0.99);
    playBuffer(currentAudioBuffer, fraction * segmentDuration);
  }
}

function animateProgress() {
  if (!isPlaying) return;

  if (currentAudioBuffer && segmentDuration > 0) {
    const elapsed = getElapsed();
    currentFraction = Math.min(elapsed / segmentDuration, 1.0);
  }

  const totalDist = getTotalDistance();
  const traveled = getTraveledDistance();
  distanceTraveledEl.textContent = Math.round(traveled).toLocaleString() + ' km';
  timeElapsedEl.textContent = formatTime(traveled / parseFloat(speedSlider.value));

  const currentSegDist = segmentDistance * currentFraction;
  document.getElementById('currentDist').textContent = Math.round(currentSegDist).toLocaleString() + ' km';
  document.getElementById('totalDist').textContent = Math.round(segmentDistance).toLocaleString() + ' km';
  seekBar.max = segmentDistance;
  seekBar.value = currentSegDist;

  updatePlayhead();
  animFrameId = requestAnimationFrame(animateProgress);
}

function addToQueue(countryCode, countryName) {
  queue.push({ code: countryCode, name: countryName });
  updatePolygons();
  updateArcs();
  updateDistanceDisplay();
  renderQueue();
  if (queue.length === 2 && currentIndex === -1) {
    currentIndex = 0;
    generateAndPlay();
  }
}

function removeFromQueue(index) {
  queue.splice(index, 1);
  if (queue.length === 0) {
    currentIndex = -1;
    sessionTraveled = 0;
    stopPlayback();
  } else if (index <= currentIndex) {
    currentIndex = Math.max(0, currentIndex - 1);
    if (isPlaying) generateAndPlay();
  }
  updatePolygons();
  updateArcs();
  updateDistanceDisplay();
  renderQueue();
}

function moveInQueue(from, to) {
  const item = queue.splice(from, 1)[0];
  queue.splice(to, 0, item);
  if (from === currentIndex) currentIndex = to;
  else if (from < currentIndex && to >= currentIndex) currentIndex--;
  else if (from > currentIndex && to <= currentIndex) currentIndex++;
  updatePolygons();
  updateArcs();
  updateDistanceDisplay();
  renderQueue();
}

function clearQueue() {
  queue = [];
  currentIndex = -1;
  sessionTraveled = 0;
  stopPlayback();
  updatePolygons();
  updateArcs();
  updateDistanceDisplay();
  renderQueue();
}

function renderQueue() {
  queueEmpty.style.display = queue.length ? 'none' : 'block';
  trackCounter.textContent = queue.length ? (currentIndex + 1) + ' / ' + queue.length : '0 / 0';
  const existing = queueList.querySelectorAll('.queue-item');
  existing.forEach(el => el.remove());
  queue.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'queue-item' + (i === currentIndex ? ' active' : '');
    el.style.borderLeft = '3px solid ' + getColorForCode(item.code);
    el.draggable = true;
    el.dataset.index = i;
    el.innerHTML =
      '<span class="qi-num">' + (i + 1) + '</span>' +
      '<span class="qi-name">' + item.name + '</span>' +
      '<button class="qi-remove" onclick="removeFromQueue(' + i + ')" title="Remove">&times;</button>';
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragend', onDragEnd);
    queueList.appendChild(el);
  });
}

let dragIndex = null;
function onDragStart(e) { dragIndex = +this.dataset.index; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function onDrop(e) { e.preventDefault(); const to = +this.dataset.index; if (dragIndex !== null && dragIndex !== to) moveInQueue(dragIndex, to); dragIndex = null; }
function onDragEnd() { this.classList.remove('dragging'); dragIndex = null; }

async function generateAndPlay() {
  if (currentIndex < 0 || currentIndex >= queue.length - 1) return;
  const c1 = queue[currentIndex];
  const c2 = queue[currentIndex + 1];
  const cc1 = countries[c1.code];
  const cc2 = countries[c2.code];

  nowPlaying.textContent = c1.name + ' → ' + c2.name;
  segmentDistance = cc1 && cc2 ? haversineDistance(cc1, cc2) : 0;
  currentFraction = 0;
  currentOffset = 0;
  updateArcs();
  renderQueue();

  try {
    currentAudioBuffer = await fetchSegmentAudio(cc1.lat, cc1.lng, cc2.lat, cc2.lng);
    segmentDuration = currentAudioBuffer.duration;

    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    isPlaying = true;
    playBuffer(currentAudioBuffer, 0);
    updatePlayPauseIcon();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animateProgress();
  } catch (e) {
    console.error('Generate failed:', e);
    nowPlaying.textContent = 'Error: ' + e.message;
    isPlaying = false;
    updatePlayPauseIcon();
  }
}

function togglePlayPause() {
  const ctx = getAudioCtx();
  if (isPlaying) {
    currentOffset = getElapsed();
    if (sourceNode) { try { sourceNode.stop(); sourceNode.disconnect(); } catch(e) {} }
    isPlaying = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
  } else if (currentAudioBuffer) {
    isPlaying = true;
    playBuffer(currentAudioBuffer, currentOffset);
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animateProgress();
  } else if (queue.length >= 2) {
    if (currentIndex < 0) currentIndex = 0;
    generateAndPlay();
  }
  updatePlayPauseIcon();
}

function stopPlayback() {
  isPlaying = false;
  currentFraction = 0;
  currentOffset = 0;
  segmentDuration = 0;
  visitedCount = 0;
  updateDistanceDisplay();
  if (sourceNode) { try { sourceNode.stop(); sourceNode.disconnect(); } catch(e) {} sourceNode = null; }
  if (animFrameId) cancelAnimationFrame(animFrameId);
  globe.pointsData([]);
  document.getElementById('currentDist').textContent = '0 km';
  document.getElementById('totalDist').textContent = '0 km';
  distanceTraveledEl.textContent = '0 km';
  timeElapsedEl.textContent = '0:00';
  seekBar.value = 0;
  nowPlaying.textContent = queue.length ? 'Paused' : 'No track';
  updatePlayPauseIcon();
}

function nextCountry() {
  if (queue.length < 2) return;
  visitedCount++;
  updateDistanceDisplay();
  if (shuffleMode) {
    currentIndex = Math.floor(Math.random() * (queue.length - 1));
  } else {
    currentIndex++;
    if (currentIndex >= queue.length - 1) currentIndex = 0;
  }
  generateAndPlay();
}

function prevCountry() {
  if (queue.length < 2) return;
  currentIndex = Math.max(0, currentIndex - 1);
  generateAndPlay();
}

function toggleShuffle() {
  shuffleMode = !shuffleMode;
  document.getElementById('shuffleBtn').classList.toggle('active', shuffleMode);
}

function updatePlayPauseIcon() {
  playPauseBtn.innerHTML = isPlaying ? '&#9646;&#9646;' : '&#9654;';
}

seekBar.addEventListener('input', () => {
  if (isPlaying && currentAudioBuffer && segmentDistance > 0) {
    const frac = seekBar.value / segmentDistance;
    seekToFraction(Math.max(0, Math.min(frac, 1.0)));
  }
});
