// Deterministic screenshot scenes behind ?shot=start|play|ring|end. Each one plays the
// real flight model forward from a fresh start, steered by the same autopilot a player
// could use, so every frame is what a short game really looks like and the same seed
// always gives the same frame. No input, no randomness at shot time.
import * as THREE from 'three';
import { autopilotInput, stepFlight } from './plane.js';

const STEP = 1 / 60;

/** Run the autopilot until `stop(state)` is true or `maxSeconds` elapse. */
function runPilot(game, stop, maxSeconds) {
  const limit = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < limit; i += 1) {
    const target = game.nextRingTarget();
    if (!target) break;
    const input = autopilotInput(game.flight, target, game.nextRingApproach());
    stepFlight(game.flight, input, STEP, game.world.heightAt);
    game.afterStep(STEP);
    if (stop(game)) break;
  }
}

/**
 * Stage the named scene on a fresh game and return the screen to show over it.
 * start: parked on the runway, title screen. play: mid-course, ring ahead, HUD lit.
 * ring: metres from the next ring, filling the frame. end: all eight rings flown,
 * mission-complete screen over the valley.
 */
export function stageShot(name, game) {
  game.reset();
  if (name === 'play') {
    runPilot(game, (g) => g.ringsPassed >= 3, 90);
    return { screen: 'play' };
  }
  if (name === 'ring') {
    runPilot(game, (g) => {
      const t = g.nextRingTarget();
      return t ? g.flight.pos.distanceTo(t) < 34 : false;
    }, 150);
    return { screen: 'play' };
  }
  if (name === 'end') {
    runPilot(game, (g) => g.ringsPassed >= 8, 300);
    game.completeMission();
    return { screen: 'complete' };
  }
  return { screen: 'title' };
}

export { THREE };
