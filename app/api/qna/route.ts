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
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!apiKey && !groqApiKey) {
    return NextResponse.json({ response: "I'm sorry, neither Gemini nor Groq API keys are configured. Please add GEMINI_API_KEY or GROQ_API_KEY to your environment variables." });
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

  if (apiKey) {
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
      } catch (geminiErr) {
        console.error('Gemini 1.5 fallback error, trying Groq:', geminiErr);
        if (groqApiKey) {
          try {
            const text = await callGroq(systemPrompt, history, message);
            return NextResponse.json({ response: text });
          } catch (groqErr) {
            console.error('Groq fallback error:', groqErr);
            return NextResponse.json({ response: FALLBACK_ERROR });
          }
        } else {
          return NextResponse.json({ response: FALLBACK_ERROR });
        }
      }
    }
  } else {
    // Gemini API key is missing but Groq API key is present!
    try {
      const text = await callGroq(systemPrompt, history, message);
      return NextResponse.json({ response: text });
    } catch (groqErr) {
      console.error('Groq API error:', groqErr);
      return NextResponse.json({ response: FALLBACK_ERROR });
    }
  }
}

async function callGroq(systemPrompt: string, history: Array<{ type: string; text: string }>, message: string): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('Groq API key not configured');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h: { type: string; text: string }) => ({
      role: h.type === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: message }
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Groq API returned status ${res.status}: ${errorData}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
