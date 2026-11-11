(() => {
  const canvas = document.querySelector('#street-canvas');
  const gameOverlay = document.querySelector('#game-overlay');
  if (!canvas || !gameOverlay) return;

  const ctx = canvas.getContext('2d');
  const scoreLabel = document.querySelector('#game-score');
  const timeLabel = document.querySelector('#game-time');
  const livesLabel = document.querySelector('#game-lives');
  const startButton = document.querySelector('#game-start');
  const resetButton = document.querySelector('#game-reset');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const W = 960;
  const H = 400;
  const ground = 330;
  const held = { left: false, right: false };
  const skyline = Array.from({ length: 14 }, (_, i) => ({
    x: i * 83 - 12,
    width: 48 + ((i * 37) % 38),
    height: 75 + ((i * 61) % 112),
  }));
  let state = 'ready';
  let lastFrame = 0;
  let elapsed = 0;
  let displayedTime = 60;
  let score = 0;
  let lives = 3;
  let invulnerable = 0;
  let spawnObstacle = 1.1;
  let spawnPatch = 1.3;
  let scenery = 0;
  let obstacles = [];
  let patches = [];
  const player = { x: 150, y: ground - 58, width: 40, height: 58, vy: 0, onGround: true, leg: 0 };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round((rect.width * H / W) * dpr);
    ctx.setTransform(dpr * rect.width / W, 0, 0, dpr * rect.width / W, 0, 0);
    draw();
  }

  function updateHud() {
    scoreLabel.textContent = `${String(score).padStart(2, '0')} / 12`;
    displayedTime = Math.max(0, Math.ceil(60 - elapsed));
    timeLabel.textContent = String(displayedTime).padStart(2, '0');
    livesLabel.textContent = `${'♥ '.repeat(lives).trim()}${lives ? '' : '—'}`;
  }

  function resetRound() {
    elapsed = 0;
    displayedTime = 60;
    score = 0;
    lives = 3;
    invulnerable = 0;
    spawnObstacle = 1.1;
    spawnPatch = 1.2;
    obstacles = [];
    patches = [];
    player.x = 150;
    player.y = ground - player.height;
    player.vy = 0;
    player.onGround = true;
    held.left = false;
    held.right = false;
    document.querySelectorAll('.game-controls button').forEach(button => button.classList.remove('is-pressed'));
    updateHud();
  }

  function startGame() {
    resetRound();
    state = 'playing';
    gameOverlay.classList.add('is-hidden');
    canvas.focus({ preventScroll: true });
    lastFrame = performance.now();
  }

  function finishGame(won) {
    if (state !== 'playing') return;
    state = won ? 'won' : 'lost';
    overlayTitle.innerHTML = won ? 'ENTREGA<br>FEITA!' : 'FIM DE<br>CORRE.';
    overlayCopy.innerHTML = won
      ? `Você levou os ${score} patches até o destino. Rua é movimento!`
      : score >= 12
        ? 'Você pegou todos os patches! Tente fazer a entrega sem perder as vidas.'
        : `Você levou ${score} de 12 patches. Respira e tenta mais uma vez.`;
    startButton.innerHTML = 'JOGAR DE NOVO <span>↗</span>';
    gameOverlay.classList.remove('is-hidden');
    updateHud();
  }

  function jump() {
    if (state === 'playing' && player.onGround) {
      player.vy = -690;
      player.onGround = false;
    }
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function update(dt) {
    scenery += dt * (state === 'playing' ? 230 + elapsed * 2.2 : 35);
    if (state !== 'playing') return;

    elapsed += dt;
    if (Math.ceil(60 - elapsed) !== displayedTime) updateHud();
    invulnerable = Math.max(0, invulnerable - dt);
    const direction = Number(held.right) - Number(held.left);
    player.x = Math.max(28, Math.min(W - player.width - 28, player.x + direction * 360 * dt));
    player.leg += dt * (direction ? 17 : 8);
    player.vy += 1850 * dt;
    player.y += player.vy * dt;
    if (player.y >= ground - player.height) {
      player.y = ground - player.height;
      player.vy = 0;
      player.onGround = true;
    }

    const speed = 300 + Math.min(150, elapsed * 2.4);
    spawnObstacle -= dt;
    if (spawnObstacle <= 0) {
      const tall = Math.random() > 0.48;
      obstacles.push({ x: W + 22, y: ground - (tall ? 51 : 38), width: tall ? 43 : 54, height: tall ? 51 : 38, tall });
      spawnObstacle = Math.max(0.72, 1.42 - elapsed * 0.008) + Math.random() * 0.38;
    }
    spawnPatch -= dt;
    if (spawnPatch <= 0) {
      const high = Math.random() > 0.62;
      patches.push({ x: W + 24, y: ground - (high ? 119 : 47), width: 27, height: 27, spin: Math.random() * Math.PI });
      spawnPatch = 1.05 + Math.random() * 0.6;
    }

    obstacles.forEach(obstacle => { obstacle.x -= speed * dt; });
    patches.forEach(patch => { patch.x -= speed * dt; patch.spin += dt * 3; });
    obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > -10);
    patches = patches.filter(patch => patch.x + patch.width > -10);

    const body = { x: player.x + 5, y: player.y + 4, width: player.width - 10, height: player.height - 5 };
    if (invulnerable <= 0) {
      const hit = obstacles.find(obstacle => overlaps(body, obstacle));
      if (hit) {
        obstacles = obstacles.filter(obstacle => obstacle !== hit);
        lives -= 1;
        invulnerable = 1.15;
        updateHud();
        if (lives <= 0) return finishGame(false);
      }
    }
    patches = patches.filter(patch => {
      const close = overlaps({ x: body.x - 4, y: body.y - 5, width: body.width + 8, height: body.height + 10 }, patch);
      if (close) {
        score += 1;
        updateHud();
        if (score >= 12) finishGame(true);
        return false;
      }
      return true;
    });
    if (elapsed >= 60) finishGame(false);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#252824');
    sky.addColorStop(1, '#47463d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d6e363';
    ctx.beginPath();
    ctx.arc(790, 79, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#252824';
    ctx.beginPath();
    ctx.arc(800, 70, 23, 0, Math.PI * 2);
    ctx.fill();

    skyline.forEach((building, i) => {
      const shift = (scenery * (i % 3 === 0 ? 0.15 : 0.08)) % 1080;
      let x = building.x - shift;
      if (x + building.width < 0) x += 1080;
      ctx.fillStyle = i % 3 === 0 ? '#343730' : '#30332e';
      ctx.fillRect(x, ground - building.height, building.width, building.height);
      ctx.fillStyle = '#777668';
      for (let row = 0; row < Math.floor(building.height / 24); row++) {
        for (let col = 0; col < 3; col++) {
          if ((i + row + col) % 3 !== 0) ctx.fillRect(x + 8 + col * 13, ground - building.height + 13 + row * 22, 4, 7);
        }
      }
    });

    ctx.fillStyle = '#1d1f1b';
    ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#626052';
    ctx.fillRect(0, ground, W, 3);
    ctx.strokeStyle = '#67675d';
    ctx.lineWidth = 2;
    ctx.setLineDash([35, 29]);
    ctx.lineDashOffset = -scenery % 64;
    ctx.beginPath();
    ctx.moveTo(0, ground + 43);
    ctx.lineTo(W, ground + 43);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e44d32';
    ctx.fillRect(0, ground - 3, 78, 4);
  }

  function drawPlayer() {
    if (invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0) return;
    const x = player.x;
    const y = player.y;
    const step = player.onGround ? Math.sin(player.leg) * 5 : 2;
    ctx.save();
    ctx.translate(x, y);
    // legs and trainers
    ctx.strokeStyle = '#d6d3c7';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 40); ctx.lineTo(15 - step, 53);
    ctx.moveTo(27, 40); ctx.lineTo(29 + step, 53);
    ctx.stroke();
    ctx.strokeStyle = '#e44d32';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(15 - step, 54); ctx.lineTo(8 - step, 55);
    ctx.moveTo(29 + step, 54); ctx.lineTo(36 + step, 55);
    ctx.stroke();
    // backpack
    ctx.fillStyle = '#d6e363';
    ctx.fillRect(3, 17, 10, 21);
    ctx.fillStyle = '#e44d32';
    ctx.fillRect(10, 17, 23, 25);
    ctx.fillStyle = '#f2f0e9';
    ctx.fillRect(17, 24, 10, 3);
    // head and cap
    ctx.fillStyle = '#d59a70';
    ctx.beginPath();
    ctx.arc(22, 11, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d6e363';
    ctx.fillRect(10, 1, 24, 5);
    ctx.fillRect(27, 5, 10, 3);
    ctx.restore();
  }

  function drawObstacle(obstacle) {
    ctx.fillStyle = obstacle.tall ? '#b8422f' : '#c7a46d';
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.strokeStyle = '#211e1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(obstacle.x + 3, obstacle.y + 3, obstacle.width - 6, obstacle.height - 6);
    ctx.beginPath();
    ctx.moveTo(obstacle.x + 4, obstacle.y + obstacle.height - 5);
    ctx.lineTo(obstacle.x + obstacle.width - 4, obstacle.y + 5);
    ctx.moveTo(obstacle.x + 4, obstacle.y + 5);
    ctx.lineTo(obstacle.x + obstacle.width - 4, obstacle.y + obstacle.height - 5);
    ctx.stroke();
  }

  function drawPatch(patch) {
    ctx.save();
    ctx.translate(patch.x + patch.width / 2, patch.y + patch.height / 2);
    ctx.rotate(Math.sin(patch.spin) * 0.18);
    ctx.fillStyle = '#d6e363';
    ctx.fillRect(-12, -12, 24, 24);
    ctx.strokeStyle = '#171816';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.fillStyle = '#171816';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✳', 0, 1);
    ctx.restore();
  }

  function draw() {
    if (!canvas.width || !canvas.height) return;
    drawBackground();
    patches.forEach(drawPatch);
    obstacles.forEach(drawObstacle);
    drawPlayer();
    ctx.fillStyle = '#f2f0e9';
    ctx.font = '10px monospace';
    ctx.fillText('SP · 23:98', 20, 27);
    ctx.textAlign = 'right';
    ctx.fillText('RUA É MOVIMENTO', W - 20, 27);
    ctx.textAlign = 'left';
  }

  function frame(now) {
    const dt = Math.min(0.035, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function keyControl(event, pressed) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'a', 'arrowright', 'd', 'arrowup', 'w', ' '].includes(key)) event.preventDefault();
    if (key === 'arrowleft' || key === 'a') held.left = pressed;
    if (key === 'arrowright' || key === 'd') held.right = pressed;
    if (pressed && (key === 'arrowup' || key === 'w' || key === ' ')) jump();
    if (pressed && key === 'enter' && state !== 'playing') startGame();
  }

  document.addEventListener('keydown', event => keyControl(event, true));
  document.addEventListener('keyup', event => keyControl(event, false));
  window.addEventListener('blur', () => { held.left = false; held.right = false; });
  document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); });
  startButton.addEventListener('click', startGame);
  resetButton.addEventListener('click', startGame);
  document.querySelectorAll('.game-controls button').forEach(button => {
    const control = button.dataset.control;
    const press = event => {
      event.preventDefault();
      button.classList.add('is-pressed');
      if (control === 'jump') jump();
      else held[control] = true;
      if (button.setPointerCapture && event.pointerId !== undefined) button.setPointerCapture(event.pointerId);
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
  resizeCanvas();
  updateHud();
  lastFrame = performance.now();
  requestAnimationFrame(frame);
})();
