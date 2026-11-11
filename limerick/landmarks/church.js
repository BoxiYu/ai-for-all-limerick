// St Mary's Cathedral, south of the castle on King's Island.
import { THREE, box, M, warmLight } from '../core.js';

export default {
  name: 'church',
  build(w) {
    const church = new THREE.Group();
    const nave = box(42, 15, 16, M.stone); nave.position.set(68, 7.5, -70); church.add(nave);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 9.5, 42, 4, 1), M.roof); roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 4; roof.position.set(68, 18, -70); roof.scale.set(1, 1, 0.85); church.add(roof);
    const tower = box(11, 36, 11, M.stone); tower.position.set(44, 18, -70); church.add(tower);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const p = box(1.8, 5, 1.8, M.stone); p.position.set(44 + dx * 4.8, 38.5, -70 + dz * 4.8); church.add(p); }
    w.crenels(church, 39, -75, 49, -75, 36, 2.6); w.crenels(church, 39, -65, 49, -65, 36, 2.6);
    w.add(church, 'church'); w.reserve(60, -70, 50, 26);
    warmLight(36, 4, -60, 1400, 90);
    return { obj: church, center: new THREE.Vector3(56, 18, -70), detect: [{ obj: church, label: 'church 0.92' }] };
  },
};
