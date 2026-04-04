import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { AppMode } from '../types';

const paletteByMode: Record<AppMode, {
  ambient: string;
  key: string;
  rim: string;
  shell: string;
  emissive: string;
  wire: string;
  halo: string;
  particles: string;
}> = {
  chat: {
    ambient: '#f1f7ff',
    key: '#76ddff',
    rim: '#5a63ff',
    shell: '#a1f0ff',
    emissive: '#1d5fff',
    wire: '#d5fbff',
    halo: '#63e7ff',
    particles: '#f7fbff',
  },
  cowork: {
    ambient: '#fff4e8',
    key: '#7ce4ff',
    rim: '#ffc17f',
    shell: '#90ecff',
    emissive: '#0c5be2',
    wire: '#fff0df',
    halo: '#ffbf86',
    particles: '#fff6ef',
  },
  image: {
    ambient: '#f3fbff',
    key: '#8be8ff',
    rim: '#6f7cff',
    shell: '#b0f4ff',
    emissive: '#1b4cff',
    wire: '#d8ffff',
    halo: '#74eaff',
    particles: '#f4fbff',
  },
  video: {
    ambient: '#fff0e5',
    key: '#ffbb8d',
    rim: '#ff8d63',
    shell: '#ffd2b0',
    emissive: '#ff7c45',
    wire: '#fff2de',
    halo: '#ffb089',
    particles: '#fff7ef',
  },
  audio: {
    ambient: '#fff1fb',
    key: '#ff9fd8',
    rim: '#ff8aa0',
    shell: '#ffc0e5',
    emissive: '#ff6798',
    wire: '#ffe7f5',
    halo: '#ff90c9',
    particles: '#fff5fb',
  },
  lyria: {
    ambient: '#edfff6',
    key: '#7bf1c4',
    rim: '#59d7a7',
    shell: '#9cf5d1',
    emissive: '#00a970',
    wire: '#e5fff4',
    halo: '#8ce8bb',
    particles: '#f2fff8',
  },
};

const createParticlePositions = (count: number) => {
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const radius = THREE.MathUtils.randFloat(2.4, 4.6);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const offset = index * 3;

    positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
    positions[offset + 1] = radius * Math.cos(phi) * 0.82;
    positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  return positions;
};

export const StudioHeroScene: React.FC<{ mode: AppMode }> = ({ mode }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const palette = paletteByMode[mode];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.className = 'studio-hero-scene__canvas';
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const ambientLight = new THREE.AmbientLight(palette.ambient, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(palette.key, 16, 20, 2);
    keyLight.position.set(2.8, 1.6, 4.6);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(palette.rim, 14, 18, 2);
    rimLight.position.set(-3.1, -1.9, -0.8);
    scene.add(rimLight);

    /* Simplified geometry: 100 segments instead of 220, 20 radial instead of 32 */
    const shellGeometry = new THREE.TorusKnotGeometry(1.08, 0.28, 100, 20, 2, 3);
    const shellMaterial = new THREE.MeshStandardMaterial({
      color: palette.shell,
      emissive: palette.emissive,
      emissiveIntensity: 0.26,
      roughness: 0.22,
      metalness: 0.35,
      opacity: 0.92,
      transparent: true,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    root.add(shell);

    const wireGeometry = shellGeometry.clone();
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: palette.wire,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      blending: THREE.AdditiveBlending,
    });
    const wireframeShell = new THREE.Mesh(wireGeometry, wireMaterial);
    wireframeShell.scale.setScalar(1.024);
    root.add(wireframeShell);

    /* Halo: 48 segments instead of 128 */
    const haloGeometry = new THREE.RingGeometry(1.84, 2.42, 48);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: palette.halo,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.set(0.12, -0.08, -0.85);
    halo.rotation.set(Math.PI / 2.3, Math.PI / 10, 0);
    root.add(halo);

    /* Particles: 80 instead of 220 */
    const particleCount = prefersReducedMotion ? 40 : 80;
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(createParticlePositions(particleCount), 3),
    );
    const particlesMaterial = new THREE.PointsMaterial({
      color: palette.particles,
      size: 0.034,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    const clock = new THREE.Clock();
    let frameId = 0;

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const render = () => {
      const elapsed = clock.getElapsedTime();
      const orbitSpeed = prefersReducedMotion ? 0.1 : 0.16;
      const floatSpeed = prefersReducedMotion ? 0.14 : 0.26;

      root.rotation.x = -0.32 + Math.sin(elapsed * floatSpeed) * 0.1;
      root.rotation.y = elapsed * orbitSpeed;

      shell.rotation.x = elapsed * 0.18;
      wireframeShell.rotation.y = -elapsed * 0.22;
      halo.rotation.z = elapsed * 0.12;

      particles.rotation.y = elapsed * 0.03;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();

      shellGeometry.dispose();
      wireGeometry.dispose();
      haloGeometry.dispose();
      particlesGeometry.dispose();

      shellMaterial.dispose();
      wireMaterial.dispose();
      haloMaterial.dispose();
      particlesMaterial.dispose();

      renderer.dispose();
      renderer.forceContextLoss();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [mode]);

  return <div ref={mountRef} className="studio-hero-scene" aria-hidden="true" />;
};
