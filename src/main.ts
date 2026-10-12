import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { advanceElapsed, GAME_DURATION, isNearMiss, isOnRoad, roadCenterAt, roadHalfWidth, stageAt, type GamePhase } from './game-logic';
import './style.css';

type CarKind = 'sport' | 'classic' | 'neo';
type ManifestModel = { id: string; file: string; category: string; source?: string; license?: string; bytes?: number; usage?: string };
type AssetManifest = { models?: ManifestModel[] };
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9ccbd2');
scene.fog = new THREE.Fog('#9ccbd2', 30, 150);
const camera = new THREE.PerspectiveCamera(57, innerWidth / innerHeight, .1, 180);
camera.position.set(0, 5.4, 11.8);
camera.lookAt(0, .5, -16);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
scene.add(new THREE.HemisphereLight(0xd9f6ff, 0x354b54, 2.25));
const sun = new THREE.DirectionalLight(0xffe3bd, 2.1); sun.position.set(-8, 18, 7); scene.add(sun);

const mats = {
  asphalt: new THREE.MeshStandardMaterial({ color: 0x303941, roughness: .95 }),
  edge: new THREE.MeshStandardMaterial({ color: 0xd9e6dc, roughness: .8 }),
  lane: new THREE.MeshBasicMaterial({ color: 0xd6e4df }),
  ground: new THREE.MeshStandardMaterial({ color: 0x758d74, roughness: 1 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x11191d, roughness: .93 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x172c38, roughness: .25, metalness: .2 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8f3eb, roughness: .36, metalness: .12 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xc7fff4 }),
};
const world = new THREE.Group(); scene.add(world);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 260), mats.ground); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.15, -95); world.add(ground);

const SEGMENTS = 70;
const ROAD_LENGTH = 150;
const roadGeometry = new THREE.BufferGeometry();
const roadPositions = new Float32Array((SEGMENTS + 1) * 2 * 3);
const roadIndices: number[] = [];
for (let i = 0; i < SEGMENTS; i++) { const a = i * 2; roadIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
roadGeometry.setAttribute('position', new THREE.BufferAttribute(roadPositions, 3).setUsage(THREE.DynamicDrawUsage));
roadGeometry.setIndex(roadIndices);
const road = new THREE.Mesh(roadGeometry, mats.asphalt); road.frustumCulled = false; world.add(road);

const edgeGroup = new THREE.Group(); world.add(edgeGroup);
const edgeMarks: THREE.Mesh[] = [];
for (let i = 0; i < 44; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.13, .035, 1.05), mats.edge); edgeGroup.add(m); edgeMarks.push(m); }
const dashes: THREE.Mesh[] = [];
for (let i = 0; i < 19; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.11, .025, 2.5), mats.lane); world.add(m); dashes.push(m); }

const vehicleRoot = new THREE.Group(); scene.add(vehicleRoot);
vehicleRoot.position.set(0, .1, 2.4);
const vehicleVisual = new THREE.Group(); vehicleRoot.add(vehicleVisual);
const carModels = new Map<CarKind, THREE.Group>();
function box(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], rotation?: [number, number, number]) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); if (rotation) mesh.rotation.set(...rotation); mesh.castShadow = false; mesh.receiveShadow = false; parent.add(mesh); return mesh;
}
function makeFallbackCar(kind: CarKind): THREE.Group {
  const group = new THREE.Group();
  const color = kind === 'sport' ? 0xf04e48 : kind === 'classic' ? 0xf3bb58 : 0x62e1db;
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .28, metalness: .3 });
  const bodyShape = kind === 'classic' ? new THREE.BoxGeometry(1.52, .46, 2.95) : new THREE.BoxGeometry(kind === 'neo' ? 1.68 : 1.58, .43, kind === 'neo' ? 3.25 : 3.05);
  box(group, bodyShape, bodyMat, [0, .48, 0]);
  box(group, new THREE.BoxGeometry(1.17, .45, 1.35), mats.glass, [0, .87, -.15], [kind === 'classic' ? 0 : -.08, 0, 0]);
  box(group, new THREE.BoxGeometry(1.48, .1, .44), bodyMat, [0, .52, 1.14]);
  box(group, new THREE.BoxGeometry(.38, .12, .2), mats.lamp, [-.49, .54, -1.49]);
  box(group, new THREE.BoxGeometry(.38, .12, .2), mats.lamp, [.49, .54, -1.49]);
  const wheelGeo = new THREE.CylinderGeometry(.3, .3, .19, 10);
  for (const x of [-.82, .82]) for (const z of [-.93, .96]) { const wheel = box(group, wheelGeo, mats.tire, [x, .34, z], [0, 0, Math.PI / 2]); wheel.rotation.z = Math.PI / 2; }
  if (kind === 'neo') { box(group, new THREE.BoxGeometry(1.42, .06, .35), mats.white, [0, .93, .97]); }
  return group;
}
for (const kind of ['sport', 'classic', 'neo'] as const) carModels.set(kind, makeFallbackCar(kind));
let chosenCar: CarKind = 'sport';
function selectCar(kind: CarKind) { chosenCar = kind; vehicleVisual.clear(); vehicleVisual.add(carModels.get(kind)!.clone(true)); }
selectCar(chosenCar);

const roadside = new THREE.Group(); scene.add(roadside);
const roadsideItems: THREE.Group[] = [];
const assetPropPool: Array<{ group: THREE.Group; category: string; slot: number }> = [];
const propGeometries = {
  pillar: new THREE.BoxGeometry(.5, 4, .5), building: new THREE.BoxGeometry(1, 1, 1), trunk: new THREE.CylinderGeometry(.12, .2, 2.1, 5), foliage: new THREE.ConeGeometry(1.05, 2.7, 6), rock: new THREE.DodecahedronGeometry(.8, 0), orb: new THREE.IcosahedronGeometry(.52, 0),
};
const buildingMaterials = [0x586c7b, 0x76858b, 0x846d69, 0x657881].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .92 }));
const natureMaterials = [0x3e725a, 0x58835c, 0x829270].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
const futureMaterials = [0x496a83, 0x6e89a0, 0x52607c].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .45, metalness: .32 }));
function createProp(): THREE.Group {
  const g = new THREE.Group();
  const type = Math.random();
  if (type < .63) {
    const h = 5 + Math.random() * 13;
    const building = new THREE.Mesh(propGeometries.building, buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)]);
    building.scale.set(3.5 + Math.random() * 5, h, 3 + Math.random() * 3); building.position.y = h / 2 - .1; g.add(building);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffdc99 });
    for (let n = 0; n < 5; n++) { const w = new THREE.Mesh(new THREE.BoxGeometry(.15, .36, .03), windowMat); w.position.set((Math.random() - .5) * 2.7, .8 + Math.random() * (h - 1), building.scale.z * .51); g.add(w); }
  } else if (type < .87) {
    const trunk = new THREE.Mesh(propGeometries.trunk, new THREE.MeshStandardMaterial({ color: 0x634c3a, roughness: 1 })); trunk.position.y = 1; g.add(trunk);
    const tree = new THREE.Mesh(propGeometries.foliage, natureMaterials[Math.floor(Math.random() * natureMaterials.length)]); tree.position.y = 3; g.add(tree);
  } else {
    const rock = new THREE.Mesh(type > .95 ? propGeometries.orb : propGeometries.rock, futureMaterials[Math.floor(Math.random() * futureMaterials.length)]); rock.position.y = type > .95 ? 3.4 : .45; rock.scale.setScalar(type > .95 ? 2.1 : 1.1); g.add(rock);
    if (type > .95) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, .04, 4, 18), mats.lamp); ring.position.y = 3.4; ring.rotation.x = .8; g.add(ring); }
  }
  return g;
}
for (let i = 0; i < 30; i++) { const g = createProp(); roadside.add(g); roadsideItems.push(g); }

let phase: GamePhase = 'ready';
let elapsed = 0;
let distance = 0;
let roadShift = 0;
let shiftTarget = 0;
let nearMisses = 0;
let nearMissCooldown = 0;
let fallingTime = 0;
let lastFrame = performance.now();
let lastFpsTime = lastFrame;
let frameCounter = 0;
let fps = 0;
let toastTimer = 0;
let previousStage = 'CITY';
let appliedTheme = '';
let audioContext: AudioContext | null = null;
let engineOscillator: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let audioMuted = false;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const overlay = $('#overlay');
const overlayKicker = $('#overlay-kicker'); const overlayTitle = $('#overlay-title'); const overlayCopy = $('#overlay-copy');
const startButton = $('#start-button'); const startLabel = startButton.querySelector('span')!;
const timerLabel = $('#timer'); const progressFill = $('#progress-fill'); const nearLabel = $('#near-misses');
const stageLabel = $('#stage-label'); const toast = $('#toast'); const warning = $('#drop-warning');

function setOverlay(mode: 'start' | 'pause' | 'won' | 'lost') {
  overlay.classList.remove('hidden', 'paused');
  if (mode === 'start') { overlayKicker.textContent = 'A DIFFERENT KIND OF DRIVE'; overlayTitle.innerHTML = '道路を、<em>運転しろ。</em>'; overlayCopy.innerHTML = '車は自動で走り続ける。<br />道路を左右に動かして、落下から守ろう。'; $('#car-picker').style.display = ''; startLabel.textContent = 'ゲームスタート'; startButton.querySelector('b')!.textContent = '→'; }
  if (mode === 'pause') { overlay.classList.add('paused'); overlayKicker.textContent = 'TAKE A BREATHER'; overlayTitle.innerHTML = '一時<em>停止中</em>'; overlayCopy.innerHTML = '道路はそのまま。準備ができたら再開しよう。'; $('#car-picker').style.display = 'none'; startLabel.textContent = 'ゲーム再開'; startButton.querySelector('b')!.textContent = '→'; }
  if (mode === 'won') { overlayKicker.textContent = '60 SECONDS · SURVIVED'; overlayTitle.innerHTML = '走破<em>成功。</em>'; overlayCopy.innerHTML = `NEAR MISS ${String(nearMisses).padStart(2, '0')}回。<br />道路を最後まで走り抜いた。`; $('#car-picker').style.display = 'none'; startLabel.textContent = 'もう一度走る'; startButton.querySelector('b')!.textContent = '↻'; }
  if (mode === 'lost') { overlayKicker.textContent = 'ROAD ENDS HERE'; overlayTitle.innerHTML = '落下<em>した。</em>'; overlayCopy.innerHTML = `生存時間 ${Math.floor(elapsed)}秒 · NEAR MISS ${String(nearMisses).padStart(2, '0')}回<br />もう一度、道路をつないでみよう。`; $('#car-picker').style.display = 'none'; startLabel.textContent = 'リトライ'; startButton.querySelector('b')!.textContent = '↻'; }
}
function playTone(frequency = 660, duration = .16, type: OscillatorType = 'sine') {
  if (audioMuted) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(.0001, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.045, audioContext.currentTime + .015); gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + duration);
  } catch { /* Audio is an optional enhancement. */ }
}
function startEngine() {
  try {
    audioContext ??= new AudioContext(); if (audioContext.state === 'suspended') void audioContext.resume();
    if (engineOscillator) return;
    engineOscillator = audioContext.createOscillator(); engineGain = audioContext.createGain(); engineOscillator.type = 'sawtooth'; engineOscillator.frequency.value = 54;
    const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 120;
    engineGain.gain.value = .018; engineOscillator.connect(filter); filter.connect(engineGain); engineGain.connect(audioContext.destination); engineOscillator.start();
  } catch { /* Audio is an optional enhancement. */ }
}
function stopEngine() { if (engineOscillator) { try { engineOscillator.stop(); } catch { /* already stopped */ } engineOscillator.disconnect(); engineGain?.disconnect(); engineOscillator = null; engineGain = null; } }
function showToast(message: string) { toast.textContent = message; toast.classList.add('show'); toastTimer = .85; }
function beginRun() {
  if (phase === 'paused') { phase = 'playing'; overlay.classList.add('hidden'); startEngine(); return; }
  elapsed = 0; distance = 0; roadShift = 0; shiftTarget = 0; nearMisses = 0; nearMissCooldown = 0; fallingTime = 0; previousStage = 'CITY';
  timerLabel.textContent = '60'; progressFill.style.width = '0%'; nearLabel.textContent = '00'; vehicleRoot.position.set(0, .1, 2.4); vehicleRoot.rotation.set(0, 0, 0); vehicleVisual.rotation.set(0, 0, 0);
  phase = 'playing'; overlay.classList.add('hidden'); warning.classList.remove('show'); startEngine();
}
function togglePause() {
  if (phase === 'playing') { phase = 'paused'; stopEngine(); setOverlay('pause'); }
  else if (phase === 'paused') { phase = 'playing'; overlay.classList.add('hidden'); startEngine(); }
}
function setShift(dir: number) { if (phase !== 'playing') return; shiftTarget = THREE.MathUtils.clamp(shiftTarget + dir * 1.25, -4.8, 4.8); }
startButton.addEventListener('click', beginRun);
$('#pause-button').addEventListener('click', togglePause);
document.querySelectorAll<HTMLButtonElement>('.drive-button').forEach(button => {
  const dir = Number(button.dataset.direction);
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.classList.add('active'); button.setPointerCapture(event.pointerId); setShift(dir); });
  button.addEventListener('pointerup', () => button.classList.remove('active'));
  button.addEventListener('pointercancel', () => button.classList.remove('active'));
});
document.querySelectorAll<HTMLButtonElement>('.car-option').forEach(button => button.addEventListener('click', () => {
  if (phase !== 'ready') return;
  document.querySelector('.car-option.selected')?.classList.remove('selected'); button.classList.add('selected'); selectCar(button.dataset.car as CarKind);
}));
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (event.repeat && ['a', 'd', 'arrowleft', 'arrowright'].includes(key)) return;
  if (['arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'a' || key === 'arrowleft') setShift(-1);
  if (key === 'd' || key === 'arrowright') setShift(1);
  if (key === 'escape' || key === 'p') togglePause();
  if (key === 'm') { audioMuted = !audioMuted; if (audioMuted) stopEngine(); else if (phase === 'playing') startEngine(); }
});
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.35 : 1.65)); renderer.setSize(innerWidth, innerHeight); });

const loader = new GLTFLoader();
const gltfCache = new Map<string, Promise<THREE.Group>>();
function loadSharedModel(file: string): Promise<THREE.Group> {
  let cached = gltfCache.get(file);
  if (!cached) { cached = new Promise((resolve, reject) => loader.load(file, data => resolve(data.scene), undefined, reject)); gltfCache.set(file, cached); }
  return cached;
}
async function loadOptionalAssets() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/manifest.json`);
    if (!response.ok) return;
    const manifest = await response.json() as AssetManifest;
    const models = manifest.models ?? [];
    const vehicles = models.filter(model => model.category === 'vehicle');
    for (const item of vehicles.slice(0, 3)) {
      try {
        const root = await loadSharedModel(`${import.meta.env.BASE_URL}${item.file}`);
        const bounds = new THREE.Box3().setFromObject(root); const size = bounds.getSize(new THREE.Vector3());
        if (size.y < 1e-4 || !Number.isFinite(size.x)) continue;
        root.scale.setScalar(3.1 / Math.max(size.x, size.y, size.z));
        root.position.sub(bounds.getCenter(new THREE.Vector3()).multiplyScalar(root.scale.x));
        const kind: CarKind = vehicles.indexOf(item) === 1 ? 'classic' : vehicles.indexOf(item) === 2 ? 'neo' : 'sport';
        carModels.set(kind, root); if (chosenCar === kind) selectCar(kind);
      } catch { /* Keep procedural vehicle if a bundled model is missing or broken. */ }
    }
    const scenery = models.filter(model => model.category !== 'vehicle').slice(0, 8);
    for (const [assetIndex, item] of scenery.entries()) {
      try {
        const source = await loadSharedModel(`${import.meta.env.BASE_URL}${item.file}`);
        const bounds = new THREE.Box3().setFromObject(source); const size = bounds.getSize(new THREE.Vector3());
        if (size.y < 1e-4 || !Number.isFinite(size.x)) continue;
        const normalizedScale = 4 / size.y;
        for (let copy = 0; copy < 2; copy++) {
          const group = source.clone(true); group.scale.setScalar(normalizedScale); group.position.y -= bounds.min.y * normalizedScale;
          roadside.add(group); assetPropPool.push({ group, category: item.category.toLowerCase(), slot: assetIndex * 2 + copy });
        }
      } catch { /* Keep procedural scenery if a bundled model is missing or broken. */ }
    }
  } catch { /* The static manifest is optional; procedural art keeps the game playable. */ }
}
void loadOptionalAssets();

function themeColors(stage: string) {
  if (stage === 'NATURE') return { sky: 0x9bbd9b, fog: 0x9bbd9b, ground: 0x587c5d, asphalt: 0x343f38, edge: 0xd9dfbe, accent: 0xe4c878 };
  if (stage === 'FUTURE') return { sky: 0x334f68, fog: 0x405a70, ground: 0x28374b, asphalt: 0x242e3a, edge: 0x81e8e1, accent: 0x63e6e2 };
  return { sky: 0x9ccbd2, fog: 0x9ccbd2, ground: 0x758d74, asphalt: 0x303941, edge: 0xd9e6dc, accent: 0xc7fff4 };
}
function updateRoad() {
  const positions = roadGeometry.attributes.position.array as Float32Array;
  const width = roadHalfWidth(elapsed);
  for (let i = 0; i <= SEGMENTS; i++) {
    const z = 9 - (i / SEGMENTS) * ROAD_LENGTH;
    const worldDistance = distance + (9 - z);
    const center = roadShift + roadCenterAt(worldDistance, elapsed);
    const localWidth = width * (1 - .08 * (1 - i / SEGMENTS));
    const p = i * 6;
    positions[p] = center - localWidth; positions[p + 1] = -.035; positions[p + 2] = z;
    positions[p + 3] = center + localWidth; positions[p + 4] = -.035; positions[p + 5] = z;
  }
  roadGeometry.attributes.position.needsUpdate = true; roadGeometry.computeVertexNormals();
  for (let i = 0; i < dashes.length; i++) {
    const z = 7 - ((i * 8 + distance * 1.8) % 150);
    const c = roadShift + roadCenterAt(distance + 7 - z, elapsed);
    dashes[i].position.set(c, .005, z); dashes[i].visible = Math.sin((distance + i * 8) * .2) > -.83;
  }
  for (let i = 0; i < edgeMarks.length; i++) {
    const segment = Math.floor(i / 2); const side = i % 2 === 0 ? -1 : 1;
    const z = 7 - ((segment * 3.2 + distance * 1.8) % 150);
    const c = roadShift + roadCenterAt(distance + 7 - z, elapsed);
    edgeMarks[i].position.set(c + side * (width - .12), .015, z);
    edgeMarks[i].rotation.y = Math.atan2(roadCenterAt(distance + 8 - z, elapsed) - roadCenterAt(distance + 6 - z, elapsed), 2);
    edgeMarks[i].visible = segment % 2 === Math.floor((distance * 1.8) % 2);
  }
}
function updateProps() {
  const width = roadHalfWidth(elapsed);
  for (let i = 0; i < roadsideItems.length; i++) {
    const item = roadsideItems[i]; const row = Math.floor(i / 2); const side = i % 2 === 0 ? -1 : 1;
    const z = 5 - ((row * 10 + distance * 1.8) % 148);
    const center = roadShift + roadCenterAt(distance + 5 - z, elapsed);
    const scale = .75 + (Math.sin(row * 2.83) + 1) * .38;
    item.position.set(center + side * (width + 5.7 + (row % 3) * 1.7), 0, z); item.scale.setScalar(scale);
    item.rotation.y = (side < 0 ? 1 : -1) * .08;
    item.visible = z > -136 && z < 15;
    item.traverse(object => { if (object instanceof THREE.Mesh) {
      if (object.geometry === propGeometries.building) object.visible = previousStage === 'CITY';
      if (object.geometry === propGeometries.trunk || object.geometry === propGeometries.foliage) object.visible = previousStage === 'NATURE';
      if (object.geometry === propGeometries.rock || object.geometry === propGeometries.orb || object.geometry instanceof THREE.TorusGeometry) object.visible = previousStage === 'FUTURE';
    } });
  }
  for (const { group, category, slot } of assetPropPool) {
    const stage = category.includes('nature') || category.includes('tree') || category.includes('rock') ? 'NATURE'
      : category.includes('future') || category.includes('space') || category.includes('sci-fi') ? 'FUTURE' : 'CITY';
    const row = Math.floor(slot / 2); const side = slot % 2 === 0 ? -1 : 1;
    const z = 5 - ((row * 13 + distance * 1.8) % 148);
    const center = roadShift + roadCenterAt(distance + 5 - z, elapsed);
    group.position.x = center + side * (width + 6.5); group.position.z = z;
    group.visible = z > -136 && z < 15 && previousStage === stage;
  }
}
function update(dt: number) {
  if (phase === 'playing') {
    const time = advanceElapsed(elapsed, dt); elapsed = time.elapsed; distance += dt * 25;
    const stage = stageAt(elapsed); stageLabel.textContent = stage;
    if (stage !== previousStage) { previousStage = stage; showToast(stage); playTone(stage === 'NATURE' ? 523 : 784, .28); }
    if (stage !== appliedTheme) {
      const colors = themeColors(stage); scene.background = new THREE.Color(colors.sky); scene.fog = new THREE.Fog(colors.fog, 30, 150);
      mats.ground.color.setHex(colors.ground); mats.asphalt.color.setHex(colors.asphalt); mats.edge.color.setHex(colors.edge); mats.lane.color.setHex(colors.edge); appliedTheme = stage;
    }
    roadShift = THREE.MathUtils.damp(roadShift, shiftTarget, 4.8, dt);
    const width = roadHalfWidth(elapsed); const lateral = roadShift + roadCenterAt(distance, elapsed);
    const safe = isOnRoad(lateral, width);
    warning.classList.toggle('show', !safe);
    if (safe && isNearMiss(lateral, width) && nearMissCooldown <= 0) {
      nearMisses++; nearLabel.textContent = String(nearMisses).padStart(2, '0'); nearMissCooldown = .85; showToast('NEAR MISS'); playTone(880, .13, 'triangle');
    }
    nearMissCooldown = Math.max(0, nearMissCooldown - dt);
    if (!safe) { phase = 'falling'; fallingTime = 0; stopEngine(); playTone(155, .42, 'sawtooth'); warning.classList.remove('show'); }
    timerLabel.textContent = String(Math.max(0, Math.ceil(GAME_DURATION - elapsed))).padStart(2, '0'); progressFill.style.width = `${Math.min(100, elapsed / GAME_DURATION * 100)}%`;
    if (time.cleared && phase === 'playing') { phase = 'won'; stopEngine(); playTone(740, .4); setOverlay('won'); }
  } else if (phase === 'falling') {
    fallingTime += dt; vehicleRoot.position.y -= dt * (1.4 + fallingTime * 3.3); vehicleRoot.position.z += dt * 1.3; vehicleRoot.rotation.z += dt * 1.8;
    if (fallingTime > 1.15) { phase = 'lost'; setOverlay('lost'); }
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toast.classList.remove('show'); }
  vehicleVisual.position.y = Math.sin(performance.now() * .006) * .025;
  vehicleVisual.rotation.z = THREE.MathUtils.damp(vehicleVisual.rotation.z, phase === 'playing' ? -((shiftTarget - roadShift) * .035) : 0, 5, dt);
  updateRoad(); updateProps();
  camera.position.x = THREE.MathUtils.damp(camera.position.x, roadShift * .15, 1.5, dt); camera.lookAt(0, .5, -16);
}
function animate(now: number) {
  requestAnimationFrame(animate);
  const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  update(dt); renderer.render(scene, camera);
  frameCounter++;
    if (now - lastFpsTime > 500) { fps = Math.round(frameCounter * 1000 / (now - lastFpsTime)); frameCounter = 0; lastFpsTime = now; $('#telemetry').innerHTML = `${fps} FPS&nbsp; · &nbsp;${renderer.info.render.calls} DRAWS&nbsp; · &nbsp;${renderer.info.render.triangles.toLocaleString()} TRIANGLES`; }
}
requestAnimationFrame(animate);
window.addEventListener('beforeunload', () => { stopEngine(); renderer.dispose(); roadGeometry.dispose(); for (const model of gltfCache.values()) void model.then(root => root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()); } })); });
