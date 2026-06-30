// API endpoint forwarding user questions and medication context to the Google Gemini model for medical guidance.
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractToken } from '../../../lib/auth';
import { getCurrentProfileId, getPatientMedications } from '../../../lib/db';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';

const FALLBACK_NO_KEY = "I'm sorry, the AI assistant isn't configured yet. Please add GEMINI_API_KEY to your environment variables. For now, always consult your pharmacist or doctor with any medication questions.";
const FALLBACK_ERROR = "I'm having trouble connecting right now. Please try again in a moment, or contact your pharmacist or doctor directly.";

export async function POST(request: Request) {
  const { message, history = [] } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ response: FALLBACK_NO_KEY });
  }

  
  let medContext = '';
  try {
    if (isSupabaseConfigured) {
      const token = extractToken(request);
      const profileId = await getCurrentProfileId(token);
      if (profileId) {
        // Retrieve patient's medications list to build context for generative model parameters.
        const meds = await getPatientMedications(profileId, token);
        if (meds.length > 0) {
          medContext = meds.map(m => `- ${m.name} at ${m.time} (status: ${m.status})`).join('\n');
        }
      }
    }
  } catch {
    
  }

  const systemPrompt = `You are MedMind AI, a helpful medication assistant. ${
    medContext
      ? `The patient is currently taking:\n${medContext}\n\n`
      : 'The patient has not shared their medication list. '
  }Answer concisely about side effects, interactions, and missed-dose guidance based on their medication list. Always recommend consulting a pharmacist or doctor for unusual symptoms or anomalies. Never diagnose, prescribe, or recommend stopping medications. Keep responses under 150 words and be empathetic.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const chat = model.startChat({
      systemInstruction: systemPrompt,
      history: history.map((h: { type: string; text: string }) => ({
        role: h.type === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      })),
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text();
    return NextResponse.json({ response: text });
  } catch (err: any) {
    console.error('Gemini API error:', err);
    
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([systemPrompt, message]);
      const text = result.response.text();
      return NextResponse.json({ response: text });
    } catch {
      return NextResponse.json({ response: FALLBACK_ERROR });
    }
  }
}
