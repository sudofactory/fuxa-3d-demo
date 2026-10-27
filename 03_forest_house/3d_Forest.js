/**
 * 3d_Forest.js
 * Episode 3, first script: a GLB model from Sketchfab shown in a FUXA view.
 *   - The model file sits in FUXA's _widgets folder, so MODEL_URL is just /_widgets/<file>.glb
 *   - Drag to orbit, mouse wheel to zoom. No tags yet: that is the second script (3d_Forest_Lights.js)
 * Model: "Forest-sided, a peaceful place to live: Diorama" by CleuzaCosta (CC BY 4.0), Sketchfab.
 */

// ==========================================
// 1. Settings
// ==========================================
const PLACEHOLDER_ID = 'forest_3d';                       // Name of the placeholder rectangle in FUXA
const MODEL_URL      = '/_widgets/forest_diorama.glb';    // FUXA serves the _widgets folder at /_widgets
const MODEL_CREDIT   = 'Model: Forest-sided, a peaceful place to live by CleuzaCosta (CC BY 4.0)';
const MODEL_SIZE     = 12;                                // The model's longest side is scaled to this many units
// The model's opening camera on Sketchfab, in the model's own units (options → camera; Z-up → (x, z, −y))
const START_VIEW     = { eye: [1361.8, 3330.4, 2723.8], target: [10.3, 925.3, -404.5], fov: 45 };

// three.js and its GLTF loader: FUXA's _widgets folder first (works without internet), then the CDN, pinned by its SHA-384 hash (SRI)
const THREE_SOURCES = [
    { src: '/_widgets/three.min.js' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      integrity: 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu' },
];
const GLTF_LOADER_SOURCES = [
    { src: '/_widgets/GLTFLoader.js' },
    { src: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
      integrity: 'sha384-fljlqkjWlmSFjkESkQvm77heIZpoWmXEOzlCA7kOpGUH+95Zk0yGfQieWM2q136E' },
];

// Helper: load a library once, trying each source in turn; isReady() tells whether it is already there.
// A source that fails is removed again, so the next open retries instead of finding a dead <script> tag
const loadScript = (sources, isReady) => {
    if (isReady()) return Promise.resolve();
    const loads = window.__fuxa3dLoads = window.__fuxa3dLoads || {};
    const key = sources[0].src;
    if (!loads[key]) {
        const tryFrom = (i) => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = sources[i].src;
            if (sources[i].integrity) { s.integrity = sources[i].integrity; s.crossOrigin = 'anonymous'; }
            s.onload = () => { if (isReady()) return resolve(); s.remove(); reject(new Error('not the library: ' + s.src)); };
            s.onerror = () => { s.remove(); reject(new Error('failed to load ' + s.src)); };
            document.head.appendChild(s);
        }).catch((err) => i + 1 < sources.length ? tryFrom(i + 1) : Promise.reject(err));
        loads[key] = tryFrom(0).finally(() => { delete loads[key]; });
    }
    return loads[key];
};

// ══════════════════════════════════════════════════════════════
// Find the DOM element of the named rectangle in the FUXA view (same as episodes 1 and 2)
// ══════════════════════════════════════════════════════════════
const findPlaceholderElement = () => {
    let el = document.querySelector(`[data-name="${PLACEHOLDER_ID}"]`);
    if (el) return el;
    el = document.getElementById(PLACEHOLDER_ID);
    if (el) return el;
    for (const e of document.querySelectorAll('[id^="svg_"], [id^="SHE_"], [id^="HXT_"]')) {
        const title = e.querySelector('title');
        if (title && title.textContent.trim() === PLACEHOLDER_ID) return e;
    }
    return null;
};

const waitForPlaceholder = (isCancelled, timeoutMs = 8000, intervalMs = 200) =>
    new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            if (isCancelled()) { resolve(null); return; }
            const el = findPlaceholderElement();
            if (el) { resolve(el); return; }
            if (Date.now() - start >= timeoutMs) {
                console.warn(`[Forest3D] 等待 ${timeoutMs}ms 後仍找不到 "${PLACEHOLDER_ID}"，不建立 3D 畫面`);
                resolve(null); return;
            }
            setTimeout(check, intervalMs);
        };
        setTimeout(check, 300);
    });

const initForest = async () => {
    let isDestroyed = false;
    let renderer = null, camera = null;
    console.log('[Forest3D] 初始化開始...');

    // On reopen, destroy the previous instance first (no leftover render loops or WebGL contexts)
    if (window.destroyForest3D) { try { window.destroyForest3D(); } catch (e) {} }
    const oldContainer = document.getElementById('forest-3d-container');
    if (oldContainer) oldContainer.remove();

    // While starting up, closing the view only has to stop the start-up; cleanup() takes over once the scene exists
    const cancelStartup = () => { isDestroyed = true; };
    const stopStartup = () => { if (window.destroyForest3D === cancelStartup) window.destroyForest3D = null; };
    window.destroyForest3D = cancelStartup;

    // ==========================================
    // 2. Placeholder rectangle + three.js -> container overlaid on the rectangle
    // ==========================================
    const placeholder = await waitForPlaceholder(() => isDestroyed);
    // No rectangle, no 3D: a floating view would cover every other view and never clean itself up
    if (isDestroyed || !placeholder) return stopStartup();

    // Load three.js before anything is added to the page, so a failed load leaves nothing behind
    try {
        await loadScript(THREE_SOURCES, () => !!window.THREE);
        await loadScript(GLTF_LOADER_SOURCES, () => !!(window.THREE && window.THREE.GLTFLoader));
    } catch (err) {
        console.error('[Forest3D] three.js / GLTFLoader 載入失敗:', err);
        return stopStartup();
    }
    if (isDestroyed || !document.body.contains(placeholder)) return stopStartup();   // the view closed while loading
    const THREE = window.THREE;

    const initRect = placeholder.getBoundingClientRect();
    placeholder.style.visibility = 'hidden';

    const container = document.createElement('div');
    container.id = 'forest-3d-container';
    Object.assign(container.style, {
        position: 'fixed', left: initRect.left + 'px', top: initRect.top + 'px',
        width: initRect.width + 'px', height: initRect.height + 'px',
        zIndex: '10', overflow: 'hidden', pointerEvents: 'none', background: '#141414',
    });
    const mountNode = placeholder.closest('app-fuxa-view') || document.body;
    mountNode.appendChild(container);

    // Loading overlay + credit line (plain DOM inside the container)
    const overlay = document.createElement('div');
    Object.assign(overlay.style, { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#cfd8ff', font: '16px system-ui, sans-serif', letterSpacing: '0.05em', pointerEvents: 'none' });
    overlay.textContent = 'Loading model…';
    container.appendChild(overlay);
    const credit = document.createElement('div');
    Object.assign(credit.style, { position: 'absolute', left: '10px', bottom: '8px', color: 'rgba(207,216,255,0.55)', font: '11px system-ui, sans-serif', pointerEvents: 'none' });
    credit.textContent = MODEL_CREDIT;
    container.appendChild(credit);

    // Keep the container on the rectangle when the window or canvas is resized, or the view scrolls
    const updateContainerPosition = () => {
        const rect = placeholder.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        Object.assign(container.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
        // Clip what sticks out of the view, so FUXA's own bars stay clickable
        const vr = (placeholder.closest('app-fuxa-view') || document.body).getBoundingClientRect();
        const cT = Math.max(0, vr.top - rect.top), cL = Math.max(0, vr.left - rect.left);
        const cR = Math.max(0, rect.right - vr.right), cB = Math.max(0, rect.bottom - vr.bottom);
        container.style.clipPath = (cT || cL || cR || cB) ? `inset(${cT}px ${cR}px ${cB}px ${cL}px)` : 'none';
        if (!renderer || !camera) return;
        renderer.setSize(rect.width, rect.height);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', updateContainerPosition);
    window.addEventListener('scroll', updateContainerPosition, true);   // true: also scrolls inside the FUXA view
    let mo = null;
    const svgEl = placeholder.closest('svg');
    if (svgEl) { mo = new MutationObserver(updateContainerPosition); mo.observe(svgEl, { attributes: true, subtree: false }); }

    // ==========================================
    // 3. three.js: renderer and lighting
    // ==========================================
    const scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(START_VIEW.fov, initRect.width / initRect.height, 0.1, 500);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(initRect.width, initRect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;          // GLTF textures are sRGB
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.pointerEvents = 'auto';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.filter = 'saturate(1.25)';   // Sketchfab's own setting for this model boosts saturation (~1.29)
    container.insertBefore(renderer.domElement, overlay);

    // ==========================================
    // 3b. The look of the model's Sketchfab page: charcoal backdrop, neutral studio light
    // ==========================================
    // Backdrop: a soft radial gradient, lighter in the middle (like the Sketchfab viewer)
    scene.background = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 512;
        const x = c.getContext('2d'), g = x.createRadialGradient(256, 230, 20, 256, 256, 380);
        g.addColorStop(0, '#3a3a3a'); g.addColorStop(1, '#141414');
        x.fillStyle = g; x.fillRect(0, 0, 512, 512);
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    })();
    // Image-based lighting: Sketchfab lights the model with an environment map, so every material picks up light from all
    // directions. Without one, PBR materials only see our few lights and look dull. A neutral grey "studio" sphere with one
    // bright spot (the sun), turned into an environment map by PMREM, does the same job offline.
    const envTex = (() => {
        const pm = new THREE.PMREMGenerator(renderer);
        const room = new THREE.Scene();
        const g = new THREE.SphereGeometry(50, 32, 16), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
        const top = new THREE.Color(0xf2f2f2), hor = new THREE.Color(0xb8b4ae), gnd = new THREE.Color(0x4a443e);
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i) / 50;
            const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.7)) : hor.clone().lerp(gnd, Math.pow(-y, 0.5));
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        room.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
        const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 14, 13) }));
        sun.position.set(-20, 30, 22); room.add(sun);
        const t = pm.fromScene(room, 0.04).texture;
        pm.dispose(); g.dispose();
        return t;
    })();
    scene.environment = envTex;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5a5048, 0.6);
    scene.add(hemi);
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.6);   // key light from the upper left, casts the soft shadows
    sunLight.position.set(-12, 26, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
    scene.add(sunLight);

    // ==========================================
    // 4. Load the model, then hang the strings on it
    // ==========================================
    let model = null, modelScale = 1;

    new THREE.GLTFLoader().load(MODEL_URL, (gltf) => {
        if (isDestroyed) return;
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        modelScale = MODEL_SIZE / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(modelScale);
        model.position.set(-center.x * modelScale, -box.min.y * modelScale, -center.z * modelScale);
        model.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = o.receiveShadow = true;
            // Leaf cards and other alpha-blended planes would cast solid rectangular shadows that blanket the island: no shadows for them
            if (o.material && o.material.transparent) { o.castShadow = false; o.receiveShadow = false; }
            if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = 0.35;   // stronger reflections turn the glossy black roofs grey (Sketchfab keeps them near-black)
        });
        scene.add(model);
        model.updateMatrixWorld(true);
        // open on the same view as the model's Sketchfab page
        const eye = model.localToWorld(new THREE.Vector3(...START_VIEW.eye));
        target.copy(model.localToWorld(new THREE.Vector3(...START_VIEW.target)));
        const off = eye.sub(target);
        view.radius = off.length(); view.phi = Math.acos(off.y / view.radius); view.theta = Math.atan2(off.x, off.z);
        updateCamera();
        overlay.remove();
    }, (e) => {
        if (e.total) overlay.textContent = 'Loading model… ' + Math.round(e.loaded / e.total * 100) + '%';
    }, (err) => {
        console.error('[Forest3D] 模型載入失敗:', MODEL_URL, err);
        overlay.textContent = 'Model not found: ' + MODEL_URL;
    });

    // ==========================================
    // 5. Mouse: drag to orbit / wheel to zoom
    // ==========================================
    const target = new THREE.Vector3(0, MODEL_SIZE * 0.3, 0);
    const view = { radius: MODEL_SIZE * 2.1, theta: Math.PI / 4, phi: 1.12 };   // start: 3/4 view from a little above; the island fills the frame, tree tops may be cut
    const updateCamera = () => {
        view.phi = Math.min(Math.max(view.phi, 0.15), Math.PI / 2 - 0.05);
        view.radius = Math.min(Math.max(view.radius, 5), 60);
        camera.position.set(
            target.x + view.radius * Math.sin(view.phi) * Math.sin(view.theta),
            target.y + view.radius * Math.cos(view.phi),
            target.z + view.radius * Math.sin(view.phi) * Math.cos(view.theta));
        camera.lookAt(target);
    };
    updateCamera();

    let drag = null;
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        drag = { lastX: e.clientX, lastY: e.clientY };
        renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!drag) { renderer.domElement.style.cursor = 'grab'; return; }
        view.theta -= (e.clientX - drag.lastX) * 0.008;
        view.phi -= (e.clientY - drag.lastY) * 0.008;
        drag.lastX = e.clientX; drag.lastY = e.clientY;
        updateCamera();
        renderer.domElement.style.cursor = 'grabbing';
    };
    const onPointerUp = (e) => {
        drag = null;
        if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e) => { e.preventDefault(); view.radius *= e.deltaY > 0 ? 1.1 : 0.9; updateCamera(); };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ==========================================
    // 6. Render loop
    // ==========================================
    // Liveness check: switching views / entering edit mode removes or hides the placeholder (width 0), so everything is
    // released even when the view has no close script. Checked every frame, and once a second by a timer as well,
    // because the browser pauses requestAnimationFrame while the tab is in the background
    const placeholderGone = () => !document.body.contains(placeholder) || placeholder.getBoundingClientRect().width === 0;
    const releaseIfGone = () => {
        if (isDestroyed || !placeholderGone()) return false;
        console.log('[Forest3D] 偵測到佔位元素消失或隱藏，自動執行銷毀...');
        cleanup();
        return true;
    };
    const watchdog = setInterval(releaseIfGone, 1000);

    let animationId = null;
    const animate = () => {
        if (isDestroyed || releaseIfGone()) return;
        animationId = requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };
    animate();

    // ==========================================
    // 7. Release resources (called by the FUXA close script)
    // ==========================================
    function cleanup() {
        if (isDestroyed) return;
        console.log('[Forest3D] 執行 destroy (關閉畫面清理資源)...');
        isDestroyed = true;
        if (animationId) cancelAnimationFrame(animationId);
        clearInterval(watchdog);
        window.removeEventListener('resize', updateContainerPosition);
        window.removeEventListener('scroll', updateContainerPosition, true);
        if (mo) mo.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        if (container && container.parentNode) container.parentNode.removeChild(container);
        placeholder.style.visibility = '';
        if (scene.background && scene.background.isTexture) scene.background.dispose();
        scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            const mats = Array.isArray(object.material) ? object.material : [object.material];
            mats.forEach((m) => { if (!m) return; Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
        });
        if (envTex) envTex.dispose();
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
        if (window.destroyForest3D === cleanup) window.destroyForest3D = null;
    }
    window.destroyForest3D = cleanup;

};

// Start
initForest().catch(err => console.error('[Forest3D] 初始化失敗:', err));
