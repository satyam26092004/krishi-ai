"use client";

import React, { useState, useEffect } from 'react';

interface PredictionFormProps {
  onPredictionResult: (result: any) => void;
  onLoadingStateChange: (isLoading: boolean) => void;
  onLog: (message: string, type?: 'info' | 'warn' | 'success') => void;
}

const PRESETS = [
  {
    name: "Optimal Rice Paddy",
    icon: "water_drop",
    values: { state: "West Bengal", season: "Kharif", N: "80", P: "42", K: "40", pH: "6.2", temp: "26.5", rainfall: "1650", humidity: "78", fertilizer: "240000", pesticide: "2200", area: "10.0" }
  },
  {
    name: "Rabi Wheat Field",
    icon: "grain",
    values: { state: "Punjab", season: "Rabi", N: "70", P: "38", K: "35", pH: "6.8", temp: "18.2", rainfall: "650", humidity: "55", fertilizer: "190000", pesticide: "1800", area: "15.0" }
  },
  {
    name: "Drought Millets Land",
    icon: "wb_sunny",
    values: { state: "Rajasthan", season: "Summer", N: "55", P: "22", K: "25", pH: "7.2", temp: "31.5", rainfall: "380", humidity: "42", fertilizer: "90000", pesticide: "800", area: "5.0" }
  },
  {
    name: "Acidic Tea Terrace",
    icon: "terrain",
    values: { state: "Assam", season: "Kharif", N: "65", P: "28", K: "45", pH: "5.5", temp: "23.4", rainfall: "2100", humidity: "82", fertilizer: "140000", pesticide: "1200", area: "8.0" }
  }
];

export default function PredictionForm({ onPredictionResult, onLoadingStateChange, onLog }: PredictionFormProps) {
  // Metadata states
  const [states, setStates] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [stateAverages, setStateAverages] = useState<Record<string, any>>({});
  const [metadataLoading, setMetadataLoading] = useState(true);

  // Form states
  const [selectedState, setSelectedState] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [area, setArea] = useState('1.0');
  const [N, setN] = useState('70');
  const [P, setP] = useState('35');
  const [K, setK] = useState('35');
  const [pH, setPH] = useState('6.5');
  const [temp, setTemp] = useState('24.0');
  const [rainfall, setRainfall] = useState('1200');
  const [humidity, setHumidity] = useState('65');
  const [fertilizer, setFertilizer] = useState('200000');
  const [pesticide, setPesticide] = useState('2000');

  // Fetch metadata on mount
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const response = await fetch('/api/predict');
        const data = await response.json();
        if (data.states && data.seasons) {
          setStates(data.states);
          setSeasons(data.seasons);
          setStateAverages(data.stateAverages || {});
          
          if (data.states.length > 0) setSelectedState(data.states[0]);
          if (data.seasons.length > 0) setSelectedSeason(data.seasons[0]);
          
          onLog("Database averages synchronized successfully", "success");
        }
      } catch (error) {
        console.error('Failed to load dataset averages:', error);
        onLog("Failed to synchronize database averages", "warn");
      } finally {
        setMetadataLoading(false);
      }
    }
    fetchMetadata();
  }, []);

  // Sync inputs with state averages unless user modifies them
  useEffect(() => {
    if (!selectedState || !selectedSeason || metadataLoading) return;
    const key = `${selectedState}_${selectedSeason}`;
    const avg = stateAverages[key];
    if (avg) {
      setN(String(avg.N));
      setP(String(avg.P));
      setK(String(avg.K));
      setPH(String(avg.pH));
      setTemp(String(avg.temp));
      setRainfall(String(avg.rainfall));
      setHumidity(String(avg.humidity));
      setFertilizer(String(avg.fertilizer));
      setPesticide(String(avg.pesticide));
      onLog(`Populated averages for ${selectedState} during ${selectedSeason}`, "info");
    }
  }, [selectedState, selectedSeason, stateAverages, metadataLoading]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    const { values } = preset;
    setSelectedState(values.state);
    setSelectedSeason(values.season);
    setArea(values.area);
    setN(values.N);
    setP(values.P);
    setK(values.K);
    setPH(values.pH);
    setTemp(values.temp);
    setRainfall(values.rainfall);
    setHumidity(values.humidity);
    setFertilizer(values.fertilizer);
    setPesticide(values.pesticide);
    onLog(`Applied farm profile preset: ${preset.name}`, "success");
  };

  const handleSliderChange = (setter: (val: string) => void, name: string, value: string, unit = '') => {
    setter(value);
    onLog(`${name} adjusted to ${value}${unit}`, "info");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onLoadingStateChange(true);
    onLog("Initiating neural node crop analysis protocol...", "info");

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: selectedState,
          season: selectedSeason,
          area,
          N, P, K, pH,
          temp, rainfall, humidity,
          fertilizer, pesticide
        })
      });

      const data = await response.json();
      onPredictionResult(data);
      onLog(`Analysis complete. Recommendation: ${data.crop} (${Math.round(data.confidence * 100)}% Confidence)`, "success");
    } catch (error) {
      console.error(error);
      onLog("Telemetry analysis failed. Check inputs.", "warn");
    } finally {
      onLoadingStateChange(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-8 border border-white/5 space-y-8 backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative overflow-hidden max-w-4xl mx-auto">
      
      {/* Preset Profiles */}
      <div className="space-y-3">
        <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-widest block text-left">Farm Presets</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="flex items-center gap-2 p-3 bg-white/5 border border-white/5 hover:border-tertiary/20 hover:bg-tertiary/5 rounded-xl transition-all duration-300 group text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-tertiary text-lg group-hover:scale-110 transition-transform">
                {p.icon}
              </span>
              <span className="text-xs font-semibold font-body-md truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] text-on-surface-variant font-label-md uppercase tracking-wider block">Region/State</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-surface-container-low border border-white/5 rounded-xl px-4 py-2.5 text-sm font-body-md focus:border-tertiary/40 focus:outline-none transition-colors text-white"
            >
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[11px] text-on-surface-variant font-label-md uppercase tracking-wider block">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="w-full bg-surface-container-low border border-white/5 rounded-xl px-4 py-2.5 text-sm font-body-md focus:border-tertiary/40 focus:outline-none transition-colors text-white"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[11px] text-on-surface-variant font-label-md uppercase tracking-wider block">Cultivation Area (Hectares)</label>
            <input
              type="number"
              step="0.1"
              value={area}
              onChange={(e) => handleSliderChange(setArea, "Area", e.target.value, " ha")}
              className="w-full bg-surface-container-low border border-white/5 rounded-xl px-4 py-2.5 text-sm font-body-md focus:border-tertiary/40 focus:outline-none transition-colors text-white"
            />
          </div>
        </div>

        {/* Soil Metrics */}
        <div className="space-y-4">
          <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-widest block text-left">Soil Substrate Telemetry</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Nitrogen */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Nitrogen (N)</span>
                <span className="text-xs font-mono text-tertiary font-bold">{N} kg/ha</span>
              </div>
              <input
                type="range" min="0" max="200"
                value={N}
                onChange={(e) => handleSliderChange(setN, "Nitrogen", e.target.value, " kg/ha")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-tertiary"
              />
            </div>

            {/* Phosphorus */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Phosphorus (P)</span>
                <span className="text-xs font-mono text-tertiary font-bold">{P} kg/ha</span>
              </div>
              <input
                type="range" min="0" max="150"
                value={P}
                onChange={(e) => handleSliderChange(setP, "Phosphorus", e.target.value, " kg/ha")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-tertiary"
              />
            </div>

            {/* Potassium */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Potassium (K)</span>
                <span className="text-xs font-mono text-tertiary font-bold">{K} kg/ha</span>
              </div>
              <input
                type="range" min="0" max="150"
                value={K}
                onChange={(e) => handleSliderChange(setK, "Potassium", e.target.value, " kg/ha")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-tertiary"
              />
            </div>

            {/* pH levels */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Acidity (pH)</span>
                <span className="text-xs font-mono text-tertiary font-bold">{pH} pH</span>
              </div>
              <input
                type="range" min="3.5" max="9.0" step="0.1"
                value={pH}
                onChange={(e) => handleSliderChange(setPH, "pH", e.target.value, " pH")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-tertiary"
              />
            </div>

          </div>
        </div>

        {/* Climate Metrics */}
        <div className="space-y-4">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block text-left">Climate Telemetry</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Temperature */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Avg Temp</span>
                <span className="text-xs font-mono text-secondary font-bold">{temp}°C</span>
              </div>
              <input
                type="range" min="5.0" max="45.0" step="0.1"
                value={temp}
                onChange={(e) => handleSliderChange(setTemp, "Temperature", e.target.value, "°C")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>

            {/* Humidity */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Humidity</span>
                <span className="text-xs font-mono text-secondary font-bold">{humidity}%</span>
              </div>
              <input
                type="range" min="15" max="100"
                value={humidity}
                onChange={(e) => handleSliderChange(setHumidity, "Humidity", e.target.value, "%")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>

            {/* Rainfall */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Rainfall</span>
                <span className="text-xs font-mono text-secondary font-bold">{rainfall} mm</span>
              </div>
              <input
                type="range" min="200" max="4000"
                value={rainfall}
                onChange={(e) => handleSliderChange(setRainfall, "Rainfall", e.target.value, " mm")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"
              />
            </div>

          </div>
        </div>

        {/* Agricultural Inputs */}
        <div className="space-y-4">
          <span className="font-label-sm text-label-sm text-accent-purple uppercase tracking-widest block text-left">Agricultural Telemetry</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Fertilizer */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Fertilizer Used</span>
                <span className="text-xs font-mono text-accent-purple font-bold">{parseFloat(fertilizer).toLocaleString()} kg</span>
              </div>
              <input
                type="range" min="0" max="1000000" step="10000"
                value={fertilizer}
                onChange={(e) => handleSliderChange(setFertilizer, "Fertilizer", e.target.value, " kg")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-accent-purple"
              />
            </div>

            {/* Pesticide */}
            <div className="bg-surface-container-low/30 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Pesticide Applied</span>
                <span className="text-xs font-mono text-accent-purple font-bold">{parseFloat(pesticide).toLocaleString()} kg</span>
              </div>
              <input
                type="range" min="0" max="20000" step="500"
                value={pesticide}
                onChange={(e) => handleSliderChange(setPesticide, "Pesticide", e.target.value, " kg")}
                className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-accent-purple"
              />
            </div>

          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-tertiary text-on-tertiary font-bold text-sm tracking-wider uppercase shadow-[0_0_30px_rgba(77,224,130,0.25)] hover:shadow-[0_0_40px_rgba(77,224,130,0.45)] hover:bg-tertiary-fixed transition-all cursor-pointer"
          >
            Run Neural Suitability Scan
          </button>
        </div>
      </form>
    </div>
  );
}