import os
import logging
import sys
import pickle
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Agricultural Recommendation Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/debug-key")
def debug_key():
    import os
    key = os.environ.get("OPENAI_API_KEY", "")
    return {
        "is_empty": len(key) == 0,
        "length": len(key),
        "prefix": key[:12] if len(key) >= 12 else key,
        "suffix": key[-4:] if len(key) >= 4 else key
    }

# --- Model Paths ---
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_M1_PATH = os.environ.get("MODEL_M1_PATH", os.path.join(BASE_DIR, "..", "models_ml", "pipeline_m1.pkl"))
MODEL_M2_PATH = os.environ.get("MODEL_M2_PATH", os.path.join(BASE_DIR, "..", "models_ml", "pipeline_m2.pkl"))

logger.info("Loading Crop & Yield Prediction models...")
try:
    with open(MODEL_M1_PATH, "rb") as f:
        crop_pipeline = pickle.load(f)
    with open(MODEL_M2_PATH, "rb") as f:
        yield_pipeline = pickle.load(f)
    logger.info("ML Models loaded successfully.")
except Exception as e:
    logger.error(f"Error loading ML pipelines: {e}")
    crop_pipeline = None
    yield_pipeline = None

# --- Indian States list for geocode mapping ---
STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", 
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", 
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", 
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", 
    "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", 
    "Ladakh", "Lakshadweep", "Puducherry"
]

def extract_state(display_name: str) -> str:
    """Matches an Indian state from nominatim address query."""
    for state in STATES:
        if state.lower() in display_name.lower():
            return state
    return "Madhya Pradesh"  # Fallback

def get_season_from_date(sowing_date_str: str) -> str:
    """Auto-detects the agricultural season in India based on sowing month."""
    try:
        dt = datetime.strptime(sowing_date_str, "%Y-%m-%d")
        month = dt.month
        # June to September: Kharif
        if 6 <= month <= 9:
            return "Kharif"
        # October to February: Rabi
        elif month == 10 or month == 11 or month == 12 or 1 <= month <= 2:
            return "Rabi"
        # March to May: Summer
        else:
            return "Summer"
    except Exception:
        return "Whole Year"

def geocode_location(query: str) -> Optional[dict]:
    url = "https://nominatim.openstreetmap.org/search"
    headers = {"User-Agent": "AgriCropBackend/1.0 (contact@satyamrathore.com)"}
    try:
        response = requests.get(url, params={"q": query, "format": "jsonv2", "limit": 1}, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data:
            return {
                "lat": float(data[0]["lat"]),
                "lon": float(data[0]["lon"]),
                "name": data[0].get("display_name", query)
            }
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
    return None

def get_climate_data(lat: float, lon: float, sowing_date: str) -> dict:
    sowing_dt = datetime.strptime(sowing_date, "%Y-%m-%d")
    try:
        start_date = sowing_dt.replace(year=sowing_dt.year - 1)
    except ValueError:
        start_date = sowing_dt.replace(year=sowing_dt.year - 1, day=28)
    
    end_date = start_date + timedelta(days=119)
    
    url = "https://power.larc.nasa.gov/api/temporal/daily/point"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start": start_date.strftime("%Y%m%d"),
        "end": end_date.strftime("%Y%m%d"),
        "parameters": "T2M,PRECTOTCORR,RH2M",
        "community": "AG",
        "format": "JSON"
    }
    
    try:
        res = requests.get(url, params=params, timeout=15)
        res.raise_for_status()
        weather = res.json()["properties"]["parameter"]
        df = pd.DataFrame(weather).replace([-999.0, -999], np.nan)
        
        return {
            "avg_temp_c": round(float(df["T2M"].mean()), 2),
            "total_rainfall_mm": round(float(df["PRECTOTCORR"].sum()), 2),
            "avg_humidity_percent": round(float(df["RH2M"].mean()), 2)
        }
    except Exception as e:
        logger.error(f"NASA Weather API error: {e}. Using weather fallback.")
        return {"avg_temp_c": 25.0, "total_rainfall_mm": 500.0, "avg_humidity_percent": 70.0}

def get_soil_data(lat: float, lon: float) -> dict:
    fallback = {"N": 50, "P": 40, "K": 50, "pH": 6.5}
    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    params = {
        "lat": lat,
        "lon": lon,
        "property": ["phh2o", "nitrogen", "soc", "cec"],
        "depth": "0-5cm",
        "value": "mean"
    }
    
    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        layers = res.json()["properties"]["layers"]
        
        extracted = {}
        for layer in layers:
            name = layer["name"]
            depths = layer["depths"]
            if depths:
                extracted[name] = depths[0]["values"]["mean"]
                
        ph_raw = extracted.get("phh2o")
        pH = round(ph_raw / 10.0, 2) if ph_raw is not None else fallback["pH"]
        
        n_raw = extracted.get("nitrogen")
        if n_raw is not None:
            total_n = (n_raw / 100.0) * 1.3 * 15.0 * 100.0
            N = int(np.clip(total_n * 0.015, 10, 150))
        else:
            N = fallback["N"]
            
        soc_raw = extracted.get("soc")
        P = int(np.clip((soc_raw / 10.0) * 3.0 * 1.2, 10, 150)) if soc_raw is not None else fallback["P"]
        
        cec_raw = extracted.get("cec")
        K = int(np.clip((cec_raw / 10.0) * 0.02 * 391.0 * 0.4, 10, 200)) if cec_raw is not None else fallback["K"]
        
        return {"N": N, "P": P, "K": K, "pH": pH}
    except Exception as e:
        logger.error(f"SoilGrids API error: {e}. Using soil fallback.")
        return fallback

# --- Agronomic Suitability Calibration ---
CROP_REQUIREMENTS = {
    "Rice": ((20, 35), (1000, 2500), (5.0, 7.5), ["Kharif", "Summer", "Whole Year", "Autumn", "Winter"]),
    "Wheat": ((10, 24), (300, 900), (6.0, 7.8), ["Rabi", "Winter"]),
    "Maize": ((18, 32), (500, 1200), (5.5, 7.5), ["Kharif", "Rabi", "Summer", "Whole Year"]),
    "Bajra": ((22, 35), (250, 800), (5.5, 8.0), ["Kharif", "Summer"]),
    "Jowar": ((22, 35), (300, 900), (5.5, 8.0), ["Kharif", "Summer", "Rabi"]),
    "Ragi": ((20, 32), (400, 1000), (5.0, 7.5), ["Kharif", "Rabi"]),
    "Gram": ((12, 25), (300, 700), (6.0, 7.5), ["Rabi", "Winter"]),
    "Masoor": ((12, 25), (300, 700), (6.0, 7.5), ["Rabi", "Winter"]),
    "Moong(Green Gram)": ((22, 35), (400, 900), (5.8, 7.5), ["Kharif", "Summer"]),
    "Urad": ((22, 35), (400, 900), (5.8, 7.5), ["Kharif", "Summer"]),
    "Arhar/Tur": ((20, 35), (500, 1100), (5.5, 7.5), ["Kharif", "Whole Year"]),
    "Rapeseed &Mustard": ((10, 22), (250, 600), (6.0, 7.5), ["Rabi"]),
    "Sugarcane": ((22, 35), (1100, 2200), (5.5, 7.5), ["Whole Year", "Kharif"]),
    "Cotton(lint)": ((20, 32), (500, 1000), (5.8, 7.8), ["Kharif", "Whole Year"]),
    "Coconut": ((22, 33), (1200, 2500), (5.2, 7.5), ["Whole Year"]),
    "Potato": ((12, 22), (400, 800), (5.0, 6.5), ["Rabi", "Winter"]),
    "Onion": ((15, 28), (400, 1000), (5.8, 7.2), ["Rabi", "Kharif", "Summer"]),
    "Banana": ((20, 32), (1000, 2200), (5.5, 7.5), ["Whole Year", "Kharif"]),
    "Jute": ((24, 35), (1200, 2500), (5.0, 7.5), ["Kharif"]),
}

def get_suitability_multiplier(crop: str, temp: float, rain: float, pH: float, season: Optional[str]) -> float:
    matched_crop = None
    for name in CROP_REQUIREMENTS.keys():
        if name.lower() in crop.lower() or crop.lower() in name.lower():
            matched_crop = name
            break
            
    if not matched_crop:
        if "rabi" in crop.lower():
            req_temp, req_rain, req_pH, req_seasons = (12, 24), (300, 800), (6.0, 7.5), ["Rabi", "Winter"]
        elif "kharif" in crop.lower():
            req_temp, req_rain, req_pH, req_seasons = (22, 35), (600, 1500), (5.5, 7.5), ["Kharif"]
        elif "summer" in crop.lower():
            req_temp, req_rain, req_pH, req_seasons = (24, 38), (400, 1000), (6.0, 7.5), ["Summer"]
        else:
            return 1.0
    else:
        req_temp, req_rain, req_pH, req_seasons = CROP_REQUIREMENTS[matched_crop]
        
    # Temperature suitability
    t_min, t_max = req_temp
    if t_min <= temp <= t_max:
        t_mult = 1.2
    else:
        dist = min(abs(temp - t_min), abs(temp - t_max))
        t_mult = max(0.1, 1.2 - (dist * 0.15))
        
    # Rainfall suitability
    r_min, r_max = req_rain
    if r_min <= rain <= r_max:
        r_mult = 1.3
    else:
        dist = min(abs(rain - r_min), abs(rain - r_max))
        r_mult = max(0.1, 1.3 - (dist * 0.002))
        
    # pH suitability
    ph_min, ph_max = req_pH
    if ph_min <= pH <= ph_max:
        ph_mult = 1.2
    else:
        dist = min(abs(pH - ph_min), abs(pH - ph_max))
        ph_mult = max(0.1, 1.2 - (dist * 0.4))
        
    # Season suitability
    if season and req_seasons:
        if season in req_seasons or "Whole Year" in req_seasons:
            s_mult = 1.3
        else:
            s_mult = 0.15
    else:
        s_mult = 1.0
        
    return float(t_mult * r_mult * ph_mult * s_mult)

class LocationRequest(BaseModel):
    location: str
    season: Optional[str] = None
    sowing_date: Optional[str] = None
    area: Optional[float] = 1.0
    fertilizer: Optional[float] = 100.0
    pesticide: Optional[float] = 1.0

@app.post("/analyze")
def analyze_location(payload: LocationRequest):
    loc_info = geocode_location(payload.location)
    if not loc_info:
        raise HTTPException(status_code=400, detail=f"Location '{payload.location}' not found.")
        
    sowing_date = payload.sowing_date or datetime.today().strftime("%Y-%m-%d")
    
    climate = get_climate_data(loc_info["lat"], loc_info["lon"], sowing_date)
    soil = get_soil_data(loc_info["lat"], loc_info["lon"])
    
    state = extract_state(loc_info["name"])
    
    # Auto-detect season if not provided
    if payload.season:
        req_season = payload.season
    else:
        req_season = get_season_from_date(sowing_date)
        
    req_area = payload.area if payload.area is not None else 1.0
    req_fertilizer = payload.fertilizer if payload.fertilizer is not None else 100.0
    req_pesticide = payload.pesticide if payload.pesticide is not None else 1.0
    
    # Auto-extract crop year from sowing date
    try:
        req_year = datetime.strptime(sowing_date, "%Y-%m-%d").year
    except Exception:
        req_year = datetime.today().year
    
    predictions = []
    
    if crop_pipeline and yield_pipeline:
        try:
            # Model 1: Predict Crops
            input_df_m1 = pd.DataFrame([{
                "N": soil["N"], "P": soil["P"], "K": soil["K"], "pH": soil["pH"],
                "avg_temp_c": climate["avg_temp_c"],
                "total_rainfall_mm": climate["total_rainfall_mm"],
                "avg_humidity_percent": climate["avg_humidity_percent"],
                "season": req_season, "state": state, "area": req_area,
                "fertilizer_per_unit_area": req_fertilizer / req_area if req_area > 0 else 0.0,
                "pesticide_per_unit_area": req_pesticide / req_area if req_area > 0 else 0.0,
                "year": req_year
            }])
            
            probs = crop_pipeline.predict_proba(input_df_m1)[0]
            classes = crop_pipeline.classes_
            
            # Apply agronomic suitability calibration to all predicted classes
            calibrated_probs = []
            for crop, prob in zip(classes, probs):
                mult = get_suitability_multiplier(
                    crop, 
                    climate["avg_temp_c"], 
                    climate["total_rainfall_mm"], 
                    soil["pH"], 
                    req_season
                )
                calibrated_probs.append(prob * mult)
            
            # Normalize calibrated probabilities
            total = sum(calibrated_probs)
            if total > 0:
                calibrated_probs = [p / total for p in calibrated_probs]
            else:
                calibrated_probs = list(probs)
                
            sorted_crops = sorted(zip(classes, calibrated_probs), key=lambda x: x[1], reverse=True)
            top_crops = sorted_crops[:5]
            
            # Model 2: Predict Yield
            for crop, prob in top_crops:
                if prob > 0.0:
                    input_df_m2 = pd.DataFrame([{
                        "crop": crop, "season": req_season, "state": state, "area": req_area,
                        "fertilizer_per_unit_area": req_fertilizer / req_area if req_area > 0 else 0.0,
                        "pesticide_per_unit_area": req_pesticide / req_area if req_area > 0 else 0.0,
                        "N": soil["N"], "P": soil["P"], "K": soil["K"], "pH": soil["pH"],
                        "avg_temp_c": climate["avg_temp_c"],
                        "total_rainfall_mm": climate["total_rainfall_mm"],
                        "avg_humidity_percent": climate["avg_humidity_percent"],
                        "year": req_year
                    }])
                    yield_pred = yield_pipeline.predict(input_df_m2)[0]
                    predictions.append({
                        "crop": crop,
                        "probability": round(float(prob), 4),
                        "predicted_yield": round(float(yield_pred), 4)
                    })
        except Exception as e:
            logger.error(f"Prediction pipeline error: {e}")
            
    return {
        "location": loc_info["name"],
        "coordinates": {"lat": loc_info["lat"], "lon": loc_info["lon"]},
        "resolved_state": state,
        "sowing_date_used": sowing_date,
        "climate_data": climate,
        "soil_data": soil,
        "predictions": predictions
    }

# --- OpenAI-Powered Farmer Tips ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

class AiTipsRequest(BaseModel):
    crop: str
    predicted_yield: float
    probability: float
    location: str
    state: str
    season: str
    climate: Dict[str, float]
    soil: Dict[str, float]
    area: Optional[float] = 1.0

@app.post("/ai-tips")
def get_ai_tips(payload: AiTipsRequest):
    """Uses OpenAI to generate actionable farming tips based on prediction context."""
    
    prompt = f"""You are an expert Indian agricultural advisor. A farmer has received the following ML-based crop prediction for their field. Based on this data, provide 5-6 concise, actionable farming tips to help maximize their crop yield and production quality.

**Predicted Crop:** {payload.crop}
**Predicted Yield:** {payload.predicted_yield:.2f} tonnes/hectare
**Match Probability:** {payload.probability * 100:.1f}%
**Location:** {payload.location} ({payload.state})
**Season:** {payload.season}
**Field Area:** {payload.area} hectares

**Climate Conditions:**
- Average Temperature: {payload.climate.get('avg_temp_c', 'N/A')}°C
- Total Rainfall: {payload.climate.get('total_rainfall_mm', 'N/A')} mm
- Average Humidity: {payload.climate.get('avg_humidity_percent', 'N/A')}%

**Soil Properties:**
- Nitrogen (N): {payload.soil.get('N', 'N/A')} kg/ha
- Phosphorus (P): {payload.soil.get('P', 'N/A')} ppm
- Potassium (K): {payload.soil.get('K', 'N/A')} ppm
- Soil pH: {payload.soil.get('pH', 'N/A')}

Please provide:
1. A brief overall assessment (1-2 sentences)
2. 5-6 specific tips covering: soil preparation, irrigation, fertilizer schedule, pest management, harvest timing, and any region-specific advice
3. One potential risk/warning to watch out for

Format each tip as a short, actionable bullet point. Keep the total response under 300 words. Use simple language a farmer can understand. Include specific quantities and timings where possible."""

    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        body = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are a knowledgeable Indian agricultural expert who provides practical, region-specific farming advice. Be concise and actionable."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 500
        }
        
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=body,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        
        tips_text = result["choices"][0]["message"]["content"]
        
        return {
            "crop": payload.crop,
            "tips": tips_text,
            "model_used": "gpt-4o-mini",
            "status": "success"
        }
        
    except requests.exceptions.Timeout:
        logger.error("OpenAI API request timed out")
        raise HTTPException(status_code=504, detail="AI tips request timed out. Please try again.")
    except requests.exceptions.HTTPError as e:
        logger.error(f"OpenAI API error: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
    except Exception as e:
        logger.error(f"OpenAI tips generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate AI tips: {str(e)}")

if __name__ == "__main__":
    if "--server" in sys.argv:
        import uvicorn
        logger.info("Starting FastAPI Server...")
        port = int(os.environ.get("PORT", 8000))
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        print("\n=================================================")
        print("🌍 Agricultural Soil & Climate Analyzer 🌍")
        print("=================================================")
        location_input = input("Enter Location Name (e.g. Betul, MP): ").strip()
        if not location_input:
            print("❌ Location name cannot be empty.")
            sys.exit(1)
            
        print("\nResolving location...")
        loc_info = geocode_location(location_input)
        if not loc_info:
            print("❌ Could not find location.")
            sys.exit(1)
            
        print(f"📍 Found: {loc_info['name']}")
        print(f"   Coordinates: Lat {loc_info['lat']}, Lon {loc_info['lon']}")
        
        # Optional input prompts with defaults
        print("\n--- Configure Model Options (Optional) ---")
        today_str = datetime.today().strftime("%Y-%m-%d")
        sowing_input = input(f"Enter Sowing Date (YYYY-MM-DD, default: {today_str}): ").strip()
        sowing_date = sowing_input if sowing_input else today_str
        
        # Auto-detect season based on sowing date
        season = get_season_from_date(sowing_date)
        print(f"🌾 Auto-detected Season: {season}")
        
        area_input = input("Enter Area (in hectares, default: 1.0): ").strip()
        area = float(area_input) if area_input else 1.0
        
        fert_input = input("Enter Fertilizer (in kg/ha, default: 100.0): ").strip()
        fertilizer = float(fert_input) if fert_input else 100.0
        
        pest_input = input("Enter Pesticide (in kg/ha, default: 1.0): ").strip()
        pesticide = float(pest_input) if pest_input else 1.0
        
        # Auto-extract crop year from sowing date
        try:
            year = datetime.strptime(sowing_date, "%Y-%m-%d").year
        except Exception:
            year = datetime.today().year
        print(f"📅 Auto-detected Crop Year: {year}")
        
        print("\nFetching baseline climate and soil parameters...")
        climate = get_climate_data(loc_info["lat"], loc_info["lon"], sowing_date)
        soil = get_soil_data(loc_info["lat"], loc_info["lon"])
        
        print("\n================ Results ========================")
        print("☁️ Climate Baseline (120-Day previous year):")
        print(f"  - Average Temp: {climate['avg_temp_c']} °C")
        print(f"  - Total Rainfall: {climate['total_rainfall_mm']} mm")
        print(f"  - Average Humidity: {climate['avg_humidity_percent']} %")
        
        print("\n🌱 Soil Properties (0-5cm topsoil):")
        print(f"  - Nitrogen (N): {soil['N']} kg/ha")
        print(f"  - Phosphorus (P): {soil['P']} ppm")
        print(f"  - Potassium (K): {soil['K']} ppm")
        print(f"  - Soil pH: {soil['pH']}")
        
        state = extract_state(loc_info["name"])
        
        # Run ML predictions
        if crop_pipeline and yield_pipeline:
            print("\n🔮 Running ML Recommendation & Yield Models...")
            try:
                input_df_m1 = pd.DataFrame([{
                    "N": soil["N"], "P": soil["P"], "K": soil["K"], "pH": soil["pH"],
                    "avg_temp_c": climate["avg_temp_c"],
                    "total_rainfall_mm": climate["total_rainfall_mm"],
                    "avg_humidity_percent": climate["avg_humidity_percent"],
                    "season": season, "state": state, "area": area,
                    "fertilizer_per_unit_area": fertilizer / area if area > 0 else 0.0,
                    "pesticide_per_unit_area": pesticide / area if area > 0 else 0.0,
                    "year": year
                }])
                
                probs = crop_pipeline.predict_proba(input_df_m1)[0]
                classes = crop_pipeline.classes_
                sorted_crops = sorted(zip(classes, probs), key=lambda x: x[1], reverse=True)
                top_crops = sorted_crops[:5]
                
                print("\n🏆 Top Recommended Crops & Predicted Yields:")
                print("---------------------------------------------")
                for crop, prob in top_crops:
                    if prob > 0.0:
                        input_df_m2 = pd.DataFrame([{
                            "crop": crop, "season": season, "state": state, "area": area,
                            "fertilizer_per_unit_area": fertilizer / area if area > 0 else 0.0,
                            "pesticide_per_unit_area": pesticide / area if area > 0 else 0.0,
                            "N": soil["N"], "P": soil["P"], "K": soil["K"], "pH": soil["pH"],
                            "avg_temp_c": climate["avg_temp_c"],
                            "total_rainfall_mm": climate["total_rainfall_mm"],
                            "avg_humidity_percent": climate["avg_humidity_percent"],
                            "year": year
                        }])
                        yield_pred = yield_pipeline.predict(input_df_m2)[0]
                        print(f"  * {crop:<20} | Probability: {prob:.2%} | Est. Yield: {yield_pred:.3f} units")
            except Exception as e:
                print(f"❌ Prediction pipeline failed: {e}")
        else:
            print("\n⚠️ ML pipelines not available/loaded.")
        print("=================================================\n")
