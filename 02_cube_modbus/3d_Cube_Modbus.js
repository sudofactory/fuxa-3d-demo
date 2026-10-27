/**
 * 3d_Cube_Modbus.js
 * Episode 1's 3D cube, now bound to Modbus TCP tags (A-1855 or a Modbus simulator)
 *
 * Controls:
 *   - Click the cube: toggle DO0 (its LED on the A-1855 turns on / off)
 *   - Drag the red/green/blue arrows on the cube: move the cube along X / Y / Z
 *   - Drag on empty space: orbit the camera; mouse wheel: zoom
 *
 * Live state:
 *   - Cube glows yellow while DO0 is on, no matter who switched it
 */

// ==========================================
// 1. Settings
// ==========================================
const PLACEHOLDER_ID = 'cube_3d'; // Name (or id) of the placeholder rectangle in FUXA
const SHOW_AXES = true;           // Show the XYZ arrows (when hidden, they can still be dragged at the same spot)

// Modbus tag: the name must match the tag created under Connections in FUXA
const LED_TAG = 'led_DO0';        // A-1855 DO0 -> Coil Status, address 17 (read/write)
const POLL_MS = 500;              // How often to read the tag
const WRITE_TIMEOUT_MS = 3000;    // After a click, wait up to this long for FUXA to report the new value

// three.js: FUXA's _widgets folder first (works without internet), then the CDN, pinned by its SHA-384 hash (SRI)
const THREE_SOURCES = [
    { src: '/_widgets/three.min.js' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      integrity: 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu' },
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
// Find the DOM element of the named rectangle in the FUXA view (same logic as 3d_Diamond.js)
// ══════════════════════════════════════════════════════════════
const findPlaceholderElement = () => {
    // Method 1: data-name attribute
    let el = document.querySelector(`[data-name="${PLACEHOLDER_ID}"]`);
    if (el) { console.log('[CubeModbus] 方法1(data-name) 命中:', el.id); return el; }

    // Method 2: match by id
    el = document.getElementById(PLACEHOLDER_ID);
    if (el) { console.log('[CubeModbus] 方法2(id) 命中:', el.id); return el; }

    // Method 3: plain SVG shape — <title> or textContent
    for (const e of document.querySelectorAll('[id^="svg_"], [id^="SHE_"], [id^="HXT_"]')) {
        const title = e.querySelector('title');
        if (title && title.textContent.trim() === PLACEHOLDER_ID) {
            console.log('[CubeModbus] 方法3(title) 命中:', e.id); return e;
        }
        if (e.textContent && e.textContent.trim() === PLACEHOLDER_ID) {
            console.log('[CubeModbus] 方法3(textContent) 命中:', e.id); return e;
        }
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
                console.warn(`[CubeModbus] 等待 ${timeoutMs}ms 後仍找不到 "${PLACEHOLDER_ID}"，不建立 3D 畫面`);
                resolve(null); return;
            }
            setTimeout(check, intervalMs);
        };
        setTimeout(check, 300);
    });

const initCube = async () => {
    let isDestroyed = false;
    let renderer = null, camera = null; // Declared up front so resize events firing before creation don't hit a TDZ error
    console.log('[CubeModbus] 初始化開始...');

    // On reopen, destroy the previous instance first to avoid leftover render loops and WebGL contexts (leaks)
    if (window.destroyCubeModbus3D) { try { window.destroyCubeModbus3D(); } catch (e) {} }

    // Force-remove any leftover container (safety net)
    const oldContainer = document.getElementById('cube-modbus-container');
    if (oldContainer) oldContainer.remove();

    // While starting up, closing the view only has to stop the start-up; cleanup() takes over once the scene exists
    const cancelStartup = () => { isDestroyed = true; };
    const stopStartup = () => { if (window.destroyCubeModbus3D === cancelStartup) window.destroyCubeModbus3D = null; };
    window.destroyCubeModbus3D = cancelStartup;

    // ==========================================
    // 2. Find the rectangle on the FUXA canvas to use as the placeholder, and load three.js
    // ==========================================
    const placeholder = await waitForPlaceholder(() => isDestroyed);
    // No rectangle, no 3D: a floating view would cover every other view, keep reading the tag and never clean itself up
    if (isDestroyed || !placeholder) return stopStartup();

    // Load three.js before anything is added to the page, so a failed load leaves nothing behind
    try {
        await loadScript(THREE_SOURCES, () => !!window.THREE);
    } catch (err) {
        console.error('[CubeModbus] three.js 載入失敗:', err);
        return stopStartup();
    }
    if (isDestroyed || !document.body.contains(placeholder)) return stopStartup(); // The view closed while loading
    const THREE = window.THREE;

    const initRect = placeholder.getBoundingClientRect();
    placeholder.style.visibility = 'hidden'; // Hide the original rectangle
    console.log('[CubeModbus] 找到佔位框:', initRect);

    // ==========================================
    // 3. Create the outer container (overlaid on the rectangle)
    // ==========================================
    const container = document.createElement('div');
    container.id = 'cube-modbus-container';
    Object.assign(container.style, {
        position: 'fixed',
        left: initRect.left + 'px',
        top: initRect.top + 'px',
        width: initRect.width + 'px',
        height: initRect.height + 'px',
        zIndex: '10',          // Low z-index: lets FUXA's own sidebar/cards (1001+) stack above the 3D view
        overflow: 'hidden',
        pointerEvents: 'none', // Let clicks pass through to the background
    });
    // Mount inside app-fuxa-view (not body): same stacking context as the FUXA UI
    const mountNode = placeholder.closest('app-fuxa-view') || document.body;
    mountNode.appendChild(container);

    // Keep position in sync when the window or canvas is resized, or the view scrolls
    const updateContainerPosition = () => {
        const rect = placeholder.getBoundingClientRect();
        if (!rect.width || !rect.height) return;   // Size is 0 while hidden; skip to avoid a NaN aspect
        Object.assign(container.style, {
            left: rect.left + 'px',
            top: rect.top + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px'
        });
        if (!renderer || !camera) return;          // Skip if the event fires before renderer/camera exist
        renderer.setSize(rect.width, rect.height);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', updateContainerPosition);
    window.addEventListener('scroll', updateContainerPosition, true); // true: also scrolls inside the FUXA view
    let mo = null;
    const svgEl = placeholder.closest('svg');
    if (svgEl) {
        mo = new MutationObserver(updateContainerPosition);
        mo.observe(svgEl, { attributes: true, subtree: false });
    }

    // ==========================================
    // 4. Build the Three.js 3D scene
    // ==========================================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e2230);

    camera = new THREE.PerspectiveCamera(45, initRect.width / initRect.height, 0.1, 200);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(initRect.width, initRect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;                 // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.pointerEvents = 'auto';  // Allow mouse dragging
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 10, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    Object.assign(dirLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 40 });
    scene.add(dirLight);

    // Floor (receives shadows)
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x2a2f40, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x8899aa, 0x445066);
    grid.position.y = 0.001; // Slightly above the floor to avoid z-fighting
    scene.add(grid);

    // Cube (casts shadows); its color shows the DO0 state
    const CUBE_SIZE = 2;
    const cubeMat = new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.2, roughness: 0.45, emissive: 0xffb020, emissiveIntensity: 0 });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE), cubeMat);
    cube.position.set(0, CUBE_SIZE / 2, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);

    // Warm glow around the cube while DO0 is on
    const glow = new THREE.PointLight(0xffc040, 0, 8);
    scene.add(glow);

    // XYZ drag arrows (X red / Y green / Z blue), always drawn on top so the cube never hides them
    const gizmo = new THREE.Group();
    const AXES = [
        { dir: new THREE.Vector3(1, 0, 0), color: 0xff4040 },
        { dir: new THREE.Vector3(0, 1, 0), color: 0x40ff40 },
        { dir: new THREE.Vector3(0, 0, 1), color: 0x4080ff },
    ];
    const handles = [];
    AXES.forEach((axis) => {
        const mat = new THREE.MeshBasicMaterial({ color: axis.color, depthTest: false, transparent: true });
        const arrow = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 8), mat);
        shaft.position.y = 1;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 12), mat);
        head.position.y = 2.2;
        // Thicker invisible hit area so the arrows are easier to grab
        const hitArea = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 2.5, 8),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitArea.position.y = 1.25;
        [shaft, head].forEach((m) => { m.renderOrder = 999; });
        arrow.add(shaft, head, hitArea);
        // Cylinders point along +Y by default; rotate to the matching axis
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.dir);
        [shaft, head, hitArea].forEach((m) => { m.userData.axis = axis; });
        handles.push(shaft, head, hitArea);
        gizmo.add(arrow);
    });
    gizmo.visible = SHOW_AXES; // Only affects rendering; raycasts still hit the arrows
    scene.add(gizmo);

    // ==========================================
    // 5. Modbus binding: read the tag on a timer, write it on click
    // ==========================================
    // The script never talks Modbus itself. It uses three FUXA client-script commands for tags:
    //   $getTagId(name)     the tag's id, looked up once by the tag's name in Connections (an id, not the value)
    //   $getTag(id)         the tag's current value; FUXA adds `await`, so call it inside an async function
    //   $setTag(id, value)  write a new value; FUXA sends it to the device (here: Modbus coil 17 of the A-1855)
    let ledTagId = null;
    try {
        ledTagId = $getTagId(LED_TAG);   // name -> id, once
    } catch (e) {}
    if (!ledTagId) console.warn(`[CubeModbus] 找不到 tag "${LED_TAG}"，請確認 Connections 裡的 tag 名稱`);

    // pending: the value just written by a click. FUXA keeps reporting the old value until it next polls the
    // module, so reads are ignored until they show the new value (or WRITE_TIMEOUT_MS passes)
    const io = { led: false, pending: null, pollTimer: null };
    const isOn = (v) => v === true || v === 1 || v === '1' || v === 'true'; // Coils can come back as boolean, number or string

    // Must be async: FUXA adds await to $getTag
    const pollTag = async () => {
        if (isDestroyed) return;
        try {
            if (ledTagId) {
                const value = isOn(await $getTag(ledTagId));   // id -> current value (1 = on, 0 = off)
                if (io.pending && (value === io.pending.value || Date.now() > io.pending.until)) io.pending = null;
                if (!io.pending) io.led = value;
            }
        } catch (e) { console.warn('[CubeModbus] 讀取 tag 失敗:', e); }
        if (!isDestroyed) io.pollTimer = setTimeout(pollTag, POLL_MS);
    };
    pollTag();

    const toggleLed = async () => {
        if (!ledTagId) return;
        io.led = !io.led;                                   // Update the 3D view right away
        io.pending = { value: io.led, until: Date.now() + WRITE_TIMEOUT_MS };
        try {
            await $setTag(ledTagId, io.led ? 1 : 0);      // id + new value -> FUXA writes coil 17
        } catch (e) {
            console.warn('[CubeModbus] 寫入 tag 失敗:', e);
            io.pending = null;                              // The next read shows the output's real state again
        }
    };

    // Called every frame: ease the cube toward the current tag state
    const applyIO = () => {
        cubeMat.emissiveIntensity += ((io.led ? 0.9 : 0) - cubeMat.emissiveIntensity) * 0.15;
        cubeMat.color.setHex(io.led ? 0xffd060 : 0x5a6070);
        glow.intensity = cubeMat.emissiveIntensity * 1.5;
        glow.position.set(cube.position.x, cube.position.y + 1.5, cube.position.z);
    };

    // ==========================================
    // 6. Mouse interaction: click the cube to toggle DO0 / drag arrows to move it / drag empty space to orbit / wheel to zoom
    // ==========================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const target = new THREE.Vector3(0, 1, 0);         // Orbit center
    const view = { radius: 13, theta: Math.PI / 4, phi: Math.PI / 3 }; // Camera in spherical coordinates
    const updateCamera = () => {
        view.phi = Math.min(Math.max(view.phi, 0.1), Math.PI / 2 - 0.05); // Keep the camera above the floor
        view.radius = Math.min(Math.max(view.radius, 4), 40);
        camera.position.set(
            target.x + view.radius * Math.sin(view.phi) * Math.sin(view.theta),
            target.y + view.radius * Math.cos(view.phi),
            target.z + view.radius * Math.sin(view.phi) * Math.cos(view.theta)
        );
        camera.lookAt(target);
    };
    updateCamera();

    const pickHandle = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(handles, false);
        return hits.length > 0 ? hits[0].object.userData.axis : null;
    };
    // Call right after pickHandle: reuses the ray it just set
    const hitsCube = () => raycaster.intersectObject(cube, false).length > 0;

    // Project a 3D point to screen pixel coordinates
    const toScreen = (v) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const p = v.clone().project(camera);
        return new THREE.Vector2((p.x * 0.5 + 0.5) * rect.width, (-p.y * 0.5 + 0.5) * rect.height);
    };

    let drag = null; // { mode: 'axis' | 'orbit', ... }
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        const axis = pickHandle(e);
        // onCube: if the pointer is released without moving, it's a click on the cube (even where the arrows cross it)
        const onCube = hitsCube();
        if (axis) {
            // Screen-space pixel vector for moving 1 unit along this axis
            const a = toScreen(cube.position);
            const b = toScreen(cube.position.clone().add(axis.dir));
            const screenDir = b.sub(a);
            drag = { mode: 'axis', axis, screenDir, lenSq: screenDir.lengthSq() || 1,
                     startX: e.clientX, startY: e.clientY, startPos: cube.position.clone(), onCube };
        } else {
            drag = { mode: 'orbit', lastX: e.clientX, lastY: e.clientY,
                     startX: e.clientX, startY: e.clientY, onCube };
        }
        renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!drag) {
            renderer.domElement.style.cursor = (pickHandle(e) || hitsCube()) ? 'pointer' : 'grab';
            return;
        }
        if (drag.mode === 'axis') {
            const d = new THREE.Vector2(e.clientX - drag.startX, e.clientY - drag.startY);
            const amount = d.dot(drag.screenDir) / drag.lenSq;
            cube.position.copy(drag.startPos).addScaledVector(drag.axis.dir, amount);
            cube.position.y = Math.max(cube.position.y, CUBE_SIZE / 2); // Don't sink below the floor
        } else {
            view.theta -= (e.clientX - drag.lastX) * 0.008;
            view.phi -= (e.clientY - drag.lastY) * 0.008;
            drag.lastX = e.clientX; drag.lastY = e.clientY;
            updateCamera();
            renderer.domElement.style.cursor = 'grabbing';
        }
    };
    const endDrag = (e) => {
        drag = null;
        if (renderer.domElement.hasPointerCapture(e.pointerId)) {
            renderer.domElement.releasePointerCapture(e.pointerId);
        }
    };
    const onPointerUp = (e) => {
        const isClick = drag && drag.onCube &&
            Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5; // Moved under 5px: click, not a drag
        if (isClick) toggleLed();
        endDrag(e);
    };
    const onWheel = (e) => {
        e.preventDefault(); // Prevent the FUXA page from scrolling
        view.radius *= e.deltaY > 0 ? 1.1 : 0.9;
        updateCamera();
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    // A cancelled pointer (the browser took over a touch gesture) never counts as a click: it must not switch the output
    renderer.domElement.addEventListener('pointercancel', endDrag);
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
        console.log('[CubeModbus] 偵測到佔位元素消失或隱藏，自動執行銷毀...');
        cleanup();
        return true;
    };
    const watchdog = setInterval(releaseIfGone, 1000);

    let animationId = null;
    const animate = () => {
        if (isDestroyed || releaseIfGone()) return;
        animationId = requestAnimationFrame(animate);
        gizmo.position.copy(cube.position); // Arrows follow the cube
        applyIO();                          // Cube color follows the Modbus tag
        renderer.render(scene, camera);
    };
    animate();

    // ==========================================
    // 8. Release resources (called by the FUXA close script)
    // ==========================================
    function cleanup() {
        if (isDestroyed) return;
        console.log('[CubeModbus] 執行 destroy (關閉畫面清理資源)...');
        isDestroyed = true;
        if (animationId) cancelAnimationFrame(animationId);
        clearTimeout(io.pollTimer); // Stop reading the Modbus tag
        clearInterval(watchdog);

        window.removeEventListener('resize', updateContainerPosition);
        window.removeEventListener('scroll', updateContainerPosition, true);
        if (mo) mo.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', endDrag);
        renderer.domElement.removeEventListener('wheel', onWheel);

        // Remove the DOM container
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }

        // Restore the FUXA placeholder
        placeholder.style.visibility = '';

        // Free Three.js WebGL memory
        if (renderer) {
            renderer.dispose();
            if (renderer.forceContextLoss) {
                renderer.forceContextLoss();
            } else {
                const gl = renderer.getContext();
                if (gl) {
                    const loseContext = gl.getExtension('WEBGL_lose_context');
                    if (loseContext) loseContext.loseContext();
                }
            }
        }
        scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        if (window.destroyCubeModbus3D === cleanup) {
            window.destroyCubeModbus3D = null;
        }
    }
    window.destroyCubeModbus3D = cleanup;
};

// Start
initCube().catch(err => console.error('[CubeModbus] 初始化失敗:', err));
