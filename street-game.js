(() => {
  'use strict';

  const canvas = document.querySelector('#street-canvas');
  const gameOverlay = document.querySelector('#game-overlay');
  if (!canvas || !gameOverlay) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const shell = canvas.closest('.game-shell');
  const stage = canvas.closest('.game-stage');
  const scoreLabel = document.querySelector('#game-score');
  const timeLabel = document.querySelector('#game-time');
  const livesLabel = document.querySelector('#game-lives');
  const bestLabel = document.querySelector('#game-best');
  const startButton = document.querySelector('#game-start');
  const resetButton = document.querySelector('#game-reset');
  const pauseButton = document.querySelector('#game-pause');
  const soundButton = document.querySelector('#game-sound');
  const statusLabel = document.querySelector('#game-status');
  const overlayKicker = document.querySelector('#overlay-kicker');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');

  const W = 960;
  const H = 400;
  const ground = 330;
  const DURATION = 60;
  const TARGET = 12;
  const BEST_KEY = 'rua98-night-run-best-v1';
  const SOUND_KEY = 'rua98-night-run-sound';
  const held = { left: false, right: false };

  const backline = Array.from({ length: 16 }, (_, i) => ({
    x: i * 75,
    width: 48 + ((i * 37) % 34),
    height: 62 + ((i * 61) % 100),
  }));
  const frontline = Array.from({ length: 10 }, (_, i) => ({
    x: i * 120,
    width: 74 + ((i * 43) % 54),
    height: 96 + ((i * 79) % 118),
  }));
  const stars = Array.from({ length: 46 }, (_, i) => ({
    x: (i * 197) % W,
    y: 18 + ((i * 83) % 132),
    size: i % 8 === 0 ? 1.8 : 1,
    phase: i * 1.7,
  }));

  let state = 'ready';
  let lastFrame = 0;
  let elapsed = 0;
  let bonusTime = 0;
  let displayedTime = DURATION;
  let score = 0;
  let lives = 3;
  let invulnerable = 0;
  let shield = 0;
  let combo = 0;
  let bestCombo = 0;
  let spawnObstacle = 1.1;
  let spawnPatch = 0.85;
  let spawnPower = 8;
  let scenery = 0;
  let shake = 0;
  let flash = 0;
  let dustTimer = 0;
  let obstacles = [];
  let patches = [];
  let powerups = [];
  let particles = [];
  let floaters = [];

  const player = {
    x: 150,
    y: ground - 58,
    width: 40,
    height: 58,
    vy: 0,
    onGround: true,
    leg: 0,
  };

  let best = loadBest();
  let soundOn = loadSoundSetting();
  let audioCtx = null;

  function loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch (error) {
      /* Storage can be unavailable in private browsing. */
    }
  }

  function loadSoundSetting() {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch (error) {
      return true;
    }
  }

  function saveSoundSetting() {
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    } catch (error) {
      /* Storage can be unavailable in private browsing. */
    }
  }

  function unlockAudio() {
    if (!soundOn) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone(frequency, duration = 0.12, type = 'sine', volume = 0.035, slideTo = 0, delay = 0) {
    if (!soundOn) return;
    const audio = unlockAudio();
    if (!audio) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  const sfx = {
    jump() {
      tone(300, 0.11, 'square', 0.025, 430);
    },
    pickup() {
      tone(660, 0.08, 'square', 0.03);
      tone(990, 0.12, 'square', 0.024, 0, 0.055);
    },
    combo() {
      tone(880, 0.1, 'triangle', 0.03);
      tone(1320, 0.14, 'triangle', 0.026, 0, 0.07);
    },
    power() {
      tone(520, 0.1, 'triangle', 0.035);
      tone(780, 0.1, 'triangle', 0.032, 0, 0.07);
      tone(1040, 0.18, 'triangle', 0.028, 0, 0.14);
    },
    shieldBreak() {
      tone(240, 0.2, 'sawtooth', 0.045, 110);
    },
    hit() {
      tone(150, 0.28, 'sawtooth', 0.052, 58);
    },
    pause() {
      tone(440, 0.08, 'square', 0.022, 330);
    },
    win() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone(frequency, 0.24, 'triangle', 0.038, 0, index * 0.13);
      });
    },
    lose() {
      tone(320, 0.2, 'triangle', 0.04, 260);
      tone(190, 0.4, 'triangle', 0.036, 90, 0.16);
    },
  };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function bestText() {
    if (!best) return '—';
    if (best.won) return `${TARGET} · ${Math.max(1, Math.round(best.time || 0))}s`;
    return `${pad(Math.min(TARGET, best.patches || 0))}/12`;
  }

  function updateHud() {
    displayedTime = Math.max(0, Math.ceil(DURATION - elapsed + bonusTime));
    if (scoreLabel) scoreLabel.textContent = `${pad(score)} / ${TARGET}`;
    if (timeLabel) {
      timeLabel.textContent = String(displayedTime);
      timeLabel.classList.toggle('is-urgent', state === 'playing' && displayedTime <= 10);
    }
    if (livesLabel) {
      const hearts = lives > 0 ? '♥ '.repeat(lives).trim() : '—';
      livesLabel.textContent = lives > 0 && shield > 0 ? `${hearts} +⬡` : hearts;
    }
    if (bestLabel) {
      bestLabel.textContent = bestText();
      bestLabel.title = best && best.won
        ? `Melhor entrega: ${Math.round(best.time)} segundos`
        : 'Seu melhor corre até agora';
    }
  }

  function setStatus(message) {
    if (statusLabel) statusLabel.textContent = message;
  }

  function showOverlay(kicker, title, copy, button) {
    if (overlayKicker) overlayKicker.textContent = kicker;
    if (overlayTitle) overlayTitle.innerHTML = title;
    if (overlayCopy) overlayCopy.innerHTML = copy;
    if (startButton) startButton.innerHTML = button;
    gameOverlay.classList.remove('is-hidden');
    if (stage) stage.classList.add('is-overlay-open');
  }

  function hideOverlay() {
    gameOverlay.classList.add('is-hidden');
    if (stage) stage.classList.remove('is-overlay-open');
  }

  function updatePauseButton() {
    if (!pauseButton) return;
    const active = state === 'playing' || state === 'paused';
    pauseButton.disabled = !active;
    pauseButton.textContent = state === 'paused' ? 'VOLTAR ▶' : 'PAUSAR ❚❚';
    pauseButton.setAttribute('aria-label', state === 'paused' ? 'Voltar ao jogo' : 'Pausar jogo');
  }

  function clearPressedControls() {
    document.querySelectorAll('.game-controls button').forEach(button => button.classList.remove('is-pressed'));
  }

  function resetRound() {
    elapsed = 0;
    bonusTime = 0;
    displayedTime = DURATION;
    score = 0;
    lives = 3;
    invulnerable = 0;
    shield = 0;
    combo = 0;
    bestCombo = 0;
    spawnObstacle = 1.1;
    spawnPatch = 0.85;
    spawnPower = 8;
    scenery = 0;
    shake = 0;
    flash = 0;
    dustTimer = 0;
    obstacles = [];
    patches = [];
    powerups = [];
    particles = [];
    floaters = [];
    player.x = 150;
    player.y = ground - player.height;
    player.vy = 0;
    player.onGround = true;
    player.leg = 0;
    held.left = false;
    held.right = false;
    clearPressedControls();
    updateHud();
  }

  function startGame() {
    resetRound();
    state = 'playing';
    hideOverlay();
    updatePauseButton();
    unlockAudio();
    canvas.focus({ preventScroll: true });
    lastFrame = performance.now();
    setStatus('Corrida iniciada. Colete 12 patches e evite as caixas.');
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    held.left = false;
    held.right = false;
    clearPressedControls();
    updatePauseButton();
    showOverlay(
      'CORRE PAUSADO',
      'PAUSA<br>NO CORRE.',
      'A rua espera. Respira e volta quando quiser.<br>Seu progresso está guardado.',
      'VOLTAR PRO CORRE <span>▶</span>',
    );
    sfx.pause();
    setStatus('Jogo pausado.');
    if (startButton) startButton.focus({ preventScroll: true });
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    hideOverlay();
    updatePauseButton();
    lastFrame = performance.now();
    canvas.focus({ preventScroll: true });
    setStatus('De volta ao corre.');
  }

  function finishGame(won, reason = '') {
    if (state !== 'playing') return;
    state = won ? 'won' : 'lost';
    held.left = false;
    held.right = false;
    clearPressedControls();
    updatePauseButton();

    const previousBest = best;
    let newRecord = false;
    if (won) {
      if (!previousBest || !previousBest.won || elapsed < previousBest.time) {
        best = { won: true, time: Math.round(elapsed * 10) / 10, patches: TARGET };
        newRecord = true;
        saveBest();
      }
    } else if (score > 0 && (!previousBest || (!previousBest.won && score > (previousBest.patches || 0)))) {
      best = { won: false, patches: score, time: Math.round(elapsed * 10) / 10 };
      newRecord = true;
      saveBest();
    }
    updateHud();

    if (won) {
      addBurst(player.x + player.width / 2, player.y + player.height / 2, ['#d6e363', '#f2f0e9', '#e44d32'], 42, 240);
      sfx.win();
    } else {
      sfx.lose();
    }

    const recordLine = newRecord
      ? won
        ? '<br><b>NOVO RECORDE PESSOAL.</b>'
        : '<br><b>NOVO MELHOR ATÉ AGORA.</b>'
      : '';
    let title;
    let kicker;
    let copy;
    if (won) {
      kicker = 'ENTREGA CONCLUÍDA';
      title = 'ENTREGA<br>FEITA!';
      copy = `Você levou os ${TARGET} patches em ${Math.max(1, Math.round(elapsed))}s.${recordLine}<br>Rua é movimento!`;
    } else if (reason === 'time') {
      kicker = 'TEMPO ESGOTADO';
      title = 'O TEMPO<br>FECHOU.';
      copy = `Você estava com ${score} de ${TARGET} patches.${recordLine}<br>Relógios compram tempo. Escudos seguram o tranco.`;
    } else {
      kicker = 'FIM DA LINHA';
      title = 'FIM DE<br>CORRE.';
      copy = `Você levou ${score} de ${TARGET} patches antes de fechar o corre.${recordLine}<br>Tenta de novo: o caminho é seu.`;
    }

    showOverlay(kicker, title, copy, won ? 'CORRER DE NOVO <span>↗</span>' : 'TENTAR DE NOVO <span>↗</span>');
    setStatus(won ? 'Entrega feita! Você completou os 12 patches.' : `Fim de corrida com ${score} de 12 patches.`);
    if (startButton) startButton.focus({ preventScroll: true });
  }

  function jump() {
    if (state !== 'playing' || !player.onGround) return;
    player.vy = -710;
    player.onGround = false;
    sfx.jump();
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function addBurst(x, y, colors, count, power = 180) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.25 + Math.random() * 0.75) * power;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.4 + Math.random() * 0.4,
        max: 0.8,
        size: 2 + Math.random() * 4,
        gravity: 560,
        color: colors[index % colors.length],
      });
    }
    if (particles.length > 180) particles.splice(0, particles.length - 180);
  }

  function addFloater(text, x, y, color = '#d6e363', size = 12) {
    floaters.push({ text, x, y, color, size, life: 1, max: 1 });
    if (floaters.length > 12) floaters.shift();
  }

  function gameSpeed() {
    return 300 + Math.min(170, elapsed * 2.6);
  }

  function updateEffects(dt) {
    shake = Math.max(0, shake - dt * 2.2);
    flash = Math.max(0, flash - dt * 2.6);
    particles.forEach(particle => {
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    });
    particles = particles.filter(particle => particle.life > 0);
    floaters.forEach(floater => {
      floater.y -= dt * 38;
      floater.life -= dt;
    });
    floaters = floaters.filter(floater => floater.life > 0);
  }

  function spawnPatchGroup() {
    const high = Math.random() > 0.62;
    if (elapsed > 8 && Math.random() < 0.2) {
      for (let index = 0; index < 3; index += 1) {
        patches.push({
          x: W + 24 + index * 40,
          y: ground - (high ? 108 + (index === 1 ? 20 : 0) : 47),
          width: 27,
          height: 27,
          spin: Math.random() * Math.PI,
        });
      }
      return;
    }
    patches.push({
      x: W + 24,
      y: ground - (high ? 119 : 47),
      width: 27,
      height: 27,
      spin: Math.random() * Math.PI,
    });
  }

  function update(dt) {
    if (dt > 0.05) {
      const steps = Math.ceil(dt / 0.05);
      for (let index = 0; index < steps; index += 1) update(dt / steps);
      return;
    }

    let speed = 0;
    if (state === 'playing') {
      speed = gameSpeed();
      scenery += dt * speed;
      elapsed += dt;
      if (Math.max(0, Math.ceil(DURATION - elapsed + bonusTime)) !== displayedTime) updateHud();
      invulnerable = Math.max(0, invulnerable - dt);
      shield = Math.max(0, shield - dt);

      const direction = Number(held.right) - Number(held.left);
      player.x = Math.max(28, Math.min(W - player.width - 28, player.x + direction * 360 * dt));
      player.leg += dt * (direction ? 18 : 10);
      player.vy += 1900 * dt;
      player.y += player.vy * dt;
      if (player.y >= ground - player.height) {
        player.y = ground - player.height;
        player.vy = 0;
        player.onGround = true;
      }

      dustTimer -= dt;
      if (player.onGround && direction && dustTimer <= 0) {
        dustTimer = 0.1;
        particles.push({
          x: player.x + (direction > 0 ? 5 : player.width - 5),
          y: ground - 3,
          vx: -speed * 0.18 + (Math.random() - 0.5) * 30,
          vy: -20 - Math.random() * 35,
          life: 0.3,
          max: 0.3,
          size: 2 + Math.random() * 3,
          gravity: 120,
          color: '#777668',
        });
      }

      spawnObstacle -= dt;
      if (spawnObstacle <= 0) {
        const tall = Math.random() > 0.48;
        obstacles.push({
          x: W + 22,
          y: ground - (tall ? 51 : 38),
          width: tall ? 43 : 54,
          height: tall ? 51 : 38,
          tall,
        });
        spawnObstacle = Math.max(0.68, 1.38 - elapsed * 0.009) + Math.random() * 0.34;
      }

      spawnPatch -= dt;
      if (spawnPatch <= 0) {
        spawnPatchGroup();
        spawnPatch = 1.05 + Math.random() * 0.62;
      }

      spawnPower -= dt;
      if (spawnPower <= 0) {
        const kind = Math.random() < 0.56 ? 'shield' : 'clock';
        powerups.push({ x: W + 26, y: ground - 132, width: 32, height: 32, kind, bob: Math.random() * Math.PI * 2 });
        spawnPower = 10.5 + Math.random() * 6;
      }

      const drift = speed * dt;
      obstacles.forEach(obstacle => { obstacle.x -= drift; });
      patches.forEach(patch => {
        patch.x -= drift;
        patch.spin += dt * 3;
      });
      powerups.forEach(powerup => {
        powerup.x -= drift;
        powerup.bob += dt * 4;
      });
      obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > -10);
      patches = patches.filter(patch => patch.x + patch.width > -10);
      powerups = powerups.filter(powerup => powerup.x + powerup.width > -10);

      const body = { x: player.x + 6, y: player.y + 5, width: player.width - 12, height: player.height - 7 };
      if (invulnerable <= 0) {
        const hit = obstacles.find(obstacle => overlaps(body, obstacle));
        if (hit) {
          obstacles = obstacles.filter(obstacle => obstacle !== hit);
          const centerX = hit.x + hit.width / 2;
          const centerY = hit.y + hit.height / 2;
          if (shield > 0) {
            shield = 0;
            invulnerable = 0.9;
            shake = Math.max(shake, 0.35);
            addBurst(centerX, centerY, ['#8fe6f2', '#f2f0e9'], 20, 210);
            addFloater('ESCUDO!', player.x + 12, player.y - 6, '#8fe6f2', 11);
            sfx.shieldBreak();
            updateHud();
            setStatus('O escudo absorveu a batida.');
          } else {
            lives -= 1;
            combo = 0;
            invulnerable = 1.35;
            shake = 0.75;
            flash = 0.75;
            addBurst(centerX, centerY, ['#e44d32', '#f2f0e9', '#b8422f'], 24, 230);
            addFloater('-1 VIDA', player.x + 4, player.y - 8, '#e44d32', 11);
            sfx.hit();
            updateHud();
            setStatus(`Batida! ${lives} ${lives === 1 ? 'vida restante' : 'vidas restantes'}.`);
            if (lives <= 0) {
              finishGame(false, 'lives');
              return;
            }
          }
        }
      }

      patches = patches.filter(patch => {
        const pickupBox = { x: body.x - 4, y: body.y - 5, width: body.width + 8, height: body.height + 10 };
        if (!overlaps(pickupBox, patch)) return true;
        score += 1;
        combo += 1;
        bestCombo = Math.max(bestCombo, combo);
        addBurst(patch.x + patch.width / 2, patch.y + patch.height / 2, ['#d6e363', '#f2f0e9'], 14, 170);
        addFloater('+1', patch.x + 6, patch.y - 2, '#d6e363', 12);
        if (combo > 0 && combo % 4 === 0) {
          bonusTime += 2;
          addFloater('COMBO +2s', player.x - 12, player.y - 20, '#f2f0e9', 10);
          sfx.combo();
        } else {
          sfx.pickup();
        }
        updateHud();
        setStatus(`Patch ${score} de ${TARGET}.`);
        if (score >= TARGET) finishGame(true, 'target');
        return false;
      });
      if (state !== 'playing') return;

      powerups = powerups.filter(powerup => {
        const pickupBox = { x: body.x - 8, y: body.y - 8, width: body.width + 16, height: body.height + 16 };
        if (!overlaps(pickupBox, powerup)) return true;
        if (powerup.kind === 'shield') {
          shield = 12;
          addFloater('ESCUDO 12s', powerup.x - 8, powerup.y - 2, '#8fe6f2', 11);
          setStatus('Escudo ativo por 12 segundos.');
        } else {
          bonusTime += 8;
          addFloater('+8 SEG', powerup.x - 4, powerup.y - 2, '#f2f0e9', 12);
          setStatus('Mais 8 segundos no relógio.');
        }
        addBurst(powerup.x + powerup.width / 2, powerup.y + powerup.height / 2, powerup.kind === 'shield' ? ['#8fe6f2', '#d6e363'] : ['#f2f0e9', '#e44d32'], 20, 190);
        sfx.power();
        updateHud();
        return false;
      });

      if (DURATION - elapsed + bonusTime <= 0) {
        finishGame(false, 'time');
        return;
      }
    } else if (state === 'ready') {
      scenery += dt * 40;
      player.leg += dt * 3;
    }

    updateEffects(dt);
  }

  function drawSkyline(layer, factor, fill, windows) {
    const span = 1200;
    const shift = (scenery * factor) % span;
    layer.forEach((building, index) => {
      let x = building.x - shift;
      if (x + building.width < 0) x += span;
      if (x > W) return;
      ctx.fillStyle = fill;
      ctx.fillRect(x, ground - building.height, building.width, building.height);
      ctx.fillStyle = windows;
      const rows = Math.max(0, Math.floor(building.height / 25));
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          if ((index + row + column) % 4 !== 0) {
            ctx.fillRect(x + 8 + column * 13, ground - building.height + 12 + row * 22, 4, 7);
          }
        }
      }
      if (index % 4 === 0) {
        ctx.fillStyle = fill;
        ctx.fillRect(x + building.width * 0.22, ground - building.height - 8, building.width * 0.2, 8);
      }
    });
  }

  function drawStreetLamps() {
    const span = 340;
    const shift = (scenery * 0.55) % span;
    for (let x = -shift - 20; x < W + span; x += span) {
      ctx.fillStyle = '#151713';
      ctx.fillRect(x, ground - 150, 3, 150);
      ctx.fillRect(x - 16, ground - 150, 19, 3);
      ctx.fillStyle = '#d6e363';
      ctx.fillRect(x - 19, ground - 149, 8, 3);
      const glow = ctx.createRadialGradient(x - 15, ground - 146, 1, x - 15, ground - 146, 56);
      glow.addColorStop(0, 'rgba(214,227,99,.17)');
      glow.addColorStop(1, 'rgba(214,227,99,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 71, ground - 202, 112, 112);
    }
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#222522');
    sky.addColorStop(0.62, '#37392f');
    sky.addColorStop(1, '#4a493d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#f2f0e9';
    stars.forEach(star => {
      ctx.globalAlpha = 0.22 + Math.abs(Math.sin(star.phase + scenery / 700)) * 0.5;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.globalAlpha = 1;

    const moonGlow = ctx.createRadialGradient(790, 79, 8, 790, 79, 74);
    moonGlow.addColorStop(0, 'rgba(214,227,99,.28)');
    moonGlow.addColorStop(1, 'rgba(214,227,99,0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(716, 5, 150, 150);
    ctx.fillStyle = '#d6e363';
    ctx.beginPath();
    ctx.arc(790, 79, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3029';
    ctx.beginPath();
    ctx.arc(800, 70, 23, 0, Math.PI * 2);
    ctx.fill();

    drawSkyline(backline, 0.055, '#30332d', '#6c6c5b');
    drawSkyline(frontline, 0.14, '#1e201c', '#85856d');
    drawStreetLamps();

    ctx.fillStyle = '#171915';
    ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#25271f';
    ctx.fillRect(0, ground, W, 9);
    ctx.fillStyle = '#77735f';
    ctx.fillRect(0, ground, W, 2);
    ctx.fillStyle = '#d6e363';
    ctx.fillRect(0, ground, 64, 2);

    ctx.strokeStyle = '#5f5d50';
    ctx.lineWidth = 2;
    ctx.setLineDash([38, 28]);
    ctx.lineDashOffset = -(scenery * 0.9) % 66;
    ctx.beginPath();
    ctx.moveTo(0, ground + 62);
    ctx.lineTo(W, ground + 62);
    ctx.stroke();
    ctx.setLineDash([]);

    const crossShift = (scenery * 0.7) % 480;
    ctx.fillStyle = '#3d3e35';
    for (let x = -crossShift; x < W + 480; x += 480) {
      for (let stripe = 0; stripe < 5; stripe += 1) {
        ctx.fillRect(x + stripe * 18, ground + 14, 9, 42);
      }
    }

    ctx.fillStyle = 'rgba(214,227,99,.07)';
    ctx.fillRect(0, ground + 112, W, 22);
    ctx.fillStyle = 'rgba(242,240,233,.1)';
    ctx.fillRect(0, ground + 110, W, 1);
  }

  function drawObstacle(obstacle) {
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath();
    ctx.ellipse(obstacle.x + obstacle.width / 2, ground + 4, obstacle.width * 0.62, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = obstacle.tall ? '#b8422f' : '#c7a46d';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.fillStyle = obstacle.tall ? '#d2604a' : '#d9bb8a';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, 4);
    ctx.strokeStyle = '#211e1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(obstacle.x + 3, obstacle.y + 3, obstacle.width - 6, obstacle.height - 6);
    ctx.beginPath();
    ctx.moveTo(obstacle.x + 5, obstacle.y + obstacle.height - 5);
    ctx.lineTo(obstacle.x + obstacle.width - 5, obstacle.y + 5);
    ctx.moveTo(obstacle.x + 5, obstacle.y + 5);
    ctx.lineTo(obstacle.x + obstacle.width - 5, obstacle.y + obstacle.height - 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(33,30,26,.82)';
    ctx.font = 'bold 6px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(obstacle.tall ? 'FRÁGIL' : 'CAIXA', obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height - 6);
    ctx.textAlign = 'left';
  }

  function drawPatch(patch) {
    const centerX = patch.x + patch.width / 2;
    const centerY = patch.y + patch.height / 2;
    const glow = ctx.createRadialGradient(centerX, centerY, 3, centerX, centerY, 28);
    glow.addColorStop(0, 'rgba(214,227,99,.24)');
    glow.addColorStop(1, 'rgba(214,227,99,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(centerX - 30, centerY - 30, 60, 60);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.sin(patch.spin) * 0.18);
    ctx.fillStyle = '#d6e363';
    ctx.fillRect(-12, -12, 24, 24);
    ctx.strokeStyle = '#171816';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.fillStyle = '#171816';
    ctx.font = 'bold 12px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✳', 0, 1);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawPowerup(powerup) {
    const centerX = powerup.x + powerup.width / 2;
    const centerY = powerup.y + powerup.height / 2 + Math.sin(powerup.bob) * 4;
    const color = powerup.kind === 'shield' ? '#8fe6f2' : '#f2f0e9';
    const glow = ctx.createRadialGradient(centerX, centerY, 3, centerX, centerY, 34);
    glow.addColorStop(0, powerup.kind === 'shield' ? 'rgba(143,230,242,.32)' : 'rgba(242,240,233,.22)');
    glow.addColorStop(1, 'rgba(143,230,242,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(centerX - 36, centerY - 36, 72, 72);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.sin(powerup.bob * 0.7) * 0.08);
    if (powerup.kind === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(13, -8);
      ctx.lineTo(10, 6);
      ctx.lineTo(0, 15);
      ctx.lineTo(-10, 6);
      ctx.lineTo(-13, -8);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#171816';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, -5);
      ctx.lineTo(4, 4);
      ctx.lineTo(0, 8);
      ctx.lineTo(-4, 4);
      ctx.lineTo(-6, -5);
      ctx.closePath();
      ctx.fillStyle = '#1d2424';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#e44d32';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = '#171816';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -8);
      ctx.moveTo(0, 0);
      ctx.lineTo(6, 3);
      ctx.stroke();
      ctx.fillStyle = '#171816';
      ctx.font = 'bold 7px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+8', 0, 26);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function drawPlayer() {
    const centerX = player.x + player.width / 2;
    const air = ground - (player.y + player.height);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.35 - air / 520)})`;
    ctx.beginPath();
    ctx.ellipse(centerX, ground + 2, 22 - Math.min(8, air / 30), 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (invulnerable > 0 && Math.floor(invulnerable * 14) % 2 === 0) return;

    const bob = player.onGround ? Math.abs(Math.sin(player.leg)) * 1.8 : 0;
    const direction = Number(held.right) - Number(held.left);
    const step = player.onGround ? Math.sin(player.leg) * 5 : 2;
    const tilt = direction * 0.045;

    ctx.save();
    ctx.translate(centerX, player.y + player.height);
    ctx.rotate(tilt);
    ctx.translate(-player.width / 2, -player.height - bob);

    // scarf trailing behind
    ctx.strokeStyle = '#e44d32';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const flap = Math.sin(player.leg * 0.8) * 3;
    ctx.beginPath();
    ctx.moveTo(12, 18);
    ctx.quadraticCurveTo(-8, 12 + flap, -22, 20 + flap);
    ctx.stroke();

    // legs and trainers
    ctx.strokeStyle = '#d6d3c7';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(16, 40);
    ctx.lineTo(15 - step, 53);
    ctx.moveTo(27, 40);
    ctx.lineTo(29 + step, 53);
    ctx.stroke();
    ctx.strokeStyle = '#e44d32';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(15 - step, 54);
    ctx.lineTo(8 - step, 55);
    ctx.moveTo(29 + step, 54);
    ctx.lineTo(36 + step, 55);
    ctx.stroke();

    // backpack
    ctx.fillStyle = '#d6e363';
    ctx.fillRect(3, 17, 10, 21);
    ctx.fillStyle = '#e44d32';
    ctx.fillRect(10, 17, 23, 25);
    ctx.fillStyle = '#f2f0e9';
    ctx.fillRect(17, 24, 10, 3);
    ctx.fillStyle = '#171816';
    ctx.fillRect(11, 33, 21, 2);

    // head and cap
    ctx.fillStyle = '#d59a70';
    ctx.beginPath();
    ctx.arc(22, 11, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#171816';
    ctx.fillRect(25, 11, 2, 2);
    ctx.fillStyle = '#d6e363';
    ctx.fillRect(10, 1, 24, 5);
    ctx.fillRect(27, 5, 10, 3);
    ctx.restore();

    if (shield > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(143,230,242,${0.55 + Math.sin(performance.now() / 160) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -performance.now() / 45;
      ctx.beginPath();
      ctx.arc(centerX, player.y + player.height / 2, 37, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEffects() {
    particles.forEach(particle => {
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;

    floaters.forEach(floater => {
      ctx.globalAlpha = Math.min(1, floater.life * 2.4);
      ctx.font = `bold ${floater.size}px "DM Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(23,24,22,.8)';
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1;
  }

  function drawCanvasLabels() {
    ctx.fillStyle = '#f2f0e9';
    ctx.font = '10px "DM Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SP · 23:98', 20, 27);
    ctx.textAlign = 'right';
    ctx.fillText('RUA É MOVIMENTO', W - 20, 27);
    ctx.textAlign = 'left';

    if (shield > 0) {
      ctx.fillStyle = '#8fe6f2';
      ctx.font = '9px "DM Mono", monospace';
      ctx.fillText(`ESCUDO ${Math.ceil(shield)}s`, 20, 44);
    }
    if (combo >= 2) {
      ctx.fillStyle = 'rgba(214,227,99,.9)';
      ctx.font = 'bold 11px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${combo}`, W / 2, 28);
      ctx.textAlign = 'left';
    }
  }

  function draw() {
    if (!canvas.width || !canvas.height) return;
    ctx.save();
    if (shake > 0) {
      ctx.translate(Math.sin(performance.now() * 0.09) * shake * 8, Math.cos(performance.now() * 0.11) * shake * 5);
    }
    drawBackground();
    powerups.forEach(drawPowerup);
    patches.forEach(drawPatch);
    obstacles.forEach(drawObstacle);
    drawPlayer();
    drawEffects();
    drawCanvasLabels();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(228,77,50,${flash * 0.34})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    const dt = Math.min(0.25, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round((rect.width * H / W) * dpr);
    ctx.setTransform((dpr * rect.width) / W, 0, 0, (dpr * rect.width) / W, 0, 0);
    draw();
  }

  function keyControl(event, pressed) {
    const key = event.key.toLowerCase();
    const isMoveKey = ['arrowleft', 'a', 'arrowright', 'd', 'arrowup', 'w', ' '].includes(key);
    const isPauseKey = key === 'p' || key === 'escape';

    if (pressed && isPauseKey && !event.repeat && (state === 'playing' || state === 'paused')) {
      event.preventDefault();
      if (state === 'playing') pauseGame();
      else resumeGame();
      return;
    }
    if (state !== 'playing' && !(pressed && isMoveKey && state === 'paused')) return;
    if (isMoveKey) event.preventDefault();
    if (key === 'arrowleft' || key === 'a') held.left = pressed;
    if (key === 'arrowright' || key === 'd') held.right = pressed;
    if (pressed && (key === 'arrowup' || key === 'w' || key === ' ')) jump();
  }

  document.addEventListener('keydown', event => keyControl(event, true));
  document.addEventListener('keyup', event => keyControl(event, false));
  window.addEventListener('blur', () => {
    held.left = false;
    held.right = false;
    clearPressedControls();
    if (state === 'playing') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') pauseGame();
    lastFrame = performance.now();
  });

  startButton.addEventListener('click', () => {
    if (state === 'paused') resumeGame();
    else startGame();
  });
  resetButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', () => {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  });
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    saveSoundSetting();
    soundButton.textContent = `SOM: ${soundOn ? 'ON' : 'OFF'}`;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) {
      unlockAudio();
      sfx.pickup();
    }
  });
  canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));

  document.querySelectorAll('.game-controls button').forEach(button => {
    const control = button.dataset.control;
    const press = event => {
      event.preventDefault();
      if (state !== 'playing') return;
      button.classList.add('is-pressed');
      if (control === 'jump') jump();
      else held[control] = true;
      if (button.setPointerCapture && event.pointerId !== undefined) {
        try {
          button.setPointerCapture(event.pointerId);
        } catch (error) {
          /* Synthetic pointers may not be capturable. */
        }
      }
    };
    const release = event => {
      if (event) event.preventDefault();
      button.classList.remove('is-pressed');
      if (control !== 'jump') held[control] = false;
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', event => event.preventDefault());
  });

  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
  else window.addEventListener('resize', resizeCanvas);

  if ('IntersectionObserver' in window && shell) {
    let gameWasVisible = false;
    const visibilityObserver = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry.isIntersecting) gameWasVisible = true;
      else if (gameWasVisible && state === 'playing') pauseGame();
    }, { threshold: 0.08 });
    visibilityObserver.observe(shell);
  }

  soundButton.textContent = `SOM: ${soundOn ? 'ON' : 'OFF'}`;
  soundButton.setAttribute('aria-pressed', String(soundOn));
  updateHud();
  updatePauseButton();
  resizeCanvas();
  lastFrame = performance.now();
  requestAnimationFrame(frame);

  if (new URLSearchParams(window.location.search).has('debug')) {
    Object.defineProperty(window, '__nightRun', {
      value: {
        get state() { return state; },
        get score() { return score; },
        get lives() { return lives; },
        get combo() { return combo; },
        get playerY() { return player.y; },
        get playerX() { return player.x; },
        get onGround() { return player.onGround; },
        start: startGame,
        pause: pauseGame,
        resume: resumeGame,
        win() {
          score = TARGET;
          updateHud();
          finishGame(true, 'target');
        },
        lose() {
          lives = 0;
          updateHud();
          finishGame(false, 'lives');
        },
        setScore(value) {
          score = Math.max(0, Math.min(TARGET, Number(value) || 0));
          updateHud();
        },
        setTime(seconds) {
          elapsed = Math.max(0, DURATION - Math.max(0, Number(seconds) || 0));
          bonusTime = 0;
          updateHud();
        },
      },
    });
  }
})();
