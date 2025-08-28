// Tug of Rope - prototype with AI opponent (Red)
// Save as main.js and open index.html
// Controls: W / ArrowUp = Blue pull; release key to stop. Touch top half = Blue pull.

// Canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width, H = canvas.height;

const scoreEl = document.getElementById('score');
const overlay = document.getElementById('overlay');
const msg = document.getElementById('msg');
const restartBtn = document.getElementById('restart');

let blueScore = 0, redScore = 0;

// Rope data
const SEGMENTS = 24;
const rope = [];
const ropeRestLen = 18;
const gravity = 0.0;
const friction = 0.995;

function resetRope(){
  rope.length = 0;
  const cx = W/2;
  for (let i=0;i<SEGMENTS;i++){
    const t = i/(SEGMENTS-1);
    const x = cx;
    const y = 80 + t*(H - 160);
    rope.push({ x, y, px: x, py: y });
  }
}
resetRope();

let lastTime = performance.now();
let bluePulling = false;
let redPulling = false;
let gameOver = false;

// Players (visual)
const blue = { x: W/2, y: 52, radius: 36, color: '#009ee6' };
const red  = { x: W/2, y: H-52, radius: 36, color: '#e03434' };

// AI configuration
const redAI = {
  difficulty: 0.86,     // 0.0 (easy) .. 1.0 (very hard)
  reactionTimer: 0,     // ms until next decision
  pulling: false,
  pullDuration: 0,
  restDuration: 0,
  stamina: 1.0          // 0..1 (can be used for future complexity)
};

// Keyboard input
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'r') doReset();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// Touch controls (top half -> blue pull)
canvas.addEventListener('touchstart', e => { e.preventDefault(); handleTouch(e.touches, true); });
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleTouch(e.touches, true); });
canvas.addEventListener('touchend', e => { e.preventDefault(); bluePulling = false; });
function handleTouch(touches, down){
  bluePulling = false;
  for (let t of touches){
    const rect = canvas.getBoundingClientRect();
    const y = t.clientY - rect.top;
    if (y < rect.height/2) { bluePulling = true; break; }
  }
}
// Mouse for quick testing
canvas.addEventListener('mousedown', e => {
  const r = canvas.getBoundingClientRect();
  if (e.clientY - r.top < r.height/2) bluePulling = true;
  else { /* don't let player control red; AI handles it */ }
});
window.addEventListener('mouseup', () => { bluePulling = false; });

// Restart
restartBtn.addEventListener('click', doReset);
function doReset(){
  resetRope();
  gameOver = false;
  overlay.classList.add('hidden');
  bluePulling = false;
  redAI.pulling = false;
  redAI.reactionTimer = 0;
}

// Verlet integration & constraints
function verlet(dt){
  for (let p of rope){
    const nx = p.x + (p.x - p.px) * friction;
    const ny = p.y + (p.y - p.py) * friction + gravity * dt * 0.001;
    p.px = p.x; p.py = p.y;
    p.x = nx; p.y = ny;
  }

  // Apply pulls based on states
  const pullStrength = 1.6;
  if (bluePulling){
    rope[0].y -= pullStrength;
    rope[1].y -= pullStrength * 0.8;
  }
  if (redPulling){
    rope[rope.length-1].y += pullStrength;
    rope[rope.length-2].y += pullStrength * 0.8;
  }

  // constraints: iterate for stability
  for (let iter=0; iter<6; iter++){
    for (let i=0;i<rope.length-1;i++){
      const a = rope[i], b = rope[i+1];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const diff = (d - ropeRestLen) / d;
      const mx = dx * 0.5 * diff;
      const my = dy * 0.5 * diff;
      // ends slightly stiffer to better reflect player grip
      const aBias = (i === 0) ? 0.25 : 1;
      const bBias = (i+1 === rope.length-1) ? 0.25 : 1;
      a.x += mx * aBias;
      a.y += my * aBias;
      b.x -= mx * bBias;
      b.y -= my * bBias;
    }
    // gentle centering horizontally
    for (let i=0;i<rope.length;i++){
      const targetX = W/2;
      rope[i].x += (targetX - rope[i].x) * 0.002;
    }
  }

  // clamp to bounds
  for (let p of rope){
    p.x = Math.max(40, Math.min(W-40, p.x));
    p.y = Math.max(60, Math.min(H-60, p.y));
  }
}

// AI logic for Red
function updateRedAI(dt){
  // Reduce reaction timer
  redAI.reactionTimer -= dt;
  if (redAI.reactionTimer > 0) {
    // keep current pulling state until timer expires
    redPulling = redAI.pulling;
    return;
  }

  // Decide based on rope center position and difficulty + randomness
  const mid = rope[Math.floor(rope.length/2)];
  const centerBias = (mid.y - H/2); // negative when rope pulled to blue(top), positive when to red(bottom)

  // probability to pull increases when rope is being pulled toward blue (centerBias negative)
  // compute desire score: positive -> pull, negative -> rest
  const desire = (-(centerBias) * 0.012) + (redAI.difficulty * 0.6) + (Math.random() - 0.5) * 0.3;

  if (desire > 0.4 && redAI.stamina > 0.15) {
    // start pulling
    redAI.pulling = true;
    // pull duration depends on desire
    redAI.pullDuration = 180 + Math.random()*220 * (1 + redAI.difficulty);
    redAI.reactionTimer = redAI.pullDuration;
    // small stamina cost
    redAI.stamina = Math.max(0.25, redAI.stamina - 0.06 * (1 + redAI.difficulty));
  } else {
    // rest / small tug
    redAI.pulling = false;
    redAI.restDuration = 120 + Math.random()*400 * (1 - redAI.difficulty + 0.2);
    redAI.reactionTimer = redAI.restDuration;
    // recover stamina slightly
    redAI.stamina = Math.min(1.0, redAI.stamina + 0.03 * (1 - redAI.difficulty + 0.3));
  }

  redPulling = redAI.pulling;
}

// Check victory: midpoint move past threshold
function checkVictory(){
  const middle = rope[Math.floor(rope.length/2)];
  const threshold = 120;
  const dy = middle.y - H/2;
  if (dy < -threshold) return 'blue';
  if (dy > threshold) return 'red';
  return null;
}

// Drawing helpers
function draw(){
  ctx.clearRect(0,0,W,H);

  // background center "road" like reference
  const roadH = 120;
  ctx.fillStyle = '#555';
  ctx.fillRect(0, (H - roadH)/2, W, roadH);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, (H - roadH)/2 - 8, W, 6);
  ctx.fillRect(0, (H + roadH)/2 + 2, W, 6);

  // rope main stroke
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#b58f6a';
  ctx.beginPath();
  for (let i=0;i<rope.length;i++){
    const p = rope[i];
    if (i===0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // twisted highlight
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,240,210,0.95)';
  ctx.beginPath();
  for (let i=0;i<rope.length;i++){
    const p = rope[i];
    const ofs = (i % 2 === 0) ? 4 : -4;
    if (i===0) ctx.moveTo(p.x + ofs, p.y);
    else ctx.lineTo(p.x + ofs, p.y);
  }
  ctx.stroke();
  ctx.restore();

  // center diamond marker
  const mid = rope[Math.floor(rope.length/2)];
  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(Math.PI/4);
  ctx.fillStyle = '#f2d43b';
  ctx.fillRect(-16, -8, 32, 16);
  ctx.restore();

  // draw players
  drawPlayer(blue, true);
  drawPlayer(red, false);

  // small HUD near players
  ctx.fillStyle = '#fff';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BLUE', blue.x, blue.y - 56);
  ctx.fillText('RED', red.x, red.y + 56);
}

function drawPlayer(p, isBlue){
  ctx.save();
  ctx.translate(p.x, p.y);
  // shadow
  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.ellipse(0, p.radius+8, p.radius+6, 10, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI*2);
  ctx.fill();

  // brows (like image)
  ctx.fillStyle = '#222';
  ctx.fillRect(-14, -6, 10, 6);
  ctx.fillRect(4, -6, 10, 6);

  // hands near rope endpoint
  const idx = isBlue ? 0 : rope.length - 1;
  const rp = rope[idx];
  const dx = rp.x - p.x, dy = rp.y - p.y;
  const ang = Math.atan2(dy, dx);
  for (let i=0;i<2;i++){
    ctx.save();
    ctx.rotate(ang + (i===0?0.45:-0.45));
    ctx.fillStyle = '#7b3f1a';
    ctx.beginPath();
    ctx.ellipse(p.radius - 6, 6 - i*8, 8, 10, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// Main loop
function frame(now){
  const dt = now - lastTime;
  lastTime = now;

  // update blue pulling from keyboard or touch
  bluePulling = !!(keys['w'] || keys['arrowup'] || bluePulling);

  // update AI
  if (!gameOver){
    updateRedAI(dt);
  } else {
    redPulling = false;
  }

  // physics
  verlet(dt);

  // spring rope ends to player's grip positions for better look
  const topGrip = { x: blue.x, y: blue.y + blue.radius - 6 };
  const botGrip = { x: red.x,  y: red.y - red.radius + 6 };
  const k = 0.22;
  rope[0].x += (topGrip.x - rope[0].x) * k;
  rope[0].y += (topGrip.y - rope[0].y) * k;
  rope[rope.length-1].x += (botGrip.x - rope[rope.length-1].x) * k;
  rope[rope.length-1].y += (botGrip.y - rope[rope.length-1].y) * k;

  // Check win
  if (!gameOver){
    const winner = checkVictory();
    if (winner){
      gameOver = true;
      if (winner === 'blue') { blueScore++; showWin('BLUE WINS!'); }
      else { redScore++; showWin('RED WINS!'); }
      scoreEl.textContent = `Blue ${blueScore} — ${redScore} Red`;
    }
  }

  draw();
  requestAnimationFrame(frame);
}

function showWin(text){
  msg.textContent = text;
  overlay.classList.remove('hidden');
}

// Resize handler
function resize(){
  W = canvas.width; H = canvas.height;
  blue.x = W/2; blue.y = 52;
  red.x = W/2; red.y = H-52;
  resetRope();
}
window.addEventListener('resize', resize);

// Start
resize();
requestAnimationFrame(frame);