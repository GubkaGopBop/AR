import * as THREE from './vendor/three.module.js';
import { applyHitPose, placeObject } from './placement.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.01, 30);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x52647a, 3));
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(2, 4, 3);
scene.add(light);

// Geometry starts at y=0 so its bottom touches the detected plane.
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(0, 0.1, 0),
  new THREE.MeshStandardMaterial({ color: 0x367bea, roughness: 0.55 })
);
cube.matrixAutoUpdate = false;
cube.visible = false;
scene.add(cube);
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.115, 0.14, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x22bc91, side: THREE.DoubleSide })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let session = null;
let hitTestSource = null;
let preview = false;
let supported = false;
let starting = false;
let angle = 0.65;
let dragging = false;
let lastX = 0;
let trackingError = false;

function status(text) {
  if ($('status').textContent !== text) $('status').textContent = text;
}
function showError(text) {
  $('error').textContent = text;
  $('error').hidden = !text;
}
function controls() {
  $('place').disabled = !reticle.visible || cube.visible;
  $('place').hidden = preview || cube.visible;
  $('reset').hidden = preview || !cube.visible;
}
function place() {
  if (!session || !renderer.xr.isPresenting || session.visibilityState !== 'visible') return;
  if (placeObject(cube, reticle)) {
    status('Куб размещён. Обойдите его и посмотрите с разных сторон.');
    controls();
  }
}
function cleanup(endedSession) {
  if (session !== endedSession) return;
  hitTestSource?.cancel();
  hitTestSource = null;
  session = null;
  cube.visible = false;
  reticle.visible = false;
  document.body.classList.remove('ar');
  $('intro').hidden = false;
  $('hud').hidden = true;
  $('start').disabled = !supported;
  $('preview').disabled = false;
  starting = false;
  controls();
}

async function startAR() {
  if (session || starting) return;
  starting = true;
  $('start').disabled = true;
  $('preview').disabled = true;
  showError('');
  let requestedSession;
  try {
    // Called directly from the button click to preserve user activation.
    requestedSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local-floor'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: $('overlay') }
    });
    session = requestedSession;
    session.addEventListener('end', () => cleanup(requestedSession), { once: true });
    session.addEventListener('select', place);
    session.addEventListener('visibilitychange', () => {
      reticle.visible = false;
      controls();
    });
    const viewerSpace = await session.requestReferenceSpace('viewer');
    const source = await session.requestHitTestSource({ space: viewerSpace, entityTypes: ['plane'] });
    if (session !== requestedSession) { source.cancel(); return; }
    hitTestSource = source;
    await renderer.xr.setSession(session);
    if (session !== requestedSession) return;
    trackingError = false;
    cube.visible = false;
    document.body.classList.add('ar');
    $('intro').hidden = true;
    $('hud').hidden = false;
    $('mode').textContent = 'ДОПОЛНЕННАЯ РЕАЛЬНОСТЬ';
    status('Наведите телефон на пол или стол и медленно двигайте его.');
    controls();
  } catch (error) {
    if (requestedSession) {
      await requestedSession.end().catch(() => {});
      cleanup(requestedSession);
    }
    const messages = {
      NotAllowedError: 'Доступ к AR не разрешён. Разрешите его в браузере и повторите.',
      NotSupportedError: 'Устройство не поддерживает AR с поиском плоскостей и local-floor.',
      SecurityError: 'Откройте страницу по HTTPS или на localhost и разрешите доступ к AR.',
      InvalidStateError: 'Закройте другую AR-сессию и повторите запуск.'
    };
    showError(messages[error.name] || 'Не удалось начать AR. Проверьте поддержку устройства и повторите.');
  } finally {
    starting = false;
    $('start').disabled = Boolean(session) || !supported;
    $('preview').disabled = Boolean(session);
  }
}

function reset() {
  cube.visible = false;
  reticle.visible = false;
  trackingError = false;
  status('Найдите новое место. Дождитесь появления кольца.');
  controls();
}
function startPreview() {
  if (session || starting) return;
  preview = true;
  showError('');
  document.body.classList.add('preview');
  $('intro').hidden = true;
  $('hud').hidden = false;
  $('mode').textContent = 'ПРОСМОТР БЕЗ КАМЕРЫ';
  status('Куб 20 × 20 × 20 см. Проведите по экрану, чтобы повернуть вид.');
  cube.matrix.identity();
  cube.matrixWorldNeedsUpdate = true;
  cube.visible = true;
  scene.background = new THREE.Color(0xeef3f8);
  controls();
}
async function exit() {
  if (session) {
    try { await session.end(); } catch { showError('Не удалось выйти. Используйте кнопку выхода из AR в браузере.'); }
  } else {
    preview = false;
    cube.visible = false;
    scene.background = null;
    document.body.classList.remove('preview');
    $('intro').hidden = false;
    $('hud').hidden = true;
  }
}

$('start').addEventListener('click', startAR);
$('preview').addEventListener('click', startPreview);
$('place').addEventListener('click', place);
$('reset').addEventListener('click', reset);
$('exit').addEventListener('click', exit);
// UI actions must not also produce an XR select and accidentally place a cube.
$('overlay').addEventListener('beforexrselect', event => {
  if (event.target.closest('button, #intro')) event.preventDefault();
});
renderer.domElement.addEventListener('pointerdown', event => {
  if (!preview) return;
  dragging = true;
  lastX = event.clientX;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', event => {
  if (!preview || !dragging) return;
  angle -= (event.clientX - lastX) * 0.01;
  lastX = event.clientX;
});
for (const event of ['pointerup', 'pointercancel']) renderer.domElement.addEventListener(event, () => { dragging = false; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (!renderer.xr.isPresenting) renderer.setSize(innerWidth, innerHeight);
});
addEventListener('pagehide', () => { if (session) session.end().catch(() => {}); });

renderer.setAnimationLoop((time, frame) => {
  if (frame && session && hitTestSource) {
    reticle.visible = false;
    if (session.visibilityState === 'visible') {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const viewerPose = referenceSpace && frame.getViewerPose(referenceSpace);
      if (!viewerPose) {
        status('Отслеживание потеряно. Медленно наведите телефон на знакомое место.');
      } else if (cube.visible) {
        status('Куб размещён. Обойдите его и посмотрите с разных сторон.');
      } else if (!trackingError) {
        try {
          const results = frame.getHitTestResults(hitTestSource);
          const pose = results.length ? results[0].getPose(referenceSpace) : null;
          applyHitPose(reticle, pose);
          status(pose ? 'Место найдено. Коснитесь экрана или нажмите «Поставить куб».' : 'Ищем поверхность. Медленно двигайте телефон над полом или столом.');
        } catch {
          trackingError = true;
          status('Поиск поверхности недоступен. Выйдите и начните AR снова.');
        }
      }
    }
    controls();
  }
  if (preview) {
    camera.position.set(Math.sin(angle) * 0.65, 0.42, Math.cos(angle) * 0.65);
    camera.lookAt(0, 0.1, 0);
  }
  renderer.render(scene, camera);
});

async function checkSupport() {
  if (!isSecureContext) {
    $('support').textContent = 'Для AR откройте страницу по HTTPS. На компьютере подходит localhost.';
    return;
  }
  if (!navigator.xr) {
    $('support').textContent = 'В этом браузере AR недоступна. Откройте страницу на совместимом телефоне.';
    return;
  }
  try {
    supported = await navigator.xr.isSessionSupported('immersive-ar');
    $('support').textContent = supported ? 'AR доступна. Можно начинать.' : 'Устройство не поддерживает AR. Доступен просмотр куба без камеры.';
    $('start').disabled = !supported;
  } catch {
    $('support').textContent = 'Не удалось проверить AR. Проверьте настройки браузера.';
  }
}
checkSupport();
