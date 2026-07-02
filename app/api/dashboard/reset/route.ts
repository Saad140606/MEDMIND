// API endpoint resetting the patient database status back to default parameters for clean client demonstration.
import { NextResponse } from 'next/server';
import { resetDatabase } from '../../../../lib/db';

import { extractToken } from '../../../../lib/authServer';


export async function POST(request: Request) {
  try {
    const token = await extractToken(request);
    // Revert user status (dose completion logs and hydration quotas) to default configuration.
    const data = await resetDatabase(token);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error resetting database:', error);
    return NextResponse.json({ error: 'Failed to reset database' }, { status: 500 });
  }
}
