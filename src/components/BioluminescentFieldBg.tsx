"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

interface BioluminescentFieldBgProps {
  addLog: (text: string, type?: 'info' | 'success' | 'warn') => void;
  viewMode?: 'dashboard' | 'specimen';
}

export default function BioluminescentFieldBg({ addLog, viewMode = 'dashboard' }: BioluminescentFieldBgProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drag and rotation state refs to communicate with Three.js animate loop HMR-friendly
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0, y: 0 });
  const viewModeRef = useRef(viewMode);

  // Update viewMode ref dynamically when it changes
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    try {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !container) return;

      let timer = new THREE.Timer();
      timer.connect(document);

      // Transparent WebGLRenderer
      const renderer = new THREE.WebGLRenderer({
        canvas:    canvas,
        alpha:     true,           // transparent canvas
        antialias: true,
        powerPreference: "high-performance"
      });

      renderer.setClearColor(0x000000, 0);   // transparent clear color
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping        = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled  = true;
      renderer.shadowMap.type     = THREE.PCFSoftShadowMap;

      let width = container.clientWidth || 800;
      let height = container.clientHeight || 900;
      renderer.setSize(width, height);

      const scene  = new THREE.Scene();
      scene.fog    = new THREE.FogExp2(0x020604, 0.01); // Deep green-black fog

      const camera = new THREE.PerspectiveCamera(
        42,
        width / height,
        0.1,
        100
      );
      camera.position.set(0.0, 0.2, 5.0);
      camera.lookAt(0, 0.0, 0);

      // ── LIGHTS ──────────────────
      const keyLight = new THREE.DirectionalLight(0x3eef9c, 0.7);
      keyLight.position.set(5, 5, 5);
      keyLight.castShadow = true;
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x00f5ff, 0.5);
      fillLight.position.set(-5, 3, 2);
      scene.add(fillLight);

      const backLight = new THREE.DirectionalLight(0xdc00ff, 0.8);
      backLight.position.set(0, 5, -5);
      scene.add(backLight);

      const ambient = new THREE.AmbientLight(0x04180f, 0.2);
      scene.add(ambient);

      // ── DYNAMIC PARTICLES SYSTEM (Bioluminescent Spores) ──────────────────
      const particleCount = 120;
      const particleGeometry = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      const particleSpeeds = new Float32Array(particleCount);
      const particleAngles = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const distance = 0.5 + Math.random() * 3.5;

        particlePositions[i * 3] = distance * Math.sin(phi) * Math.cos(theta); // x
        particlePositions[i * 3 + 1] = (Math.random() * 6) - 3; // y
        particlePositions[i * 3 + 2] = distance * Math.sin(phi) * Math.sin(theta); // z

        particleSpeeds[i] = 0.002 + Math.random() * 0.005; // speed
        particleAngles[i] = Math.random() * Math.PI * 2; // initial drift angle
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

      const particleMaterial = new THREE.PointsMaterial({
        color: 0x2EE87A,
        size: 0.02,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Data Nodes Group
      const nodesGroup = new THREE.Group();
      scene.add(nodesGroup);
      
      const nodePositions = [
        new THREE.Vector3(0.6, 0.8, 0.5),
        new THREE.Vector3(-0.7, -0.3, 0.6),
        new THREE.Vector3(0.4, -0.7, -0.4),
        new THREE.Vector3(-0.2, 0.9, -0.2)
      ];
      
      const nodeMaterials: THREE.MeshBasicMaterial[] = [];
      
      nodePositions.forEach((pos, idx) => {
        const geom = new THREE.SphereGeometry(0.04, 16, 16);
        const color = idx % 2 === 0 ? 0x2EE87A : 0x00E5FF;
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        nodesGroup.add(mesh);
        nodeMaterials.push(mat);
      });

      let loadedModel: THREE.Group | null = null;
      let scaleFactor = 2.4;

      const applyMaterials = (model: THREE.Group) => {
        model.traverse((child) => {
          if (!(child as any).isMesh) return;
          const meshChild = child as THREE.Mesh;
          const rawMat = meshChild.material;
          const mats = Array.isArray(rawMat) ? rawMat : [rawMat];

          mats.forEach((mat) => {
            if (!mat) return;
            const stdMat = mat as THREE.MeshStandardMaterial;
            stdMat.roughness = 0.25;
            stdMat.metalness = 0.4;

            const name = child.name.toLowerCase();
            const isGlowElement = name.includes('glow')
                               || name.includes('energy')
                               || name.includes('swirl')
                               || name.includes('light')
                               || name.includes('emissive')
                               || name.includes('flora')
                               || name.includes('crystal')
                               || (stdMat.emissive && (stdMat.emissive.r > 0.05 || stdMat.emissive.g > 0.05 || stdMat.emissive.b > 0.05));

            if (isGlowElement) {
              stdMat.emissiveIntensity = 0.0;
              if (stdMat.emissive) {
                stdMat.emissive.setHex(0x000000);
              }
            }

            stdMat.side = THREE.DoubleSide;
          });
        });
      };

      const loader = new GLTFLoader();
      let isMounted = true;

      addLog(`👾 3D Canvas initialized: Container="${width}x${height}"`, "info");

      loader.load(
        '/assets/coexistence.glb',
        (gltf) => {
          if (!isMounted) return;
          
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box.getCenter(center);
          model.position.copy(center).negate(); // shift origin to center

          const modelGroup = new THREE.Group();
          modelGroup.add(model);
          scene.add(modelGroup);

          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          scaleFactor = 2.4 / (maxDim || 1); // Centered, smaller silhouette size

          addLog(`👾 3D Model loaded: center=(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}) size=(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}) scale=${scaleFactor.toFixed(4)}`, "success");

          modelGroup.scale.set(0, 0, 0); // start invisible
          applyMaterials(modelGroup);
          loadedModel = modelGroup;

          // Animate scale-in over 1.5s with spring overshoot
          const startTime = performance.now();
          function scaleIn() {
            if (!isMounted) return;
            const elapsed = (performance.now() - startTime) / 1000;
            const progress = Math.min(elapsed / 1.5, 1);

            const spring = progress < 1
              ? 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 2.2)
              : 1;

            modelGroup.scale.setScalar(spring * scaleFactor);

            if (progress < 1) {
              requestAnimationFrame(scaleIn);
            }
          }
          requestAnimationFrame(scaleIn);
        },
        undefined,
        (error: any) => {
          console.error('Error loading coexistence.glb backdrop model:', error);
          addLog(`❌ 3D Model file failed to load: ${error?.message || 'Check asset paths'}`, "warn");
        }
      );

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new OutputPass());
      composer.setSize(width, height);

      let animationId: number;

      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;

        renderer.setSize(w, h);
        composer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(container);

      const animate = (timestamp?: number) => {
        animationId = requestAnimationFrame(animate);
        timer.update(timestamp);
        const t = timer.getElapsed();

        const isExecuting = typeof window !== 'undefined' && (window as any).pipelineExecuting;
        const pulseSpeed = isExecuting ? 12.0 : 2.5;
        const pulseIntensity = 0.5 + Math.sin(t * pulseSpeed) * 0.45;

        // ── ANIMATE PARTICLES (Bioluminescent Spores) ──────────────────
        const positions = particleGeometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const speed = particleSpeeds[i] * (isExecuting ? 3.0 : 1.0);
          positions[i * 3 + 1] += speed;

          particleAngles[i] += 0.02;
          positions[i * 3] += Math.sin(particleAngles[i]) * 0.002;
          positions[i * 3 + 2] += Math.cos(particleAngles[i]) * 0.002;

          if (positions[i * 3 + 1] > 3) {
            positions[i * 3 + 1] = -3;
            positions[i * 3] = (Math.random() * 6) - 3;
            positions[i * 3 + 2] = (Math.random() * 6) - 3;
          }
        }
        particleGeometry.attributes.position.needsUpdate = true;

        // Pulse floating data nodes
        nodeMaterials.forEach((mat, idx) => {
          if (mat) {
            mat.opacity = 0.3 + pulseIntensity * 0.6;
            if (nodesGroup.children[idx]) {
              nodesGroup.children[idx].scale.setScalar(0.7 + pulseIntensity * 0.5);
            }
          }
        });

        // Revert to original subtle lighting targets
        keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, 0.7, 0.05);
        fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, 0.5, 0.05);
        backLight.intensity = THREE.MathUtils.lerp(backLight.intensity, 0.8, 0.05);
        ambient.intensity = THREE.MathUtils.lerp(ambient.intensity, 0.2, 0.05);

        if (loadedModel) {
          // Slow breathing hover
          loadedModel.position.y = Math.sin(t * 0.5) * 0.08;

          // Merge manual drag rotation with slow idle spin
          loadedModel.rotation.y = rotationRef.current.y + t * 0.06;
          loadedModel.rotation.x = THREE.MathUtils.lerp(
            loadedModel.rotation.x,
            rotationRef.current.x + (isExecuting ? -0.15 : 0),
            0.05
          );
        }

        composer.render();
      };

      animate();

      return () => {
        isMounted = false;
        resizeObserver.disconnect();
        cancelAnimationFrame(animationId);
        timer.dispose();
        renderer.dispose();
      };
    } catch (err: any) {
      console.error(err);
      addLog(`❌ Three.js setup crashed: ${err.message || err}`, 'warn');
    }
  }, []);

  // Pointer event handlers for manual rotation on specimen view mode
  const handlePointerDown = (e: React.PointerEvent) => {
    if (viewMode !== 'specimen') return;
    isDragging.current = true;
    previousMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || viewMode !== 'specimen') return;
    // Invert deltaX because the container is flipped 180deg on the Y-axis
    const deltaX = -(e.clientX - previousMouse.current.x);
    const deltaY = e.clientY - previousMouse.current.y;

    rotationRef.current.y += deltaX * 0.007;
    rotationRef.current.x += deltaY * 0.007;

    // Constrain X rotation to prevent flipping upside down
    rotationRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotationRef.current.x));

    previousMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full pointer-events-none" 
      style={{ zIndex: 1 }}
    >
      <canvas 
        ref={canvasRef} 
        id="model-canvas" 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100%',
          pointerEvents: viewMode === 'specimen' ? 'auto' : 'none',
          cursor: viewMode === 'specimen' ? (isDragging.current ? 'grabbing' : 'grab') : 'default'
        }} 
      />
    </div>
  );
}
