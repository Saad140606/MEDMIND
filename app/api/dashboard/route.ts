// API endpoint fetching user demographics, medication schedules, streaks, hydration data, and refills for dashboard render.
import { NextResponse } from 'next/server';
import { getDashboardData } from '../../../lib/db';

import { extractToken } from '../../../lib/auth';


export async function GET(request: Request) {
  try {
    const token = extractToken(request);
    // Fetch demographic fields, streak tallies, and active compliance charts.
    const data = await getDashboardData(token);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
