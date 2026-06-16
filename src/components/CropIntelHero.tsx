"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, animate, AnimatePresence } from "framer-motion";
import Tilt from "react-parallax-tilt";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "gsap";
import Typed from "typed.js";
import { Cpu, Plant, Broadcast, Pulse, X } from "@phosphor-icons/react";
import CircuitNetBackground from "./CircuitNetBackground";
import PredictionForm from "./PredictionForm";
import ResultCard from "./ResultCard";

const GOLD = "#b8860b";
const BRIGHT_GOLD = "#c8960c";
const fullRecommendation = "RECOMMENDED: RABI WHEAT > CLASSIFIER MATCH 98.4% > SOIL ALIGNMENT COMPLETE_";

// Central timing configuration for sequential page entry animations
const ANIMATION_DELAYS = {
  // L0: HUD & Frames (Establish borders)
  navigation: 0.15,
  statusBar: 0.25,
  timelineFrame: 0.3,
  timelineLine: 0.35, // GSAP scaleY delay
  hudBrackets: 0.4,

  // L1: Central centerpiece
  tree: 0.45,
  treeGlow: 0.45,
  treeRings: 0.5,

  // L2: Left Card & Hero Content
  cardWrapper: 0.55,
  eyebrow: 0.65,
  headlineCrop: 0.75,
  headlineIntel: 0.85,
  bodyText: 0.95,
  
  // Staggered telemetry metrics inside the left card
  telemetryGrid: 1.05,
  ctaRow: 1.15,
  statusTextTyped: 1.25, // Typed.js delay

  // L3: Telemetry chips clockwise sequence around the tree
  chipA: 1.35, // Top-Left (Moisture)
  chipB: 1.45, // Top-Right (Humidity)
  chipD: 1.55, // Bottom-Right (Soil Sync Card)
  chipC: 1.65, // Bottom-Left (NPK Module)

  // L4: Terminal lock
  terminalBox: 1.75,
  terminalStats: 1.95, // Progress bar & count up delay
};

// Cascading fade-in variants for telemetry metric boxes
const metricBoxVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (customDelay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: customDelay,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

// Sequential spring-loaded reveals for timeline nodes
const timelineNodeVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: (customDelay: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: customDelay,
      type: "spring" as const,
      stiffness: 160,
      damping: 15,
    },
  }),
};

// Elegant text fade-in with vertical drift and blur reveal
function ElegantFadeText({ text, delay = 0.5, speed = 0.03 }: { text: string; delay?: number; speed?: number }) {
  const words = text.split(" ");
  
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: speed, delayChildren: delay },
    },
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
    hidden: {
      opacity: 0,
      y: 8,
      filter: "blur(4px)",
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      style={{ display: "inline-block" }}
    >
      {words.map((word, idx) => (
        <motion.span
          variants={child}
          style={{ display: "inline-block", marginRight: "6px" }}
          key={idx}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Elegant letter-by-letter fade-in with blur
function ElegantFadeLetters({ text, delay = 0.4, speed = 0.02, className, style }: { text: string; delay?: number; speed?: number; className?: string; style?: React.CSSProperties }) {
  const letters = Array.from(text);

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: speed, delayChildren: delay },
    },
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
    hidden: {
      opacity: 0,
      y: 6,
      filter: "blur(3px)",
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      animate="visible"
      className={className}
      style={{ display: "inline-flex", flexWrap: "wrap", ...style }}
    >
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          variants={child}
          style={{ display: "inline-block" }}
        >
          {letter === " " ? "\u00A0" : letter}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Elegant word reveal with blur (e.g. for gradient text headings)
function ElegantFadeWord({ text, className, style, delay = 0.4 }: { text: string; className: string; style?: React.CSSProperties; delay?: number }) {
  const child = {
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
    hidden: {
      opacity: 0,
      y: 12,
      filter: "blur(4px)",
    },
  };

  return (
    <motion.div
      variants={child}
      initial="hidden"
      animate="visible"
      className={className}
      style={{ display: "inline-block", ...style }}
      transition={{ delay }}
    >
      {text}
    </motion.div>
  );
}

// Counter animation component
function AnimatedNumber({ target, suffix, delay = 1.0 }: { target: number; suffix: string; delay?: number }) {
  const count = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const controls = animate(count, target, {
      duration: 1.5,
      delay: delay,
      ease: "easeOut",
      onUpdate: (v) => {
        if (Number.isInteger(target)) {
          setDisplay(Math.round(v).toString());
        } else {
          setDisplay(v.toFixed(1));
        }
      },
    });
    return controls.stop;
  }, [target, count, delay]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

// 3D Particles Field using React Three Fiber
function R3FParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 140;
  const state = useThree();
  const { viewport } = state;

  // Generate a soft circular glowing texture for fireflies
  const fireflyTexture = React.useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.2, "rgba(184, 255, 150, 0.8)");
      gradient.addColorStop(0.5, "rgba(62, 207, 90, 0.3)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  const [positions] = useState(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      // Random coordinates
      arr[i * 3] = (Math.random() - 0.2) * 3.5; 
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return arr;
  });

  useEffect(() => {
    const handleFireflyClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ normX: number; normY: number }>;
      const { normX, normY } = customEvent.detail;

      const mouse = state.mouse;
      const size = state.size;
      const width = viewport?.width ?? 10;
      const height = viewport?.height ?? 10;

      // Compensate for the DOM parallax offset (dy is negated since CSS y is positive down but WebGL y is positive up)
      const dx_3d = (mouse.x * 50 / size.width) * width;
      const dy_3d = (mouse.y * 35 / size.height) * height;

      // Subtract the canvas displacement from the click coordinates
      const click3D_X = normX * (width / 2) - dx_3d;
      const click3D_Y = normY * (height / 2) - dy_3d;

      let closestIndex = -1;
      let minDistance = Infinity;

      if (pointsRef.current) {
        const positionsAttr = pointsRef.current.geometry.attributes.position;
        if (positionsAttr) {
          for (let i = 0; i < particleCount; i++) {
            const px = positionsAttr.getX(i);
            const py = positionsAttr.getY(i);
            const dist = Math.hypot(px - click3D_X, py - click3D_Y);
            if (dist < minDistance) {
              minDistance = dist;
              closestIndex = i;
            }
          }

          // Trigger burst if click is close to a firefly (using a wider, easy-to-hit 0.24 unit threshold)
          if (minDistance < 0.24 && closestIndex !== -1) {
            const bx = positionsAttr.getX(closestIndex);
            const by = positionsAttr.getY(closestIndex);
            const bz = positionsAttr.getZ(closestIndex);

            // Dispatch burst event at exact 3D coordinates
            const burstEvent = new CustomEvent("firefly-burst", {
              detail: { x: bx, y: by, z: bz },
            });
            window.dispatchEvent(burstEvent);

            // Respawn the popped firefly at the bottom
            positionsAttr.setX(closestIndex, (Math.random() - 0.2) * 3.5);
            positionsAttr.setY(closestIndex, -2.2);
            positionsAttr.setZ(closestIndex, (Math.random() - 0.5) * 2);
            positionsAttr.needsUpdate = true;
          }
        }
      }
    };

    window.addEventListener("firefly-click", handleFireflyClick);
    return () => {
      window.removeEventListener("firefly-click", handleFireflyClick);
    };
  }, [viewport, state]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      const time = state.clock.elapsedTime;
      const positionsAttr = pointsRef.current.geometry.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        // Organic firefly floating movement
        let y = positionsAttr.getY(i) + delta * 0.04;
        if (y > 2.2) {
          y = -2.2;
        }
        
        // Add wandering using sine/cosine
        const xOffset = Math.sin(time * 0.8 + i) * delta * 0.08;
        const zOffset = Math.cos(time * 0.7 + i) * delta * 0.08;
        
        positionsAttr.setX(i, positionsAttr.getX(i) + xOffset);
        positionsAttr.setY(i, y);
        positionsAttr.setZ(i, positionsAttr.getZ(i) + zOffset);
      }
      positionsAttr.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={fireflyTexture}
        size={0.12}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  age: number;
}

function CrackerBursts() {
  const pointsRef = useRef<THREE.Points>(null);
  const sparksRef = useRef<Spark[]>([]);
  const maxSparks = 800;

  const [positionsArray] = useState(() => new Float32Array(maxSparks * 3));
  const [colorsArray] = useState(() => new Float32Array(maxSparks * 3));

  // Spark radial texture with fading edges (client-only safety)
  const sparkTexture = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.15, "rgba(255, 255, 255, 0.9)");
        gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.3)");
        gradient.addColorStop(0.8, "rgba(255, 255, 255, 0.05)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(canvas);
    } catch (e) {
      console.error("Failed to create spark canvas texture:", e);
      return null;
    }
  }, []);

  useEffect(() => {
    const handleBurst = (e: Event) => {
      const customEvent = e as CustomEvent<{ x: number; y: number; z: number }>;
      const { x, y, z } = customEvent.detail;
      
      // Spawn 45 dense, elegant sparks per click in a compact radius
      const newSparks: Spark[] = [];
      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.15 + Math.random() * 0.5; // small range, tight burst
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed + 0.12; // subtle upward drift
        const vz = (Math.random() - 0.5) * 0.3;
        const life = 0.5 + Math.random() * 0.5; // compact lifespan of 0.5 to 1.0 seconds
        
        newSparks.push({
          x,
          y,
          z,
          vx,
          vy,
          vz,
          life,
          age: 0
        });
      }
      
      sparksRef.current = [...sparksRef.current, ...newSparks].slice(-maxSparks);
    };

    window.addEventListener("firefly-burst", handleBurst);
    return () => {
      window.removeEventListener("firefly-burst", handleBurst);
    };
  }, []);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.1);
    
    // Update velocities, positions, and filter out dead sparks
    const active = sparksRef.current.filter((spark) => {
      spark.age += d;
      if (spark.age >= spark.life) return false;
      
      // Gentle gravity pulling sparks down
      spark.vy -= 1.6 * d;
      
      // Increased drag to decelerate quickly and hover elegantly
      const dragFactor = Math.exp(-2.2 * d);
      spark.vx *= dragFactor;
      spark.vy *= dragFactor;
      spark.vz *= dragFactor;
      
      // Update coordinates
      spark.x += spark.vx * d;
      spark.y += spark.vy * d;
      spark.z += spark.vz * d;
      
      return true;
    });
    
    sparksRef.current = active;

    if (pointsRef.current) {
      const geometry = pointsRef.current.geometry;
      if (geometry) {
        const positionsAttr = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
        const colorsAttr = geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
        
        if (positionsAttr && positionsAttr.array && colorsAttr && colorsAttr.array) {
          const posArr = positionsAttr.array as Float32Array;
          const colArr = colorsAttr.array as Float32Array;
          
          for (let i = 0; i < maxSparks; i++) {
            if (i < active.length) {
              const spark = active[i];
              posArr[i * 3] = spark.x;
              posArr[i * 3 + 1] = spark.y;
              posArr[i * 3 + 2] = spark.z;
              
              const ratio = spark.age / spark.life;
              let r = 0, g = 0, b = 0;
              if (ratio < 0.15) {
                // Pure bright white-gold
                const t = ratio / 0.15;
                r = 1.0;
                g = 1.0;
                b = 0.8 + 0.2 * (1 - t);
              } else if (ratio < 0.5) {
                // Elegant gold-green glow transition
                const t = (ratio - 0.15) / 0.35;
                r = 1.0 - 0.55 * t; // fades R from 1.0 to 0.45
                g = 1.0 - 0.05 * t; // G stays bright at 0.95
                b = 0.8 - 0.65 * t; // fades B from 0.8 to 0.15
              } else if (ratio < 0.8) {
                // Rich copper-amber cooling phase
                const t = (ratio - 0.5) / 0.3;
                r = 0.45 + 0.5 * t; // R transitions from 0.45 to 0.95
                g = 0.95 - 0.45 * t; // G transitions from 0.95 to 0.5
                b = 0.15 - 0.05 * t; // B transitions to 0.1
              } else {
                // Fading out to black
                const t = (ratio - 0.8) / 0.2;
                r = 0.95 * (1 - t);
                g = 0.5 * (1 - t);
                b = 0.1 * (1 - t);
              }
              
              colArr[i * 3] = r;
              colArr[i * 3 + 1] = g;
              colArr[i * 3 + 2] = b;
            } else {
              posArr[i * 3] = 0;
              posArr[i * 3 + 1] = 0;
              posArr[i * 3 + 2] = 0;
              colArr[i * 3] = 0;
              colArr[i * 3 + 1] = 0;
              colArr[i * 3 + 2] = 0;
            }
          }
          
          positionsAttr.needsUpdate = true;
          colorsAttr.needsUpdate = true;
          geometry.setDrawRange(0, active.length);
        }
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionsArray, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colorsArray, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={sparkTexture || undefined}
        size={0.06}
        sizeAttenuation={true}
        transparent={true}
        vertexColors={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function ParticleFieldCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%", zIndex: 5 }}>
      <Canvas camera={{ position: [0, 0, 2], fov: 60 }} gl={{ alpha: true }}>
        <R3FParticles />
        <CrackerBursts />
      </Canvas>
    </div>
  );
}

// Subcomponents for CropIntelHero
function SVGTraces() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1920 1080" preserveAspectRatio="none">
        <path
          d="M 100,200 L 500,200 L 620,320 L 620,550"
          stroke="rgba(201, 168, 76, 0.4)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="15, 15"
          className="animate-[traceFlow_25s_linear_infinite]"
        />
        <path
          d="M 1800,150 L 1400,150 L 1280,270 L 1280,500"
          stroke="rgba(201, 168, 76, 0.4)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="20, 10"
          className="animate-[traceFlow_18s_linear_infinite]"
        />
        <path
          d="M 200,900 L 700,900 L 820,780 L 820,620"
          stroke="rgba(201, 168, 76, 0.35)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="12, 12"
          className="animate-[traceFlow_30s_linear_infinite]"
        />
        <path
          d="M 1720,850 L 1350,850 L 1200,700 L 1200,550"
          stroke="rgba(201, 168, 76, 0.45)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="8, 12"
          className="animate-[traceFlow_15s_linear_infinite]"
        />
      </svg>
    </div>
  );
}

function ParticleField({ style }: { style: any }) {
  return (
    <motion.div
      className="particles absolute inset-0 pointer-events-none"
      style={{ ...style, zIndex: 5 }}
    >
      <ParticleFieldCanvas />
    </motion.div>
  );
}

function BreathingTree() {
  return (
    <motion.img
      src="/assets/tree-on-chip.png"
      className="tree w-auto h-full object-contain select-none"
      draggable={false}
      animate={{
        scale: [1, 1.014, 1],
        filter: [
          "saturate(1.35) brightness(1.12) drop-shadow(0 0 40px rgba(62,207,90,0.16))",
          "saturate(1.42) brightness(1.18) drop-shadow(0 0 65px rgba(62,207,90,0.26))",
          "saturate(1.35) brightness(1.12) drop-shadow(0 0 40px rgba(62,207,90,0.16))",
        ],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

function SolderDots() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 7 }}>
      <div className="solder-dot" style={{ top: "15%", left: "69%", animationDelay: "0.2s" }} />
      <div className="solder-dot" style={{ top: "35%", left: "72%", animationDelay: "1.1s" }} />
      <div className="solder-dot" style={{ top: "65%", left: "66%", animationDelay: "0.5s" }} />
      <div className="solder-dot" style={{ top: "25%", right: "20%", animationDelay: "1.8s" }} />
      <div className="solder-dot" style={{ top: "55%", right: "15%", animationDelay: "2.4s" }} />
      <div className="solder-dot" style={{ top: "75%", right: "22%", animationDelay: "0.9s" }} />
    </div>
  );
}

function ChipContent({ chip }: { chip: any }) {
  const isGold = chip.dot === "#b8860b";
  return (
    <div className="mono-class pointer-events-none relative select-none">
      <div className="flex items-center gap-1.5">
        {isGold ? (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: "#c8960c",
              animation: "nodePulse 1.8s infinite ease-in-out",
            }}
          />
        ) : (
          <span className="telem-dot" />
        )}
        <span className="font-semibold text-white/95">{chip.label}</span>
      </div>
      <span className="text-[9px]" style={{ color: isGold ? "#c8960c" : "#3ecf5a" }}>
        {chip.value} &nbsp; &nbsp; {chip.sub}
      </span>
    </div>
  );
}

function TerminalOutput({ recommendationText, delay }: { recommendationText: string; delay: number }) {
  return (
    <div className="text-left flex flex-col gap-1.5 text-white">
      <div className="rec-title flex justify-between items-center text-[9px] text-[#c8960c] tracking-wider uppercase font-mono">
        <span>TERMINAL OUTPUT // LOG_RECOMMEND</span>
        <span className="text-[#3ecf5a] font-bold">READY</span>
      </div>
      <div className="h-[1px] bg-white/10 w-full my-1" />
      <div className="text-[10px] text-white/90 font-mono leading-relaxed min-h-[36px]">
        {recommendationText}
        <span className="rec-cursor inline-block w-1.5 h-3 bg-[#3ecf5a] ml-1 animate-[blink_1s_infinite]" />
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between text-[8px] text-white/60">
          <span>MODEL CONFIDENCE PROTOCOL</span>
          <span className="text-[#3ecf5a] font-bold">
            <AnimatedNumber target={98.4} suffix="%" delay={delay + 0.2} />
          </span>
        </div>
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
          <motion.div
            className="bg-[#3ecf5a] h-full rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "98.4%" }}
            transition={{ duration: 1.5, delay: delay + 0.2, ease: [0.16, 1, 0.3, 1] as const }}
            style={{ boxShadow: "0 0 8px #3ecf5a" }}
          />
        </div>
      </div>
    </div>
  );
}

function SoilMatrixSyncCard({ activeSoilProgress, delay }: { activeSoilProgress: number; delay: number }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[10px] text-left text-white">
      {/* 3 Stats Row */}
      <div className="grid grid-cols-3 gap-2 border-b border-white/10 pb-2">
        <div className="flex flex-col">
          <span className="text-white/40 text-[8px] tracking-wide">SUITABILITY</span>
          <span className="text-white font-bold text-[11px] mt-0.5"><AnimatedNumber target={98.4} suffix="%" delay={delay + 0.1} /></span>
        </div>
        <div className="flex flex-col">
          <span className="text-white/40 text-[8px] tracking-wide">SOIL SYNC</span>
          <span className="text-[#3ecf5a] font-bold text-[11px] mt-0.5">ACTIVE</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white/40 text-[8px] tracking-wide">MODEL ACCURACY</span>
          <span className="text-[#3ecf5a] font-bold text-[11px] mt-0.5"><AnimatedNumber target={95.4} suffix="%" delay={delay + 0.1} /></span>
        </div>
      </div>

      {/* Live Soil Pulse Monitor */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex justify-between items-center text-[9px] tracking-wide">
          <span className="text-white/80 font-bold">LIVE SOIL MATRIX SYNC</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf5a] animate-pulse" />
            <span className="text-[#3ecf5a] font-bold">
              <AnimatedNumber target={activeSoilProgress} suffix="%" delay={delay + 0.1} />
            </span>
          </div>
        </div>
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
          <div className="bg-[#3ecf5a] h-full rounded-full transition-all duration-300" style={{ width: `${activeSoilProgress}%` }} />
        </div>
        <div className="flex justify-between text-[8px] text-[#c8960c] pt-0.5">
          <span>N: 72 mg/kg</span>
          <span>P: 35 mg/kg</span>
          <span>K: 38 mg/kg</span>
        </div>
      </div>
    </div>
  );
}

function CardContent({
  statusTextRef,
  onStartAnalysis,
}: {
  statusTextRef: React.RefObject<HTMLSpanElement | null>;
  onStartAnalysis: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Eyebrow */}
      <p
        className="eyebrow mono-class text-[12px] tracking-[0.25em] font-medium section-header"
        style={{
          color: "#c9a84c",
          marginBottom: "14px",
          textShadow: "0 0 20px rgba(184, 134, 11, 0.2)",
        }}
      >
        <ElegantFadeLetters text="AI-POWERED AGRICULTURE" delay={ANIMATION_DELAYS.eyebrow} />
      </p>

      {/* Headline */}
      <h1
        className="text-left flex flex-col"
        style={{ fontWeight: 400, marginBottom: "0px", marginTop: "0px" }}
      >
        <ElegantFadeWord text="Krishi" className="headline-crop hero-title" delay={ANIMATION_DELAYS.headlineCrop} />
        <ElegantFadeWord text="Predict.ai" className="headline-intel hero-title" style={{ marginTop: "-4px" }} delay={ANIMATION_DELAYS.headlineIntel} />
      </h1>

      {/* Divider */}
      <hr
        className="divider"
        style={{ marginTop: "20px", marginBottom: "16px" }}
      />

      {/* Body text */}
      <p className="text-white/90 text-[15px] leading-[1.6] max-w-[440px] italic-hero body-text">
        <ElegantFadeText 
          text="Predict crop suitability and optimize yield by analyzing soil biochemistry and real-time climate telemetry." 
          delay={ANIMATION_DELAYS.bodyText} 
          speed={0.02} 
        />
      </p>

      {/* Live environmental telemetry grid */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 my-6 border-y border-white/10 py-5 font-mono select-none">
        <motion.div
          variants={metricBoxVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.telemetryGrid}
          className="telemetry-metric-box flex flex-col gap-1 text-left"
          style={{ "--hover-border-color": "#3ecf5a" } as React.CSSProperties}
        >
          <span className="text-white/30 text-[9px] tracking-wider uppercase font-semibold mono-label">SOIL PH LEVEL</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-bold text-[14px] data-value">6.84 pH</span>
            <span className="text-[#3ecf5a] text-[8px] font-bold status-badge">OPTIMAL</span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-[#3ecf5a] h-full rounded-full w-[68%]" />
          </div>
        </motion.div>

        <motion.div
          variants={metricBoxVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.telemetryGrid + 0.1}
          className="telemetry-metric-box flex flex-col gap-1 text-left"
          style={{ "--hover-border-color": "#c8960c" } as React.CSSProperties}
        >
          <span className="text-white/30 text-[9px] tracking-wider uppercase font-semibold mono-label">SOIL MOISTURE</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-bold text-[14px] data-value">42.5%</span>
            <span className="text-[#c8960c] text-[8px] font-bold status-badge">NOMINAL</span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-[#c8960c] h-full rounded-full w-[42.5%]" />
          </div>
        </motion.div>

        <motion.div
          variants={metricBoxVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.telemetryGrid + 0.2}
          className="telemetry-metric-box flex flex-col gap-1 text-left"
          style={{ "--hover-border-color": "#3ecf5a" } as React.CSSProperties}
        >
          <span className="text-white/30 text-[9px] tracking-wider uppercase font-semibold mono-label">AMBIENT TEMP</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-bold text-[14px] data-value">24.8°C</span>
            <span className="text-[#3ecf5a] text-[8px] font-bold status-badge">STABLE</span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-[#3ecf5a] h-full rounded-full w-[78%]" />
          </div>
        </motion.div>

        <motion.div
          variants={metricBoxVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.telemetryGrid + 0.3}
          className="telemetry-metric-box flex flex-col gap-1 text-left"
          style={{ "--hover-border-color": "#3ecf5a" } as React.CSSProperties}
        >
          <span className="text-white/30 text-[9px] tracking-wider uppercase font-semibold mono-label">ACTIVE TELEMETRY</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[#3ecf5a] font-bold text-[14px] status-badge">CONNECTED</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf5a] animate-pulse" />
            <span className="text-[8px] text-white/40 font-semibold uppercase mono-label">24H DUPLEX LINK</span>
          </div>
        </motion.div>
      </div>

      {/* Badges and CTA row */}
      <div className="flex flex-col gap-3">
        {/* Badges Row */}
        <div
          className="status-row mono mono-class flex items-center gap-3"
          style={{
            fontSize: "13px",
          }}
        >
          <span
            className="badge px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 text-[11px]"
            style={{
              background: "rgba(62, 207, 90, 0.12)",
              color: "#4de082",
              border: "1px solid rgba(62, 207, 90, 0.35)",
              boxShadow: "0 0 12px rgba(62, 207, 90, 0.15), inset 0 0 8px rgba(62, 207, 90, 0.1)",
              textShadow: "0 0 8px rgba(62, 207, 90, 0.4)",
              letterSpacing: "0.08em"
            }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4de082] animate-pulse shadow-[0_0_6px_#4de082]" />
            V3.5 ONLINE
          </span>
          <span 
            className="font-bold flex items-center gap-1.5 text-[12px]" 
            style={{ 
              color: "#c9a84c", 
              letterSpacing: "0.1em",
              textShadow: "0 0 12px rgba(184, 134, 11, 0.3)"
            }}
          >
            <Cpu size={16} weight="fill" />
            <span ref={statusTextRef} />
          </span>
        </div>

        {/* CTA Button */}
        <div>
          <motion.button
            className="premium-cta"
            whileTap={{ scale: 0.97 }}
            onClick={onStartAnalysis}
          >
            <span>START CROP ANALYSIS</span>
            <motion.span
              className="arrow inline-block ml-1"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              →
            </motion.span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function ScanLine({ scanSpeed }: { scanSpeed: number }) {
  return (
    <motion.div
      className="scanline"
      style={{ animation: "none", zIndex: 10 }}
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: scanSpeed, repeat: Infinity, ease: "linear" }}
    />
  );
}

function StatusBar() {
  return (
    <motion.div
      className="status-bar mono-class pointer-events-auto flex items-center gap-3 text-[9px] text-white/35"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: ANIMATION_DELAYS.statusBar, duration: 0.8 }}
    >
      <Pulse size={10} className="text-[#3ecf5a]/60 animate-pulse" />
      <span>SYS STATUS: OK</span>
      <span className="opacity-30">|</span>
      <span>UPTIME: 99.98%</span>
      <span className="opacity-30">|</span>
      <span>SYNC_LOCK: TRUE</span>
    </motion.div>
  );
}

function Navigation() {
  return (
    <motion.nav
      className="navigation absolute left-0 right-0 top-0 z-[12] h-[64px] bg-transparent pointer-events-auto"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: ANIMATION_DELAYS.navigation, duration: 0.8 }}
    >
      {/* Left: AI Crop Recommendation System */}
      <a
        href="/"
        className="absolute left-[48px] top-1/2 -translate-y-1/2 text-[26px] text-white hover:opacity-85 transition-opacity flex items-center gap-3"
        style={{
          fontFamily: "'Rubik Dirt', cursive",
          fontWeight: 400,
          letterSpacing: "0.02em",
          textShadow: "0 0 12px rgba(255, 255, 255, 0.15)",
        }}
      >
        <Plant size={32} className="text-[#3ecf5a]" weight="fill" style={{ filter: "drop-shadow(0 0 8px rgba(62, 207, 90, 0.4))" }} />
        Krishi Predict.ai
      </a>

      {/* Right: Telemetry Indicators */}
      <div className="absolute right-[48px] top-1/2 -translate-y-1/2 flex items-center gap-6 text-[10px] font-mono text-white/50 select-none">
        <div className="flex items-center gap-2 border-r border-white/10 pr-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf5a] animate-pulse" style={{ boxShadow: "0 0 8px #3ecf5a" }} />
          <span className="text-white/30">SAT_SYNC:</span>
          <span className="text-[#3ecf5a] font-bold">ONLINE</span>
        </div>
        <div className="flex items-center gap-2 border-r border-white/10 pr-6">
          <span className="text-white/30">LOC:</span>
          <span className="text-[#c8960c] font-semibold">28.6139° N, 77.2090° E</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Cpu size={12} className="text-[#3ecf5a]/70 animate-pulse" />
          <span className="text-white/30">NPK LINK:</span>
          <span className="text-[#3ecf5a] font-bold">ACTIVE</span>
          <span className="text-white/35 text-[9px] font-medium">(OK)</span>
        </div>
      </div>
    </motion.nav>
  );
}

export default function Hero() {
  const [recommendationText, setRecommendationText] = useState("");
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [activeSoilProgress, setActiveSoilProgress] = useState(74);
  const [scanSpeed, setScanSpeed] = useState(7);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [modalLogs, setModalLogs] = useState<{ text: string; type: string }[]>([]);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const handlePredictionResult = (result: any) => {
    setIsAnalyzing(true);
    setModalLogs([]);
    
    const steps = [
      { text: "INITIATING SUITABILITY INTERFACE PROTOCOL...", type: "info" },
      { text: "CONNECTING TO REGIONAL SUBSTRATE DATA SENSORS...", type: "info" },
      { text: "EXTRACTING SEASONAL PRECIPITATION AND TEMP FEED...", type: "info" },
      { text: "INJECTING NPK CHEMICAL COEFFICIENTS TO CLASSIFIER...", type: "info" },
      { text: "EXECUTING NEURAL TENSOR FLOW GRAPH...", type: "info" },
      { text: "MATCH COMPLETED. RENDERING SCHEMATIC RECOMMENDATION...", type: "success" }
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setModalLogs((prev) => [...prev, step]);
        if (idx === steps.length - 1) {
          setTimeout(() => {
            setPredictionResult(result);
            setIsAnalyzing(false);
          }, 800);
        }
      }, idx * 600);
    });
  };

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Refs for animations
  const timelineLineRef = useRef<HTMLDivElement>(null);
  const statusTextRef = useRef<HTMLSpanElement>(null);

  // Parallax setup
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 35, damping: 24 });
  const springY = useSpring(mouseY, { stiffness: 35, damping: 24 });

  const bgX = useTransform(springX, [-1, 1], [-12, 12]);
  const bgY = useTransform(springY, [-1, 1], [-12, 12]);
  const treeX = useTransform(springX, [-1, 1], [-35, 35]);
  const treeY = useTransform(springY, [-1, 1], [-25, 25]);
  const chipX = useTransform(springX, [-1, 1], [-50, 50]);
  const chipY = useTransform(springY, [-1, 1], [-35, 35]);
  const cardX = useTransform(springX, [-1, 1], [-12, 12]);
  const cardY = useTransform(springY, [-1, 1], [-8, 8]);
  const terminalX = useTransform(springX, [-1, 1], [-25, 25]);
  const terminalY = useTransform(springY, [-1, 1], [-18, 18]);

  useEffect(() => {
    // Typewriter effect for terminal box (delayed systematically to align with box reveal)
    let currentIndex = 0;
    let interval: NodeJS.Timeout;
    const typewriterTimeout = setTimeout(() => {
      interval = setInterval(() => {
        if (currentIndex < fullRecommendation.length) {
          setRecommendationText(fullRecommendation.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          currentIndex = 0;
        }
      }, 100);
    }, ANIMATION_DELAYS.terminalBox * 1000);

    // Simulate soil sync bar changes
    const progressInterval = setInterval(() => {
      setActiveSoilProgress((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = prev + delta;
        return next >= 70 && next <= 80 ? next : prev;
      });
    }, 3000);

    // GSAP Timeline Line Draw
    if (timelineLineRef.current) {
      gsap.to(timelineLineRef.current, {
        scaleY: 1,
        duration: 2.2,
        ease: "power2.out",
        delay: ANIMATION_DELAYS.timelineLine,
      });
    }

    // Typed.js Status text animation
    let typed: Typed | null = null;
    if (statusTextRef.current) {
      typed = new Typed(statusTextRef.current, {
        strings: ["PREDICTION ENGINE ACTIVE"],
        typeSpeed: 40,
        showCursor: false,
        startDelay: ANIMATION_DELAYS.statusTextTyped * 1000,
        loop: false,
      });
    }

    return () => {
      clearTimeout(typewriterTimeout);
      if (interval) clearInterval(interval);
      clearInterval(progressInterval);
      if (typed) {
        typed.destroy();
      }
    };
  }, []);

  function onMouseMove(e: React.MouseEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    mouseX.set(((e.clientX - r.left) / r.width) * 2 - 1);
    mouseY.set(((e.clientY - r.top) / r.height) * 2 - 1);

    // Speed up scanline on fast mouse move
    const velocity = Math.abs(e.movementX) + Math.abs(e.movementY);
    setScanSpeed(Math.max(3, 7 - velocity * 0.05));
  }

  function onMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
    setScanSpeed(7);
  }

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest(".telem-chip") ||
      target.closest(".telem-chip-large") ||
      target.closest(".rec-box") ||
      target.closest(".card") ||
      target.closest(".timeline-node") ||
      target.closest(".glass-card") ||
      isModalOpen
    ) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();

    setRipples((prev) => [
      ...prev,
      {
        id,
        x,
        y,
      },
    ]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1000);

    const normX = (x / rect.width) * 2 - 1;
    const normY = -((y / rect.height) * 2 - 1);

    // Dispatch "firefly-click" event to let R3FParticles determine if a particle was clicked
    const clickEvent = new CustomEvent("firefly-click", {
      detail: { normX, normY },
    });
    window.dispatchEvent(clickEvent);
  };

  const chips = [
    {
      id: "A",
      style: { top: "14%", left: "calc(69% - 330px)", width: "220px" },
      isLargeCard: false,
      render: () => (
        <div className="flex flex-col gap-2.5 text-left text-white font-mono">
          <div className="flex items-center gap-2 text-white/70 text-[10px] tracking-widest font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf5a] animate-pulse shadow-[0_0_8px_#3ecf5a]" />
            SOIL MOISTURE SENSOR
          </div>
          <div className="text-white font-black text-[22px] tracking-tight leading-none flex items-baseline gap-2">
            87.6% 
            <span className="bg-[#3ecf5a]/15 text-[#3ecf5a] px-1.5 py-0.5 rounded-[4px] font-bold text-[8px] tracking-wider border border-[#3ecf5a]/30">OPTIMAL</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/10">
              <div className="bg-[#3ecf5a] h-full rounded-full w-[28.5%] shadow-[0_0_8px_#3ecf5a]" />
            </div>
            <span className="text-white/40 text-[9px] font-medium">28.5%</span>
          </div>
        </div>
      ),
      delay: ANIMATION_DELAYS.chipA,
    },
    {
      id: "B",
      style: { top: "10%", left: "calc(69% + 80px)", width: "220px" },
      isLargeCard: false,
      render: () => (
        <div className="flex flex-col gap-2.5 text-left text-white font-mono">
          <div className="flex items-center gap-2 text-white/70 text-[10px] tracking-widest font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf5a] animate-pulse shadow-[0_0_8px_#3ecf5a]" />
            AMBIENT HUMIDITY SENSOR
          </div>
          <div className="text-white font-black text-[22px] tracking-tight leading-none flex items-baseline gap-2">
            64.8% 
            <span className="bg-[#3ecf5a]/15 text-[#3ecf5a] px-1.5 py-0.5 rounded-[4px] font-bold text-[8px] tracking-wider border border-[#3ecf5a]/30">OPTIMAL</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/10">
              <div className="bg-[#3ecf5a] h-full rounded-full w-[36.2%] shadow-[0_0_8px_#3ecf5a]" />
            </div>
            <span className="text-white/40 text-[9px] font-medium">36.2%</span>
          </div>
        </div>
      ),
      delay: ANIMATION_DELAYS.chipB,
    },
    {
      id: "C",
      style: { top: "68%", left: "calc(69% - 330px)", width: "220px" },
      isLargeCard: false,
      render: () => (
        <div className="flex flex-col gap-2 text-left text-white font-mono">
          <div className="flex items-center gap-2 text-white/70 text-[10px] tracking-widest font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c8960c] animate-pulse shadow-[0_0_8px_#c8960c]" />
            SOIL NPK MONITOR
          </div>
          <div className="flex justify-between items-end text-white font-black text-[22px] tracking-tight leading-none mt-1">
            <div className="flex items-baseline gap-2">
              056% 
              <span className="bg-[#3ecf5a]/15 text-[#3ecf5a] px-1.5 py-0.5 rounded-[4px] font-bold text-[8px] tracking-wider border border-[#3ecf5a]/30">ACTIVE</span>
            </div>
            <div className="flex gap-1 items-end h-3 pb-0.5">
              <div className="w-0.5 h-1.5 bg-[#3ecf5a]" />
              <div className="w-0.5 h-2.5 bg-[#3ecf5a]" />
              <div className="w-0.5 h-3.5 bg-[#3ecf5a] shadow-[0_0_8px_#3ecf5a]" />
              <div className="w-0.5 h-2 bg-[#3ecf5a]/30" />
            </div>
          </div>
          <div className="bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/10 mt-1">
            <div className="bg-[#3ecf5a] h-full rounded-full w-[56%] shadow-[0_0_8px_#3ecf5a]" />
          </div>
          <div className="flex justify-between text-[9px] text-[#c8960c] font-semibold tracking-wide pt-1">
            <span>N: 72 mg/kg</span>
            <span>P: 35 mg/kg</span>
            <span>K: 38 mg/kg</span>
          </div>
        </div>
      ),
      delay: ANIMATION_DELAYS.chipC,
    },
    {
      id: "D",
      style: { top: "45%", left: "calc(69% + 70px)", width: "300px" },
      isLargeCard: true,
      renderLarge: (activeSoilProgress: number) => (
        <SoilMatrixSyncCard activeSoilProgress={activeSoilProgress} delay={ANIMATION_DELAYS.chipD} />
      ),
      delay: ANIMATION_DELAYS.chipD,
    },
  ];

  return (
    <motion.div
      className="hero pointer-events-auto"
      initial="hidden"
      animate="visible"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={handleContainerClick}
    >
      {/* L0 — Background */}
      <motion.img
        className="bg-photo absolute inset-0 h-full w-full object-cover select-none"
        draggable={false}
        style={{ x: bgX, y: bgY, scale: 1.06, zIndex: 0 }}
        src="/assets/pcb-bg.jpg"
      />

      {/* L1 — Black veil */}
      <div
        className="veil"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(3, 10, 6, 0.78)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* L2.5 — Custom interactive gold network background */}
      <CircuitNetBackground />

      {/* L2.5 — Animated grid overlay */}
      <div className="hero-grid" />

      {/* L2.5 — Ambient light flares */}
      <div className="ambient-flare" style={{ top: "20%", left: "69%" }} />
      <div className="ambient-flare ambient-flare--gold" style={{ top: "60%", left: "30%" }} />

      {/* L2.5 — Floating ambient orbs */}
      <div
        className="ambient-orb"
        style={{ width: 120, height: 120, background: "rgba(62, 207, 90, 0.04)", top: "15%", left: "65%", animationDelay: "0s" }}
      />
      <div
        className="ambient-orb"
        style={{ width: 80, height: 80, background: "rgba(184, 134, 11, 0.05)", top: "70%", left: "45%", animationDelay: "7s", animationDuration: "25s" }}
      />
      <div
        className="ambient-orb"
        style={{ width: 100, height: 100, background: "rgba(62, 207, 90, 0.03)", top: "40%", right: "10%", animationDelay: "3s", animationDuration: "18s" }}
      />

      {/* L3 — SVG traces */}
      <SVGTraces />

      {/* L4 — Tree glow */}
      <motion.div
        className="tree-glow"
        style={{
          x: treeX,
          y: treeY,
          zIndex: 4,
          position: "absolute",
          top: "50%",
          left: "69%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* L5 — Particles */}
      <ParticleField style={{ x: chipX, y: chipY }} />

      {/* L5.5 — Tree holographic energy rings */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: ANIMATION_DELAYS.treeRings, duration: 1.0 }}
        style={{ position: "absolute", top: "72%", left: "69%", zIndex: 5 }}
        className="pointer-events-none"
      >
        <div className="tree-ring" />
        <div className="tree-ring tree-ring--outer" />
      </motion.div>

      {/* L6 — Tree (Uses a static wrapper to align exactly to left:80%, top:50%) */}
      <div className="tree-wrapper">
        <motion.div
          style={{ x: treeX, y: treeY, height: "100%" }}
          initial={{ opacity: 0, y: 40, filter: "saturate(0) brightness(0.4)" }}
          animate={{ opacity: 1, y: 0, filter: "saturate(1.35) brightness(1.12)" }}
          transition={{ duration: 1.2, delay: ANIMATION_DELAYS.tree, ease: [0.16, 1, 0.3, 1] as const }}
        >
          <BreathingTree />
        </motion.div>
      </div>

      {/* L7 — Solder dots */}
      <SolderDots />

      {/* L8 — Telemetry chips */}
      {chips.map((chip) => (
        <motion.div
          key={chip.id}
          style={{ position: "absolute", ...chip.style, x: chipX, y: chipY, zIndex: 8 }}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: chip.delay }}
        >
          <Tilt
            tiltMaxAngleX={10}
            tiltMaxAngleY={10}
            glareEnable={true}
            glareMaxOpacity={0.12}
            glareColor={chip.isLargeCard ? "#b8860b" : "#3ecf5a"}
            scale={1.03}
            glareBorderRadius={chip.isLargeCard ? "10px" : "8px"}
          >
            <div className={`${chip.isLargeCard ? "telem-chip-large" : "telem-chip"} relative w-full h-full`}>
              {chip.isLargeCard && chip.renderLarge
                ? chip.renderLarge(activeSoilProgress)
                : chip.render && chip.render()
              }
            </div>
          </Tilt>
        </motion.div>
      ))}

      {/* L8 — Terminal box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: ANIMATION_DELAYS.terminalBox }}
        style={{ position: "absolute", bottom: "72px", right: "40px", zIndex: 8, x: terminalX, y: terminalY }}
      >
        <Tilt
          tiltMaxAngleX={4}
          tiltMaxAngleY={6}
          glareEnable={true}
          glareMaxOpacity={0.08}
          glareColor="#3ecf5a"
          scale={1.02}
        >
          <div className="rec-box relative w-full h-full">
            <TerminalOutput recommendationText={recommendationText} delay={ANIMATION_DELAYS.terminalBox} />
          </div>
        </Tilt>
      </motion.div>

      {/* L9 — Left flat content panel */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: ANIMATION_DELAYS.cardWrapper, ease: [0.16, 1, 0.3, 1] as const }}
        className="card-wrapper"
        style={{ flexShrink: 0, position: "relative", zIndex: 9 }}
      >
        <motion.div
          className="card"
          style={{ x: cardX, y: cardY }}
        >
          <CardContent 
            statusTextRef={statusTextRef} 
            onStartAnalysis={() => {
              const el = document.getElementById('workstation');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              } else {
                setIsModalOpen(true);
              }
            }}
          />
        </motion.div>
      </motion.div>

      {/* L10 — Scanline */}
      <ScanLine scanSpeed={scanSpeed} />

      {/* L11 — Status bar */}
      <StatusBar />

      {/* L12 — Navigation */}
      <Navigation />

      {/* Left Timeline Strip */}
      <motion.div
        className="timeline pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: ANIMATION_DELAYS.timelineFrame, duration: 0.8 }}
      >
        <div className="timeline-line" ref={timelineLineRef} />
        
        <motion.div
          className="timeline-node"
          style={{ top: "22%" }}
          variants={timelineNodeVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.timelineLine + 2.2 * 0.22}
        >
          <span className="timeline-tooltip">ORBIT // CONSTELLATION SYNC</span>
        </motion.div>
        
        <motion.div
          className="timeline-node"
          style={{ top: "40%" }}
          variants={timelineNodeVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.timelineLine + 2.2 * 0.40}
        >
          <span className="timeline-tooltip">TELEM // MULTISPECTRAL FEED</span>
        </motion.div>
        
        <motion.div
          className="timeline-node"
          style={{ top: "58%" }}
          variants={timelineNodeVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.timelineLine + 2.2 * 0.58}
        >
          <span className="timeline-tooltip">MODEL // CLASSIFIER NET</span>
        </motion.div>
        
        <motion.div
          className="timeline-node active"
          style={{ top: "76%" }}
          variants={timelineNodeVariants}
          initial="hidden"
          animate="visible"
          custom={ANIMATION_DELAYS.timelineLine + 2.2 * 0.76}
        >
          <span className="timeline-tooltip">RECOMMEND // CRITICAL INTERFACE (ACTIVE)</span>
        </motion.div>
      </motion.div>

      {/* HUD Corner Brackets */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: ANIMATION_DELAYS.hudBrackets, duration: 1.0 }}
      >
        <div className="hud-corner hud-corner--tl" />
        <div className="hud-corner hud-corner--tr" />
        <div className="hud-corner hud-corner--bl" />
        <div className="hud-corner hud-corner--br" />
      </motion.div>

      {/* Data Connector Lines — tree to chips */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 7 }}
        preserveAspectRatio="none"
      >
        {/* Top-left chip connector */}
        <line
          className="data-connector"
          stroke="rgba(62, 207, 90, 0.12)"
          strokeWidth="1"
          x1={dimensions.width * 0.69}
          y1={dimensions.height * 0.5}
          x2={dimensions.width * 0.69 - 220}
          y2={dimensions.height * 0.14 + 35}
        />
        {/* Top-right chip connector */}
        <line
          className="data-connector"
          stroke="rgba(62, 207, 90, 0.12)"
          strokeWidth="1"
          style={{ animationDelay: "0.8s" }}
          x1={dimensions.width * 0.69}
          y1={dimensions.height * 0.5}
          x2={dimensions.width * 0.69 + 190}
          y2={dimensions.height * 0.18 + 35}
        />
        {/* Bottom-left chip connector */}
        <line
          className="data-connector"
          stroke="rgba(184, 134, 11, 0.10)"
          strokeWidth="1"
          style={{ animationDelay: "1.5s" }}
          x1={dimensions.width * 0.69}
          y1={dimensions.height * 0.5}
          x2={dimensions.width * 0.69 - 220}
          y2={dimensions.height * 0.70 + 45}
        />
        {/* Bottom-right chip connector */}
        <line
          className="data-connector"
          stroke="rgba(184, 134, 11, 0.10)"
          strokeWidth="1"
          style={{ animationDelay: "2.2s" }}
          x1={dimensions.width * 0.69}
          y1={dimensions.height * 0.5}
          x2={dimensions.width * 0.69 + 220}
          y2={dimensions.height * 0.48 + 50}
        />
      </svg>


      {/* Click Ripples */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="pointer-events-none absolute z-[30] h-[50px] w-[50px] rounded-full border-2 border-[#4de082] animate-[ripple-animation_1s_cubic-bezier(0.1,0.8,0.3,1)_forwards]"
          style={{
            left: `${ripple.x}px`,
            top: `${ripple.y}px`,
            marginLeft: "-25px",
            marginTop: "-25px",
            boxShadow: "0 0 15px #4de082, inset 0 0 15px #4de082",
          }}
        />
      ))}

      {/* Futuristic Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto">
            <div 
              className="absolute inset-0 bg-transparent" 
              onClick={() => {
                if (!isAnalyzing) {
                  setIsModalOpen(false);
                  setPredictionResult(null);
                }
              }} 
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl glass-card border border-white/10 p-6 md:p-8 no-scrollbar flex flex-col gap-6"
            >
              {/* Close Button */}
              {!isAnalyzing && (
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setPredictionResult(null);
                  }}
                  className="absolute right-6 top-6 text-white/40 hover:text-white/90 hover:scale-110 transition-all cursor-pointer z-10"
                >
                  <X size={20} weight="bold" />
                </button>
              )}

              {/* Title Header */}
              <div className="text-left border-b border-white/10 pb-4 pr-10">
                <span className="text-[10px] font-mono text-[#c8960c] tracking-widest uppercase block mb-1">
                  Krishi Predict.ai Workstation v3.5
                </span>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-wide font-sans">
                  {isAnalyzing 
                    ? "NEURAL SUITABILITY RECONSTRUCT..." 
                    : predictionResult 
                      ? "ANALYTICAL REPORT" 
                      : "NEURAL SUITABILITY WORKSTATION"
                  }
                </h2>
              </div>

              {/* Content Panel */}
              <div className="flex-1">
                {isAnalyzing ? (
                  /* Loading / Scanning Sequence */
                  <div className="py-12 flex flex-col items-center justify-center gap-6 text-center font-mono">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-[#3ecf5a]/25 animate-ping" />
                      <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#c8960c]/40 animate-spin" style={{ animationDuration: '6s' }} />
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3ecf5a] to-[#c8960c] animate-pulse flex items-center justify-center shadow-[0_0_25px_#3ecf5a]" />
                    </div>

                    <div className="w-full max-w-md bg-black/40 border border-white/5 rounded-xl p-4 text-left text-[11px] text-white/80 space-y-2 max-h-[160px] overflow-y-auto no-scrollbar shadow-inner">
                      {modalLogs.map((log, i) => (
                        <div key={i} className="flex gap-2 items-start leading-relaxed">
                          <span className={log.type === 'success' ? 'text-[#3ecf5a]' : 'text-[#c8960c]'}>
                            {log.type === 'success' ? '[✓]' : '[-]'}
                          </span>
                          <span>{log.text}</span>
                        </div>
                      ))}
                      <div className="w-1.5 h-3 bg-[#3ecf5a] animate-pulse inline-block" />
                    </div>
                  </div>
                ) : predictionResult ? (
                  <ResultCard 
                    prediction={predictionResult} 
                    onReset={() => setPredictionResult(null)} 
                  />
                ) : (
                  <PredictionForm 
                    onPredictionResult={handlePredictionResult}
                    onLoadingStateChange={() => {}}
                    onLog={(msg, type) => {
                      console.log(`[FORM LOG]: ${msg} (${type})`);
                    }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
