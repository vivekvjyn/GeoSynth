let countries = {};
let queue = [];
let currentIndex = -1;
let isPlaying = false;

const SAMPLE_RATE = 44100;
const CHUNK_SAMPLES = 2048;
const CHUNK_DURATION = CHUNK_SAMPLES / SAMPLE_RATE;

const COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4',
  '#a66cff', '#00d2ff', '#ff9a3c', '#c9e4de', '#ff5e78'
];

const seekBar = document.getElementById('audioSeekBar');
const playPauseBtn = document.getElementById('playPauseBtn');
const queueList = document.getElementById('queueList');
const queueEmpty = document.getElementById('queueEmpty');
const speedSlider = document.getElementById('speedSlider');
const volumeSlider = document.getElementById('volumeSlider');
const filterSlider = document.getElementById('filterSlider');
const speedVal = document.getElementById('speedVal');
const volumeVal = document.getElementById('volumeVal');
const filterVal = document.getElementById('filterVal');
const countriesVisitedEl = document.getElementById('countriesVisited');
const tripCountEl = document.getElementById('tripCount');
const distanceTraveledEl = document.getElementById('distanceTraveled');
const timeElapsedEl = document.getElementById('timeElapsed');

function getColorForIndex(i) { return COLORS[i % COLORS.length]; }
function getColorForCode(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) { h = ((h << 5) - h) + code.charCodeAt(i); h |= 0; }
  return COLORS[Math.abs(h) % COLORS.length];
}
function isCountrySelected(code) { return queue.findIndex(q => q.code === code); }

function sliderToFreq(val) {
  if (val === 0) return 20;
  return Math.round(20 * Math.pow(1100, val / 10000));
}

function sliderToDb(val) {
  if (val === 0) return -Infinity;
  return Math.round(-60 + (val / 100) * 60);
}

function dbToGain(db) {
  if (db === -Infinity || db <= -60) return 0;
  return Math.pow(10, db / 20);
}

let audioCtx = null;
let sourceNode = null;
let gainNode = null;
let filterNode = null;
let currentAudioBuffer = null;
let segmentDistance = 0;
let animFrameId = null;

let playheadLat = 0;
let playheadLng = 0;
let playheadFraction = 0;
let segmentStartLat = 0;
let segmentStartLng = 0;
let segmentEndLat = 0;
let segmentEndLng = 0;
let nextPlayTime = 0;
let bufferQueue = [];
let isBuffering = false;
let playheadTimer = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = sliderToFreq(parseFloat(filterSlider.value));
    gainNode = audioCtx.createGain();
    gainNode.gain.value = dbToGain(sliderToDb(parseFloat(volumeSlider.value)));
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
    if (c1 && c2) dist += haversineDistance(c1, c2) * playheadFraction;
  }
  return dist;
}

function updateDistanceDisplay() {
  countriesVisitedEl.textContent = visitedCount;
  tripCountEl.textContent = Math.max(0, queue.length - 1);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

speedSlider.addEventListener('input', () => {
  speedVal.textContent = speedSlider.value + ' km/s';
  updateDistanceDisplay();
});

volumeSlider.addEventListener('input', () => {
  const db = sliderToDb(parseFloat(volumeSlider.value));
  volumeVal.textContent = db === -Infinity ? '-∞ dB' : db + ' dB';
  if (gainNode) gainNode.gain.value = dbToGain(db);
});

filterSlider.addEventListener('input', () => {
  const freq = sliderToFreq(parseFloat(filterSlider.value));
  filterVal.textContent = freq >= 1000 ? (freq / 1000).toFixed(1) + ' kHz' : freq + ' Hz';
  if (filterNode) filterNode.frequency.value = freq;
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
    return '<div style="background:rgba(16,16,24,0.8);backdrop-filter:blur(12px);color:#e6edf3;padding:6px 10px;border-radius:8px;font-size:13px;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:6px"><img src="https://flagcdn.com/w24/' + code.toLowerCase() + '.png" style="height:14px" loading="lazy">' + name + '</div>';
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

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => globe.pointOfView({ lat: pos.coords.latitude, lng: pos.coords.longitude, altitude: 2.5 }, 1000),
    () => globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0),
    { timeout: 5000 }
  );
} else {
  globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
}

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
  if (queue.some(q => q.code === code)) return;
  const name = countries[code] ? countries[code].name : code;
  addToQueue(code, name);
}

function updatePolygons() {
  globe.polygonsData([...globe.polygonsData()]);
}

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
  const pos = getArcPosition(
    { lat: segmentStartLat, lng: segmentStartLng },
    { lat: segmentEndLat, lng: segmentEndLng },
    playheadFraction
  );
  globe.pointsData([{ lat: pos.lat, lng: pos.lng }]);
}

let visitedCount = 0;

async function fetchChunk(lat, lng) {
  const resp = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng })
  });
  const count = parseInt(resp.headers.get('X-Sample-Count'));
  const buf = await resp.arrayBuffer();
  return new Float32Array(buf, 0, count);
}

function scheduleChunk(samples) {
  const ctx = getAudioCtx();
  const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
  buffer.getChannelData(0).set(samples);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(filterNode);

  const now = ctx.currentTime;
  if (nextPlayTime < now) {
    nextPlayTime = now;
  }

  source.start(nextPlayTime);
  nextPlayTime += buffer.duration;

  bufferQueue.push({ source, duration: buffer.duration });
}

let segmentStartTime = 0;
let lastTickTime = 0;

function startPlayhead() {
  if (playheadTimer) clearInterval(playheadTimer);

  playheadFraction = 0;
  nextPlayTime = getAudioCtx().currentTime;
  bufferQueue = [];
  isBuffering = false;
  lastTickTime = performance.now();

  playheadTimer = setInterval(() => {
    if (!isPlaying) return;

    const now = performance.now();
    const dt = (now - lastTickTime) / 1000;
    lastTickTime = now;

    const speed = parseFloat(speedSlider.value);
    playheadFraction = Math.min(playheadFraction + (dt * speed) / segmentDistance, 1.0);

    const lat = segmentStartLat + (segmentEndLat - segmentStartLat) * playheadFraction;
    const lng = segmentStartLng + (segmentEndLng - segmentStartLng) * playheadFraction;

    updatePlayhead();

    const traveled = getTraveledDistance();
    distanceTraveledEl.textContent = Math.round(traveled).toLocaleString() + ' km';
    timeElapsedEl.textContent = formatTime(traveled / speed);
    document.getElementById('currentDist').textContent = Math.round(segmentDistance * playheadFraction).toLocaleString() + ' km';
    document.getElementById('totalDist').textContent = Math.round(segmentDistance).toLocaleString() + ' km';
    seekBar.max = segmentDistance;
    seekBar.value = segmentDistance * playheadFraction;

    fetchChunk(lat, lng).then(samples => {
      scheduleChunk(samples);
      if (isBuffering) {
        isBuffering = false;
      }
    }).catch(() => {});

    if (playheadFraction >= 1.0) {
      clearInterval(playheadTimer);
      playheadTimer = null;
      setTimeout(() => {
        if (isPlaying) nextCountry();
      }, 2000);
    }
  }, 50);
}

function stopPlayhead() {
  if (playheadTimer) {
    clearInterval(playheadTimer);
    playheadTimer = null;
  }
  bufferQueue.forEach(b => {
    try { b.source.stop(); b.source.disconnect(); } catch(e) {}
  });
  bufferQueue = [];
  nextPlayTime = 0;
  playheadFraction = 0;
}

function addToQueue(countryCode, countryName) {
  queue.push({ code: countryCode, name: countryName });
  updatePolygons();
  updateArcs();
  updateDistanceDisplay();
  renderQueue();
  if (queue.length === 2 && currentIndex === -1) {
    currentIndex = 0;
    visitedCount = 1;
    updateDistanceDisplay();
    generateAndPlay();
  }
}

function removeFromQueue(index) {
  queue.splice(index, 1);
  if (queue.length === 0) {
    currentIndex = -1;
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
  stopPlayback();
  updatePolygons();
  updateArcs();
  updateDistanceDisplay();
  renderQueue();
}

function getFlagUrl(code) {
  if (!code || code.length !== 2) return '';
  return 'https://flagcdn.com/w40/' + code.toLowerCase() + '.png';
}

function renderQueue() {
  queueEmpty.style.display = queue.length ? 'none' : 'block';
  const existing = queueList.querySelectorAll('.queue-item');
  existing.forEach(el => el.remove());
  queue.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'queue-item' + (i === currentIndex ? ' active' : '');
    el.style.borderLeft = '3px solid ' + getColorForCode(item.code);
    el.draggable = true;
    el.dataset.index = i;
    el.innerHTML =
      '<img class="qi-flag" src="' + getFlagUrl(item.code) + '" alt="' + item.code + '" loading="lazy">' +
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

  stopPlayhead();

  segmentStartLat = cc1.lat;
  segmentStartLng = cc1.lng;
  segmentEndLat = cc2.lat;
  segmentEndLng = cc2.lng;
  segmentDistance = cc1 && cc2 ? haversineDistance(cc1, cc2) : 0;

  updateArcs();
  renderQueue();

  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    isPlaying = true;
    updatePlayPauseIcon();
    startPlayhead();
  } catch (e) {
    console.error('Generate failed:', e);
    isPlaying = false;
    updatePlayPauseIcon();
  }
}

function togglePlayPause() {
  const ctx = getAudioCtx();
  if (isPlaying) {
    stopPlayhead();
    isPlaying = false;
  } else if (queue.length >= 2) {
    if (currentIndex < 0) currentIndex = 0;
    generateAndPlay();
  }
  updatePlayPauseIcon();
}

function stopPlayback() {
  isPlaying = false;
  stopPlayhead();
  playheadFraction = 0;
  segmentDistance = 0;
  visitedCount = 0;
  updateDistanceDisplay();
  globe.pointsData([]);
  document.getElementById('currentDist').textContent = '0 km';
  document.getElementById('totalDist').textContent = '0 km';
  distanceTraveledEl.textContent = '0 km';
  timeElapsedEl.textContent = '0:00';
  seekBar.value = 0;
  updatePlayPauseIcon();
}

function nextCountry() {
  if (queue.length < 2) return;
  visitedCount++;
  updateDistanceDisplay();
  currentIndex++;
  if (currentIndex >= queue.length - 1) currentIndex = 0;
  generateAndPlay();
}

function prevCountry() {
  if (queue.length < 2) return;
  currentIndex = Math.max(0, currentIndex - 1);
  generateAndPlay();
}

function updatePlayPauseIcon() {
  playPauseBtn.innerHTML = isPlaying ? '&#9646;&#9646;' : '&#9654;';
}

seekBar.addEventListener('input', () => {
  if (isPlaying && segmentDistance > 0) {
    playheadFraction = seekBar.value / segmentDistance;
    lastTickTime = performance.now();
    updatePlayhead();
  }
});
