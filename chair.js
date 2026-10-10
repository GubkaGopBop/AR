import * as THREE from './vendor/three.module.js';

// All sizes are in metres. The wheels touch y=0 in the group's local space.
export function createOfficeChair() {
  const chair = new THREE.Group();
  chair.name = 'office-chair';
  const fabric = new THREE.MeshStandardMaterial({ color: 0x26394d, roughness: 0.9 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0x344e67, roughness: 0.92 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x20262d, roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9ca9b5, metalness: 0.75, roughness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.95 });

  function add(geometry, material, x, y, z, parent = chair) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function roundedBox(w, h, d, radius = 0.015) {
    const r = Math.min(radius, w / 4, h / 4, d / 4);
    const x = -w / 2 + r, y = -h / 2 + r;
    const a = w - 2 * r, b = h - 2 * r;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + a - r, y);
    shape.quadraticCurveTo(x + a, y, x + a, y + r);
    shape.lineTo(x + a, y + b - r);
    shape.quadraticCurveTo(x + a, y + b, x + a - r, y + b);
    shape.lineTo(x + r, y + b);
    shape.quadraticCurveTo(x, y + b, x, y + b - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d - 2 * r, bevelEnabled: true, bevelThickness: r,
      bevelSize: r, bevelSegments: 3, steps: 1, curveSegments: 6
    });
    geometry.translate(0, 0, -d / 2 + r);
    return geometry;
  }
  function bar(start, end, radius, material) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, direction.length(), 16), material, 0, 0, 0);
    mesh.position.copy(a.add(b).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  // Five-spoke base and paired caster wheels.
  add(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 32), frame, 0, 0.13, 0);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const x = Math.sin(angle), z = Math.cos(angle);
    bar([x * 0.055, 0.145, z * 0.055], [x * 0.29, 0.075, z * 0.29], 0.022, metal);
    bar([x * 0.29, 0.075, z * 0.29], [x * 0.29, 0.035, z * 0.29], 0.014, frame);
    for (const side of [-1, 1]) {
      const wheel = add(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 20), rubber,
        x * 0.29 + z * side * 0.018, 0.035, z * 0.29 - x * side * 0.018);
      wheel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(z, 0, -x));
    }
  }
  add(new THREE.CylinderGeometry(0.032, 0.04, 0.21, 24), frame, 0, 0.265, 0);
  add(new THREE.CylinderGeometry(0.021, 0.021, 0.15, 24), metal, 0, 0.42, 0);
  add(roundedBox(0.3, 0.045, 0.27), frame, 0, 0.46, 0);
  const seat = add(roundedBox(0.51, 0.085, 0.48, 0.025), cushion, 0, 0.52, 0.015);
  seat.name = 'seat';
  bar([0, 0.46, -0.16], [0, 0.79, -0.27], 0.025, frame);

  const back = new THREE.Group();
  back.position.set(0, 0.86, -0.235);
  back.rotation.x = -0.11;
  chair.add(back);
  add(roundedBox(0.49, 0.53, 0.075, 0.018), frame, 0, 0, 0, back);
  add(roundedBox(0.435, 0.47, 0.04, 0.012), fabric, 0, 0, 0.045, back);
  // Subtle stitched panels make the backrest readable from a distance.
  for (const y of [-0.14, -0.04, 0.06, 0.16]) {
    add(roundedBox(0.39, 0.006, 0.006, 0.001), cushion, 0, y, 0.068, back);
  }
  add(roundedBox(0.32, 0.09, 0.06, 0.012), cushion, 0, -0.16, 0.075, back);
  bar([-0.075, 1.06, -0.255], [-0.075, 1.17, -0.275], 0.012, metal);
  bar([0.075, 1.06, -0.255], [0.075, 1.17, -0.275], 0.012, metal);
  const headrest = add(roundedBox(0.32, 0.14, 0.075, 0.018), cushion, 0, 1.2, -0.275);
  headrest.rotation.x = -0.11;

  for (const side of [-1, 1]) {
    bar([side * 0.22, 0.48, -0.1], [side * 0.285, 0.7, -0.1], 0.018, frame);
    bar([side * 0.22, 0.48, 0.12], [side * 0.285, 0.7, 0.12], 0.018, frame);
    add(roundedBox(0.085, 0.04, 0.32, 0.012), frame, side * 0.285, 0.715, 0.015);
  }
  // Height adjustment lever under the right side of the seat.
  bar([0.15, 0.46, 0.06], [0.29, 0.44, 0.06], 0.009, metal);
  add(roundedBox(0.055, 0.025, 0.055, 0.006), frame, 0.29, 0.44, 0.06);
  return chair;
}
