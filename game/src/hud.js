// The HUD: a DOM overlay (crisp text in screenshots) plus two small canvases — the
// compass strip and the artificial horizon. update() is called every rendered frame.
const $ = (id) => document.getElementById(id);

export function makeHud() {
  const compass = $('compass-canvas').getContext('2d');
  const attitude = $('attitude').getContext('2d');
  let msgTimer = 0;

  function fmtTime(sec) {
    const m = Math.floor(sec / 60); const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawCompass(headingDeg) {
    const W = 280; const H = 26;
    compass.clearRect(0, 0, W, H);
    compass.fillStyle = 'rgba(8,24,38,0)';
    compass.font = 'bold 13px sans-serif';
    compass.textAlign = 'center'; compass.textBaseline = 'middle';
    // One tick every 15 degrees; the strip scrolls so the current heading stays centred.
    for (let d = -90; d <= 90; d += 15) {
      const deg = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
      const x = W / 2 + (d / 15) * 34;
      const cardinal = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[deg];
      compass.fillStyle = cardinal ? '#ffd166' : '#cfe8ff';
      compass.fillText(cardinal ?? String(deg), x, 10);
      compass.fillRect(x - 0.5, 19, 1, 6);
    }
    compass.fillStyle = '#ffd166';
    compass.beginPath(); compass.moveTo(W / 2 - 6, 0); compass.lineTo(W / 2 + 6, 0);
    compass.lineTo(W / 2, 6); compass.closePath(); compass.fill();
  }

  function drawAttitude(pitch, roll) {
    const S = 120; const C = S / 2;
    attitude.clearRect(0, 0, S, S);
    attitude.save();
    attitude.beginPath(); attitude.arc(C, C, C - 2, 0, Math.PI * 2); attitude.clip();
    attitude.translate(C, C);
    attitude.rotate(-roll);
    attitude.translate(0, pitch * 110);
    attitude.fillStyle = '#3f8fd2'; attitude.fillRect(-C, -C * 2, S, C * 2); // sky
    attitude.fillStyle = '#8a6b3a'; attitude.fillRect(-C, 0, S, C * 2); // ground
    attitude.fillStyle = '#fff'; attitude.fillRect(-C, -1.5, S, 3); // horizon line
    attitude.restore();
    // Fixed aircraft symbol + bank pointer.
    attitude.strokeStyle = '#ffd166'; attitude.lineWidth = 3;
    attitude.beginPath(); attitude.moveTo(C - 26, C); attitude.lineTo(C - 8, C);
    attitude.moveTo(C + 8, C); attitude.lineTo(C + 26, C);
    attitude.moveTo(C, C - 4); attitude.lineTo(C, C + 4); attitude.stroke();
    attitude.fillStyle = '#ffd166';
    attitude.beginPath(); attitude.arc(C + Math.sin(roll) * (C - 8), C - Math.cos(roll) * (C - 8), 4, 0, Math.PI * 2); attitude.fill();
  }

  return {
    show() { $('hud').classList.remove('hidden'); },
    hide() { $('hud').classList.add('hidden'); },
    message(text, seconds = 2.2) {
      const el = $('msg');
      el.textContent = text; el.style.opacity = '1';
      msgTimer = seconds;
      return msgTimer;
    },
    warn(text) { const el = $('warn'); el.textContent = text; el.style.opacity = text ? '1' : '0'; },
    update(state, dt) {
      const msToKt = 1.94384; const mToFt = 3.28084;
      $('ias').textContent = Math.round(state.speed * msToKt);
      $('alt').textContent = Math.round(Math.max(0, (state.pos.y - state.groundY) * mToFt));
      $('vs').textContent = Math.round(state.vel.y * mToFt * 60);
      const bearing = ((Math.atan2(state.fwd.x, -state.fwd.z) * 180 / Math.PI) + 360) % 360;
      $('hdg').textContent = String(Math.round(bearing)).padStart(3, '0');
      drawCompass(bearing);
      $('time').textContent = fmtTime(state.time);
      $('score').textContent = state.score;
      $('fuel').textContent = Math.round(state.fuel);
      $('ring-count').textContent = `${state.ringsPassed} / ${state.ringsTotal}`;
      $('ring-next').textContent = state.nextRing == null ? 'LAND' : `R${state.nextRing + 1}`;
      $('throttle-fill').style.height = `${Math.round(state.throttle * 100)}%`;
      drawAttitude(state.pitch, state.roll);
      if (msgTimer > 0) {
        msgTimer -= dt;
        if (msgTimer <= 0) $('msg').style.opacity = '0';
      }
    },
  };
}
