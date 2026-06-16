"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const BioluminescentFieldBg = dynamic(() => import('./BioluminescentFieldBg'), {
  ssr: false,
});

interface Prediction {
  crop: string;
  probability: number;
  predicted_yield: number;
}

interface TelemetryResult {
  location: string;
  coordinates: { lat: number; lon: number };
  resolved_state: string;
  sowing_date_used: string;
  climate_data: {
    avg_temp_c: number;
    total_rainfall_mm: number;
    avg_humidity_percent: number;
  };
  soil_data: {
    N: number;
    P: number;
    K: number;
    pH: number;
  };
  predictions: Prediction[];
}

// Telemetry Presets for Locations
const PRESET_TELEMETRY: Record<string, {
  climate: { temp: number; rain: number; humid: number };
  soil: { N: number; P: number; K: number; pH: number };
}> = {
  BETUL: {
    climate: { temp: 28.5, rain: 120, humid: 55 },
    soil: { N: 75, P: 22, K: 180, pH: 6.8 }
  },
  BHATINDA: {
    climate: { temp: 32.0, rain: 60, humid: 40 },
    soil: { N: 120, P: 35, K: 240, pH: 7.5 }
  },
  BARDHAMAN: {
    climate: { temp: 29.8, rain: 280, humid: 85 },
    soil: { N: 90, P: 18, K: 150, pH: 6.2 }
  },
  SHIMOGA: {
    climate: { temp: 24.2, rain: 350, humid: 90 },
    soil: { N: 65, P: 15, K: 130, pH: 5.8 }
  }
};

// Panel Border Drawing SVG Overlay
function DrawingPanelBorder({ duration = 400 }: { duration?: number }) {
  const rectRef = useRef<SVGRectElement>(null);
  const [perimeter, setPerimeter] = useState(0);
  const [active, setActive] = useState(false);

  // Add body class for dashboard background
  useEffect(() => {
    document.body.classList.add('dashboard');
    return () => document.body.classList.remove('dashboard');
  }, []);

  useEffect(() => {
    if (rectRef.current) {
      const parent = rectRef.current.viewportElement || rectRef.current.ownerSVGElement;
      if (parent) {
        const width = parent.clientWidth || parent.getBoundingClientRect().width;
        const height = parent.clientHeight || parent.getBoundingClientRect().height;
        setPerimeter(2 * (width + height));
      }
    }
    setActive(true);
  }, []);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-[8px] z-20">
      <rect
        ref={rectRef}
        x="0.5"
        y="0.5"
        width="calc(100% - 1px)"
        height="calc(100% - 1px)"
        rx="8"
        fill="none"
        stroke="rgba(0, 229, 255, 0.25)"
        strokeWidth="1"
        strokeDasharray={perimeter || 1000}
        strokeDashoffset={active ? 0 : (perimeter || 1000)}
        style={{
          transition: `stroke-dashoffset ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          strokeLinecap: 'round'
        }}
      />
    </svg>
  );
}

// React CountUp Component for Match Numbers
function CountUp({ target, delay = 800, duration = 600 }: { target: number; delay?: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let started = false;
    let animationFrameId: number;

    const startTimeout = setTimeout(() => {
      started = true;
      const startTime = performance.now();

      const update = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setValue(Math.floor(eased * target));

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(update);
        }
      };

      animationFrameId = requestAnimationFrame(update);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      cancelAnimationFrame(animationFrameId);
    };
  }, [target, delay, duration]);

  return <>{value}%</>;
}

// Custom SVG Radar / Spider Chart
function RadarChart({ temp, rain, humid }: { temp: number; rain: number; humid: number }) {
  const cx = 100;
  const cy = 70;
  const maxRadius = 50;

  const nTemp = Math.min(1, Math.max(0.1, temp / 50));
  const nRain = Math.min(1, Math.max(0.1, rain / 500));
  const nHumid = Math.min(1, Math.max(0.1, humid / 100));

  const angles = [
    -Math.PI / 2,     // Temp (12 o'clock)
    Math.PI / 6,      // Rain (4 o'clock)
    5 * Math.PI / 6,  // Humid (8 o'clock)
  ];

  const getCoords = (val: number, angle: number) => {
    const r = val * maxRadius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    };
  };

  const gridLevels = [0.33, 0.66, 1.0];
  const dataPoints = [
    getCoords(nTemp, angles[0]),
    getCoords(nRain, angles[1]),
    getCoords(nHumid, angles[2])
  ];

  const polygonPoints = dataPoints.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");

  return (
    <div className="flex items-center justify-center" style={{ width: '200px', height: '140px' }}>
      <svg width="200" height="140" className="overflow-visible" style={{ background: 'transparent' }}>
        {/* Concentric reference triangles */}
        {gridLevels.map((lvl, idx) => {
          const pts = angles.map(a => getCoords(lvl, a));
          const ptString = pts.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");
          return (
            <polygon
              key={idx}
              points={ptString}
              fill="transparent"
              stroke="rgba(46, 232, 122, 0.12)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis lines from center to each vertex */}
        {angles.map((angle, idx) => {
          const outer = getCoords(1.0, angle);
          return (
            <line
              key={idx}
              x1={cx}
              y1={cy}
              x2={parseFloat(outer.x.toFixed(3))}
              y2={parseFloat(outer.y.toFixed(3))}
              stroke="rgba(46, 232, 122, 0.25)"
              strokeWidth="1"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(46, 232, 122, 0.15)"
          stroke="var(--signal)"
          strokeWidth="1.5"
        />

        {/* Vertex dots */}
        {dataPoints.map((p, idx) => (
          <circle
            key={idx}
            cx={parseFloat(p.x.toFixed(3))}
            cy={parseFloat(p.y.toFixed(3))}
            r="4.5"
            fill="var(--signal)"
            style={{
              filter: 'drop-shadow(0 0 5px var(--signal))'
            }}
          />
        ))}

        {/* Axis Labels: T top, H bottom-left, R bottom-right */}
        <text
          x={cx}
          y={cy - maxRadius - 8}
          textAnchor="middle"
          className="climate-axis-label temp"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 700 }}
        >
          T
        </text>

        {(() => {
          const coords = getCoords(1.0, angles[1]);
          return (
            <text
              x={parseFloat((coords.x + 12).toFixed(3))}
              y={parseFloat((coords.y + 4).toFixed(3))}
              textAnchor="start"
              className="climate-axis-label rain"
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 700 }}
            >
              R
            </text>
          );
        })()}

        {(() => {
          const coords = getCoords(1.0, angles[2]);
          return (
            <text
              x={parseFloat((coords.x - 12).toFixed(3))}
              y={parseFloat((coords.y + 4).toFixed(3))}
              textAnchor="end"
              className="climate-axis-label humid"
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 700 }}
            >
              H
            </text>
          );
        })()}
      </svg>
    </div>
  );
}

// Glowing Soil chemistry digital gauge circular indicator (open-arc style)
function SoilGauge({ label, value, max, unit, color = "#2EE87A" }: { label: string; value: number; max: number; unit: string; color?: string }) {
  const percentage = Math.min(1, Math.max(0.05, value / max));
  
  const cx = 28;
  const cy = 28;
  const r = 24;

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    if (Math.abs(endAngle - startAngle) < 0.1) {
      const p = polarToCartesian(x, y, radius, startAngle);
      return `M ${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
    }
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x.toFixed(3), start.y.toFixed(3),
      "A", radius, radius, 0, largeArcFlag, 1, end.x.toFixed(3), end.y.toFixed(3)
    ].join(" ");
  };

  const startAngle = -220;
  const endAngle = 40;
  const trackPath = describeArc(cx, cy, r, startAngle, endAngle);
  
  const activeEndAngle = startAngle + percentage * (endAngle - startAngle);
  const valuePath = describeArc(cx, cy, r, startAngle, activeEndAngle);

  const renderDialValue = (val: number, lbl: string) => {
    const str = lbl === "pH" ? val.toFixed(1) : Math.round(val).toString();
    if (str.includes('.')) {
      const [intPart, decPart] = str.split('.');
      return (
        <span style={{ fontSize: '18px' }}>
          {intPart}
          <span style={{ fontSize: '12px', opacity: 0.85 }}>.{decPart}</span>
        </span>
      );
    }
    if (str.length >= 3) {
      return <span style={{ fontSize: '16px' }}>{str}</span>;
    }
    return <span style={{ fontSize: '18px' }}>{str}</span>;
  };

  return (
    <div className="flex flex-col items-center justify-center select-none" style={{ width: '56px' }}>
      <div 
        className="nutrient-ring"
        style={{ 
          width: '56px', 
          height: '56px', 
          position: 'relative', 
          marginBottom: '3px' 
        }}
      >
        <svg width="56" height="56" style={{ background: 'transparent' }}>
          <path
            d={trackPath}
            fill="transparent"
            stroke="#152318"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <motion.path
            d={valuePath}
            fill="transparent"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              filter: `drop-shadow(0 0 2px ${color}44)`
            }}
          />
        </svg>
        
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center" 
          style={{ 
            pointerEvents: 'none',
            lineHeight: 1
          }}
        >
          <span 
            style={{ 
              fontFamily: "'IBM Plex Mono', monospace", 
              fontWeight: 700, 
              letterSpacing: '-0.02em', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'baseline'
            }}
          >
            {renderDialValue(value, label)}
          </span>
          <span 
            style={{ 
              fontFamily: "'IBM Plex Mono', monospace", 
              fontSize: '8px', 
              fontWeight: 400, 
              letterSpacing: '0.15em', 
              color: '#3D5C42', 
              marginTop: '1px' 
            }}
          >
            {unit}
          </span>
        </div>
      </div>
      
      <span 
        style={{ 
          fontFamily: "'IBM Plex Mono', monospace", 
          fontSize: '10px', 
          fontWeight: 600, 
          letterSpacing: '0.15em', 
          color: color, 
          textTransform: 'uppercase',
          marginTop: '3px',
          lineHeight: 1
        }}
      >
        {label === "pH" ? "PH" : label}
      </span>
      
      <div 
        style={{ 
          width: '3px', 
          height: '3px', 
          borderRadius: '50%', 
          backgroundColor: color, 
          marginTop: '2px' 
        }} 
      />
    </div>
  );
}

// Live ASCII canopy scan matrix map
function AsciiFieldMap() {
  const [grid, setGrid] = useState<string[]>([]);

  useEffect(() => {
    const chars = ['.', '.', '.', '*', '*', 'o', '+', '#'];
    const generateGrid = () => {
      let lines = [];
      for (let r = 0; r < 5; r++) {
        let line = "";
        for (let c = 0; c < 24; c++) {
          const rand = Math.random();
          if (rand > 0.82) line += chars[Math.floor(Math.random() * chars.length)] + " ";
          else if (rand > 0.5) line += ". ";
          else line += "  ";
        }
        lines.push(line);
      }
      return lines;
    };

    setGrid(generateGrid());

    const interval = setInterval(() => {
      setGrid(generateGrid());
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-[10px] text-[var(--signal)] leading-tight p-3 bg-black/40 border border-[var(--border)] rounded select-none w-full h-[140px] overflow-hidden flex flex-col justify-between">
      <div className="text-[var(--muted)] border-b border-[var(--border)] pb-1 mb-1 flex justify-between select-none">
        <span>CANOPY SCAN MATRIX</span>
        <span className="animate-pulse text-[var(--signal)] font-bold">● LIVE</span>
      </div>
      <pre className="text-left flex-1 font-bold select-none opacity-80 leading-tight">
        {grid.join("\n")}
      </pre>
    </div>
  );
}

// Traced execute button component
function ExecuteButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="execute-btn run-btn relative w-full h-[52px] bg-[rgba(46,232,122,0.06)] text-[var(--signal)] font-mono font-bold text-[11px] tracking-[0.14em] uppercase transition-colors duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed border border-[var(--border)] rounded overflow-hidden whitespace-nowrap"
      style={{ padding: '0 16px' }}
      onClick={() => {
        if (typeof window !== 'undefined') {
          (window as any).pipelineExecuting = true;
          setTimeout(() => {
            (window as any).pipelineExecuting = false;
          }, 4300);
        }
      }}
    >
      {loading ? (
        <span className="material-symbols-outlined text-base animate-spin">sync</span>
      ) : (
        <span className="material-symbols-outlined text-base animate-pulse">radar</span>
      )}
      {loading ? "SCANNING PIPELINE..." : "RUN ML PREDICTION PIPELINE"}
    </button>
  );
}

// 🌐 Layer 3 Expanding Concentric Rings for scanning background
function RadialScanPulse() {
  return (
    <div className="absolute right-[10%] top-[35%] w-[400px] h-[400px] -translate-y-1/2 translate-x-1/2 pointer-events-none">
      <div className="absolute inset-0 rounded-full border border-[#2EE87A] opacity-0 radial-ring-1" />
      <div className="absolute inset-0 rounded-full border border-[#2EE87A] opacity-0 radial-ring-2" />
      <div className="absolute inset-0 rounded-full border border-[#2EE87A] opacity-0 radial-ring-3" />
      <div className="absolute inset-0 rounded-full border border-[#2EE87A] opacity-0 radial-ring-4" />
    </div>
  );
}


function LoadingSimulationOverlay() {
  const [percent, setPercent] = React.useState(0);
  const [phase, setPhase] = React.useState("INITIATING SCAN");
  
  React.useEffect(() => {
    const start = performance.now();
    const duration = 4100; // slightly shorter than 4300 to hold 100% briefly
    
    const update = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const currentPercent = Math.floor(progress * 100);
      setPercent(currentPercent);
      
      if (currentPercent < 20) {
        setPhase("🛰️ CONNECTING SATELLITE ARRAYS");
      } else if (currentPercent < 45) {
        setPhase("☁️ DOWNLOADING NASA CLIMATE VECTOR");
      } else if (currentPercent < 70) {
        setPhase("🌱 ANALYZING SOIL GRIDS METRICS");
      } else if (currentPercent < 90) {
        setPhase("🔮 RUNNING XGBOOST INFERENCE ENGINE");
      } else {
        setPhase("🏆 COMPILING OPTIMIZED SUITABILITY");
      }
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };
    
    requestAnimationFrame(update);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-4 text-center select-none z-30 transition-all duration-300">
      {/* Cyber pulse circle */}
      <div className="relative flex items-center justify-center mb-5">
        <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-[color:var(--signal)] opacity-25"></span>
        <span className="relative inline-flex rounded-full h-10 w-10 bg-black border border-[var(--signal)] items-center justify-center">
          <span className="material-symbols-outlined text-base text-[var(--signal)] animate-spin" style={{ animationDuration: '3s' }}>
            sync
          </span>
        </span>
      </div>
      
      {/* Percentage read */}
      <div 
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--signal)',
          letterSpacing: '-0.05em',
          textShadow: '0 0 12px rgba(0, 229, 255, 0.4)',
          lineHeight: 1
        }}
      >
        {percent}%
      </div>
      
      {/* Active Phase */}
      <div 
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '8px',
          fontWeight: 600,
          color: '#A8C8AA',
          letterSpacing: '0.12em',
          marginTop: '6px',
          textTransform: 'uppercase',
          minHeight: '10px'
        }}
      >
        {phase}
      </div>
      
      {/* Custom progress bar track */}
      <div className="w-40 h-[2px] bg-white/5 border border-white/10 rounded-full mt-4 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-[var(--signal)] to-[#2EE87A] transition-all duration-75"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}


export default function PredictionWorkstation() {
  const [mounted, setMounted] = useState(false);
  const [bootStarted, setBootStarted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Boot sequence timer triggers drone assembly at 1.2s
    const timer = setTimeout(() => {
      setBootStarted(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const [location, setLocation] = useState('Betul, MP');
  const [sowingDate, setSowingDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [season, setSeason] = useState('Auto');
  const [area, setArea] = useState('1.0');
  const [fertilizer, setFertilizer] = useState('100');
  const [pesticide, setPesticide] = useState('1.0');

  // UI States
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<{ text: string; type: 'info' | 'success' | 'warn' }[]>([]);
  const [result, setResult] = useState<TelemetryResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanTimestamp, setScanTimestamp] = useState<string>('2026-06-14 20:00:00 UTC');
  const [consoleHovered, setConsoleHovered] = useState(false);

  // Design Overhaul States
  const [activePreset, setActivePreset] = useState('BETUL');
  const [eyebrowText, setEyebrowText] = useState('');
  
  // Custom Hover/Drawer states
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  
  // Interactivity connection
  const [hoveredCropIndex, setHoveredCropIndex] = useState<number | null>(null);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  // AI Tips state
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [aiTipsLoading, setAiTipsLoading] = useState(false);
  const [aiTipsError, setAiTipsError] = useState<string | null>(null);

  // UX Enhancement States
  const [scanCount, setScanCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({ message: '', type: 'info', visible: false });
  const [tipsCopied, setTipsCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const aiTipsRef = useRef<HTMLDivElement>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  }, []);

  // Copy AI tips to clipboard
  const copyAiTips = useCallback(() => {
    if (!aiTips) return;
    navigator.clipboard.writeText(aiTips).then(() => {
      setTipsCopied(true);
      showToast('📋 Farming tips copied to clipboard!', 'success');
      setTimeout(() => setTipsCopied(false), 2000);
    }).catch(() => {
      showToast('Failed to copy tips', 'error');
    });
  }, [aiTips, showToast]);

  // Eyebrow typewriter animation
  const fullEyebrowText = "Neural Analysis Workstation";
  useEffect(() => {
    let timer = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setEyebrowText(fullEyebrowText.slice(0, i + 1));
        i++;
        if (i >= fullEyebrowText.length) clearInterval(interval);
      }, 40);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Update client-side scan timestamp on mount
  useEffect(() => {
    setScanTimestamp(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
  }, []);

  // Preset locations
  const PRESET_LOCATIONS = [
    { name: "BETUL", state: "Madhya Pradesh", zone: "Central Drylands Belt", values: { area: "2.5", fert: "180", pest: "1.5" } },
    { name: "BHATINDA", state: "Punjab", zone: "Wheat Basket Belt", values: { area: "10.0", fert: "800", pest: "8.0" } },
    { name: "BARDHAMAN", state: "West Bengal", zone: "Alluvial Rice Paddy", values: { area: "5.0", fert: "450", pest: "3.5" } },
    { name: "SHIMOGA", state: "Karnataka", zone: "Tropical Wet Highlands", values: { area: "4.0", fert: "220", pest: "2.0" } }
  ];

  const applyPreset = (preset: typeof PRESET_LOCATIONS[0]) => {
    setLocation(preset.name === "BARDHAMAN" ? "Bardhaman, WB" : preset.name === "BETUL" ? "Betul, MP" : preset.name === "BHATINDA" ? "Bhatinda, Punjab" : "Shimoga, Karnataka");
    setActivePreset(preset.name);
    setArea(preset.values.area);
    setFertilizer(preset.values.fert);
    setPesticide(preset.values.pest);
    addLog(`Configured preset environment for ${preset.name}`, 'info');
  };

  const addLog = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setLogs((prev) => [...prev, { text, type }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      setErrorMsg('Please enter a location name.');
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMsg('');
    setLogs([]);
    setAiTips(null);
    setAiTipsError(null);
    setAiTipsLoading(false);
    setDrawerExpanded(true); // Open drawer on submit

    if (typeof window !== 'undefined') {
      (window as any).pipelineExecuting = true;
      setTimeout(() => {
        (window as any).pipelineExecuting = false;
      }, 4300);
    }

    // Initial parameters scan log
    addLog(`⚙️ SCANNERS ENGAGED: TARGET="${location.toUpperCase()}" | AREA=${area}HA | SEASON=${season.toUpperCase()} | FERT=${fertilizer}KG | PEST=${pesticide}KG`, 'info');

    const steps = [
      { text: "🛰️ Resolving coordinates from open-source geocoder...", delay: 200 },
      { text: `📍 Location geocoded to region: searching database averages...`, delay: 700 },
      { text: "☁️ Initiating satellite link: querying NASA POWER Climate Database...", delay: 1400 },
      { text: "🌱 Substrate scan: extracting soil biochemical data from SoilGrids API...", delay: 2200 },
      { text: "🔮 Injecting climate & soil vectors into ML Recommendation Pipeline...", delay: 3000 },
      { text: "🏆 Running Scikit-Learn Stage-1 Classifier & XGBoost Stage-2 Regressor...", delay: 3600 }
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        addLog(step.text, 'info');
      }, step.delay);
    });

    try {
      const payload = {
        location: location.trim(),
        sowing_date: sowingDate,
        season: season === 'Auto' ? null : season,
        area: parseFloat(area) || 1.0,
        fertilizer: parseFloat(fertilizer) || 100.0,
        pesticide: parseFloat(pesticide) || 1.0
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch predictions');
      }

      setTimeout(() => {
        setResult(data);
        setScanTimestamp(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
        setLoading(false);
        setScanCount(prev => prev + 1);
        addLog("✅ Optimization pipeline complete. Analytical Report generated.", 'success');
        showToast(`✅ Analysis complete for ${location.toUpperCase()} — ${data.predictions?.length || 0} crops matched`, 'success');
        
        // Auto-scroll to results after a brief delay
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 600);
        
        // Auto-fetch AI farming tips for the top predicted crop
        if (data.predictions && data.predictions.length > 0) {
          const topPred = data.predictions[0];
          setAiTips(null);
          setAiTipsError(null);
          setAiTipsLoading(true);
          addLog("🤖 Querying OpenAI for personalized farming advisory...", 'info');
          
          fetch('/api/ai-tips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              crop: topPred.crop,
              predicted_yield: topPred.predicted_yield,
              probability: topPred.probability,
              location: data.location,
              state: data.resolved_state,
              season: season === 'Auto' ? 'Auto-detected' : season,
              climate: data.climate_data,
              soil: data.soil_data,
              area: parseFloat(area) || 1.0
            })
          })
          .then(res => res.json())
          .then(tipsData => {
            if (tipsData.tips) {
              setAiTips(tipsData.tips);
              addLog("🌿 AI Farming Advisory received successfully.", 'success');
              showToast('🤖 AI farming tips ready!', 'success');
              // Auto-scroll to AI tips panel
              setTimeout(() => {
                aiTipsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 400);
            } else {
              setAiTipsError(tipsData.error || 'No tips received');
              addLog("⚠️ AI tips unavailable.", 'warn');
            }
            setAiTipsLoading(false);
          })
          .catch(err => {
            setAiTipsError(err.message || 'Failed to fetch AI tips');
            setAiTipsLoading(false);
            addLog("⚠️ AI advisory fetch failed. Tips unavailable.", 'warn');
          });
        }
      }, 4300);

    } catch (err: any) {
      console.error(err);
      setTimeout(() => {
        setErrorMsg(err.message || 'Connection lost. Verify ML backend server is online.');
        setLoading(false);
        addLog("❌ Telemetry fetch aborted. Check connection profiles.", 'warn');
      }, 4300);
    }
  };

  // Bind Telemetry values
  const hasResult = result !== null;
  const climateData = hasResult ? {
    temp: result.climate_data.avg_temp_c,
    rain: result.climate_data.total_rainfall_mm,
    humid: result.climate_data.avg_humidity_percent
  } : PRESET_TELEMETRY[activePreset]?.climate || PRESET_TELEMETRY.BETUL.climate;

  const soilData = hasResult ? {
    N: result.soil_data.N,
    P: result.soil_data.P,
    K: result.soil_data.K,
    pH: result.soil_data.pH
  } : PRESET_TELEMETRY[activePreset]?.soil || PRESET_TELEMETRY.BETUL.soil;

  const predictionsToShow = result ? result.predictions : [
    { crop: "WHEAT", probability: 0.87, predicted_yield: 4.20 },
    { crop: "RICE", probability: 0.61, predicted_yield: 3.10 },
    { crop: "MAIZE", probability: 0.38, predicted_yield: 2.80 }
  ];

  const matchScore = predictionsToShow[0] ? Math.round(predictionsToShow[0].probability * (predictionsToShow[0].probability <= 1 ? 100 : 1)) : 87;

  const getThresholdColor = (pct: number) => {
    if (pct > 70) return "var(--signal)";
    if (pct >= 40) return "var(--warn)";
    return "var(--danger)";
  };

  const getAgronomicRationale = (crop: string, prob: number) => {
    const cropLower = crop.toLowerCase();
    if (cropLower.includes("wheat")) {
      return "Rabi sowing window · High nitrogen responsiveness · Optimal dry temperature profile";
    } else if (cropLower.includes("rice") || cropLower.includes("paddy")) {
      return "Monsoon sowing window · High water saturation suitability · Alluvial clay loam match";
    } else if (cropLower.includes("maize")) {
      return "Kharif sowing window · Substrate aeration compatible · Soil pH balanced";
    } else {
      return `ML Vector optimization: ${Math.round(prob * (prob <= 1 ? 100 : 1))}% biochemical alignment criteria met`;
    }
  };

  // Framer Motion staggered entrance presets
  const labelVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: { opacity: 1, y: 0 }
  };

  const inputVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: { opacity: 1, x: 0 }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: -16 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <section 
      id="workstation" 
      className="workstation-theme relative w-full min-h-screen text-white flex flex-col justify-start items-center py-16 px-6 md:px-12 border-t border-[var(--border)] overflow-x-hidden font-sans"
    >
      {/* Layer 5: Noise texture overlay (2% opacity) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.02,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          zIndex: 3
        }}
      />

      <div className="dashboard-root max-w-[1440px] w-full z-10 space-y-6 flex flex-col relative">
        
        {/* Section Header */}
        <div className="text-center pb-2">
          <div className="inline-flex items-center gap-[10px] px-3 py-1.5 bg-[rgba(46,232,122,0.04)] border border-[rgba(46,232,122,0.15)] rounded-full text-[10px] uppercase tracking-[0.20em] text-[var(--signal)] mb-3">
            <span className="status-dot w-1.5 h-1.5 rounded-full bg-[color:var(--signal)]" />
            {eyebrowText || " "}
          </div>
          
          <h2 className="text-[42px] font-black tracking-tight leading-tight flex flex-col items-center animate-[fade-in_0.6s_ease-out]" style={{ fontFamily: "var(--font-display), sans-serif", letterSpacing: '-0.035em', marginBottom: '12px' }}>
            <span className="bg-gradient-to-r from-white via-[#E0F7FA] to-[var(--warn)] bg-clip-text text-transparent uppercase font-black hero-title">
              Predict Crop Suitability & Expected Yield
            </span>
          </h2>
        </div>

        {/* Full Header Block */}
        <div 
          style={{ 
            padding: '12px 0px 0px 0px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            marginBottom: '8px'
          }}
        >
          {/* Subtitle Badges (BADGE ROW) */}
          <div 
            className="flex flex-wrap justify-center" 
            style={{ 
              gap: '8px', 
              marginBottom: '8px' 
            }}
          >
            {/* NASA Climate Arrays */}
            <div
              style={{
                padding: '4px 10px',
                border: '1px solid rgba(240, 192, 64, 0.2)',
                borderRadius: '4px',
                backgroundColor: 'rgba(240, 192, 64, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                minWidth: '140px'
              }}
            >
              <span style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}>🔭</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 400, letterSpacing: '0.08em', color: 'var(--warn)' }}>
                NASA Climate Arrays
              </span>
            </div>

            {/* SoilGrids Sensors */}
            <div
              style={{
                padding: '4px 10px',
                border: '1px solid rgba(62, 207, 90, 0.2)',
                borderRadius: '4px',
                backgroundColor: 'rgba(62, 207, 90, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                minWidth: '140px'
              }}
            >
              <span style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}>🌍</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 400, letterSpacing: '0.08em', color: 'var(--signal)' }}>
                SoilGrids Sensors
              </span>
            </div>

            {/* Geocoding API */}
            <div
              style={{
                padding: '4px 10px',
                border: '1px solid rgba(232, 64, 122, 0.2)',
                borderRadius: '4px',
                backgroundColor: 'rgba(232, 64, 122, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                minWidth: '140px'
              }}
            >
              <span style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}>📍</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 400, letterSpacing: '0.08em', color: 'var(--danger)' }}>
                Geocoding API
              </span>
            </div>
          </div>

        </div>

        {/* Static Workstation Container with Bioluminescent Background */}
        <div className="relative w-full">
          {/* Bioluminescent canvas background sits statically behind the dashboard panels */}
          <BioluminescentFieldBg addLog={addLog} viewMode="dashboard" />
          
          {/* Front Face: The standard 3-column dashboard */}
          <div className="flex flex-col gap-6 w-full relative z-10">
              {/* Main Interface Columns - 3-Column Layout */}
              <div className="workstation-grid items-stretch w-full mt-2">
          
          {/* Col 1 (25%): Input controls */}
          <div className="flex flex-col justify-start gap-5">
            <div 
              className="panel-container relative overflow-hidden flex flex-col justify-start gap-5 flex-1 cultivation-form h-full"
              style={{ padding: '32px 28px' }}
            >
              <DrawingPanelBorder duration={400} />
              
              <div>
                <motion.h3 
                  variants={labelVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="section-header"
                >
                  Cultivation Parameters
                </motion.h3>
                
                <form onSubmit={handleSubmit}>
                  {/* Location */}
                  <motion.div 
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.40, duration: 0.3 }}
                    className="flex flex-col text-left"
                    style={{ marginBottom: '24px' }}
                  >
                    <label className="field-label">Location / District</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Betul, MP"
                      className="focus:outline-none"
                      disabled={loading}
                    />
                  </motion.div>

                  {/* Sowing Date */}
                  <motion.div 
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.48, duration: 0.3 }}
                    className="flex flex-col text-left"
                    style={{ marginBottom: '24px' }}
                  >
                    <label className="field-label">Estimated Sowing Date</label>
                    <input
                      type="date"
                      value={sowingDate}
                      onChange={(e) => setSowingDate(e.target.value)}
                      className="focus:outline-none"
                      disabled={loading}
                    />
                  </motion.div>

                  {/* Season and Area row */}
                  <motion.div 
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.56, duration: 0.3 }}
                    className="grid grid-cols-2"
                    style={{ gap: '16px', marginBottom: '26px' }}
                  >
                    <div className="flex flex-col text-left">
                      <label className="field-label">Season</label>
                      <select
                        value={season}
                        onChange={(e) => setSeason(e.target.value)}
                        className="focus:outline-none appearance-none cursor-pointer"
                        disabled={loading}
                      >
                        <option value="Auto">Auto-detect</option>
                        <option value="Kharif">Kharif</option>
                        <option value="Rabi">Rabi</option>
                        <option value="Summer">Summer</option>
                        <option value="Whole Year">Whole Year</option>
                      </select>
                    </div>

                    <div className="flex flex-col text-left">
                      <label className="field-label">Area (HA)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="focus:outline-none"
                        disabled={loading}
                      />
                    </div>
                  </motion.div>

                  {/* Sliders */}
                  <div className="pt-2 border-t border-[var(--border)] mt-1">
                    <motion.div 
                      variants={inputVariants}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.64, duration: 0.3 }}
                      className="text-left"
                      style={{ marginBottom: '24px' }}
                    >
                      <div className="flex justify-between items-center" style={{ marginBottom: '10px' }}>
                        <span className="field-label" style={{ marginBottom: 0 }}>Fertilizer Used</span>
                      </div>
                      
                      <div className="workstation-slider-container">
                        {/* Floating Tooltip */}
                        <div 
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '22px',
                            marginBottom: '4px'
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              left: `calc(${((parseFloat(fertilizer) - 10) / 990) * 100}% - 22px)`,
                              bottom: '0px',
                              backgroundColor: 'var(--signal)',
                              color: '#060814',
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontFamily: "'IBM Plex Mono', monospace",
                              whiteSpace: 'nowrap',
                              boxShadow: '0 0 8px var(--signal)',
                              pointerEvents: 'none',
                              transition: 'left 50ms ease-out'
                            }}
                          >
                            {fertilizer} kg
                          </span>
                        </div>
                        
                        <input
                          type="range"
                          min="10"
                          max="1000"
                          step="10"
                          value={fertilizer}
                          onChange={(e) => setFertilizer(e.target.value)}
                          disabled={loading}
                        />
                        
                        <div className="flex justify-between text-[8px] text-[#5A7D5E] font-mono mt-1 select-none">
                          <span>MIN: 10 KG</span>
                          <span>MAX: 1000 KG</span>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      variants={inputVariants}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.72, duration: 0.3 }}
                      className="text-left"
                      style={{ marginBottom: '0px' }}
                    >
                      <div className="flex justify-between items-center" style={{ marginBottom: '10px' }}>
                        <span className="field-label" style={{ marginBottom: 0 }}>Pesticide Applied</span>
                      </div>
                      
                      <div className="workstation-slider-container">
                        {/* Floating Tooltip */}
                        <div 
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '22px',
                            marginBottom: '4px'
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              left: `calc(${parseFloat(pesticide) / 20 * 100}% - 22px)`,
                              bottom: '0px',
                              backgroundColor: 'var(--signal)',
                              color: '#060814',
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontFamily: "'IBM Plex Mono', monospace",
                              whiteSpace: 'nowrap',
                              boxShadow: '0 0 8px var(--signal)',
                              pointerEvents: 'none',
                              transition: 'left 50ms ease-out'
                            }}
                          >
                            {pesticide} kg
                          </span>
                        </div>
                        
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="0.5"
                          value={pesticide}
                          onChange={(e) => setPesticide(e.target.value)}
                          disabled={loading}
                        />
                        
                        <div className="flex justify-between text-[8px] text-[#5A7D5E] font-mono mt-1 select-none">
                          <span>MIN: 0 KG</span>
                          <span>MAX: 20 KG</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  
                  {/* Action Button Staggered Reveal */}
                  <motion.div 
                    variants={inputVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ delay: 0.80, duration: 0.3 }}
                    style={{ marginTop: '26px' }}
                  >
                    <ExecuteButton loading={loading} />
                  </motion.div>
                </form>
              </div>
            </div>
          </div>

          {/* Col 2 (45%): Recommendation cards */}
          <div ref={resultsRef} className="flex flex-col justify-between gap-4">
            <div 
              className="panel-container flex-1 relative flex flex-col h-full overflow-hidden"
              style={{ padding: '32px 28px' }}
            >
              <DrawingPanelBorder duration={400} />
              
              <h3 className="section-header">
                Optimized Crop Recommendation Matrix
              </h3>
              
              <div className="flex flex-col flex-1 w-full mt-3 min-h-0 relative">
                {/* Regular Cards Container */}
                <div style={{ opacity: loading ? 0.12 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 300ms ease', display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
                  {predictionsToShow[0] && (() => {
                    const pred = predictionsToShow[0];
                    const i = 0;
                    const matchPct = Math.round(pred.probability * (pred.probability <= 1 ? 100 : 1));
                    const scoreColor = "#2EE87A";
                    const cropIcon = pred.crop.toUpperCase().includes("RICE") 
                      ? "🍚" 
                      : pred.crop.toUpperCase().includes("WHEAT") 
                        ? "🌾" 
                        : "🌽";
                    const rationale = getAgronomicRationale(pred.crop, pred.probability);
                    const delay = 600;
                    const isHovered = hoveredCropIndex === i;
                    
                    return (
                      <div 
                        onMouseEnter={() => setHoveredCropIndex(i)}
                        onMouseLeave={() => setHoveredCropIndex(null)}
                        className="rounded-none relative cursor-pointer animate-[fade-in_0.5s_ease-out]"
                        style={{ 
                          padding: '32px 28px',
                          backgroundColor: 'rgba(6, 14, 26, 0.15)',
                          backdropFilter: 'blur(4px) saturate(1.3) brightness(0.9)',
                          WebkitBackdropFilter: 'blur(4px) saturate(1.3) brightness(0.9)',
                          border: '1px solid rgba(46, 232, 122, 0.25)',
                          borderLeft: `5px solid ${scoreColor}`,
                          boxShadow: isHovered 
                            ? '0 0 30px rgba(46, 232, 122, 0.3), inset 0 0 20px rgba(46, 232, 122, 0.08)' 
                            : '0 0 18px rgba(46, 232, 122, 0.12), inset 0 0 12px rgba(46, 232, 122, 0.04)',
                          opacity: 1.0,
                          display: 'flex',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        {/* Left Column (crop info & yield bar) */}
                        <div className="flex flex-col text-left pr-4" style={{ flex: 1, height: '100%', justifyContent: 'space-between' }}>
                          <div>
                            <span 
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '8px',
                                fontWeight: 700,
                                letterSpacing: '0.2em',
                                color: '#2EE87A',
                                backgroundColor: 'rgba(46, 232, 122, 0.1)',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                display: 'inline-block',
                                marginBottom: '6px',
                                border: '1px solid rgba(46, 232, 122, 0.2)'
                              }}
                            >
                              OPTIMAL SPECIMEN
                            </span>
                            <span 
                              style={{ 
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '8px',
                                fontWeight: 400,
                                letterSpacing: '0.3em',
                                color: 'var(--muted)',
                                textTransform: 'uppercase',
                                display: 'block',
                                marginBottom: '4px',
                                lineHeight: 1
                              }}
                            >
                              Specimen Analysis
                            </span>
                            <h4 
                              style={{ 
                                fontFamily: "'Space Grotesk', sans-serif",
                                fontSize: '26px',
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                color: '#FFFFFF',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '6px',
                                lineHeight: 1.2
                              }}
                            >
                              <span className="text-lg" style={{ transform: 'translateY(-1px)' }}>{cropIcon}</span> <span className="hero-title">{pred.crop}</span>
                            </h4>
                            <p className="body-text" 
                              style={{ 
                                fontFamily: "'Inter', sans-serif",
                                fontSize: '12px',
                                fontWeight: 500,
                                letterSpacing: '0.01em',
                                color: '#D4E1E8',
                                lineHeight: 1.45,
                                marginBottom: '12px'
                              }}
                            >
                                {rationale}
                            </p>
                          </div>
                          
                          {/* Yield Bar + Readout row */}
                          <div className="flex items-center" style={{ gap: '6px', marginTop: '0px' }}>
                            <div className="flex-1 h-[6px] bg-[rgba(60,180,80,0.15)] relative overflow-hidden" style={{ borderRadius: '3px' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${matchPct}%` }}
                                transition={{ duration: 0.7, ease: "easeOut", delay: delay / 1000 }}
                                className="h-full"
                                style={{
                                  backgroundColor: scoreColor,
                                  borderRadius: '3px',
                                  opacity: 0.95
                                }}
                              />
                            </div>
                            <div className="flex items-center whitespace-nowrap" style={{ gap: '6px' }}>
                              <span style={{ 
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '8px',
                                fontWeight: 400,
                                letterSpacing: '0.15em',
                                color: 'var(--muted)',
                                textTransform: 'uppercase'
                              }}>
                                YIELD:
                              </span>
                              <span style={{ 
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '14px',
                                fontWeight: 600,
                                letterSpacing: '0.05em',
                                color: scoreColor
                              }}>
                                {pred.predicted_yield.toFixed(2)} T/HA EST.
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Column (Number / Match label) */}
                        <div className="flex flex-col justify-center items-end text-right" style={{ width: '100px', alignSelf: 'stretch' }}>
                          <span 
                            style={{ 
                              fontFamily: "'IBM Plex Mono', monospace", 
                              fontSize: '44px',
                              fontWeight: 700,
                              letterSpacing: '-0.02em', 
                              lineHeight: '1',
                              color: scoreColor,
                              verticalAlign: 'baseline'
                            }}
                          >
                            <span className="data-value"><CountUp target={matchPct} delay={delay} duration={700} /></span>
                          </span>
                          <span 
                            style={{ 
                              fontFamily: "'IBM Plex Mono', monospace", 
                              fontSize: '8px',
                              fontWeight: 400,
                              letterSpacing: '0.2em',
                              color: scoreColor, 
                              opacity: 0.6, 
                              marginTop: '3px',
                              textTransform: 'uppercase',
                              textAlign: 'right'
                            }}
                          >
                            MATCH
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sub-Crops Container */}
                  <div className="grid grid-cols-2 gap-4 mt-2 flex-1">
                    {predictionsToShow.slice(1).map((pred, subIdx) => {
                      const i = subIdx + 1;
                      const matchPct = Math.round(pred.probability * (pred.probability <= 1 ? 100 : 1));
                      const scoreColor = matchPct >= 40 ? "var(--signal)" : "var(--danger)";
                      const cropIcon = pred.crop.toUpperCase().includes("RICE") 
                        ? "🍚" 
                        : pred.crop.toUpperCase().includes("WHEAT") 
                          ? "🌾" 
                          : "🌽";
                      const rationale = getAgronomicRationale(pred.crop, pred.probability);
                      const delay = 600 + i * 150;
                      const isHovered = hoveredCropIndex === i;

                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setHoveredCropIndex(i)}
                          onMouseLeave={() => setHoveredCropIndex(null)}
                          className="rounded-none relative cursor-pointer flex flex-col justify-start gap-4"
                          style={{
                            padding: '24px 12px',
                            backgroundColor: 'rgba(6, 14, 26, 0.12)',
                            backdropFilter: 'blur(4px) saturate(1.3) brightness(0.9)',
                            WebkitBackdropFilter: 'blur(4px) saturate(1.3) brightness(0.9)',
                            border: '1px solid rgba(60, 180, 80, 0.15)',
                            borderLeft: `4px solid ${scoreColor}`,
                            opacity: isHovered ? 1.0 : 0.65,
                            transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {/* Card Header */}
                          <div className="flex justify-between items-start w-full">
                            <div className="flex flex-col text-left">
                              <span 
                                style={{ 
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  fontSize: '8px',
                                  fontWeight: 700,
                                  letterSpacing: '0.2em',
                                  color: 'var(--muted)',
                                  marginBottom: '4px',
                                  lineHeight: 1
                                }}
                              >
                                SECONDARY MATCH
                              </span>
                              <h4 
                                style={{ 
                                  fontFamily: "'Space Grotesk', sans-serif",
                                  fontSize: '20px',
                                  fontWeight: 700,
                                  color: '#FFFFFF',
                                  textTransform: 'uppercase',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  lineHeight: 1.1
                                }}
                              >
                                <span className="text-base" style={{ transform: 'translateY(-1px)' }}>{cropIcon}</span> <span className="hero-title">{pred.crop}</span>
                              </h4>
                            </div>
                            <div className="flex flex-col items-end text-right">
                              <span 
                                style={{ 
                                  fontFamily: "'IBM Plex Mono', monospace", 
                                  fontSize: '24px',
                                  fontWeight: 700,
                                  lineHeight: '1',
                                  color: scoreColor
                                }}
                              >
                                <span className="data-value"><CountUp target={matchPct} delay={delay} duration={700} /></span>
                              </span>
                            </div>
                          </div>

                          <div className="match-breakdown">
                            <div className="factor">
                              <span className="label">SOIL MATCH</span>
                              <div className="bar">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(98, matchPct + 11)}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut", delay: (delay + 100) / 1000 }}
                                  className="fill" 
                                  style={{ backgroundColor: scoreColor, height: '100%' }}
                                />
                              </div>
                            </div>
                            <div className="factor">
                              <span className="label">WATER REQ</span>
                              <div className="bar">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(95, matchPct + 24)}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut", delay: (delay + 200) / 1000 }}
                                  className="fill" 
                                  style={{ backgroundColor: scoreColor, height: '100%' }}
                                />
                              </div>
                            </div>
                            <div className="factor">
                              <span className="label">TEMP FIT</span>
                              <div className="bar">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(45, matchPct - 15)}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut", delay: (delay + 300) / 1000 }}
                                  className="fill" 
                                  style={{ backgroundColor: scoreColor, height: '100%' }}
                                />
                              </div>
                            </div>
                          </div>

                            {/* Rationale/Description */}
                            <p className="body-text" 
                              style={{ 
                                fontFamily: "'Inter', sans-serif",
                                fontSize: '10px',
                                fontWeight: 500,
                                letterSpacing: '0.01em',
                                color: '#A8C8AA',
                                lineHeight: 1.4,
                                marginBottom: '2px'
                              }}
                            >
                              {rationale}
                            </p>

                            {/* Sowing calendar strip */}
                            <div className="sow-strip" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ fontSize: '7px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: '6px', fontFamily: "'IBM Plex Mono', monospace" }}>
                                OPTIMAL SOWING WINDOW
                              </span>
                              <div className="flex gap-[2px] w-full">
                                {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m) => {
                                  const cropName = pred.crop.toUpperCase();
                                  const isRice = cropName.includes('RICE') || cropName.includes('PADDY');
                                  const isWheat = cropName.includes('WHEAT');
                                  const isMaize = cropName.includes('MAIZE') || cropName.includes('CORN');
                                  
                                  let isActive = false;
                                  let activeColor = 'rgba(52, 211, 153, 0.9)';
                                  let activeBg = 'rgba(52, 211, 153, 0.15)';
                                  
                                  if (isRice) {
                                    isActive = ['JUN', 'JUL', 'AUG', 'SEP', 'OCT'].includes(m);
                                    activeColor = 'rgba(0, 200, 255, 0.9)';
                                    activeBg = 'rgba(0, 200, 255, 0.15)';
                                  } else if (isWheat) {
                                    isActive = ['NOV', 'DEC', 'JAN', 'FEB'].includes(m);
                                    activeColor = 'rgba(245, 158, 11, 0.9)';
                                    activeBg = 'rgba(245, 158, 11, 0.15)';
                                  } else if (isMaize) {
                                    isActive = ['JUN', 'JUL', 'AUG', 'SEP'].includes(m);
                                    activeColor = 'rgba(255, 60, 160, 0.9)';
                                    activeBg = 'rgba(255, 60, 160, 0.15)';
                                  } else {
                                    isActive = ['JUN', 'JUL', 'AUG', 'SEP'].includes(m);
                                  }
                                  
                                  return (
                                    <span 
                                      key={m} 
                                      style={{
                                        fontSize: '7.5px',
                                        padding: '4px 0px',
                                        borderRadius: '2px',
                                        color: isActive ? activeColor : 'rgba(255,255,255,0.2)',
                                        background: isActive ? activeBg : 'rgba(255,255,255,0.03)',
                                        flex: 1,
                                        textAlign: 'center',
                                        fontFamily: "'Inter', sans-serif",
                                        fontWeight: isActive ? 600 : 500,
                                        letterSpacing: '-0.02em'
                                      }}
                                    >
                                      {m}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                          {/* Bottom part: Progress bar and yield readout */}
                          <div className="flex flex-col gap-2 w-full mt-2 pt-2 border-t border-[var(--border)]">
                            {/* Yield Bar */}
                            <div className="w-full h-[6px] bg-[rgba(60,180,80,0.15)] relative overflow-hidden" style={{ borderRadius: '3px' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${matchPct}%` }}
                                transition={{ duration: 0.7, ease: "easeOut", delay: delay / 1000 }}
                                className="h-full"
                                style={{
                                  backgroundColor: scoreColor,
                                  borderRadius: '3px',
                                  opacity: 0.7
                                }}
                              />
                            </div>
                            
                            {/* Yield Readout */}
                            <div className="flex justify-between items-center w-full">
                              <span style={{ 
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '8px',
                                fontWeight: 400,
                                letterSpacing: '0.15em',
                                color: 'var(--muted)',
                                textTransform: 'uppercase'
                              }}>
                                EST. YIELD
                              </span>
                              <span style={{ 
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '12px',
                                fontWeight: 600,
                                letterSpacing: '0.05em',
                                color: scoreColor
                              }}>
                                {pred.predicted_yield.toFixed(2)} T/HA
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* High-fidelity simulation progress loader overlay */}
                {loading && <LoadingSimulationOverlay />}
              </div>
            </div>
          </div>

          {/* Col 3 (30%): Climate/Soil telemetry & stats */}
          <div className="flex flex-col justify-start gap-5 h-full lg:border-l lg:border-[var(--border)] lg:pl-8 pl-0 border-l-0">
            {/* Sidebar Header */}
            <div 
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.25em',
                color: 'var(--signal)',
                marginBottom: '4px',
                paddingLeft: '4px',
                opacity: 0.8
              }}
            >
              // ENVIRONMENTAL INTELLIGENCE
            </div>
            
            {/* Panel 1: Climate Vector */}
            <div 
              className="panel-container flex flex-col relative justify-between min-h-[310px]"
              style={{ padding: '32px 28px' }}
            >
              <DrawingPanelBorder duration={400} />
              
              <h3 className="section-header" style={{ marginBottom: '0px' }}>
                Climate Vector
              </h3>
              
              <div style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center'}}>
                MULTI-AXIS SENSOR FUSION
              </div>

              <div 
                className="flex items-center justify-center pointer-events-none"
                style={{ 
                  height: '140px',
                  overflow: 'visible',
                  marginTop: '10px',
                  marginBottom: '10px'
                }}
              >
                <RadarChart 
                  temp={climateData.temp} 
                  rain={climateData.rain} 
                  humid={climateData.humid} 
                />
              </div>

              {/* Climate labels row */}
              <div 
                className="flex justify-between border-t border-[var(--border)] pt-3" 
                style={{ lineHeight: 1.2 }}
              >
                <div className="flex flex-col text-left">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', fontWeight: 400, color: 'var(--muted)', textTransform: 'uppercase' }}>TEMP:</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>{climateData.temp.toFixed(1)}°C</span>
                </div>
                <div className="flex flex-col text-center">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', fontWeight: 400, color: 'var(--muted)', textTransform: 'uppercase' }}>HUMID:</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>{Math.round(climateData.humid)}%</span>
                </div>
                <div className="flex flex-col text-right">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', fontWeight: 400, color: 'var(--muted)', textTransform: 'uppercase' }}>RAIN:</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>{Math.round(climateData.rain)}MM</span>
                </div>
              </div>
            </div>

            {/* Panel 2: Soil Nutrient Matrix */}
            <div 
              className="panel-container flex flex-col relative justify-between min-h-[240px]"
              style={{ padding: '32px 28px' }}
            >
              <DrawingPanelBorder duration={400} />
              
              <h3 className="section-header" style={{ marginBottom: '6px' }}>
                Soil Nutrient Matrix
              </h3>
              
              <div 
                className="flex justify-evenly items-end flex-1" 
                style={{ 
                  paddingBottom: '2px'
                }}
              >
                <SoilGauge label="N" value={soilData.N} max={150} unit="KG/HA" color="#8AD6F2" />
                <SoilGauge label="P" value={soilData.P} max={50} unit="PPM" color="#BD00FF" />
                <SoilGauge label="K" value={soilData.K} max={300} unit="PPM" color="#C8A84B" />
                <SoilGauge label="pH" value={soilData.pH} max={14} unit="PH" color="#7FFFD4" />
              </div>
            </div>

            {/* Panel 3: System Telemetry / Quick Stats */}
            <div 
              className="panel-container flex flex-col relative justify-start gap-4 min-h-[360px]"
              style={{ padding: '32px 28px' }}
            >
              <DrawingPanelBorder duration={400} />
              
              <h3 className="section-header" style={{ marginBottom: '8px' }}>
                Quick Stats & Telemetry
              </h3>

              <div className="conf-history" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '4px' }}>
                <div 
                  className="conf-label"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '8px',
                    letterSpacing: '0.15em',
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: '10px'
                  }}
                >
                  CONFIDENCE HISTORY
                </div>
                <div className="bars" style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '36px' }}>
                  {[26, 29, 27, 31, 33, 29, 32, 30].map((h, index) => (
                    <motion.div 
                      key={index}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}px` }}
                      transition={{ duration: 0.5, delay: index * 0.04, ease: 'easeOut' }}
                      style={{
                        width: '12px',
                        background: 'linear-gradient(to top, rgba(46, 232, 122, 0.15), rgba(46, 232, 122, 0.85))',
                        boxShadow: '0 0 6px rgba(46, 232, 122, 0.35)',
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex-1 flex flex-col justify-start space-y-3 font-mono text-[9px] select-none mt-1">
                <div className="flex justify-between items-center border-b border-[var(--border)] py-2">
                  <span className="mono-label" style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>RESOLVED REGION:</span>
                  <span className="data-value" style={{ color: '#FFFFFF', fontWeight: 600 }}>
                    {result ? result.resolved_state : PRESET_LOCATIONS.find(p => p.name === activePreset)?.state || 'MADHYA PRADESH'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-b border-[var(--border)] py-2">
                  <span className="mono-label" style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>COORDINATES (GPS):</span>
                  <span className="data-value" style={{ color: 'var(--signal)', fontWeight: 600 }}>
                    {result ? `${result.coordinates.lat.toFixed(4)}°N, ${result.coordinates.lon.toFixed(4)}°E` : activePreset === 'BETUL' ? '21.9167°N, 77.8961°E' : activePreset === 'BHATINDA' ? '30.2068°N, 74.9519°E' : activePreset === 'BARDHAMAN' ? '23.2324°N, 87.8630°E' : '13.9299°N, 75.5681°E'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-b border-[var(--border)] py-2">
                  <span className="mono-label" style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>SOWING WINDOW:</span>
                  <span className="data-value" style={{ color: '#2EE87A', fontWeight: 600 }}>
                    {result ? result.sowing_date_used : sowingDate}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-[var(--border)] py-2">
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>CONFIDENCE PROFILE:</span>
                  <span style={{ color: 'var(--signal)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.15)', marginRight: '2px', fontFamily: 'monospace' }}>[</span>
                    {(() => {
                      const confidenceScore = result ? Math.round(predictionsToShow[0].probability * (predictionsToShow[0].probability <= 1 ? 100 : 1)) : 94;
                      const activeBlocks = Math.round(confidenceScore / 10);
                      return [...Array(10)].map((_, idx) => {
                        const isActive = idx < activeBlocks;
                        return (
                          <span 
                            key={idx} 
                            style={{
                              width: '4px',
                              height: '8px',
                              backgroundColor: isActive ? 'var(--signal)' : 'rgba(255,255,255,0.06)',
                              display: 'inline-block',
                              borderRadius: '0.5px',
                              boxShadow: isActive ? '0 0 4px var(--signal)' : 'none',
                              transition: 'all 300ms ease'
                            }}
                          />
                        );
                      });
                    })()}
                    <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: '2px', marginRight: '6px', fontFamily: 'monospace' }}>]</span>
                    <span>{result ? Math.round(predictionsToShow[0].probability * (predictionsToShow[0].probability <= 1 ? 100 : 1)) : 94}%</span>
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-[var(--border)] py-2">
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>SCAN TIMESTAMP:</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
                    {scanTimestamp}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-[var(--border)] py-2">
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>INFERENCE NODE:</span>
                  <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
                    XGBoost v1.7.6 | ResNet-18 v4.2
                  </span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>MODEL STABILITY:</span>
                  <span style={{ color: '#2EE87A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2EE87A] animate-pulse" />
                    NOMINAL (99.2%)
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* AI-Powered Farming Advisory Panel - Full Width Below Grid */}
        <AnimatePresence>
          {(aiTips || aiTipsLoading || aiTipsError) && (
            <motion.div 
              ref={aiTipsRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <div 
                className="panel-container relative"
                style={{ 
                  padding: '28px 28px 24px',
                  borderLeft: '4px solid rgba(0, 229, 255, 0.4)',
                  background: 'rgba(6, 14, 26, 0.15)',
                  backdropFilter: 'blur(6px) saturate(1.3) brightness(0.9)',
                  WebkitBackdropFilter: 'blur(6px) saturate(1.3) brightness(0.9)',
                }}
              >
                <DrawingPanelBorder duration={400} />
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(46, 232, 122, 0.2))',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}
                  >
                    🤖
                  </div>
                  <div>
                    <h3 className="section-header" style={{ marginBottom: '0px', fontSize: '13px' }}>
                      AI Farming Advisory
                    </h3>
                    <span 
                      style={{ 
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '8px',
                        fontWeight: 500,
                        letterSpacing: '0.2em',
                        color: 'rgba(0, 229, 255, 0.7)',
                        textTransform: 'uppercase'
                      }}
                    >
                      POWERED BY GPT-4o-mini • PERSONALIZED FOR YOUR FIELD
                    </span>
                  </div>
                  {aiTipsLoading && (
                    <div className="ml-auto flex items-center gap-2">
                      <div 
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#00E5FF',
                          animation: 'pulse 1.2s ease-in-out infinite'
                        }}
                      />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#00E5FF', letterSpacing: '0.15em' }}>
                        GENERATING...
                      </span>
                    </div>
                  )}
                </div>

                {/* Loading Skeleton */}
                {aiTipsLoading && (
                  <div className="flex flex-col gap-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div 
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'rgba(0, 229, 255, 0.3)',
                            marginTop: '5px',
                            flexShrink: 0
                          }}
                        />
                        <div 
                          style={{
                            height: '12px',
                            borderRadius: '4px',
                            background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.08), rgba(0, 229, 255, 0.15), rgba(0, 229, 255, 0.08))',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s ease-in-out infinite',
                            width: `${70 + (i * 5)}%`
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Error State */}
                {aiTipsError && (
                  <div 
                    style={{
                      padding: '14px 18px',
                      background: 'rgba(255, 82, 82, 0.08)',
                      border: '1px solid rgba(255, 82, 82, 0.2)',
                      borderRadius: '4px',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: '11px',
                      color: '#FF5252',
                      lineHeight: 1.5
                    }}
                  >
                    ⚠️ {aiTipsError}
                  </div>
                )}

                {/* AI Tips Content */}
                {aiTips && (
                  <div 
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: '11.5px',
                      lineHeight: 1.7,
                      color: 'rgba(255, 255, 255, 0.85)',
                      whiteSpace: 'pre-wrap',
                      letterSpacing: '0.01em'
                    }}
                  >
                    {aiTips.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;
                      
                      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                        return (
                          <div 
                            key={idx}
                            style={{
                              fontFamily: "'Space Grotesk', sans-serif",
                              fontWeight: 700,
                              fontSize: '12px',
                              color: '#00E5FF',
                              letterSpacing: '0.05em',
                              marginTop: idx > 0 ? '12px' : '0',
                              marginBottom: '4px'
                            }}
                          >
                            {trimmed.replace(/\*\*/g, '')}
                          </div>
                        );
                      }
                      
                      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || /^\d+\./.test(trimmed)) {
                        const bulletText = trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '');
                        const parts = bulletText.split(/(\*\*.*?\*\*)/g);
                        return (
                          <div 
                            key={idx}
                            style={{
                              display: 'flex',
                              gap: '10px',
                              alignItems: 'flex-start',
                              padding: '6px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.04)'
                            }}
                          >
                            <span 
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #00E5FF, #2EE87A)',
                                marginTop: '6px',
                                flexShrink: 0,
                                boxShadow: '0 0 6px rgba(0, 229, 255, 0.4)'
                              }}
                            />
                            <span>
                              {parts.map((part, pIdx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return <strong key={pIdx} style={{ color: '#FFFFFF', fontWeight: 600 }}>{part.replace(/\*\*/g, '')}</strong>;
                                }
                                return <span key={pIdx}>{part}</span>;
                              })}
                            </span>
                          </div>
                        );
                      }
                      
                      if (trimmed.toLowerCase().includes('warning') || trimmed.toLowerCase().includes('risk') || trimmed.toLowerCase().includes('⚠')) {
                        return (
                          <div 
                            key={idx}
                            style={{
                              padding: '10px 14px',
                              background: 'rgba(255, 183, 77, 0.08)',
                              border: '1px solid rgba(255, 183, 77, 0.2)',
                              borderLeft: '3px solid rgba(255, 183, 77, 0.5)',
                              borderRadius: '4px',
                              color: '#FFB74D',
                              fontSize: '11px',
                              marginTop: '8px',
                              lineHeight: 1.6
                            }}
                          >
                            {trimmed.replace(/\*\*/g, '')}
                          </div>
                        );
                      }
                      
                      const parts = trimmed.split(/(\*\*.*?\*\*)/g);
                      return (
                        <p key={idx} style={{ margin: '2px 0' }}>
                          {parts.map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={pIdx} style={{ color: '#FFFFFF', fontWeight: 600 }}>{part.replace(/\*\*/g, '')}</strong>;
                            }
                            return <span key={pIdx}>{part}</span>;
                          })}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsible bottom drawer for Workstation Console Log */}
        <div className="panel-container w-full overflow-hidden">
          
          {/* Header/Status Strip */}
          <button 
            type="button"
            onClick={() => setDrawerExpanded(prev => !prev)}
            onMouseEnter={() => setConsoleHovered(true)}
            onMouseLeave={() => setConsoleHovered(false)}
            className="w-full cursor-pointer flex justify-between items-center select-none transition-colors"
            style={{
              height: '42px',
              backgroundColor: consoleHovered ? 'rgba(46, 232, 122, 0.08)' : 'rgba(46, 232, 122, 0.03)',
              borderBottom: 'none',
              padding: '0 20px',
              outline: 'none',
              transition: 'background-color 200ms ease'
            }}
          >
            <div 
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                fontWeight: 500,
                color: 'var(--muted)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ color: 'var(--signal)' }}>{drawerExpanded ? "[-] " : "[+] "} Diagnostic Log Console</span>
              {loading && <span className="status-dot w-1.5 h-1.5 rounded-full bg-[color:var(--signal)]" />}
            </div>
            
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px'
              }}
            >
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 400 }}>
                <span style={{ color: 'var(--muted)', letterSpacing: '0.15em' }}>LATENCY: </span>
                <span style={{ color: 'var(--signal)', fontWeight: 600, letterSpacing: '0.05em' }}>{loading ? "SCANNING" : "12MS"}</span>
              </div>
              
              <span style={{ color: 'var(--border)', fontFamily: "'IBM Plex Mono', monospace" }}>·</span>
              
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 400 }}>
                <span style={{ color: 'var(--muted)', letterSpacing: '0.15em' }}>SYS STATUS: </span>
                <span 
                  style={{ 
                    color: errorMsg ? 'var(--danger)' : loading ? 'var(--warn)' : 'var(--warn)', 
                    fontWeight: 600,
                    letterSpacing: '0.05em'
                  }}
                >
                  {errorMsg ? 'ERROR' : loading ? 'RUNNING' : 'IDLE'}
                </span>
              </div>
              
              <span style={{ color: 'var(--border)', fontFamily: "'IBM Plex Mono', monospace" }}>·</span>
              
              <div 
                style={{ 
                  fontFamily: "'IBM Plex Mono', monospace", 
                  fontSize: '10px', 
                  fontWeight: 500,
                  color: 'var(--signal)',
                  letterSpacing: '0.15em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--signal)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[color:var(--signal)]"></span>
                </span>
                <span>V3.5 ONLINE</span>
                <span 
                  className="material-symbols-outlined text-xs transition-transform duration-200"
                  style={{ 
                    transform: drawerExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    fontSize: '12px'
                  }}
                >
                  expand_more
                </span>
              </div>
            </div>
          </button>

          {/* Drawer contents */}
          <AnimatePresence>
            {drawerExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 bg-black/20 border-t border-[var(--border)]">
                  {/* Left: ASCII Canopy grid */}
                  <div className="md:col-span-4 flex items-center justify-center">
                    <AsciiFieldMap />
                  </div>
                  {/* Right: Scrollable terminal logs */}
                  <div className="md:col-span-8 flex flex-col justify-between p-4 bg-black/30 border border-[var(--border)] rounded h-[140px]">
                    <div className="flex-1 overflow-y-auto max-h-[115px] text-left no-scrollbar pointer-events-auto select-text font-mono text-[10px] leading-relaxed">
                      {logs.length === 0 ? (
                        <div className="text-[var(--muted)] font-mono text-[10px] py-1 flex items-center justify-start gap-1.5">
                          <span>&gt; Console ready. Execute a suitability scan...</span>
                          <span className="w-1 h-3 bg-[color:var(--signal)] inline-block align-middle ml-1 animate-[blink_1s_step-end_infinite]" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {logs.map((log, i) => (
                            <div key={i} className="flex gap-2 items-start text-white/90">
                              <span className={log.type === 'success' ? 'text-[var(--signal)]' : log.type === 'warn' ? 'text-[var(--danger)]' : 'text-[var(--warn)]'}>
                                {log.type === 'success' ? '✓' : log.type === 'warn' ? '!' : '>'}
                              </span>
                              <span>{log.text}</span>
                            </div>
                          ))}
                          {loading && (
                            <div className="flex gap-2 items-center text-[var(--signal)]">
                              <span>&gt;</span>
                              <span className="w-1 h-3 bg-[color:var(--signal)] inline-block align-middle ml-1 animate-[blink_1s_step-end_infinite]" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  </div>
</section>
  );
}

// Preload not needed for vanilla GLTFLoader
