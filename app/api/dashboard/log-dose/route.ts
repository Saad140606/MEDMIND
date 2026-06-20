import { NextResponse } from 'next/server';
import { logDose } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    const { medicationId } = await request.json();
    if (medicationId === undefined || medicationId === null) {
      return NextResponse.json({ error: 'Medication ID is required' }, { status: 400 });
    }
    const updatedData = await logDose(Number(medicationId));
    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('Error logging dose:', error);
    return NextResponse.json({ error: 'Failed to log dose' }, { status: 500 });
  }
}
