// The valley of Sky Courier: a seeded heightfield with a river, a lake, a runway strip,
// pine forest, drifting clouds and the eight-ring courier course. heightAt(x, z) is the
// single source of truth for the mesh, the collision test and the ring placement.
import * as THREE from 'three';
import { makeNoise, mulberry32 } from './rng.js';

export const WORLD_SIZE = 2600;
export const WATER_Y = 3.2;
export const RUNWAY = { x: 0, z: 0, length: 420, width: 34, headingDeg: 90 };

const RING_DEFS = [
  [320, 95, -260], [680, 130, -480], [820, 165, 60], [470, 200, 540],
  [-40, 215, 680], [-480, 175, 430], [-780, 140, -80], [-380, 105, -480],
];
export const RING_RADIUS = 9;

/** The river meanders east-west across the valley. */
function riverZ(x) { return 150 * Math.sin(x * 0.0016) + 60 * Math.sin(x * 0.004 + 1.7); }

export function makeWorld(seed) {
  const noise = makeNoise(seed);
  const rand = mulberry32(seed ^ 0x9e3779b9);

  function rawHeight(x, z) {
    let h = noise(x * 0.004, z * 0.004) * 58
      + noise(x * 0.016, z * 0.016) * 16
      + noise(x * 0.055, z * 0.055) * 3.5;
    // Mountain wall to the north (negative z) and a ridge to the far east.
    const north = THREE.MathUtils.clamp((-z - 620) / 420, 0, 1);
    h += north * north * 150 * (0.55 + 0.45 * noise(x * 0.006 + 40, z * 0.006));
    const east = THREE.MathUtils.clamp((x - 950) / 300, 0, 1);
    h += east * east * 80 * (0.6 + 0.4 * noise(x * 0.005, z * 0.005 + 80));
    return h;
  }

  function heightAt(x, z) {
    let h = rawHeight(x, z);
    // Calm the valley floor near the airfield so takeoffs are forgiving: the
    // terrain grows to full height only beyond ~1 km from the runway.
    const d0 = Math.hypot(x, z);
    h *= 0.25 + 0.75 * THREE.MathUtils.smoothstep(d0, 350, 1000);
    // Carve the river valley down to just below the water line.
    const dRiver = Math.abs(z - riverZ(x));
    if (dRiver < 90) {
      const t = THREE.MathUtils.smoothstep(dRiver, 12, 90);
      h = THREE.MathUtils.lerp(1.5, h, t);
    }
    // Flatten a shelf for the runway and the airfield.
    const dx = Math.abs(x - RUNWAY.x); const dz = Math.abs(z - RUNWAY.z);
    const dRun = Math.max(dx / 320, dz / 130);
    if (dRun < 1) {
      const t = THREE.MathUtils.smoothstep(dRun, 0.25, 1);
      h = THREE.MathUtils.lerp(0, h, t);
    }
    return h;
  }

  // ---- terrain mesh (vertex colours by height / land use) ----
  const SEG = 180;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x5d8a3c); const cGrass2 = new THREE.Color(0x7aa84e);
  const cField = new THREE.Color(0xb59a4e); const cSand = new THREE.Color(0xcbb98a);
  const cRock = new THREE.Color(0x8a8578); const cSnow = new THREE.Color(0xeef2f5);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const patch = noise(x * 0.002 + 31, z * 0.002 + 17);
    // The flattened airfield shelf is mown grass, not sand.
    const dRun = Math.max(Math.abs(x - RUNWAY.x) / 320, Math.abs(z - RUNWAY.z) / 130);
    // Sand only on the river's banks; the low valley floor is meadow grass.
    const dRiver = Math.abs(z - riverZ(x));
    if (h < 6 && dRiver < 25) tmp.copy(cSand);
    else if (dRun < 1.15) tmp.copy(cGrass).lerp(cGrass2, 0.4);
    else if (h < 42) tmp.copy(cGrass).lerp(cGrass2, THREE.MathUtils.clamp(0.5 + patch * 0.5, 0, 1));
    else if (h < 78) tmp.copy(cGrass2).lerp(cRock, (h - 42) / 36);
    else if (h < 120) tmp.copy(cRock);
    else tmp.copy(cRock).lerp(cSnow, THREE.MathUtils.clamp((h - 120) / 40, 0, 1));
    // Farmland patches on the flat valley floor.
    if (h >= 6 && h < 30 && patch > 0.45) tmp.lerp(cField, 0.55);
    colours[i * 3] = tmp.r; colours[i * 3 + 1] = tmp.g; colours[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0,
  }));
  terrain.receiveShadow = true;

  // ---- sky dome (gradient shader, sun glow near the sun azimuth) ----
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0.55, 0.38, 0.42).normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 zen = vec3(0.16, 0.38, 0.72);
        vec3 hor = vec3(0.82, 0.90, 0.97);
        vec3 col = mix(hor, zen, pow(max(h, 0.0), 0.62));
        float sun = pow(max(dot(normalize(vDir), sunDir), 0.0), 90.0);
        float halo = pow(max(dot(normalize(vDir), sunDir), 0.0), 7.0);
        col += vec3(1.0, 0.82, 0.5) * sun * 0.9 + vec3(1.0, 0.75, 0.45) * halo * 0.28;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), skyMat);

  // ---- sun disc + clouds ----
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }),
  );
  sun.position.set(2300, 1600, 1750); sun.lookAt(0, 0, 0);
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.92,
    emissive: 0xffffff, emissiveIntensity: 0.55,
  });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 16; i += 1) {
    const cluster = new THREE.Group();
    const n = 3 + Math.floor(rand() * 4);
    for (let j = 0; j < n; j += 1) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set((rand() - 0.5) * 90, (rand() - 0.5) * 14, (rand() - 0.5) * 46);
      const s = 22 + rand() * 30;
      puff.scale.set(s, s * 0.42, s * 0.7);
      cluster.add(puff);
    }
    cluster.position.set((rand() - 0.5) * 2400, 260 + rand() * 130, (rand() - 0.5) * 2400);
    clouds.add(cluster);
  }

  // ---- river + lake (flat translucent water) ----
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f7fb8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82,
  });
  const riverPts = [];
  for (let x = -1300; x <= 1300; x += 40) riverPts.push(new THREE.Vector2(x, riverZ(x)));
  const riverShape = new THREE.Shape();
  riverShape.moveTo(riverPts[0].x, riverPts[0].y - 26);
  for (const p of riverPts) riverShape.lineTo(p.x, p.y - 26);
  for (let i = riverPts.length - 1; i >= 0; i -= 1) riverShape.lineTo(riverPts[i].x, riverPts[i].y + 26);
  riverShape.closePath();
  const riverGeo = new THREE.ShapeGeometry(riverShape);
  riverGeo.rotateX(-Math.PI / 2);
  const river = new THREE.Mesh(riverGeo, waterMat);
  river.position.y = WATER_Y;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(150, 40), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-950, WATER_Y, 520);

  // ---- runway (canvas-painted asphalt with markings) ----
  const rc = document.createElement('canvas'); rc.width = 512; rc.height = 64;
  const g = rc.getContext('2d');
  g.fillStyle = '#2e3138'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#3a3e46';
  for (let i = 0; i < 400; i += 1) g.fillRect(rand() * 512, rand() * 64, 2, 2);
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 3, 512, 3); g.fillRect(0, 58, 512, 3);
  for (let x = 20; x < 512; x += 42) g.fillRect(x, 29, 22, 6);
  g.fillStyle = '#ffd166'; g.fillRect(8, 10, 14, 44); g.fillRect(490, 10, 14, 44);
  const runwayTex = new THREE.CanvasTexture(rc);
  runwayTex.colorSpace = THREE.SRGBColorSpace;
  runwayTex.anisotropy = 4;
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.length, RUNWAY.width),
    new THREE.MeshStandardMaterial({ map: runwayTex, roughness: 0.9 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(RUNWAY.x, 0.4, RUNWAY.z);
  runway.receiveShadow = true;

  // ---- pine forest (instanced) ----
  const treeCount = 650;
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 6, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const crownGeo = new THREE.ConeGeometry(4.2, 16, 7);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2e5d2a, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  const dummy = new THREE.Object3D();
  let placed = 0; let tries = 0;
  while (placed < treeCount && tries < 8000) {
    tries += 1;
    const x = (rand() - 0.5) * 2400; const z = (rand() - 0.5) * 2400;
    const h = heightAt(x, z);
    if (h < 8 || h > 60) continue;
    if (Math.abs(z - riverZ(x)) < 45) continue;
    if (Math.abs(x) < 340 && Math.abs(z) < 150) continue; // keep the airfield clear
    const s = 0.7 + rand() * 0.9;
    dummy.position.set(x, h + 2.5 * s, z);
    dummy.scale.setScalar(s); dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix(); trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (6 + 8) * s;
    dummy.updateMatrix(); crowns.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  trunks.count = placed; crowns.count = placed;
  trunks.castShadow = true; crowns.castShadow = true;

  // ---- the ring course ----
  const rings = [];
  const ringGroup = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 1.1, 12, 40);
  for (let i = 0; i < RING_DEFS.length; i += 1) {
    const [x, y, z] = RING_DEFS[i];
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff8c1a, emissive: 0xff6a00, emissiveIntensity: 0.9, roughness: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(x, y, z);
    const next = RING_DEFS[(i + 1) % RING_DEFS.length];
    const dir = new THREE.Vector3(next[0] - x, next[1] - y, next[2] - z).normalize();
    ring.lookAt(ring.position.clone().add(dir));
    // The approach direction (from the previous ring, or the runway for ring 1):
    // the autopilot lines up on it from far away so it arrives through the hole.
    const prev = i === 0 ? [0, 2, 0] : RING_DEFS[i - 1];
    const approach = new THREE.Vector3(x - prev[0], y - prev[1], z - prev[2]).normalize();
    ring.userData = { index: i, centre: new THREE.Vector3(x, y, z), passed: false, approach };
    rings.push(ring);
    ringGroup.add(ring);
    // A slim guide pylon under each ring so it reads from far away.
    const pylon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, Math.max(10, y - heightAt(x, z)), 6),
      new THREE.MeshStandardMaterial({ color: 0xff8c1a, emissive: 0x903a00, emissiveIntensity: 0.5 }),
    );
    pylon.position.set(x, (y + heightAt(x, z)) / 2, z);
    ringGroup.add(pylon);
  }

  const group = new THREE.Group();
  group.add(terrain, sky, sun, clouds, river, lake, runway, trunks, crowns, ringGroup);
  return { group, heightAt, rings, ringGroup, clouds, terrain };
}
