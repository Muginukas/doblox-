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
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
  const towerEl = document.getElementById('tower');
  const shopEl = document.getElementById('shop');
  const resetBtn = document.getElementById('reset-btn');

  function startGame() {
    playerNameEl.textContent = state.name;
    ownerBadge.classList.toggle('hidden', !state.isOwner);
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    renderShop();
    renderTower();
    updateHud();
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
          <button class="shop-buy ${free ? 'free' : ''}" data-id="${item.id}" ${free ? 'disabled' : (canBuy ? '' : 'disabled')}>
            ${free ? 'FREE ✔' : 'Pirkti'}
          </button>
          <button class="shop-add" data-id="${item.id}" ${canAdd ? '' : 'disabled'}>Į bokštą</button>
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
    renderTower(true);
    renderShop();
    updateHud();
    save();
  }

  function renderTower(onlyAppendLast) {
    if (!onlyAppendLast) towerEl.innerHTML = '';
    if (state.tower.length === 0) {
      towerEl.innerHTML = '<div class="tower-empty">Bokštas tuščias.<br>Nusipirk detalių ir prasidėk statybą! 🏗️</div>';
      return;
    }
    if (onlyAppendLast) {
      const emptyMsg = towerEl.querySelector('.tower-empty');
      if (emptyMsg) towerEl.innerHTML = '';
      const id = state.tower[state.tower.length - 1];
      towerEl.appendChild(makeBlock(id));
    } else {
      state.tower.forEach(id => towerEl.appendChild(makeBlock(id)));
    }
  }

  function makeBlock(id) {
    const item = ITEMS.find(i => i.id === id);
    const el = document.createElement('div');
    el.className = 'tower-block';
    el.style.background = item.color;
    el.style.transform = `rotate(${(Math.random() * 6 - 3).toFixed(1)}deg)`;
    el.textContent = item.icon;
    el.title = item.name;
    return el;
  }

  earnBtn.addEventListener('click', (e) => {
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
