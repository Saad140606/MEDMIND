import { NextResponse } from 'next/server';
import { resetDatabase } from '../../../../lib/db';

export async function POST() {
  try {
    const data = await resetDatabase();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error resetting database:', error);
    return NextResponse.json({ error: 'Failed to reset database' }, { status: 500 });
  }
}
