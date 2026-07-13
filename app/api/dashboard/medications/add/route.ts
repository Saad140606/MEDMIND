import { NextResponse } from 'next/server';
import { addMedication } from '@/lib/db';
import { extractToken } from '@/lib/authServer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, dosage, time, icon, color, iconBg, requiresLock } = body;
    
    if (!name || !dosage || !time) {
      return NextResponse.json({ error: 'Name, dosage, and time are required' }, { status: 400 });
    }

    const token = await extractToken(request);
    const updatedData = await addMedication({
      name,
      dosage,
      time,
      icon,
      color,
      iconBg,
      requiresLock,
    }, token);
    
    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('Error adding medication:', error);
    return NextResponse.json({ error: 'Failed to add medication' }, { status: 500 });
  }
}
