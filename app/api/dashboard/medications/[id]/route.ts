import { NextResponse } from 'next/server';
import { updateMedication, deleteMedication } from '@/lib/db';
import { extractToken } from '@/lib/authServer';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, dosage, time, requiresLock, icon, color, iconBg } = body;

    const token = await extractToken(request);
    const updatedData = await updateMedication(
      Number(id),
      { name, dosage, time, requiresLock, icon, color, iconBg },
      token
    );

    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('Error updating medication:', error);
    return NextResponse.json({ error: 'Failed to update medication' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await extractToken(request);
    const updatedData = await deleteMedication(Number(id), token);

    return NextResponse.json(updatedData);
  } catch (error: any) {
    console.error('Error deleting medication:', error);
    return NextResponse.json({ error: 'Failed to delete medication' }, { status: 500 });
  }
}
