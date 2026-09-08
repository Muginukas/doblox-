(() => {
  'use strict';

  const OWNER_NAME = 'deva';
  const OWNER_COINS = 100000000000; // 100 milijardų
  const START_COINS = 100;
  const SAVE_KEY = 'asmr-tower-save';

  const ITEMS = [
    { id: 'butter',   name: 'Sviestas',        icon: '🧈', price: 10, color: '#ffe08a' },
    { id: 'keyboard', name: 'Klaviatūra',       icon: '⌨️', price: 25, color: '#a3a3ff' },
    { id: 'popcorn',  name: 'Spragėsiai',       icon: '🍿', price: 15, color: '#ffd27a' },
    { id: 'soap',     name: 'Muilas',           icon: '🧼', price: 20, color: '#bde0fe' },
    { id: 'sand',     name: 'Kinetinis smėlis', icon: '🏖️', price: 30, color: '#f4d58d' },
    { id: 'balloon',  name: 'Balionas',         icon: '🎈', price: 12, color: '#ffb3c1' },
    { id: 'honey',    name: 'Medus',            icon: '🍯', price: 18, color: '#ffcb69' },
    { id: 'jelly',    name: 'Želė',             icon: '🍮', price: 22, color: '#caffbf' },
    { id: 'jar',      name: 'Stiklo indas',     icon: '🫙', price: 35, color: '#d0f4de' },
    { id: 'oil',      name: 'Aliejus',          icon: '🧴', price: 28, color: '#e0aaff' },
    { id: 'ice',      name: 'Ledas',            icon: '🧊', price: 16, color: '#caf0f8' },
    { id: 'sponge',   name: 'Kempinė',          icon: '🧽', price: 14, color: '#ffd6a5' },
  ];

  let state = null;

  function defaultState(name) {
    const isOwner = name.trim().toLowerCase() === OWNER_NAME;
    const owned = {};
    ITEMS.forEach(item => { owned[item.id] = isOwner ? Infinity : 0; });
    return {
      name: name.trim(),
      isOwner,
      coins: isOwner ? OWNER_COINS : START_COINS,
      owned,
      tower: [],
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.isOwner) {
        ITEMS.forEach(item => { parsed.owned[item.id] = Infinity; });
        parsed.coins = Math.max(parsed.coins, OWNER_COINS);
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function formatNumber(n) {
    if (n === Infinity) return '∞';
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (abs >= 1e9)  return (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (abs >= 1e6)  return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (abs >= 1e3)  return (n / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
    return String(Math.floor(n));
  }

  // ---------- DOM refs ----------
  const loginScreen = document.getElementById('login-screen');
  const gameScreen = document.getElementById('game-screen');
  const nicknameInput = document.getElementById('nickname-input');
  const loginBtn = document.getElementById('login-btn');
  const playerNameEl = document.getElementById('player-name');
  const ownerBadge = document.getElementById('owner-badge');
  const coinCountEl = document.getElementById('coin-count');
  const towerHeightEl = document.getElementById('tower-height');
  const earnBtn = document.getElementById('earn-btn');
  const towerViewport = document.getElementById('tower-viewport');
  const towerCanvas = document.getElementById('tower-canvas');
  const towerEmptyEl = document.getElementById('tower-empty');
  const shopEl = document.getElementById('shop');
  const resetBtn = document.getElementById('reset-btn');

  // ============================================================
  // 3D bokšto scena (Three.js) – tipiškas Roblox "workspace":
  // baseplate + apšvietimas + orbituojanti kamera + kraunami blokai
  // ============================================================
  const BLOCK_SIZE = 0.95;
  const BLOCK_HEIGHT = 0.62;
  const BLOCK_GAP = 0.04;

  let renderer, scene, camera, controls;
  let towerGroup, clock;
  let cameraTargetY = 0;
  const dropAnimations = [];
  const textureCache = new Map();

  // Etiketė ant bloko – kaip prekės pakuotė (ikona + pavadinimas), ne vien emoji
  function makeLabelTexture(item) {
    if (textureCache.has(item.id)) return textureCache.get(item.id);
    const w = 256, h = 256;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');

    ctx.fillStyle = item.color;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(23,50,74,0.55)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);

    ctx.fillStyle = '#ffffffee';
    const cardY = h * 0.32, cardH = h * 0.5;
    ctx.beginPath();
    ctx.roundRect(w * 0.08, cardY, w * 0.84, cardH, 18);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.font = `${h * 0.34}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(item.icon, w / 2, cardY + cardH * 0.52);

    ctx.fillStyle = '#17324a';
    ctx.font = `900 ${h * 0.1}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(item.name.toUpperCase(), w / 2, cardY + cardH * 0.94);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    tex.anisotropy = 4;
    textureCache.set(item.id, tex);
    return tex;
  }

  // Roblox stiliaus baseplate – šviesus pilkas/baltas šachmatinis grindinys
  function makeCheckerTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const step = size / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#eef5fa' : '#d4e6f0';
        ctx.fillRect(x * step, y * step, step, step);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  function initScene() {
    if (renderer) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd8ff);
    scene.fog = new THREE.Fog(0x8fd8ff, 16, 40);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(3.4, 2.7, 3.4);

    renderer = new THREE.WebGLRenderer({ canvas: towerCanvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.8;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.5, 0);
    controls.update();

    const hemi = new THREE.HemisphereLight(0xffffff, 0xbcdcf5, 1.05);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff6dd, 1.0);
    sun.position.set(6, 9, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    scene.add(sun);

    // Roblox stiliaus pastelinės sienos aplink boksto aikštelę
    const wallColors = [0xffd9e6, 0xdcefff, 0xfff3c9];
    const wallGeo = new THREE.PlaneGeometry(30, 14);
    wallColors.forEach((color, i) => {
      const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color, roughness: 1 }));
      wall.position.set(0, 6.5, -9);
      wall.rotation.y = (i - 1) * (Math.PI / 2.6);
      wall.receiveShadow = true;
      scene.add(wall);
    });

    const baseGeo = new THREE.CylinderGeometry(3.4, 3.6, 0.4, 48);
    const baseMat = new THREE.MeshStandardMaterial({ map: makeCheckerTexture(), roughness: 0.85 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.2;
    base.receiveShadow = true;
    scene.add(base);

    const rimGeo = new THREE.TorusGeometry(3.5, 0.12, 12, 48);
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.6 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.02;
    scene.add(rim);

    towerGroup = new THREE.Group();
    scene.add(towerGroup);

    clock = new THREE.Clock();
    resizeRenderer();
    window.addEventListener('resize', resizeRenderer);
    animate();
  }

  function resizeRenderer() {
    if (!renderer || !towerViewport) return;
    const w = towerViewport.clientWidth || 1;
    const h = towerViewport.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    for (let i = dropAnimations.length - 1; i >= 0; i--) {
      const anim = dropAnimations[i];
      anim.t += dt / anim.duration;
      const t = Math.min(anim.t, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      anim.mesh.position.y = anim.startY + (anim.endY - anim.startY) * eased;
      if (t >= 1) {
        anim.mesh.position.y = anim.endY;
        anim.mesh.scale.set(1, 1, 1);
        dropAnimations.splice(i, 1);
      } else if (t > 0.92) {
        const settle = (t - 0.92) / 0.08;
        const squash = 1 - Math.sin(settle * Math.PI) * 0.12;
        anim.mesh.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6);
      }
    }

    if (controls) {
      controls.target.y += (cameraTargetY - controls.target.y) * 0.06;
      controls.update();
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function makeBlockMesh(item) {
    const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_HEIGHT, BLOCK_SIZE);
    const colorMat = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.6, metalness: 0.04 });
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, map: makeLabelTexture(item) });
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    const materials = [colorMat, colorMat, labelMat, colorMat, labelMat, colorMat];
    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function addBlockToScene(id, animate) {
    const item = ITEMS.find(i => i.id === id);
    if (!item || !towerGroup) return;

    const index = towerGroup.children.length;
    const step = BLOCK_HEIGHT + BLOCK_GAP;
    const endY = index * step + BLOCK_HEIGHT / 2;
    const jitter = 0.16;
    const x = (Math.random() - 0.5) * jitter;
    const z = (Math.random() - 0.5) * jitter;

    const mesh = makeBlockMesh(item);
    mesh.position.set(x, animate ? endY + 5 : endY, z);
    mesh.rotation.y = (Math.random() - 0.5) * 0.5;
    towerGroup.add(mesh);

    cameraTargetY = (index * step) / 2;

    if (animate) {
      dropAnimations.push({ mesh, startY: endY + 5, endY, t: 0, duration: 0.45 });
    }
  }

  function rebuildTowerFromState() {
    if (!towerGroup) return;
    towerGroup.clear();
    dropAnimations.length = 0;
    state.tower.forEach(id => addBlockToScene(id, false));
    towerEmptyEl.classList.toggle('hidden', state.tower.length > 0);
  }

  // ---------- Game flow ----------
  function startGame() {
    playerNameEl.textContent = state.name;
    ownerBadge.classList.toggle('hidden', !state.isOwner);
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    renderShop();
    initScene();
    rebuildTowerFromState();
    updateHud();
    requestAnimationFrame(resizeRenderer);
  }

  function updateHud() {
    coinCountEl.textContent = formatNumber(state.coins);
    coinCountEl.title = state.coins === Infinity ? '' : state.coins.toLocaleString('lt-LT');
    towerHeightEl.textContent = state.tower.length;
  }

  function renderShop() {
    shopEl.innerHTML = '';
    ITEMS.forEach(item => {
      const owned = state.owned[item.id] || 0;
      const free = state.isOwner;
      const canBuy = !free && state.coins >= item.price;
      const canAdd = free || owned > 0;

      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `
        <span class="shop-icon">${item.icon}</span>
        <div class="shop-info">
          <div class="shop-name">${item.name}</div>
          <div class="shop-price">${free ? 'NEMOKAMA' : formatNumber(item.price) + ' 🪙'}</div>
          <div class="shop-owned">Turi: ${owned === Infinity ? '∞' : owned}</div>
        </div>
        <div class="shop-buttons">
          <button class="shop-buy pop-btn ${free ? 'free' : ''}" data-id="${item.id}" ${free ? 'disabled' : (canBuy ? '' : 'disabled')}>
            ${free ? 'FREE ✔' : 'Pirkti'}
          </button>
          <button class="shop-add pop-btn" data-id="${item.id}" ${canAdd ? '' : 'disabled'}>Į bokštą</button>
        </div>
      `;
      shopEl.appendChild(row);
    });

    shopEl.querySelectorAll('.shop-buy').forEach(btn => {
      btn.addEventListener('click', () => buyItem(btn.dataset.id));
    });
    shopEl.querySelectorAll('.shop-add').forEach(btn => {
      btn.addEventListener('click', () => addToTower(btn.dataset.id));
    });
  }

  function buyItem(id) {
    const item = ITEMS.find(i => i.id === id);
    if (!item || state.isOwner) return;
    if (state.coins < item.price) return;
    state.coins -= item.price;
    state.owned[id] = (state.owned[id] || 0) + 1;
    updateHud();
    renderShop();
    save();
  }

  function addToTower(id) {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;
    const owned = state.owned[id] || 0;
    if (!state.isOwner) {
      if (owned <= 0) return;
      state.owned[id] = owned - 1;
    }
    state.tower.push(id);
    addBlockToScene(id, true);
    towerEmptyEl.classList.add('hidden');
    renderShop();
    updateHud();
    save();
  }

  earnBtn.addEventListener('click', () => {
    state.coins += 1;
    updateHud();
    renderShop();
    save();

    const label = earnBtn.querySelector('.earn-label');
    label.classList.remove('pop');
    void label.offsetWidth; // restart animation
    label.classList.add('pop');
  });

  resetBtn.addEventListener('click', () => {
    if (!confirm('Ar tikrai nori pradėti žaidimą iš naujo? Visa pažanga bus prarasta.')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });

  loginBtn.addEventListener('click', () => {
    const name = nicknameInput.value.trim();
    if (!name) {
      nicknameInput.focus();
      return;
    }
    const existing = loadSave();
    if (existing && existing.name.toLowerCase() === name.toLowerCase()) {
      state = existing;
    } else {
      state = defaultState(name);
    }
    save();
    startGame();
  });

  nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });

  // Auto-login if a save already exists
  window.addEventListener('DOMContentLoaded', () => {
    const existing = loadSave();
    if (existing) {
      nicknameInput.value = existing.name;
    }
  });
})();
