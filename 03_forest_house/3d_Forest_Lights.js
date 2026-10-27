/**
 * 3d_Forest_Lights.js
 * Episode 3, second script: the forest house model with LED string lights in three groups.
 * Each group is bound to one A-1855 output (DO0 / DO1 / DO2) through a FUXA tag:
 *   - Click any string: its group's output toggles (and the whole group lights up or goes dark)
 *   - The script reads the three tags every 0.5 s, so the lights follow whoever switched the output
 *
 * Controls: drag on empty space to orbit, mouse wheel to zoom.
 * Model: "Forest-sided, a peaceful place to live: Diorama" by CleuzaCosta (CC BY 4.0), Sketchfab.
 */

// ==========================================
// 1. Settings
// ==========================================
const PLACEHOLDER_ID = 'forest_3d';                       // Name of the placeholder rectangle in FUXA
const MODEL_URL      = '/_widgets/forest_diorama.glb';    // FUXA serves the _widgets folder at /_widgets
const MODEL_CREDIT   = 'Model: Forest-sided, a peaceful place to live by CleuzaCosta (CC BY 4.0)';
const MODEL_SIZE     = 12;                                // The model's longest side is scaled to this many units
const BRIGHTNESS     = 1.0;                               // Model lighting at start (the slider top right goes 0.2 – 1.5; LEDs are not affected)

// Three light groups, each bound to one FUXA tag (A-1855 Coil Status 17 / 18 / 19 = DO0 / DO1 / DO2)
const OUTPUTS = {
    house: 'led_DO0',   // roof ridge, eaves, shed roof, umbrella rim, deck railing
    dock:  'led_DO1',   // the lamps on the dock posts
    trees: 'led_DO2',   // the trunk spirals
};
const POLL_MS = 500;              // How often the tags are read
const WRITE_TIMEOUT_MS = 3000;    // After a click, wait up to this long for FUXA to report the new value

const LED_COLOR   = 0xffb760;     // warm white
const LED_SPACING = 0.18;         // distance between bulbs (world units)

// Where the strings hang. Coordinates are in the model's own units (measured with tools/layout.html).
//   points: hooks the cable runs through     circle: a ring (umbrella rim)
//   spiral: a helix around a trunk axis      lamp:   one big bulb (dock posts)
const STRINGS = [
    { name: 'Roof slope E', group: 'house', closed: true, points: [[181.5, 893.2, -532.4], [-137.8, 1456.4, -602.5], [-308.9, 1456.4, 177.2], [10.3, 893.2, 247.3]] },
    { name: 'Roof slope W', group: 'house', closed: true, points: [[-671.4, 894.4, 97.6], [-353.9, 1456.4, 167.3], [-184.0, 1456.4, -606.7], [-501.5, 894.4, -676.4]] },
    { name: 'Annex roof 2', group: 'house', closed: true, points: [[-232.0, 1390.8, -404.4], [-205.6, 1244.3, -524.6], [-962.0, 1244.3, -691.2], [-940.9, 1390.8, -560.1]] },
    { name: 'Annex roof 3', group: 'house', closed: true, points: [[-271.3, 1446.2, -225.6], [-980.2, 1451.6, -381.2], [-1019.4, 1396.2, -202.3], [-310.5, 1390.8, -46.7]] },
    { name: 'Annex roof 4', group: 'house', closed: true, points: [[-232.0, 1390.8, -404.4], [-243.8, 1407.4, -350.8], [-940.9, 1390.8, -560.1]] },
    { name: 'Annex roof 5', group: 'house', closed: true, points: [[-243.8, 1407.4, -350.8], [-271.3, 1446.2, -225.6], [-980.2, 1451.6, -381.2], [-952.7, 1412.8, -506.4]] },
    { name: 'Annex roof 6', group: 'house', closed: true, points: [[-339.0, 1231.5, 83.0], [-1019.4, 1396.2, -202.3], [-1047.9, 1231.5, -72.6]] },
    { name: 'Shed roof 7', group: 'house', closed: true, points: [[474.8, 708.3, 250.0], [568.8, 834.9, 494.2], [997.2, 834.9, 329.3], [903.2, 708.3, 85.1]] },
    { name: 'Shed roof 9', group: 'house', closed: true, points: [[587.1, 777.9, 471.2], [968.2, 777.9, 324.5], [1030.7, 693.2, 486.8], [649.6, 693.2, 633.5]] },
    { name: 'Umbrella rim', group: 'house', circle: {center: [-577.6, 1055.2, 350.1], radius: 169.9} },
    { name: 'Deck rail', group: 'house', points: [[-91.0, 1005.0, 553.0], [-27.0, 1005.0, 265.0], [-706.0, 1005.0, 421.0], [-646.0, 1005.0, 129.0]] },
    { name: 'Dock post lamp 1', group: 'dock', lamp: [-238.6, 529.0, 729.1] },
    { name: 'Dock post lamp 2', group: 'dock', lamp: [-227.0, 529.0, 1033.5] },
    { name: 'Dock post lamp 3', group: 'dock', lamp: [-11.7, 529.0, 1011.4] },
    { name: 'Dock post lamp 4', group: 'dock', lamp: [157.5, 529.0, 994.9] },
    { name: 'Dock post lamp 5', group: 'dock', lamp: [431.2, 529.0, 956.6] },
    { name: 'Dock post lamp 6', group: 'dock', lamp: [662.7, 529.0, 826.1] },
    { name: 'Trunk Birch 1', group: 'trees', spiral: {axis: [[-32.6, 868.1, -1069.9, 128.3], [-37.2, 1346.1, -1074.7, 78.4], [-39.8, 1824.1, -1063.7, 62.1], [-24.7, 2302.1, -1060.1, 53.5], [-15.9, 2780.1, -1063.7, 41.4], [-40.6, 3258.1, -1069.0, 30.7]], turns: 9} },
    { name: 'Trunk Birch 2', group: 'trees', spiral: {axis: [[838.7, 564.5, -587.6, 128.3], [834.2, 1042.5, -592.4, 78.4], [831.6, 1520.5, -581.4, 62.1], [846.7, 1998.5, -577.8, 53.5], [855.5, 2476.5, -581.4, 41.4], [830.7, 2954.5, -586.8, 30.7]], turns: 9} },
    { name: 'Trunk Birch 3', group: 'trees', spiral: {axis: [[-668.3, 375.6, -837.2, 128.3], [-674.9, 853.6, -837.2, 78.4], [-668.6, 1331.6, -827.7, 62.1], [-655.7, 1809.6, -836.3, 53.5], [-652.4, 2287.6, -845.2, 41.4], [-673.1, 2765.6, -830.7, 30.7]], turns: 9} },
    { name: 'Trunk Birch 4', group: 'trees', spiral: {axis: [[-968.8, 589.2, 23.9, 128.3], [-972.6, 1067.2, 18.5, 78.4], [-976.9, 1545.2, 29.0, 62.1], [-962.5, 2023.2, 34.9, 53.5], [-953.2, 2501.2, 32.7, 41.4], [-976.9, 2979.2, 23.5, 30.7]], turns: 9} },
    { name: 'Trunk RedOa 1', group: 'trees', spiral: {axis: [[973.0, 639.1, -211.7, 157.7], [977.7, 1033.1, -213.5, 102.4], [968.5, 1427.1, -217.0, 72.2], [965.9, 1821.1, -206.0, 54.9], [975.2, 2215.1, -193.4, 38.4], [968.9, 2609.1, -212.6, 26.5]], turns: 9} },
    { name: 'Trunk RedOa 2', group: 'trees', spiral: {axis: [[196.7, 764.7, -1004.8, 134.3], [200.2, 1098.7, -1006.7, 87.1], [192.3, 1432.7, -1008.8, 62.1], [191.1, 1766.7, -999.4, 47.7], [198.2, 2100.7, -990.2, 34.1], [193.8, 2434.7, -1006.5, 23.3]], turns: 9} },
];

// The model's opening camera on Sketchfab (https://sketchfab.com/i/models/<uid>/options → camera; Z-up → (x, z, −y))
const START_VIEW = { eye: [1361.8, 3330.4, 2723.8], target: [10.3, 925.3, -404.5], fov: 45 };

// The model author's five viewpoints from Sketchfab (same coordinates as STRINGS: the model's own units).
//   pos: where the numbered marker sits   eye / target: camera position and the point it looks at   name: the marker's tooltip
const VIEWPOINTS = [
    { name: 'Ready for a ride?',
      pos: [-76.5, 424.6, 863.4], eye: [-497.7, 836.1, 1361.4], target: [598.3, -1.4, -318.4] },
    { name: 'It smells like tompero!',
      pos: [803.2, 473.5, 445.9], eye: [668.4, 616.8, 566.7], target: [941.0, 464.4, 255.9] },
    { name: 'Little meetings',
      pos: [-488.6, 889.3, 243.8], eye: [-198.7, 1173.8, 544.0], target: [-572.0, 704.7, -27.7] },
    { name: 'The fort',
      pos: [1089.3, 1139.2, -385.7], eye: [595.8, 1313.8, -255.5], target: [881.4, 1200.7, -288.4] },
    { name: 'Bear? No. Chihuahua!',
      pos: [-537.8, 947.2, -736.0], eye: [-507.3, 1048.8, -1176.1], target: [-605.6, 677.3, -32.1] },
];

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
    // No rectangle, no 3D: a floating view would cover every other view, keep reading the tags and never clean itself up
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
    // a little warm fill while light groups are on
    const warmFill = new THREE.HemisphereLight(0xffc080, 0x201008, 0);
    scene.add(warmFill);
    // Model brightness: hemisphere + key light + environment reflections scale together (remembered in this browser)
    const modelMats = new Set();
    let brightness = BRIGHTNESS, lightInput = null, lightLabel = null;
    try { const b = parseFloat(localStorage.getItem('forest3d.brightness')); if (b >= 0.2 && b <= 1.5) brightness = b; } catch (e) {}
    const setBrightness = (b) => {
        brightness = Math.min(Math.max(b, 0.2), 1.5);
        hemi.intensity = 0.6 * brightness;
        sunLight.intensity = 2.6 * brightness;
        modelMats.forEach((m) => { m.envMapIntensity = 0.35 * brightness; });
        if (lightLabel) { lightInput.value = brightness; lightLabel.textContent = Math.round(brightness * 100) + '%'; }
        try { localStorage.setItem('forest3d.brightness', String(brightness)); } catch (e) {}
    };
    const env = { glow: 1.8 };     // LED halo strength (the lit scene is bright, so the halos need more)
    const style = document.createElement('style');
    style.textContent = [
      '#forest-3d-container .f3d-hs{position:absolute;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;pointer-events:auto;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;font:600 13px system-ui,sans-serif;color:#ffe2b0;background:rgba(10,14,30,.72);',
      'border:1px solid rgba(255,196,120,.75);box-shadow:0 0 8px rgba(255,180,90,.45);transition:opacity .3s,transform .2s,background .3s;user-select:none}',
      '#forest-3d-container .f3d-hs:hover{transform:scale(1.15)}',
      '#forest-3d-container .f3d-hs.on{background:radial-gradient(circle at 35% 35%,#fff1c9,#ffb55a 70%,#d98a2b);color:#3a2408;border-color:#fff3d6}',
      '#forest-3d-container .f3d-hs.hidden{opacity:.25}',
      '#forest-3d-container .f3d-bar{position:absolute;left:14px;top:14px;display:flex;gap:6px;padding:6px 8px;border-radius:22px;pointer-events:auto;',
      'background:rgba(10,14,30,.62);backdrop-filter:blur(6px);border:1px solid rgba(255,196,120,.55);box-shadow:0 2px 10px rgba(0,0,0,.45)}',
      '#forest-3d-container .f3d-bar button{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,196,120,.5);background:transparent;color:#ffd79a;',
      'font:600 13px system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .3s,color .3s}',
      '#forest-3d-container .f3d-bar button:hover{background:rgba(255,196,120,.18)}',
      '#forest-3d-container .f3d-bar button.on{background:radial-gradient(circle at 35% 35%,#fff1c9,#ffb55a 70%,#d98a2b);color:#3a2408;border-color:#fff3d6}',
      '#forest-3d-container .f3d-light{position:absolute;right:14px;top:14px;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:22px;pointer-events:auto;',
      'background:rgba(10,14,30,.62);backdrop-filter:blur(6px);border:1px solid rgba(255,196,120,.55);box-shadow:0 2px 10px rgba(0,0,0,.45);color:#ffd79a;font:600 12px system-ui,sans-serif;user-select:none}',
      '#forest-3d-container .f3d-light input{width:130px;accent-color:#ffb55a;cursor:pointer}',
      '#forest-3d-container .f3d-light span{min-width:34px;text-align:right}',
    ].join('\n');
    container.appendChild(style);

    // ==========================================
    // 4. Load the model, then hang the strings on it
    // ==========================================
    const glowTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
        const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,220,160,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    })();

    // Expand a string spec into the hook polyline it hangs from
    const hooksOf = (s) => {
        if (s.points) return { pts: s.points, closed: !!s.closed };
        if (s.circle) {
            const c = s.circle.center, r = s.circle.radius, pts = [];
            for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; pts.push([c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]); }
            return { pts, closed: true };
        }
        if (s.spiral) {
            const ax = s.spiral.axis, n = 320, pts = [], y0 = ax[0][1], y1 = ax[ax.length - 1][1];
            const at = (y, k) => { let i = 0; while (i < ax.length - 2 && ax[i + 1][1] < y) i++; const t = (y - ax[i][1]) / (ax[i + 1][1] - ax[i][1] || 1); return ax[i][k] + (ax[i + 1][k] - ax[i][k]) * t; };
            for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * i / (n - 1), a = s.spiral.turns * Math.PI * 2 * i / (n - 1), r = at(y, 3); pts.push([at(y, 0) + r * Math.cos(a), y, at(y, 2) + r * Math.sin(a)]); }
            return { pts, closed: false };
        }
        return { pts: [], closed: false };
    };
    // Bulb positions along the cable (with a little droop between hooks)
    const sampleString = (points, closed, spacing) => {
        const P = points.map(p => new THREE.Vector3(p[0], p[1], p[2])); if (closed) P.push(P[0].clone());
        const out = []; let carry = 0;
        for (let i = 0; i < P.length - 1; i++) {
            const a = P[i], b = P[i + 1], seg = a.distanceTo(b); if (seg < 1e-6) continue;
            const sag = Math.min(seg * 0.06, 25);
            let d = carry;
            for (; d <= seg; d += spacing) { const t = d / seg; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); out.push(p); }
            carry = d - seg;
        }
        return out;
    };

    const groups = {};        // group name -> { mat, glow, lights, hit }
    const hitMeshes = [];     // invisible, bigger spheres used for clicking
    let model = null, modelScale = 1;
    let windowMats = [];

    const buildStrings = () => {
        const spacing = LED_SPACING / modelScale;
        const byGroup = {};
        for (const s of STRINGS) (byGroup[s.group] = byGroup[s.group] || []).push(s);
        const rBulb = 0.017 / modelScale, rHit = 0.09 / modelScale, rLamp = 0.06 / modelScale;   // small bulbs: the glow does the work
        const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
        for (const g of Object.keys(byGroup)) {
            const bulbs = [], wire = [], lamps = [], bases = [], anchors = [];
            for (const s of byGroup[g]) {
                if (s.lamp) { lamps.push(new THREE.Vector3(s.lamp[0], s.lamp[1], s.lamp[2])); continue; }
                const h = hooksOf(s), pts = sampleString(h.pts, h.closed, spacing);
                if (s.spiral && pts.length) bases.push(pts[Math.floor(pts.length * 0.12)], pts[Math.floor(pts.length * 0.55)], pts[Math.floor(pts.length * 0.92)]);   // foot, middle, crown of each trunk
                if (g === 'house' && pts.length && /^(Roof slope|Umbrella rim|Shed roof 7|Deck rail)/.test(s.name)) {   // where the house lights go: under each roof / rail, never above a roof
                    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
                    c.y = Math.min(...pts.map(p => p.y)) - 0.1 / modelScale;
                    anchors.push(c);
                }
                bulbs.push(...pts);
                for (let i = 0; i < pts.length - 1; i++) wire.push(pts[i], pts[i + 1]);
            }
            const G = { mats: [], glows: [], lights: [], n: bulbs.length + lamps.length };
            // small bulbs on a cable: one InstancedMesh + one glow sprite cloud + the cable
            if (bulbs.length) {
                const mat = new THREE.MeshStandardMaterial({ color: 0x120e0b, emissive: new THREE.Color(0xffb050), emissiveIntensity: 0, roughness: 1 });
                const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(rBulb, 8, 6), mat, bulbs.length);
                const hit = new THREE.InstancedMesh(new THREE.SphereGeometry(rHit, 6, 4), new THREE.MeshBasicMaterial({ visible: false }), bulbs.length);
                bulbs.forEach((p, i) => { m4.compose(p, q0, s1); inst.setMatrixAt(i, m4); hit.setMatrixAt(i, m4); });
                inst.instanceMatrix.needsUpdate = true; hit.instanceMatrix.needsUpdate = true;
                hit.userData.group = g;
                const glow = new THREE.Points(new THREE.BufferGeometry().setFromPoints(bulbs),
                    new THREE.PointsMaterial({ map: glowTex, color: LED_COLOR, size: 0.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
                const wl = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x0e0b09, transparent: true, opacity: 0.7 }));
                model.add(inst, hit, glow, wl);
                hitMeshes.push(hit);
                G.mats.push({ mat, peak: 2.6 }); G.glows.push({ mat: glow.material, peak: 0.55 });
                if (bases.length) {                                    // trees: three lights up each trunk (foot, middle, crown)
                    for (const p of bases) {
                        const L = new THREE.PointLight(0xffb060, 0, 4.2, 1.5);
                        L.position.copy(p).multiplyScalar(modelScale).add(model.position); L.position.y += 0.2;
                        scene.add(L); G.lights.push({ light: L, peak: 0.85 });
                    }
                } else {                                               // house: one light below each roof edge / rail (a light above a glossy roof would mirror in it)
                    for (const p of anchors) {
                        const L = new THREE.PointLight(0xffb060, 0, 4.5, 1.6);     // short range: lights walls, deck and ground, not the trees
                        L.position.copy(p).multiplyScalar(modelScale).add(model.position);
                        scene.add(L); G.lights.push({ light: L, peak: 0.9 });
                    }
                }
            }
            // big lamps (dock posts): warmer, not blown out, a wide halo, and one point light each
            if (lamps.length) {
                const mat = new THREE.MeshStandardMaterial({ color: 0x3a2e24, emissive: new THREE.Color(0xffc070), emissiveIntensity: 0, roughness: 0.8 });
                const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(rLamp, 12, 8), mat, lamps.length);
                const hit = new THREE.InstancedMesh(new THREE.SphereGeometry(rLamp * 2.2, 6, 4), new THREE.MeshBasicMaterial({ visible: false }), lamps.length);
                lamps.forEach((p, i) => { m4.compose(p, q0, s1); inst.setMatrixAt(i, m4); hit.setMatrixAt(i, m4); });
                inst.instanceMatrix.needsUpdate = true; hit.instanceMatrix.needsUpdate = true;
                hit.userData.group = g;
                const glow = new THREE.Points(new THREE.BufferGeometry().setFromPoints(lamps),
                    new THREE.PointsMaterial({ map: glowTex, color: 0xffb860, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
                model.add(inst, hit, glow);
                hitMeshes.push(hit);
                G.mats.push({ mat, peak: 1.3 }); G.glows.push({ mat: glow.material, peak: 0.5 });
                for (const p of lamps) {
                    const L = new THREE.PointLight(0xffb060, 0, 4.5, 1.6);
                    L.position.copy(p).multiplyScalar(modelScale).add(model.position); L.position.y += 0.05;
                    scene.add(L); G.lights.push({ light: L, peak: 0.7 });
                }
            }
            groups[g] = G;
        }
        console.log('[Forest3D] strings built:', Object.keys(groups).map(g => `${g}: ${groups[g].n} bulbs`).join(', '));
    };

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
            if (o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.35 * brightness; modelMats.add(o.material); }   // stronger reflections turn the glossy black roofs grey (Sketchfab keeps them near-black)
            if (/Windows_Interior/i.test(o.name) && o.material) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xffb060); o.material.emissiveIntensity = 0; windowMats.push(o.material); }
        });
        scene.add(model);
        model.updateMatrixWorld(true);
        // open on the same view as the model's Sketchfab page, and make it the home view
        target.copy(toWorld(START_VIEW.target)); camera.position.copy(toWorld(START_VIEW.eye)); camera.lookAt(target);
        syncView(); HOME.pos.copy(camera.position); HOME.target.copy(target);
        overlay.remove();
        buildStrings();
    }, (e) => {
        if (e.total) overlay.textContent = 'Loading model… ' + Math.round(e.loaded / e.total * 100) + '%';
    }, (err) => {
        console.error('[Forest3D] 模型載入失敗:', MODEL_URL, err);
        overlay.textContent = 'Model not found: ' + MODEL_URL;
    });

    // ==========================================
    // 5. Tag binding: read the three tags on a timer, write one on click (same three commands as episode 2)
    // ==========================================
    const io = {};   // group -> { tagId, on, pending }
    for (const g of Object.keys(OUTPUTS)) {
        let tagId = null;
        try { tagId = $getTagId(OUTPUTS[g]); } catch (e) {}
        if (!tagId) console.warn(`[Forest3D] 找不到 tag "${OUTPUTS[g]}"，請確認 Connections 裡的 tag 名稱`);
        io[g] = { tagId, on: false, pending: null };
    }
    const isOn = (v) => v === true || v === 1 || v === '1' || v === 'true';

    let pollTimer = null;
    const pollTags = async () => {          // async: FUXA adds await to $getTag
        if (isDestroyed) return;
        for (const g of Object.keys(io)) {
            const s = io[g]; if (!s.tagId) continue;
            try {
                const value = isOn(await $getTag(s.tagId));
                if (s.pending && (value === s.pending.value || Date.now() > s.pending.until)) s.pending = null;
                if (!s.pending) s.on = value;
            } catch (e) { console.warn('[Forest3D] 讀取 tag 失敗:', e); }
        }
        if (!isDestroyed) pollTimer = setTimeout(pollTags, POLL_MS);
    };
    pollTags();

    const toggleGroup = async (g) => {
        const s = io[g]; if (!s || !s.tagId) return;
        s.on = !s.on;                                             // update the 3D view right away
        s.pending = { value: s.on, until: Date.now() + WRITE_TIMEOUT_MS };
        try {
            await $setTag(s.tagId, s.on ? 1 : 0);                 // FUXA writes the coil
        } catch (e) {
            console.warn('[Forest3D] 寫入 tag 失敗:', e);
            s.pending = null;                                     // the next read shows the output's real state again
        }
    };

    // Called every frame: ease each group toward its tag state
    let hoverGroup = null;
    const applyIO = () => {
        let lit = 0;
        for (const g in groups) {
            const G = groups[g], target = io[g] && io[g].on ? 1 : 0;
            const hover = hoverGroup === g && !target ? 0.18 : 0;
            G.mats.forEach(m => { m.mat.emissiveIntensity += ((target + hover) * m.peak - m.mat.emissiveIntensity) * 0.12; });
            G.glows.forEach(m => { m.mat.opacity += ((target + hover) * m.peak * env.glow - m.mat.opacity) * 0.12; });
            G.lights.forEach(L => { L.light.intensity += (target * L.peak - L.light.intensity) * 0.12; });
            lit += target;
        }
        warmFill.intensity += (lit * 0.015 - warmFill.intensity) * 0.1;   // almost none: each group lights only its own area
        const wTarget = io.house && io.house.on ? 0.9 : 0;
        windowMats.forEach(m => { m.emissiveIntensity += (wTarget - m.emissiveIntensity) * 0.12; });
    };

    // ==========================================
    // 6. Mouse: click a string to toggle its group / drag to orbit / wheel to zoom
    // ==========================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const target = new THREE.Vector3(0, MODEL_SIZE * 0.3, 0);
    const view = { radius: MODEL_SIZE * 2.1, theta: Math.PI / 4, phi: 1.12 };   // start: 3/4 view from a little above; the island fills the frame, tree tops may be cut
    const updateCamera = () => {
        view.phi = Math.min(Math.max(view.phi, 0.15), Math.PI / 2 - 0.05);
        view.radius = Math.min(Math.max(view.radius, 1), 60);
        camera.position.set(
            target.x + view.radius * Math.sin(view.phi) * Math.sin(view.theta),
            target.y + view.radius * Math.cos(view.phi),
            target.z + view.radius * Math.sin(view.phi) * Math.cos(view.theta));
        camera.lookAt(target);
    };
    updateCamera();
    const HOME = { pos: camera.position.clone(), target: target.clone() };

    // ---- Viewpoints: numbered markers + a home / 1-5 bar (top left: FUXA's runtime can push the bottom edge below the window); a click flies the camera there ----
    const syncView = () => {                       // after a flight, continue orbiting around the new target
        const off = camera.position.clone().sub(target);
        view.radius = off.length();
        view.phi = Math.acos(Math.min(Math.max(off.y / view.radius, -1), 1));
        view.theta = Math.atan2(off.x, off.z);
    };
    let fly = null, activeVp = -1;
    const toWorld = (v) => model ? model.localToWorld(new THREE.Vector3(v[0], v[1], v[2])) : null;
    const bar = document.createElement('div'); bar.className = 'f3d-bar'; container.appendChild(bar);

    // ---- Brightness slider (top right): scales the light on the model; the LED strings keep their own glow ----
    const lightBox = document.createElement('div'); lightBox.className = 'f3d-light';
    lightBox.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
        + '<input type="range" min="0.2" max="1.5" step="0.05" title="Brightness"><span></span>';
    lightInput = lightBox.querySelector('input'); lightLabel = lightBox.querySelector('span');
    lightInput.addEventListener('input', () => setBrightness(parseFloat(lightInput.value)));
    lightBox.addEventListener('pointerdown', (e) => e.stopPropagation());
    container.appendChild(lightBox);
    setBrightness(brightness);
    const markers = VIEWPOINTS.map((vp, i) => {
        const m = document.createElement('div'); m.className = 'f3d-hs'; m.textContent = String(i + 1); m.title = vp.name;
        m.addEventListener('click', () => goTo(i)); m.addEventListener('pointerdown', (e) => e.stopPropagation());
        container.appendChild(m); return m;
    });
    const homeBtn = document.createElement('button'); homeBtn.title = 'Overview';
    homeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M3 11.5 12 4l9 7.5M6 10v9h4.5v-5h3v5H18v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    homeBtn.addEventListener('click', () => goTo(-1)); bar.appendChild(homeBtn);
    const vpBtns = VIEWPOINTS.map((vp, i) => {
        const b = document.createElement('button'); b.textContent = String(i + 1); b.title = vp.name;
        b.addEventListener('click', () => goTo(i)); bar.appendChild(b); return b;
    });
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    const goTo = (i) => {
        if (i >= 0 && !model) return;
        const toPos = i < 0 ? HOME.pos.clone() : toWorld(VIEWPOINTS[i].eye);
        const toTarget = i < 0 ? HOME.target.clone() : toWorld(VIEWPOINTS[i].target);
        fly = { t0: performance.now(), dur: 1300, fromPos: camera.position.clone(), fromTarget: target.clone(), toPos, toTarget };
        activeVp = i;
        markers.forEach((m, k) => m.classList.toggle('on', k === i));
        vpBtns.forEach((b, k) => b.classList.toggle('on', k === i));
    };
    const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const occluders = [];                          // model meshes, filled once the model is in
    let frame = 0;
    const updateViewpoints = () => {
        if (fly) {
            const k = Math.min(1, (performance.now() - fly.t0) / fly.dur), e = ease(k);
            camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
            target.lerpVectors(fly.fromTarget, fly.toTarget, e);
            camera.lookAt(target);
            if (k >= 1) { fly = null; syncView(); }
        }
        if (!model) return;
        if (!occluders.length) model.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material && !o.material.transparent) occluders.push(o); });
        const r = renderer.domElement.getBoundingClientRect();
        const checkSlot = frame++ % 12;            // at most one marker's occlusion raycast per frame, so they never pile up
        VIEWPOINTS.forEach((vp, i) => {
            const w = toWorld(vp.pos), p = w.clone().project(camera), m = markers[i];
            if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) { m.style.display = 'none'; return; }
            m.style.display = '';
            const x = (p.x * 0.5 + 0.5) * r.width, y = (-p.y * 0.5 + 0.5) * r.height;
            m.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
            if (checkSlot === i * 2) {             // dim a marker that sits behind the model
                const dir = w.clone().sub(camera.position), dist = dir.length();
                raycaster.set(camera.position, dir.normalize());
                const hit = raycaster.intersectObjects(occluders, false)[0];
                m.classList.toggle('hidden', !!hit && hit.distance < dist - 0.15);
            }
        });
    };

    const pickGroup = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(hitMeshes, false);
        return hits.length ? hits[0].object.userData.group : null;
    };

    let drag = null;
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        if (fly) { fly = null; syncView(); }
        drag = { lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY, group: pickGroup(e) };
        renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!drag) {
            hoverGroup = pickGroup(e);
            renderer.domElement.style.cursor = hoverGroup ? 'pointer' : 'grab';
            return;
        }
        view.theta -= (e.clientX - drag.lastX) * 0.008;
        view.phi -= (e.clientY - drag.lastY) * 0.008;
        drag.lastX = e.clientX; drag.lastY = e.clientY;
        updateCamera();
        renderer.domElement.style.cursor = 'grabbing';
    };
    const endDrag = (e) => {
        drag = null;
        if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
    };
    const onPointerUp = (e) => {
        const isClick = drag && drag.group && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5;
        if (isClick) toggleGroup(drag.group);
        endDrag(e);
    };
    const onPointerLeave = () => { if (!drag) hoverGroup = null; };   // no group stays half-lit once the pointer is gone
    const onWheel = (e) => { e.preventDefault(); if (fly) { fly = null; syncView(); } view.radius *= e.deltaY > 0 ? 1.1 : 0.9; updateCamera(); };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    // a cancelled pointer (the browser took over a touch gesture) never counts as a click: it must not switch an output
    renderer.domElement.addEventListener('pointercancel', endDrag);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ==========================================
    // 7. Render loop
    // ==========================================
    // Liveness check: switching views / entering edit mode removes or hides the placeholder (width 0), so everything is
    // released (and the tag reads stop) even when the view has no close script. Checked every frame, and once a second
    // by a timer as well, because the browser pauses requestAnimationFrame while the tab is in the background
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
        applyIO();
        updateViewpoints();
        renderer.render(scene, camera);
    };
    animate();

    // ==========================================
    // 8. Release resources (called by the FUXA close script)
    // ==========================================
    function cleanup() {
        if (isDestroyed) return;
        console.log('[Forest3D] 執行 destroy (關閉畫面清理資源)...');
        isDestroyed = true;
        if (animationId) cancelAnimationFrame(animationId);
        clearTimeout(pollTimer);
        clearInterval(watchdog);
        window.removeEventListener('resize', updateContainerPosition);
        window.removeEventListener('scroll', updateContainerPosition, true);
        if (mo) mo.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', endDrag);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
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
        // The debug handle holds the scene and the whole model: drop it, or the memory stays in use after the view closes
        if (window.__forest3d && window.__forest3d.scene === scene) window.__forest3d = null;
    }
    window.destroyForest3D = cleanup;

    // Debug / recording helpers (F12): window.__forest3d.toggle('house'), .screenOf('trees') -> {x, y} of one bulb
    window.__forest3d = {
        scene, renderer, camera, hemi, sunLight, setBrightness, goTo, io, toggle: toggleGroup, view, updateCamera,
        screenOf: (g, which = 0.5) => {
            const G = groups[g]; if (!G || !model) return null;
            const glowObj = model.children.find(o => o.isPoints && G.glows.some(x => x.mat === o.material)); const pos = glowObj.geometry.attributes.position, i = Math.floor(which * (pos.count - 1));
            const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(model.matrixWorld).project(camera);
            const r = renderer.domElement.getBoundingClientRect();
            return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height, behind: p.z > 1 };
        },
    };
};

// Start
initForest().catch(err => console.error('[Forest3D] 初始化失敗:', err));
