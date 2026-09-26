// Hero WebGL scene: a faceted lime core inside a wireframe cage, orbiting rings and
// satellites, over a drifting particle field. Loads Three.js on demand; if WebGL or the
// CDN is unavailable the page keeps its CSS hero shapes.
(() => {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const hero = canvas.closest('.hero');

  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js')
    .then(init)
    .catch(() => {});

  function init(THREE) {
    const LIME = 0xC6FF3D;
    const LIME_DEEP = 0x8FE000;
    const PANEL_ALT = 0x1A2016;
    const BG = 0x0B0F0C;
    const INK = 0xF3F7F0;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG, 9, 24);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    scene.add(new THREE.AmbientLight(INK, 0.35));
    const key = new THREE.PointLight(LIME, 80, 30);
    key.position.set(4, 4, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(INK, 0.9);
    rim.position.set(-5, 3, -2);
    scene.add(rim);

    const rig = new THREE.Group();
    scene.add(rig);

    const coreGeo = new THREE.IcosahedronGeometry(1.7, 1);
    const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({
      color: PANEL_ALT, roughness: 0.35, metalness: 0.6, flatShading: true,
    }));
    core.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(coreGeo),
      new THREE.LineBasicMaterial({ color: LIME, transparent: true, opacity: 0.9 }),
    ));
    rig.add(core);

    const cage = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.6, 0)),
      new THREE.LineBasicMaterial({ color: LIME_DEEP, transparent: true, opacity: 0.35 }),
    );
    rig.add(cage);

    const ringMat = new THREE.MeshStandardMaterial({
      color: LIME, emissive: LIME_DEEP, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.4,
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.025, 12, 180), ringMat);
    ring1.rotation.x = Math.PI * 0.42;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.015, 12, 180), ringMat);
    ring2.rotation.set(Math.PI * 0.6, Math.PI * 0.25, 0);
    rig.add(ring1, ring2);

    const satGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const satMat = new THREE.MeshStandardMaterial({
      color: LIME, emissive: LIME_DEEP, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.3,
    });
    const sats = Array.from({ length: 5 }, (_, i) => {
      const mesh = new THREE.Mesh(satGeo, satMat);
      const scale = 0.6 + (i % 3) * 0.3;
      mesh.scale.setScalar(scale);
      rig.add(mesh);
      return {
        mesh,
        radius: 3.0 + (i % 2) * 0.7,
        speed: 0.25 + i * 0.07,
        phase: (i / 5) * Math.PI * 2,
        tilt: 0.3 + (i % 3) * 0.25,
      };
    });

    const count = window.innerWidth < 720 ? 450 : 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
      color: LIME, size: 0.045, transparent: true, opacity: 0.7, depthWrite: false,
    }));
    scene.add(particles);

    let baseX = 0;
    let baseY = 0;

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const wide = camera.aspect > 1.2;
      // Wide screens: object sits right of the copy. Narrow: tucked into the lower-right corner.
      baseX = wide ? halfW * 0.5 : halfW * 0.55;
      baseY = wide ? 0 : -halfH * 0.62;
      const fit = wide ? Math.min(halfW * 0.5, halfH * 0.95) : halfW * 0.75;
      rig.scale.setScalar(Math.min(1, fit / 3.9));
      if (reduceMotion) render(0);
    }

    const pointer = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    if (!reduceMotion) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      });
      hero.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });
    }

    function render(time) {
      smooth.x += (pointer.x - smooth.x) * 0.05;
      smooth.y += (pointer.y - smooth.y) * 0.05;
      const scroll = Math.min(window.scrollY / (hero.offsetHeight || 1), 1);

      core.rotation.x = time * 0.25 + smooth.y * 0.4;
      core.rotation.y = time * 0.35 + smooth.x * 0.6;
      core.scale.setScalar(1 + Math.sin(time * 1.6) * 0.03);
      cage.rotation.y = -time * 0.15;
      cage.rotation.z = time * 0.1;
      ring1.rotation.z = time * 0.2;
      ring2.rotation.z = -time * 0.15;

      sats.forEach((s) => {
        const a = s.phase + time * s.speed;
        s.mesh.position.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius * s.tilt, Math.sin(a) * s.radius);
        s.mesh.rotation.x = time * 0.8 + s.phase;
        s.mesh.rotation.y = time * 0.6;
      });

      rig.position.set(baseX, baseY + scroll * 2.5, 0);
      rig.rotation.x = smooth.y * 0.25 + scroll * 0.9;
      rig.rotation.y = smooth.x * 0.35;

      particles.rotation.y = time * 0.02;
      particles.position.y = scroll * 1.5;

      camera.position.x = smooth.x * 0.6;
      camera.position.y = -smooth.y * 0.4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    new ResizeObserver(resize).observe(canvas);
    resize();
    render(0);
    canvas.classList.add('is-ready');
    document.documentElement.classList.add('has-webgl');

    if (reduceMotion) return;

    let rafId = 0;
    function loop(now) {
      render(now * 0.001);
      rafId = requestAnimationFrame(loop);
    }
    new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(rafId);
      if (entry.isIntersecting) rafId = requestAnimationFrame(loop);
    }).observe(hero);
  }
})();
