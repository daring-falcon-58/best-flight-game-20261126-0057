// The Kestrel — Sky Courier's own courier plane — and its arcade flight model.
// Built from primitives (no imported model): cream fuselage, burnt-orange wings, a
// spinning propeller and red/green nav lights. The model is deliberately forgiving:
// bank to turn, pitch to climb and dive, throttle to gain speed, and lift fades below
// stall speed so the plane sinks instead of snapping out of the sky.
import * as THREE from 'three';

export const STALL_SPEED = 22; // m/s — below this the wing stops lifting
export const MAX_SPEED = 92; // m/s at full throttle, level flight
export const CRUISE_SPEED = 55;

export function buildPlane() {
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.55, metalness: 0.08 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe86a1c, roughness: 0.5, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x16324a, roughness: 0.12, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.3 });

  const plane = new THREE.Group();

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 4.4, 12), cream);
  fuselage.rotation.x = Math.PI / 2; fuselage.castShadow = true; plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), cream);
  nose.position.z = 2.2; nose.scale.set(1, 0.9, 0.9); plane.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), glass);
  canopy.scale.set(0.85, 0.62, 1.5); canopy.position.set(0, 0.48, 0.9); plane.add(canopy);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.5, 12), orange);
  stripe.rotation.x = Math.PI / 2; stripe.position.z = 0.6; plane.add(stripe);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.16, 1.5), orange);
  wing.position.set(0, -0.05, 0.3); wing.castShadow = true; plane.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 1.3), cream);
  wingTipL.position.set(-3.7, -0.05, 0.3); plane.add(wingTipL);
  const wingTipR = wingTipL.clone(); wingTipR.position.x = 3.7; plane.add(wingTipR);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.95), orange);
  stab.position.set(0, 0.12, -2.0); plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 1.05), orange);
  fin.position.set(0, 0.55, -2.0); plane.add(fin);

  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), dark);
  hub.rotation.x = Math.PI / 2; prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.22, 2.5, 0.06);
  const blade1 = new THREE.Mesh(bladeGeo, dark); prop.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, dark); blade2.rotation.z = Math.PI / 2; prop.add(blade2);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 10), orange);
  spinner.rotation.x = Math.PI / 2; spinner.position.z = 0.3; prop.add(spinner);
  prop.position.z = 2.75;
  plane.add(prop);

  // Fixed gear: two wheels and a tail wheel.
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6), dark);
    leg.position.set(sx * 0.8, -0.75, 0.9); plane.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 0.8, -1.08, 0.9); plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 8), dark);
  tailWheel.rotation.z = Math.PI / 2; tailWheel.position.set(0, -0.55, -2.1); plane.add(tailWheel);

  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 2 }));
  navL.position.set(-3.85, -0.05, 0.3); plane.add(navL);
  const navR = navL.clone();
  navR.material = new THREE.MeshStandardMaterial({ color: 0x2aff5a, emissive: 0x00ff33, emissiveIntensity: 2 });
  navR.position.x = 3.85; plane.add(navR);

  plane.userData.prop = prop;
  return plane;
}

export function makeFlight() {
  return {
    pos: new THREE.Vector3(0, 2.2, 0),
    vel: new THREE.Vector3(0, 0, 0),
    quat: new THREE.Quaternion(),
    speed: 0,
    throttle: 0,
    pitch: 0, // radians, nose up positive
    roll: 0, // radians, right wing down positive
    heading: Math.PI / 2, // radians, 0 = north (-z), 90 deg = east (+x)
    crashed: false,
    landed: false,
    onGround: true,
  };
}

/**
 * One fixed physics step. `input` is { pitch: -1..1, roll: -1..1, throttleDelta: -1..1 }.
 * Returns an event string: 'stall' | 'terrain' | 'landed' | null.
 */
export function stepFlight(f, input, dt, heightAt) {
  if (f.crashed || f.landed) return null;
  const up = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(f.quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(f.quat);

  // Throttle: 0..1, eased toward the target the pilot asks for.
  f.throttle = THREE.MathUtils.clamp(f.throttle + input.throttleDelta * dt * 0.55, 0, 1);

  // Attitude: pitch and roll chase the pilot's stick with first-order lag.
  const pitchTarget = input.pitch * 0.42;
  const rollTarget = input.roll * 1.05;
  f.pitch += (pitchTarget - f.pitch) * Math.min(1, dt * 3.2);
  f.roll += (rollTarget - f.roll) * Math.min(1, dt * 3.2);

  // Banked turn: heading rate grows with bank angle and speed.
  const turnRate = -Math.sin(f.roll) * THREE.MathUtils.clamp(f.speed / 45, 0, 1) * 0.75;
  f.heading += turnRate * dt;

  // Rebuild the orientation from heading + pitch + roll (yaw-pitch-roll, Z-up world).
  // Signs: positive pitch is nose-up (Rx(-pitch) lifts the +z nose), positive roll is
  // right-wing-down (Rz(-roll) drops the +x wingtip), so a right bank turns right.
  const euler = new THREE.Euler(-f.pitch, f.heading, -f.roll, 'YXZ');
  f.quat.setFromEuler(euler);

  // Speed: thrust minus drag, minus the climb penalty, plus a dive gain.
  const climb = Math.sin(f.pitch);
  const accel = f.throttle * 26 - 0.0032 * f.speed * f.speed - 9.8 * climb * 0.55;
  f.speed = THREE.MathUtils.clamp(f.speed + accel * dt, 0, MAX_SPEED);

  // Velocity follows the nose; lift fades below stall speed and the plane sinks.
  const lift = THREE.MathUtils.clamp(f.speed / STALL_SPEED, 0, 1);
  f.vel.copy(fwd).multiplyScalar(f.speed);
  if (!f.onGround) f.vel.y -= (1 - lift) * 9;
  f.pos.addScaledVector(f.vel, dt);

  // Ground handling: rolling on the runway, taking off, landing.
  const ground = heightAt(f.pos.x, f.pos.z);
  const clearance = f.pos.y - ground;
  if (f.onGround) {
    f.pos.y = ground + 2.2;
    if (f.speed > 26 && f.pitch > 0.06) { f.onGround = false; }
  } else if (clearance <= 2.2) {
    const onRunway = Math.abs(f.pos.x) < 200 && Math.abs(f.pos.z) < 16;
    const gentle = f.vel.y > -6 && Math.abs(f.roll) < 0.35 && f.speed < 45;
    if (onRunway && gentle && f.speed > 8) {
      f.landed = true; f.onGround = true; f.pos.y = ground + 2.2; return 'landed';
    }
    f.crashed = true; return 'terrain';
  }
  if (!f.onGround && f.speed < STALL_SPEED * 0.55 && clearance < 40) return 'stall';
  return null;
}

/**
 * Steer the plane toward `target` (a Vector3): used by the screenshot autopilot.
 * A proportional heading controller with bank chosen from the turn rate it asks for
 * (no saturated-bank limit cycle), a pitch gain that actually climbs, and a speed
 * schedule that slows the plane down as it nears the ring so the turn radius fits.
 * When `approachDir` is given (the course direction into the ring), the plane
 * lines up on a point 180 m before the ring while far away, so it arrives through
 * the hole instead of orbiting it.
 */
export function autopilotInput(f, target, approachDir = null) {
  const to = new THREE.Vector3().subVectors(target, f.pos);
  const dist = to.length();
  const aim = (approachDir && dist > 200)
    ? new THREE.Vector3().copy(target).addScaledVector(approachDir, -180)
    : target;
  const toAim = new THREE.Vector3().subVectors(aim, f.pos);
  // Internal heading: forward = (sin h, 0, cos h), so h = atan2(toAim.x, toAim.z).
  const wantHeading = Math.atan2(toAim.x, toAim.z);
  let dH = wantHeading - f.heading;
  while (dH > Math.PI) dH -= Math.PI * 2;
  while (dH < -Math.PI) dH += Math.PI * 2;
  // Ask for a turn rate proportional to the heading error, capped by what the
  // wing can deliver at this speed; invert it into the bank that produces it.
  const speedFactor = THREE.MathUtils.clamp(f.speed / 45, 0, 1);
  const maxTurn = 0.75 * Math.max(speedFactor, 0.15);
  const desiredTurn = THREE.MathUtils.clamp(dH * 1.2, -maxTurn, maxTurn);
  const sinRoll = THREE.MathUtils.clamp(-desiredTurn / maxTurn, -0.94, 0.94);
  const rollCmd = Math.asin(sinRoll) / 1.05;
  // Pitch: climb hard toward the aim point's height, within the model's authority.
  const wantPitch = THREE.MathUtils.clamp(Math.atan2(toAim.y, Math.hypot(toAim.x, toAim.z)), -0.42, 0.42);
  const pitchCmd = THREE.MathUtils.clamp((wantPitch - f.pitch) * 5, -1, 1);
  // Speed schedule: fast between rings, slow on the final approach.
  const targetSpeed = dist > 250 ? 62 : dist > 120 ? 48 : 38;
  let throttleCmd = 0.1;
  if (f.speed < targetSpeed - 3) throttleCmd = 0.7;
  else if (f.speed > targetSpeed + 3) throttleCmd = -0.5;
  return { pitch: pitchCmd, roll: rollCmd, throttleDelta: throttleCmd };
}
