// API endpoint handling user water intake updates, modifying local/remote database state, and returning metrics.
import { NextResponse } from 'next/server';
import { addHydration } from '../../../../lib/db';

import { extractToken } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { amount } = await request.json();
    if (amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Hydration amount is required' }, { status: 400 });
    }
    const token = extractToken(request);
    // Parse client token and increment hydration status before returning updated metrics.
    const updatedData = await addHydration(Number(amount), token);
    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('Error updating hydration:', error);
    return NextResponse.json({ error: 'Failed to update hydration' }, { status: 500 });
  }
}
