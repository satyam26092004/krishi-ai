"use client";

import React, { useState } from 'react';

interface ResultCardProps {
  prediction: {
    crop: string;
    confidence: number;
    yieldTonsPerHectare: number;
    productionTons: number;
    description: string;
    recommendations: string[];
    features: {
      state: string;
      season: string;
      area: number;
      N: number;
      P: number;
      K: number;
      pH: number;
      temp: number;
      rainfall: number;
      humidity: number;
    };
  } | null;
  onReset: () => void;
}

export default function ResultCard({ prediction, onReset }: ResultCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!prediction) return null;

  const confidencePercent = Math.round(prediction.confidence * 100);

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-5 relative overflow-hidden backdrop-blur-2xl max-w-4xl mx-auto shadow-[0_0_50px_rgba(77,224,130,0.15)] animate-[fade-in_0.6s_ease-out_forwards]">
      {/* Background bioluminescent glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-tertiary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="text-left">
          <span className="inline-block px-3 py-1 bg-tertiary/10 border border-tertiary/20 rounded-full font-label-sm text-[10px] text-tertiary uppercase tracking-widest mb-1.5">
            Analysis Successful
          </span>
          <h2 className="font-display text-xl md:text-2xl font-bold text-white">
            Recommended Crop: <span className="text-tertiary">{prediction.crop}</span>
          </h2>
        </div>
        <div className="flex items-center gap-4 sm:text-right">
          <div className="text-left sm:text-right">
            <span className="font-label-sm text-[10px] text-on-surface-variant block uppercase tracking-wider">Confidence Level</span>
            <span className="font-mono text-lg font-bold text-tertiary">{confidencePercent}%</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Yield */}
        <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5 text-center group hover:bg-surface-container-low/50 transition-colors">
          <span className="material-symbols-outlined text-tertiary text-xl mb-1 block group-hover:scale-110 transition-transform">speed</span>
          <span className="text-[9px] text-on-surface-variant uppercase tracking-wider block">Expected Yield</span>
          <span className="font-mono text-base font-bold text-white block mt-0.5">{prediction.yieldTonsPerHectare} Tons/Ha</span>
        </div>

        {/* Total Production */}
        <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5 text-center group hover:bg-surface-container-low/50 transition-colors">
          <span className="material-symbols-outlined text-secondary text-xl mb-1 block group-hover:scale-110 transition-transform">agriculture</span>
          <span className="text-[9px] text-on-surface-variant uppercase tracking-wider block">Total Production</span>
          <span className="font-mono text-base font-bold text-white block mt-0.5">{prediction.productionTons} Tons</span>
        </div>

        {/* Suitability Index */}
        <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5 text-center group hover:bg-surface-container-low/50 transition-colors">
          <span className="material-symbols-outlined text-accent-purple text-xl mb-1 block group-hover:scale-110 transition-transform">verified</span>
          <span className="text-[9px] text-on-surface-variant uppercase tracking-wider block">Suitability Rating</span>
          <span className="font-mono text-base font-bold text-white block mt-0.5">
            {prediction.confidence > 0.85 ? 'Excellent' : prediction.confidence > 0.7 ? 'Optimal' : 'Moderate'}
          </span>
        </div>

      </div>

      {/* Description */}
      <p className="text-on-surface-variant leading-relaxed text-xs text-left border-l-2 border-tertiary/40 pl-3 py-0.5 italic">
        {prediction.description}
      </p>

      {/* Recommendations */}
      <div className="space-y-2.5 text-left">
        <span className="font-label-sm text-[10px] text-tertiary uppercase tracking-widest block">Actionable Agronomic Protocol</span>
        <div className="grid grid-cols-1 gap-2.5">
          {prediction.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5 text-xs text-on-surface">
              <span className="material-symbols-outlined text-tertiary text-sm mt-0.5">check_circle</span>
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Telemetry Toggle & Reset Button */}
      <div className="pt-3 flex items-center justify-between gap-4 border-t border-white/5 mt-3 text-left">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant hover:text-tertiary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-xs">
            {showDetails ? 'expand_less' : 'expand_more'}
          </span>
          {showDetails ? 'Hide Telemetry' : 'View Telemetry'}
        </button>

        <button
          onClick={onReset}
          className="px-4 py-2 rounded-xl bg-tertiary text-on-tertiary font-bold text-[10px] tracking-wider uppercase shadow-[0_0_20px_rgba(77,224,130,0.15)] hover:bg-[#c8e6c0] transition-colors cursor-pointer text-center"
        >
          Scan Another Field
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 bg-black/30 rounded-xl p-3 border border-white/5 font-mono text-[10px] text-on-surface-variant space-y-1 animate-[slide-down_0.3s_ease-out_forwards] text-left">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-tertiary">State:</span> {prediction.features.state}</div>
            <div><span className="text-tertiary">Season:</span> {prediction.features.season}</div>
            <div><span className="text-tertiary">Area:</span> {prediction.features.area} ha</div>
            <div><span className="text-tertiary">N-P-K:</span> {prediction.features.N}-{prediction.features.P}-{prediction.features.K}</div>
            <div><span className="text-tertiary">pH:</span> {prediction.features.pH}</div>
            <div><span className="text-tertiary">Temp:</span> {prediction.features.temp}°C</div>
            <div><span className="text-tertiary">Rainfall:</span> {prediction.features.rainfall}mm</div>
            <div><span className="text-tertiary">Humidity:</span> {prediction.features.humidity}%</div>
          </div>
        </div>
      )}

    </div>
  );
}