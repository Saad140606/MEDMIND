// API endpoint processing intake logging for a medication dose, updating streaks/history, and returning dashboard metrics.
import { NextResponse } from 'next/server';
import { logDose } from '../../../../lib/db';

import { extractToken } from '../../../../lib/authServer';

export async function POST(request: Request) {
  try {
    const { medicationId } = await request.json();
    if (medicationId === undefined || medicationId === null) {
      return NextResponse.json({ error: 'Medication ID is required' }, { status: 400 });
    }
    const token = await extractToken(request);
    // Parse token and record logged medication intake parameters before returning dashboard stats.
    // If the dose was already logged for today, this performs a safe no-op returning HTTP 200,
    // which allows the client offline queue synchronizer to clear the duplicate request from its store.
    const updatedData = await logDose(Number(medicationId), token);
    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('Error logging dose:', error);
    return NextResponse.json({ error: 'Failed to log dose' }, { status: 500 });
  }
}
