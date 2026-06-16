import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { crop, predicted_yield, probability, location, state, season, climate, soil, area } = body;

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured on the Vercel server. Please add OPENAI_API_KEY to your environment variables." },
        { status: 500 }
      );
    }

    const prompt = `You are an expert Indian agricultural advisor. A farmer has received the following ML-based crop prediction for their field. Based on this data, provide 5-6 concise, actionable farming tips to help maximize their crop yield and production quality.

**Predicted Crop:** ${crop}
**Predicted Yield:** ${predicted_yield ? parseFloat(predicted_yield).toFixed(2) : 'N/A'} tonnes/hectare
**Match Probability:** ${probability ? (parseFloat(probability) * 100).toFixed(1) : 'N/A'}%
**Location:** ${location} (${state || 'N/A'})
**Season:** ${season || 'N/A'}
**Field Area:** ${area || 1.0} hectares

**Climate Conditions:**
- Average Temperature: ${climate?.avg_temp_c ?? 'N/A'}°C
- Total Rainfall: ${climate?.total_rainfall_mm ?? 'N/A'} mm
- Average Humidity: ${climate?.avg_humidity_percent ?? 'N/A'}%

**Soil Properties:**
- Nitrogen (N): ${soil?.N ?? 'N/A'} kg/ha
- Phosphorus (P): ${soil?.P ?? 'N/A'} ppm
- Potassium (K): ${soil?.K ?? 'N/A'} ppm
- Soil pH: ${soil?.pH ?? 'N/A'}

Please provide:
1. A brief overall assessment (1-2 sentences)
2. 5-6 specific tips covering: soil preparation, irrigation, fertilizer schedule, pest management, harvest timing, and any region-specific advice
3. One potential risk/warning to watch out for

Format each tip as a short, actionable bullet point. Keep the total response under 300 words. Use simple language a farmer can understand. Include specific quantities and timings where possible.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable Indian agricultural expert who provides practical, region-specific farming advice. Be concise and actionable.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `OpenAI API returned error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const tipsText = data.choices?.[0]?.message?.content || 'No tips generated.';

    return NextResponse.json({
      crop,
      tips: tipsText,
      model_used: 'gpt-4o-mini',
      status: 'success'
    });
  } catch (error: any) {
    console.error('Error generating AI tips in Next.js:', error);
    return NextResponse.json(
      { error: `Failed to generate AI tips: ${error.message}` },
      { status: 500 }
    );
  }
}
