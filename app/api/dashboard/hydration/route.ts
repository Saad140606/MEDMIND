import { NextResponse } from 'next/server';
import { addHydration } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    const { amount } = await request.json();
    if (amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Hydration amount is required' }, { status: 400 });
    }
    const updatedData = await addHydration(Number(amount));
    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('Error updating hydration:', error);
    return NextResponse.json({ error: 'Failed to update hydration' }, { status: 500 });
  }
}
