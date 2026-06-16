"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const CropIntelHero = dynamic(() => import('../components/CropIntelHero'), {
  ssr: false,
});

const PredictionWorkstation = dynamic(() => import('../components/PredictionWorkstation'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="relative min-h-screen w-full bg-[#080e0a] selection:bg-[#3ecf5a]/25 selection:text-white overflow-x-hidden">

      {/* Hero Section */}
      <div className="h-screen w-screen relative">
        <CropIntelHero />
      </div>

      {/* Prediction Workstation Section */}
      <PredictionWorkstation />
    </main>
  );
}