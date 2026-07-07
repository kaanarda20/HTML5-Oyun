const state = {
  game: 'sequence',
  score: 0,
  lives: 3,
  soundEnabled: true,
  soundVolume: 0.7,
  status: 'Hazır',
  cleanup: null,
  rafId: null,
  sequence: [],
  sequenceInput: [],
  sequenceReady: false,
  arcade: null,
  memory: null,
  platform: null,
  runner: null,
  balloon: null,
  shooter: null,
  quiz: null,
  clicker: null,
  defense: null,
};

const panel = document.getElementById('gamePanel');
const scoreValue = document.getElementById('scoreValue');
const livesValue = document.getElementById('livesValue');
const statusValue = document.getElementById('statusValue');
const activeGameName = document.getElementById('activeGameName');
const soundToggle = document.getElementById('soundToggle');
const volumeRange = document.getElementById('volumeRange');
const scoreList = document.getElementById('scoreList');
const restartBtn = document.getElementById('restartBtn');

const gameNames = {
  sequence: 'Renk Sırası',
  collector: 'Altın Toplayıcı',
  memory: 'Hafıza Kartları',
  platformer: 'Platform',
  runner: 'Endless Runner',
  balloon: 'Balon Patlatma',
  shooter: 'Space Shooter',
  quiz: 'Kelime / Bilgi',
  clicker: 'Clicker',
  defense: 'Savunma',
};

const colorKeys = ['red', 'blue', 'green', 'yellow'];
const colorLabels = {
  red: 'Kırmızı',
  blue: 'Mavi',
  green: 'Yeşil',
  yellow: 'Sarı',
};

const memoryPairs = ['🍀', '🚀', '⭐', '🎯', '💎', '🎮', '🔥', '🍩'];

const quizQuestions = [
  { question: 'HTML neyin kısaltmasıdır?', answers: ['HyperText Markup Language', 'HighText Machine Language', 'Hyper Transfer Machine Layer'], correct: 0 },
  { question: 'C# hangi platformla sık kullanılır?', answers: ['ASP.NET Core', 'Photoshop', 'Excel'], correct: 0 },
  { question: 'JavaScript ile ne yapılır?', answers: ['Etkileşimli web uygulamaları', 'Sadece tasarım', 'Sadece veritabanı'], correct: 0 },
  { question: 'Phaser nedir?', answers: ['Oyun frameworkü', 'Metin editörü', 'Tarayıcı'], correct: 0 },
  { question: 'CSS ne içindir?', answers: ['Stil verme', 'Veri toplama', 'Sunucu yönetimi'], correct: 0 },
];

function setStatus(message) {
  state.status = message;
  statusValue.textContent = message;
}

function setScore(value) {
  state.score = value;
  scoreValue.textContent = value;
}

function setLives(value) {
  state.lives = Math.max(0, value);
  livesValue.textContent = '❤'.repeat(state.lives).padEnd(3, '·');
  livesValue.classList.toggle('lives-low', state.lives === 2);
  livesValue.classList.toggle('lives-empty', state.lives <= 1);
}

let audioContext = null;

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playSound(type) {
  if (!state.soundEnabled) return;

  const context = ensureAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const settings = {
    success: { frequency: 660, duration: 0.12, volume: 0.08, type: 'triangle' },
    collect: { frequency: 880, duration: 0.08, volume: 0.06, type: 'sine' },
    damage: { frequency: 180, duration: 0.16, volume: 0.1, type: 'sawtooth' },
    pop: { frequency: 520, duration: 0.06, volume: 0.07, type: 'square' },
    click: { frequency: 420, duration: 0.05, volume: 0.04, type: 'sine' },
    gameover: { frequency: 110, duration: 0.35, volume: 0.12, type: 'triangle' },
  }[type] || { frequency: 440, duration: 0.08, volume: 0.05, type: 'sine' };

  oscillator.type = settings.type;
  oscillator.frequency.value = settings.frequency;
  gain.gain.value = settings.volume * state.soundVolume;

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + settings.duration);
  oscillator.stop(context.currentTime + settings.duration);
}

function updateSoundToggleLabel() {
  soundToggle.textContent = state.soundEnabled ? 'Ses: Açık' : 'Ses: Kapalı';
  soundToggle.setAttribute('aria-pressed', String(state.soundEnabled));
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  updateSoundToggleLabel();
  if (state.soundEnabled) {
    playSound('click');
  }
}

function setSoundVolume(value) {
  state.soundVolume = Math.max(0, Math.min(1, value));
}

function renderScores(items) {
  scoreList.innerHTML = '';
  if (!items.length) {
    scoreList.innerHTML = '<li>Henüz kayıt yok.</li>';
    return;
  }

  for (const item of items.slice().reverse().slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = `${item.player} - ${item.game} - ${item.value}`;
    scoreList.appendChild(li);
  }
}

async function loadScores() {
  try {
    const response = await fetch('/api/scores');
    if (!response.ok) return;
    const scores = await response.json();
    renderScores(scores);
  } catch {
    renderScores([]);
  }
}

async function saveScore(game, value) {
  try {
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: 'Misafir', game, value }),
    });

    if (response.ok) {
      await loadScores();
    }
  } catch {
    // offline demo mode
  }
}

function stopCurrentGame() {
  if (typeof state.cleanup === 'function') {
    state.cleanup();
  }

  state.cleanup = null;

  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  if (state.arcade?.timer) clearInterval(state.arcade.timer);
  if (state.platform?.timer) clearInterval(state.platform.timer);
  if (state.runner?.timer) clearInterval(state.runner.timer);
  if (state.balloon?.spawnTimer) clearInterval(state.balloon.spawnTimer);
  if (state.balloon?.moveTimer) clearInterval(state.balloon.moveTimer);
  if (state.shooter?.timer) clearInterval(state.shooter.timer);
  if (state.clicker?.timer) clearInterval(state.clicker.timer);

  document.onkeydown = null;
  document.onkeyup = null;
}

function endAndSave(gameName, score, message) {
  setStatus(message);
  saveScore(gameName, score);
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function switchGame(game) {
  stopCurrentGame();
  state.game = game;
  activeGameName.textContent = gameNames[game];
  document.querySelectorAll('.game-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.game === game);
  });

  renderCurrentGame();
}

function resetGame() {
  switchGame(state.game);
}

function renderCurrentGame() {
  const game = games[state.game];
  if (game) {
    game.init();
  }
}

function startSequenceGame() {
  setScore(0);
  setLives(3);
  setStatus('Sıra hazırlanıyor');
  state.sequence = [];
  state.sequenceInput = [];
  state.sequenceReady = false;

  panel.innerHTML = `
    <div class="game-layout">
      <div class="panel-box">
        <h2>Renk Sırası</h2>
        <p>Gösterilen renk sırasını tekrar et. Her turda dizi uzar.</p>
        <div id="sequenceHint">Başlamak için aşağıdaki düğmeye basın.</div>
        <div class="color-grid" id="colorGrid"></div>
      </div>
      <div class="panel-box">
        <h3>Kurallar</h3>
        <ul class="feature-list">
          <li>Her doğru tur +10 puan</li>
          <li>Yanlış tıkta oyun biter</li>
          <li>Şimdi source olarak düzenlenebilir</li>
        </ul>
        <button id="sequenceStart" class="ghost" style="margin-top:12px">Oyunu Başlat</button>
      </div>
    </div>
  `;

  const grid = document.getElementById('colorGrid');
  const hint = document.getElementById('sequenceHint');
  const startBtn = document.getElementById('sequenceStart');

  for (const color of colorKeys) {
    const button = document.createElement('button');
    button.className = 'color-btn';
    button.dataset.color = color;
    button.textContent = colorLabels[color];
    button.addEventListener('click', () => handleSequenceInput(color, button));
    grid.appendChild(button);
  }

  function flashStep(index) {
    if (index >= state.sequence.length) {
      state.sequenceReady = true;
      hint.textContent = 'Sıra sende!';
      return;
    }

    const color = state.sequence[index];
    const target = grid.querySelector(`[data-color="${color}"]`);
    target.classList.add('flash');
    hint.textContent = `${index + 1}. adım: ${colorLabels[color]}`;
    setTimeout(() => target.classList.remove('flash'), 420);
    setTimeout(() => flashStep(index + 1), 700);
  }

  function nextRound() {
    state.sequence.push(colorKeys[Math.floor(Math.random() * colorKeys.length)]);
    state.sequenceInput = [];
    state.sequenceReady = false;
    setStatus(`Tur ${state.sequence.length}`);
    hint.textContent = 'Diziyi izle.';
    setTimeout(() => flashStep(0), 500);
  }

  function begin() {
    setScore(0);
    state.sequence = [];
    nextRound();
  }

  startBtn.onclick = begin;
  begin();

  function handleSequenceInput(color, button) {
    if (!state.sequenceReady) return;

    button.classList.add('flash');
    setTimeout(() => button.classList.remove('flash'), 120);
    state.sequenceInput.push(color);

    const currentIndex = state.sequenceInput.length - 1;
    if (state.sequence[currentIndex] !== color) {
      setStatus('Yanlış sıra');
      setLives(state.lives - 1);
      playSound('damage');
      hint.textContent = `Oyun bitti. Skor: ${state.score}`;
      if (state.lives <= 0) {
        playSound('gameover');
        saveScore('Renk Sırası', state.score);
        state.sequenceReady = false;
        return;
      }
      state.sequence = [];
      state.sequenceInput = [];
      state.sequenceReady = false;
      setTimeout(nextRound, 700);
      return;
    }

    if (state.sequenceInput.length === state.sequence.length) {
      const nextScore = state.score + 10;
      setScore(nextScore);
      setStatus('Doğru!');
      hint.textContent = 'Yeni tur hazırlanıyor...';
      state.sequenceReady = false;
      setTimeout(nextRound, 850);
    }
  }

  state.sequenceHandler = handleSequenceInput;
}

function startArcadeGame() {
  setScore(0);
  setLives(3);
  setStatus('Kaçış başladı');
  const targetTime = 30;
  const width = 720;
  const height = 400;

  panel.innerHTML = `
    <div class="arcade-wrap">
      <div class="panel-box">
        <h2>Altın Toplayıcı</h2>
        <p>Ok tuşları veya WASD ile hareket et. Altınları topla, taşlardan kaç.</p>
        <div class="controls">Kontroller: ← → / A D, hedef: 30 saniye</div>
      </div>
      <canvas id="arcadeCanvas" width="${width}" height="${height}"></canvas>
    </div>
  `;

  const canvas = document.getElementById('arcadeCanvas');
  const ctx = canvas.getContext('2d');
  const keys = new Set();

  const game = {
    player: { x: width / 2 - 18, y: height - 34, size: 36, speed: 6 },
    items: [],
    score: 0,
    timeLeft: targetTime,
    running: true,
    timer: null,
  };
  state.arcade = game;

  function spawnItem() {
    game.items.push({
      x: Math.random() * (width - 24),
      y: -20,
      size: 22,
      speed: 2.5 + Math.random() * 3,
      kind: Math.random() > 0.25 ? 'gold' : 'rock',
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#12192f');
    gradient.addColorStop(1, '#070b16');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#7c4dff';
    ctx.fillRect(game.player.x, game.player.y, game.player.size, game.player.size);

    for (const item of game.items) {
      ctx.beginPath();
      ctx.fillStyle = item.kind === 'gold' ? '#f6c244' : '#ff5d73';
      ctx.arc(item.x + item.size / 2, item.y + item.size / 2, item.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#edf2ff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`Skor: ${game.score}`, 18, 28);
    ctx.fillText(`Süre: ${game.timeLeft}`, width - 108, 28);

    if (!game.running) {
      ctx.fillStyle = 'rgba(0,0,0,.56)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px Inter, sans-serif';
      ctx.fillText('Oyun Bitti', width / 2 - 88, height / 2 - 10);
      ctx.font = '18px Inter, sans-serif';
      ctx.fillText(`Son skor: ${game.score}`, width / 2 - 56, height / 2 + 24);
    }
  }

  function update() {
    if (!game.running) {
      draw();
      return;
    }

    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
      game.player.x -= game.player.speed;
    }
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
      game.player.x += game.player.speed;
    }

    game.player.x = Math.max(0, Math.min(width - game.player.size, game.player.x));

    if (Math.random() < 0.07) {
      spawnItem();
    }

    for (const item of game.items) {
      item.y += item.speed;
    }

    const player = game.player;
    game.items = game.items.filter((item) => {
      const hit = item.x < player.x + player.size && item.x + item.size > player.x && item.y < player.y + player.size && item.y + item.size > player.y;
      if (hit) {
        if (item.kind === 'gold') {
          game.score += 1;
          setScore(game.score);
          setStatus('Altın toplandı');
          playSound('collect');
        } else {
          game.score = Math.max(0, game.score - 2);
          setScore(game.score);
          setStatus('Taşa çarptın');
          setLives(state.lives - 1);
          playSound('damage');
        }
        return false;
      }
      return item.y < height + 24;
    });

    draw();
  }

  document.onkeydown = (event) => keys.add(event.key);
  document.onkeyup = (event) => keys.delete(event.key);

  game.timer = setInterval(() => {
    if (!game.running) return;
    game.timeLeft -= 1;
    setStatus(`Süre: ${game.timeLeft}`);
    if (game.timeLeft <= 0) {
      game.running = false;
      clearInterval(game.timer);
      setStatus('Süre doldu');
      saveScore('Altın Toplayıcı', game.score);
    }
  }, 1000);

  const loop = () => {
    update();
    if (game.running) {
      requestAnimationFrame(loop);
    }
  };
  loop();
}

function startMemoryGame() {
  setScore(0);
  setLives(3);
  setStatus('Eşleşme başladı');
  const cards = [...memoryPairs, ...memoryPairs]
    .sort(() => Math.random() - 0.5)
    .map((symbol, id) => ({ id, symbol, revealed: false, matched: false }));

  state.memory = { cards, open: [], matchedCount: 0 };

  panel.innerHTML = `
    <div class="game-layout">
      <div class="panel-box">
        <h2>Hafıza Kartları</h2>
        <p>Aynı sembolleri eşleştir. Bütün kartlar eşleşince skor kaydedilir.</p>
        <div class="memory-grid" id="memoryGrid"></div>
      </div>
      <div class="panel-box">
        <h3>Puanlama</h3>
        <ul class="feature-list">
          <li>Her eşleşme +5 puan</li>
          <li>Yanlış seçim kısa süre sonra kapanır</li>
          <li>Toplam 8 çift kart bulunur</li>
        </ul>
      </div>
    </div>
  `;

  const grid = document.getElementById('memoryGrid');

  function refresh() {
    grid.innerHTML = '';
    for (const card of state.memory.cards) {
      const button = document.createElement('button');
      button.className = 'card-tile';
      button.textContent = card.revealed || card.matched ? card.symbol : '❓';
      button.classList.toggle('revealed', card.revealed);
      button.classList.toggle('matched', card.matched);
      button.disabled = card.matched;
      button.addEventListener('click', () => onCardClick(card));
      grid.appendChild(button);
    }
  }

  function onCardClick(card) {
    if (card.revealed || card.matched || state.memory.open.length === 2) return;

    card.revealed = true;
    state.memory.open.push(card);
    refresh();

    if (state.memory.open.length < 2) return;

    const [first, second] = state.memory.open;
    if (first.symbol === second.symbol) {
      first.matched = true;
      second.matched = true;
      state.memory.matchedCount += 1;
      setScore(state.memory.matchedCount * 5);
      setStatus('Eşleşti');
      state.memory.open = [];
      refresh();

      if (state.memory.matchedCount === memoryPairs.length) {
        setStatus('Tamamlandı');
        saveScore('Hafıza Kartları', state.score);
      }
      return;
    }

    setStatus('Yanlış eşleşme');
    setLives(state.lives - 1);
    playSound('damage');
    setTimeout(() => {
      first.revealed = false;
      second.revealed = false;
      state.memory.open = [];
      refresh();
    }, 700);
  }

  refresh();
}

function startPlatformerGame() {
  setScore(0);
  setLives(3);
  setStatus('Platform başladı');

  const width = 720;
  const height = 400;
  const { canvas, ctx } = createCanvas(width, height);
  const keys = new Set();

  panel.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'arcade-wrap';
  wrap.innerHTML = `
    <div class="panel-box">
      <h2>Platform</h2>
      <p>Ok tuşları veya WASD ile hareket et, boşluk ile zıpla.</p>
      <div class="controls">Yıldızları topla, düşme.</div>
    </div>
  `;
  wrap.appendChild(canvas);
  panel.appendChild(wrap);

  const game = {
    player: { x: 60, y: 250, w: 28, h: 36, vx: 0, vy: 0, onGround: false },
    gravity: 0.45,
    speed: 4.5,
    jump: 9.6,
    stars: [],
    platforms: [
      { x: 0, y: 360, w: 720, h: 40 },
      { x: 80, y: 300, w: 140, h: 16 },
      { x: 250, y: 245, w: 120, h: 16 },
      { x: 430, y: 190, w: 135, h: 16 },
      { x: 600, y: 280, w: 90, h: 16 },
    ],
    score: 0,
    timeLeft: 30,
    running: true,
    timer: null,
  };
  state.platform = game;

  function spawnStar() {
    const platform = game.platforms[1 + Math.floor(Math.random() * (game.platforms.length - 1))];
    game.stars.push({ x: platform.x + 20 + Math.random() * Math.max(20, platform.w - 40), y: platform.y - 24, size: 14 });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#1c2f66');
    sky.addColorStop(1, '#0b1020');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    for (const platform of game.platforms) {
      ctx.fillStyle = platform.y === 360 ? '#27304d' : '#4b7cff';
      ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    }

    for (const star of game.stars) {
      ctx.fillStyle = '#f6c244';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#7c4dff';
    ctx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);
    ctx.fillStyle = '#edf2ff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`Skor: ${game.score}`, 18, 26);
    ctx.fillText(`Süre: ${game.timeLeft}`, width - 108, 26);
  }

  function update() {
    if (!game.running) {
      draw();
      return;
    }

    const player = game.player;
    player.vx = 0;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) player.vx = -game.speed;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) player.vx = game.speed;
    if ((keys.has('ArrowUp') || keys.has('w') || keys.has('W') || keys.has(' ')) && player.onGround) {
      player.vy = -game.jump;
      player.onGround = false;
    }

    player.x += player.vx;
    player.vy += game.gravity;
    player.y += player.vy;
    player.x = Math.max(0, Math.min(width - player.w, player.x));
    player.onGround = false;

    for (const platform of game.platforms) {
      const landing = player.vy >= 0 && player.x + player.w > platform.x && player.x < platform.x + platform.w && player.y + player.h > platform.y && player.y + player.h < platform.y + 18;
      if (landing) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }

    if (Math.random() < 0.04 && game.stars.length < 4) spawnStar();

    game.stars = game.stars.filter((star) => {
      const hit = player.x < star.x + star.size && player.x + player.w > star.x - star.size && player.y < star.y + star.size && player.y + player.h > star.y - star.size;
      if (hit) {
        game.score += 10;
        setScore(game.score);
        setStatus('Yıldız toplandı');
        playSound('collect');
        return false;
      }
      return true;
    });

    if (player.y > height + 50) {
      player.x = 60;
      player.y = 250;
      player.vy = 0;
      game.score = Math.max(0, game.score - 5);
      setScore(game.score);
      setLives(state.lives - 1);
      playSound('damage');
      setStatus('Düştün');
    }

    draw();
    state.rafId = requestAnimationFrame(update);
  }

  document.onkeydown = (event) => keys.add(event.key);
  document.onkeyup = (event) => keys.delete(event.key);

  game.timer = setInterval(() => {
    if (!game.running) return;
    game.timeLeft -= 1;
    if (game.timeLeft <= 0) {
      game.running = false;
      clearInterval(game.timer);
      endAndSave('Platform', game.score, 'Süre doldu');
    }
  }, 1000);

  update();
}

function startRunnerGame() {
  setScore(0);
  setLives(3);
  setStatus('Koşu başladı');

  const width = 720;
  const height = 360;
  const { canvas, ctx } = createCanvas(width, height);
  const keys = new Set();

  panel.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'arcade-wrap';
  wrap.innerHTML = `
    <div class="panel-box">
      <h2>Endless Runner</h2>
      <p>Boşluk veya W ile zıpla. Engellerden kaç, mesafe puanı topla.</p>
    </div>
  `;
  wrap.appendChild(canvas);
  panel.appendChild(wrap);

  const game = {
    player: { x: 70, y: 250, w: 28, h: 38, vy: 0, onGround: true },
    gravity: 0.5,
    jump: 10.5,
    obstacles: [],
    score: 0,
    running: true,
    timeLeft: 45,
    timer: null,
  };
  state.runner = game;

  function spawnObstacle() {
    game.obstacles.push({ x: width + 20, y: 268, w: 24 + Math.random() * 14, h: 28 + Math.random() * 18, speed: 4 + Math.random() * 2.5 });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#10192d');
    bg.addColorStop(1, '#050814');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1f2a46';
    ctx.fillRect(0, 288, width, 72);
    ctx.fillStyle = '#7c4dff';
    ctx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);
    ctx.fillStyle = '#ff5d73';
    for (const obstacle of game.obstacles) ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

    ctx.fillStyle = '#edf2ff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`Skor: ${game.score}`, 16, 26);
    ctx.fillText(`Süre: ${game.timeLeft}`, width - 108, 26);
  }

  function hitTest(player, obstacle) {
    return player.x < obstacle.x + obstacle.w && player.x + player.w > obstacle.x && player.y < obstacle.y + obstacle.h && player.y + player.h > obstacle.y;
  }

  function update() {
    if (!game.running) {
      draw();
      return;
    }

    if ((keys.has(' ') || keys.has('ArrowUp') || keys.has('w') || keys.has('W')) && game.player.onGround) {
      game.player.vy = -game.jump;
      game.player.onGround = false;
    }

    game.player.vy += game.gravity;
    game.player.y += game.player.vy;
    if (game.player.y >= 250) {
      game.player.y = 250;
      game.player.vy = 0;
      game.player.onGround = true;
    }

    if (Math.random() < 0.04) spawnObstacle();

    game.obstacles.forEach((obstacle) => {
      obstacle.x -= obstacle.speed;
    });

    if (game.obstacles.some((obstacle) => hitTest(game.player, obstacle))) {
      setLives(state.lives - 1);
      playSound('damage');
      if (state.lives <= 0) {
        game.running = false;
        playSound('gameover');
        endAndSave('Endless Runner', game.score, 'Çarptın');
        draw();
        return;
      }
      game.obstacles = [];
      game.player.y = 250;
      game.player.vy = 0;
      setStatus('Çarptın, devam');
      draw();
      return;
    }

    game.obstacles = game.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -20);
    game.score += 1;
    setScore(game.score);
    setStatus('Koşuyor');
    draw();
    state.rafId = requestAnimationFrame(update);
  }

  document.onkeydown = (event) => keys.add(event.key);
  document.onkeyup = (event) => keys.delete(event.key);

  game.timer = setInterval(() => {
    if (!game.running) return;
    game.timeLeft -= 1;
    if (game.timeLeft <= 0) {
      game.running = false;
      clearInterval(game.timer);
      endAndSave('Endless Runner', game.score, 'Süre doldu');
    }
  }, 1000);

  update();
}

function startBalloonGame() {
  setScore(0);
  setLives(3);
  setStatus('Balonlar başladı');

  panel.innerHTML = `
    <div class="game-layout">
      <div class="panel-box">
        <h2>Balon Patlatma</h2>
        <p>20 saniye içinde mümkün olduğunca çok balon patlat.</p>
        <div id="balloonArea" class="balloon-area"></div>
      </div>
      <div class="panel-box">
        <h3>Kurallar</h3>
        <ul class="feature-list">
          <li>Her balon +1 puan</li>
          <li>Kaçan balonlar puan düşürmez</li>
        </ul>
      </div>
    </div>
  `;

  const area = document.getElementById('balloonArea');
  const balloons = [];
  let running = true;
  let timeLeft = 20;
  const spawnTimer = setInterval(() => {
    if (!running) return;
    if (balloons.length >= 10) return;

    const balloon = document.createElement('button');
    balloon.className = 'balloon';
    balloon.textContent = '🎈';
    balloon.style.left = `${Math.random() * 85}%`;
    balloon.style.bottom = '-30px';
    balloon.dataset.speed = `${1.2 + Math.random() * 1.8}`;
    balloon.addEventListener('click', () => {
      if (!running) return;
      setScore(state.score + 1);
      setStatus('Balon patladı');
      playSound('pop');
      balloon.remove();
    });
    area.appendChild(balloon);
    balloons.push(balloon);
  }, 600);

  const moveTimer = setInterval(() => {
    if (!running) return;
    timeLeft -= 1;
    setStatus(`Süre: ${timeLeft}`);
    if (timeLeft <= 0) {
      running = false;
      clearInterval(spawnTimer);
      clearInterval(moveTimer);
      endAndSave('Balon Patlatma', state.score, 'Süre doldu');
    }
  }, 1000);

  function step() {
    if (!running) return;
    for (const balloon of balloons) {
      const nextBottom = Number.parseFloat(balloon.style.bottom || '0') + Number(balloon.dataset.speed);
      balloon.style.bottom = `${nextBottom}px`;
      if (nextBottom > 320) balloon.remove();
    }
    state.rafId = requestAnimationFrame(step);
  }

  state.balloon = { spawnTimer, moveTimer };
  step();
}

function startShooterGame() {
  setScore(0);
  setLives(3);
  setStatus('Uzay savaşı başladı');

  const width = 720;
  const height = 420;
  const { canvas, ctx } = createCanvas(width, height);
  const keys = new Set();

  panel.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'arcade-wrap';
  wrap.innerHTML = `
    <div class="panel-box">
      <h2>Space Shooter</h2>
      <p>Ok tuşları veya A/D ile hareket et, boşlukla ateş et.</p>
    </div>
  `;
  wrap.appendChild(canvas);
  panel.appendChild(wrap);

  const game = {
    player: { x: width / 2 - 18, y: height - 50, w: 36, h: 24, cooldown: 0 },
    bullets: [],
    enemies: [],
    score: 0,
    lives: 3,
    running: true,
    timer: null,
  };
  state.shooter = game;

  function spawnEnemy() {
    game.enemies.push({ x: Math.random() * (width - 30), y: -20, w: 26, h: 26, speed: 2 + Math.random() * 2 });
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#091126');
    bg.addColorStop(1, '#02040a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#7c4dff';
    ctx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);
    ctx.fillStyle = '#f6c244';
    for (const bullet of game.bullets) ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    ctx.fillStyle = '#ff5d73';
    for (const enemy of game.enemies) ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
    ctx.fillStyle = '#edf2ff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`Skor: ${game.score}`, 16, 26);
    ctx.fillText(`Can: ${game.lives}`, 120, 26);
  }

  function shoot() {
    if (game.player.cooldown > 0) return;
    game.bullets.push({ x: game.player.x + game.player.w / 2 - 2, y: game.player.y - 8, w: 4, h: 8, speed: 7 });
    game.player.cooldown = 12;
  }

  function update() {
    if (!game.running) {
      draw();
      return;
    }

    if (game.player.cooldown > 0) game.player.cooldown -= 1;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) game.player.x -= 6;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) game.player.x += 6;
    game.player.x = Math.max(0, Math.min(width - game.player.w, game.player.x));
    if (keys.has(' ')) shoot();

    if (Math.random() < 0.04) spawnEnemy();
    game.bullets.forEach((bullet) => (bullet.y -= bullet.speed));
    game.enemies.forEach((enemy) => (enemy.y += enemy.speed));

    game.bullets = game.bullets.filter((bullet) => bullet.y > -20);
    game.enemies = game.enemies.filter((enemy) => {
      if (intersects(game.player, enemy)) {
        setLives(state.lives - 1);
        playSound('damage');
        setStatus(`Can azaldı: ${state.lives}`);
        if (state.lives <= 0) {
          game.running = false;
          playSound('gameover');
          endAndSave('Space Shooter', game.score, 'Gemi düştü');
        }
        return false;
      }
      return enemy.y < height + 30;
    });

    game.bullets = game.bullets.filter((bullet) => {
      const hitIndex = game.enemies.findIndex((enemy) => intersects(bullet, enemy));
      if (hitIndex >= 0) {
        game.enemies.splice(hitIndex, 1);
        game.score += 1;
        setScore(game.score);
        setStatus('Düşman vuruldu');
        return false;
      }
      return true;
    });

    if (game.lives <= 0) {
      game.running = false;
      endAndSave('Space Shooter', game.score, 'Gemi düştü');
      draw();
      return;
    }

    draw();
    state.rafId = requestAnimationFrame(update);
  }

  document.onkeydown = (event) => keys.add(event.key);
  document.onkeyup = (event) => keys.delete(event.key);

  game.timer = setInterval(() => {
    if (!game.running) return;
    if (Math.random() < 0.05) setStatus('Uzay savaşı sürüyor');
  }, 1000);

  update();
}

function startQuizGame() {
  setScore(0);
  setLives(3);
  setStatus('Soru başlıyor');

  const questions = [...quizQuestions].sort(() => Math.random() - 0.5).slice(0, 5);
  let index = 0;
  let localScore = 0;

  panel.innerHTML = `
    <div class="game-layout">
      <div class="panel-box">
        <h2>Kelime / Bilgi Yarışması</h2>
        <p>Doğru cevabı seç, her doğru cevap +10 puan getirir.</p>
        <div id="quizBody"></div>
      </div>
      <div class="panel-box">
        <h3>İpucu</h3>
        <ul class="feature-list">
          <li>5 soru</li>
          <li>Her soru tek seçim</li>
          <li>Bittiğinde skor kaydedilir</li>
        </ul>
      </div>
    </div>
  `;

  const body = document.getElementById('quizBody');

  function renderQuestion() {
    const question = questions[index];
    body.innerHTML = `
      <div class="quiz-card">
        <h3>${index + 1}. ${question.question}</h3>
        <div class="quiz-options" id="quizOptions"></div>
      </div>
    `;

    const options = document.getElementById('quizOptions');
    question.answers.forEach((answer, answerIndex) => {
      const button = document.createElement('button');
      button.className = 'quiz-option';
      button.textContent = answer;
      button.addEventListener('click', () => {
        if (answerIndex === question.correct) {
          localScore += 10;
          setScore(localScore);
          setStatus('Doğru cevap');
          playSound('success');
        } else {
          setStatus('Yanlış cevap');
          setLives(state.lives - 1);
          playSound('damage');
        }
        index += 1;
        if (index >= questions.length) {
          body.innerHTML = `<div class="quiz-card"><h3>Test tamamlandı</h3><p>Son skor: ${localScore}</p></div>`;
          setTimeout(() => endAndSave('Kelime / Bilgi', localScore, 'Quiz tamamlandı'), 250);
          return;
        }
        setTimeout(renderQuestion, 350);
      });
      options.appendChild(button);
    });
  }

  renderQuestion();
}

function startClickerGame() {
  setScore(0);
  setLives(3);
  setStatus('Clicker başladı');

  let timeLeft = 20;
  let multiplier = 1;
  let clicks = 0;
  let running = true;

  panel.innerHTML = `
    <div class="game-layout">
      <div class="panel-box">
        <h2>Clicker</h2>
        <p>Merkezdeki düğmeye tıkla. Zaman içinde çarpan artabilir.</p>
        <button id="clickerBtn" class="clicker-button">TIKLA</button>
      </div>
      <div class="panel-box">
        <h3>Durum</h3>
        <div class="clicker-stats" id="clickerStats"></div>
      </div>
    </div>
  `;

  const button = document.getElementById('clickerBtn');
  const stats = document.getElementById('clickerStats');

  function refresh() {
    stats.innerHTML = `<p>Süre: ${timeLeft}</p><p>Çarpan: x${multiplier}</p><p>Toplam tık: ${clicks}</p>`;
    button.textContent = `+${multiplier} PUAN`;
  }

  button.addEventListener('click', () => {
    if (!running) return;
    clicks += 1;
    setScore(state.score + multiplier);
    playSound('click');
    if (state.score > 0 && state.score % 20 === 0) {
      multiplier += 1;
      setStatus('Çarpan arttı');
    } else {
      setStatus('Tıklandı');
    }
    refresh();
  });

  const timer = setInterval(() => {
    if (!running) return;
    timeLeft -= 1;
    refresh();
    if (timeLeft <= 0) {
      running = false;
      clearInterval(timer);
      endAndSave('Clicker', state.score, 'Süre doldu');
    }
  }, 1000);

  state.clicker = { timer };
  refresh();
}

function startDefenseGame() {
  setScore(0);
  setLives(3);
  setStatus('Savunma kuruluyor');

  const width = 760;
  const height = 420;
  const { canvas, ctx } = createCanvas(width, height);

  panel.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'arcade-wrap';
  wrap.innerHTML = `
    <div class="panel-box">
      <h2>Savunma</h2>
      <p>Kule seç, saha üzerindeki boş noktalara tıkla. Düşmanları yolun başında durdur.</p>
      <div class="tower-toolbar" id="towerToolbar"></div>
    </div>
  `;
  wrap.appendChild(canvas);
  panel.appendChild(wrap);

  const game = {
    towers: [],
    enemies: [],
    bullets: [],
    credits: 30,
    health: 3,
    score: 0,
    running: true,
    selectedType: 'basic',
  };
  state.defense = game;

  const towerTypes = {
    basic: { cost: 10, range: 130, cooldown: 55, damage: 1, color: '#4b7cff' },
    rapid: { cost: 15, range: 110, cooldown: 28, damage: 1, color: '#47d18c' },
  };

  const laneY = 180;
  const towerPositions = [120, 240, 360, 480, 600];
  const toolbar = document.getElementById('towerToolbar');
  toolbar.innerHTML = '';

  Object.entries(towerTypes).forEach(([type, config]) => {
    const button = document.createElement('button');
    button.className = 'ghost';
    button.textContent = `${type} (${config.cost})`;
    button.addEventListener('click', () => {
      game.selectedType = type;
      setStatus(`${type} seçildi`);
    });
    toolbar.appendChild(button);
  });

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    if (Math.abs(y - laneY) > 70) return;

    const slot = towerPositions.find((position) => Math.abs(position - x) < 35);
    if (!slot) return;
    if (game.towers.some((tower) => tower.x === slot)) return;

    const type = towerTypes[game.selectedType];
    if (game.credits < type.cost) {
      setStatus('Yeterli kredi yok');
      return;
    }

    game.credits -= type.cost;
    game.towers.push({ x: slot, y: laneY - 18, type: game.selectedType, cooldown: 0 });
    setStatus('Kule yerleştirildi');
  });

  function spawnEnemy() {
    game.enemies.push({ x: width + 20, y: laneY - 14, w: 24, h: 24, speed: 1.2 + Math.random() * 1.2, hp: 2 });
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#12203f');
    bg.addColorStop(1, '#070b16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#24304b';
    ctx.fillRect(0, laneY - 18, width, 36);
    ctx.fillStyle = '#3f4b73';
    for (const pos of towerPositions) ctx.fillRect(pos - 10, laneY - 35, 20, 70);

    for (const tower of game.towers) {
      const type = towerTypes[tower.type];
      ctx.fillStyle = type.color;
      ctx.fillRect(tower.x - 12, tower.y - 20, 24, 40);
    }

    ctx.fillStyle = '#ff5d73';
    for (const enemy of game.enemies) ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
    ctx.fillStyle = '#f6c244';
    for (const bullet of game.bullets) ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    ctx.fillStyle = '#edf2ff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`Kredi: ${game.credits}`, 16, 26);
    ctx.fillText(`Can: ${game.health}`, 130, 26);
    ctx.fillText(`Skor: ${game.score}`, 220, 26);
  }

  function update() {
    if (!game.running) {
      draw();
      return;
    }

    if (Math.random() < 0.03) spawnEnemy();

    for (const tower of game.towers) {
      const type = towerTypes[tower.type];
      if (tower.cooldown > 0) tower.cooldown -= 1;
      const target = game.enemies.find((enemy) => Math.abs(enemy.x - tower.x) < type.range && Math.abs(enemy.y - tower.y) < 80);
      if (target && tower.cooldown <= 0) {
        game.bullets.push({ x: tower.x, y: tower.y, w: 6, h: 4, speed: 6, damage: type.damage, target });
        tower.cooldown = type.cooldown;
      }
    }

    game.enemies.forEach((enemy) => {
      enemy.x -= enemy.speed;
    });

    game.bullets.forEach((bullet) => {
      bullet.x += bullet.speed;
    });

    game.bullets = game.bullets.filter((bullet) => {
      const hit = bullet.target && intersects(bullet, bullet.target);
      if (hit) {
        bullet.target.hp -= bullet.damage;
        if (bullet.target.hp <= 0) {
          game.score += 1;
          game.credits += 2;
          setScore(game.score);
          game.enemies = game.enemies.filter((enemy) => enemy !== bullet.target);
          setStatus('Düşman yok edildi');
        }
        return false;
      }
      return bullet.x < width + 20;
    });

    game.enemies = game.enemies.filter((enemy) => {
      if (enemy.x < -20) {
        setLives(state.lives - 1);
        playSound('damage');
        setStatus(`Can kaybı: ${state.lives}`);
        if (state.lives <= 0) {
          game.running = false;
          playSound('gameover');
          endAndSave('Savunma', game.score, 'Üs düştü');
          draw();
          return false;
        }
        return false;
      }
      return true;
    });

    if (game.health <= 0) {
      game.running = false;
      endAndSave('Savunma', game.score, 'Üs düştü');
      draw();
      return;
    }

    draw();
    state.rafId = requestAnimationFrame(update);
  }

  update();
}

const games = {
  sequence: { init: startSequenceGame },
  collector: { init: startArcadeGame },
  memory: { init: startMemoryGame },
  platformer: { init: startPlatformerGame },
  runner: { init: startRunnerGame },
  balloon: { init: startBalloonGame },
  shooter: { init: startShooterGame },
  quiz: { init: startQuizGame },
  clicker: { init: startClickerGame },
  defense: { init: startDefenseGame },
};

document.querySelectorAll('.game-btn').forEach((button) => {
  button.addEventListener('click', () => switchGame(button.dataset.game));
});

restartBtn.addEventListener('click', resetGame);
soundToggle.addEventListener('click', toggleSound);
volumeRange.addEventListener('input', () => setSoundVolume(Number(volumeRange.value) / 100));
updateSoundToggleLabel();
setSoundVolume(Number(volumeRange.value) / 100);

document.addEventListener('keydown', (event) => {
  if (state.game === 'sequence' && state.sequenceReady && state.sequenceHandler && colorKeys.includes(event.key)) {
    state.sequenceHandler(event.key, document.querySelector(`[data-color="${event.key}"]`));
  }
});

switchGame('sequence');
loadScores();
