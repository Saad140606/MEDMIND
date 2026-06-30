// API endpoint matching speech input against user medications, intent-mapping commands, and executing actions using Gemini.
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractToken } from '../../../../lib/auth';
import { getCurrentProfileId, getPatientMedications, logDose } from '../../../../lib/db';
import { isSupabaseConfigured } from '../../../../lib/supabaseClient';
import type { Medication } from '../../../../lib/db';

interface ParseResult {
  action: 'LOG_DOSE' | 'QUERY_STATUS' | 'UNKNOWN';
  medicationId?: number;
  medicationName?: string;
  responseText: string;
}

function fuzzyMatchMedication(transcript: string, medications: Medication[]): Medication | null {
  const lower = transcript.toLowerCase();
  // Iterate through active medications and check if any constituent words longer than 3 characters match the voice transcript.
  for (const med of medications) {
    const medLower = med.name.toLowerCase();
    const words = medLower.split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && lower.includes(word)) {
        return med;
      }
    }
  }
  return null;
}

function detectIntent(transcript: string): 'LOG_DOSE' | 'QUERY_STATUS' | 'UNKNOWN' {
  const lower = transcript.toLowerCase();
  const logKeywords = ['log', 'took', 'taken', 'take', 'have taken', 'just took', 'swallow', 'dose', 'pill'];
  const statusKeywords = ['did i', 'have i', 'status', 'check', 'when', 'what time'];
  if (logKeywords.some(k => lower.includes(k))) return 'LOG_DOSE';
  if (statusKeywords.some(k => lower.includes(k))) return 'QUERY_STATUS';
  return 'UNKNOWN';
}

export async function POST(request: Request) {
  const body = await request.json();
  const { transcript } = body;

  if (!transcript?.trim()) {
    return NextResponse.json({ action: 'UNKNOWN', responseText: 'I did not catch that. Please try again.' });
  }

  let medications: Medication[] = [];
  let profileId: string | null = null;
  let token: string | null = null;

  try {
    token = extractToken(request);
    if (isSupabaseConfigured && token) {
      profileId = await getCurrentProfileId(token);
      if (profileId) {
        medications = await getPatientMedications(profileId, token);
      }
    } else if (!isSupabaseConfigured) {
      const { getDashboardData } = await import('../../../../lib/db');
      const data = await getDashboardData();
      medications = data.medications;
    }
  } catch {
    
  }

  const intent = detectIntent(transcript);
  const matchedMed = fuzzyMatchMedication(transcript, medications);

  if (matchedMed && intent === 'LOG_DOSE') {
    try {
      await logDose(matchedMed.id, token);
      return NextResponse.json<ParseResult>({
        action: 'LOG_DOSE',
        medicationId: matchedMed.id,
        medicationName: matchedMed.name,
        responseText: `Got it! ${matchedMed.name} logged at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      });
    } catch {
      return NextResponse.json<ParseResult>({
        action: 'LOG_DOSE',
        medicationId: matchedMed.id,
        medicationName: matchedMed.name,
        responseText: `Found ${matchedMed.name} but couldn't save the log. Please try again.`,
      });
    }
  }

  if (matchedMed && intent === 'QUERY_STATUS') {
    const statusText = matchedMed.status === 'taken'
      ? `Yes, you've already logged ${matchedMed.name} today.`
      : `No, ${matchedMed.name} is scheduled for ${matchedMed.time} and is ${matchedMed.status}.`;
    return NextResponse.json<ParseResult>({
      action: 'QUERY_STATUS',
      medicationId: matchedMed.id,
      medicationName: matchedMed.name,
      responseText: statusText,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const responseText = matchedMed
      ? `I found ${matchedMed.name} in your list. Did you want to log it?`
      : `I heard: "${transcript}". Please say the medication name clearly, e.g. "Log my Metformin".`;
    return NextResponse.json<ParseResult>({ action: 'UNKNOWN', responseText });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const medList = medications.map(m => `id:${m.id} name:"${m.name}" status:${m.status}`).join(', ');
    // Issue structured instruction prompt to Gemini requesting a single, schema-compliant JSON response block.
    const prompt = `The patient said: "${transcript}"\n\nTheir medications: ${medList || 'none'}\n\nRespond with ONLY valid JSON: {"action":"LOG_DOSE"|"QUERY_STATUS"|"UNKNOWN","medicationId":number|null,"responseText":"string"}\n\naction=LOG_DOSE if they want to log a dose, QUERY_STATUS if asking about status, UNKNOWN otherwise. medicationId must match one of the listed ids or null. responseText should be a friendly 1-sentence confirmation.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Parse the output using regex to safely extract the raw JSON brackets, stripping away LLM markdown formatting ticks if present.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: ParseResult = JSON.parse(jsonMatch[0]);
      if (parsed.action === 'LOG_DOSE' && parsed.medicationId) {
        try {
          await logDose(parsed.medicationId, token);
          const medName = medications.find(m => m.id === parsed.medicationId)?.name || 'medication';
          return NextResponse.json<ParseResult>({
            ...parsed,
            medicationName: medName,
            responseText: `Got it! ${medName} logged at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          });
        } catch {
          return NextResponse.json<ParseResult>({ ...parsed, responseText: 'Found the medication but could not save the log. Please try again.' });
        }
      }
      return NextResponse.json<ParseResult>(parsed);
    }
  } catch (err) {
    console.error('Gemini voice parse error:', err);
  }

  return NextResponse.json<ParseResult>({
    action: 'UNKNOWN',
    responseText: `I heard "${transcript}" but couldn't understand. Try saying "Log my [medication name]".`,
  });
}
