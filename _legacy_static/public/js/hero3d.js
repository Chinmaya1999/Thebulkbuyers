/* Procedural 3D T-shirt (Three.js r128). Drag to rotate, swatches recolour, floats with the cursor. */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;
  const T = THREE, reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(32, 1, .1, 100); cam.position.set(0, .1, 11);

  // lights
  scene.add(new T.HemisphereLight(0xfff1e6, 0x1a1020, .9));
  const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
  const rim = new T.DirectionalLight(0xff5a2c, 2.4); rim.position.set(-5, 2, -3); scene.add(rim);
  const fill = new T.PointLight(0x7ee0c3, 1.1, 20); fill.position.set(-3, -2, 4); scene.add(fill);

  // woven-fabric bump texture
  function weave() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 8) for (let j = 0; j < 128; j += 8) {
      const v = ((i + j) / 8) % 2 ? 140 : 116; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, j, 8, 8);
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2.2, 2.2); t.anisotropy = 8; return t;
  }
  const bump = weave();

  // T-shirt outline (symmetric), built right half then mirrored
  const half = [[0.38, 1.3], [1.05, 1.18], [1.9, .6], [1.52, .08], [1.0, .32], [1.0, -1.35]];
  const shape = new T.Shape();
  shape.moveTo(-0.38, 1.3);
  shape.quadraticCurveTo(0, .95, 0.38, 1.3);
  half.slice(1).forEach(p => shape.lineTo(p[0], p[1]));
  shape.lineTo(-1.0, -1.35); shape.lineTo(-1.0, .32); shape.lineTo(-1.52, .08); shape.lineTo(-1.9, .6); shape.lineTo(-1.05, 1.18); shape.lineTo(-0.38, 1.3);

  const geo = new T.ExtrudeGeometry(shape, { depth: .34, bevelEnabled: true, bevelThickness: .16, bevelSize: .16, bevelSegments: 10, curveSegments: 28 });
  geo.center();
  const mat = new T.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .86, metalness: 0, bumpMap: bump, bumpScale: .12 });
  const shirt = new T.Mesh(geo, mat); shirt.castShadow = true;

  // rib collar
  const collar = new T.Mesh(new T.TorusGeometry(.43, .075, 16, 48, Math.PI), new T.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .9, bumpMap: bump, bumpScale: .2 }));
  collar.position.set(0, 1.42 - .05, .02); collar.rotation.z = Math.PI; collar.scale.set(1, .8, 1.2);
  const collarBack = collar.clone(); collarBack.position.z = -.02;

  // chest label
  function label() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    x.clearRect(0, 0, 512, 256); x.fillStyle = '#ff5a2c'; x.font = '700 92px Georgia, serif'; x.textAlign = 'center'; x.fillText('TBB', 256, 120);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '600 26px sans-serif'; x.fillText('THE BULK BUYERS', 256, 175);
    const t = new T.CanvasTexture(c); t.anisotropy = 8; t.encoding = T.sRGBEncoding; return t;
  }
  const logo = new T.Mesh(new T.PlaneGeometry(.9, .45), new T.MeshBasicMaterial({ map: label(), transparent: true, opacity: .96 }));
  logo.position.set(.45, .4, .335);

  const group = new T.Group(); group.add(shirt, collar, collarBack, logo); scene.add(group);

  // floating thread particles
  const N = 160, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { pos.set([(Math.random() - .5) * 11, (Math.random() - .5) * 7, (Math.random() - .5) * 6 - 1], i * 3); vel.push(.002 + Math.random() * .005); }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const dust = new T.Points(pg, new T.PointsMaterial({ color: 0xffb347, size: .035, transparent: true, opacity: .75, depthWrite: false }));
  scene.add(dust);

  // controls (drag + pointer parallax)
  let tx = 0, ty = 0, rx = 0, ry = .3, drag = false, lx = 0, ly = 0, auto = !reduce;
  canvas.addEventListener('pointerdown', e => { drag = true; auto = false; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = false; setTimeout(() => auto = !reduce, 2500); });
  canvas.addEventListener('pointermove', e => { if (drag) { ry += (e.clientX - lx) * .01; rx += (e.clientY - ly) * .006; rx = Math.max(-.6, Math.min(.6, rx)); lx = e.clientX; ly = e.clientY; } });
  addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5); }, { passive: true });

  // colour swatches
  const sw = document.querySelectorAll('.sw');
  sw.forEach(b => b.addEventListener('click', () => {
    sw.forEach(x => x.classList.remove('on')); b.classList.add('on');
    target.set(b.dataset.c); const dark = target.getHSL({}).l < .3; collar.material.color.copy(target); logo.material.opacity = dark ? 1 : .96;
  }));
  const target = new T.Color(0xf4f1ea);

  function resize() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.position.z = r.width < 600 ? 12.5 : 11; cam.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  let vis = true; new IntersectionObserver(e => vis = e[0].isIntersecting).observe(canvas);
  const clock = new T.Clock();
  (function loop() {
    requestAnimationFrame(loop); if (!vis) return;
    const t = clock.getElapsedTime();
    if (auto) ry += .004;
    group.rotation.y += (ry + tx * .5 - group.rotation.y) * .06;
    group.rotation.x += (rx + ty * .25 - group.rotation.x) * .06;
    group.position.y = Math.sin(t * 1.2) * .1;
    mat.color.lerp(target, .08);
    const p = pg.attributes.position; for (let i = 0; i < N; i++) { p.array[i * 3 + 1] += vel[i]; if (p.array[i * 3 + 1] > 3.6) p.array[i * 3 + 1] = -3.6; } p.needsUpdate = true;
    dust.rotation.y = t * .02;
    renderer.render(scene, cam);
  })();
})();
