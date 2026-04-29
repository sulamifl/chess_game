import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://ipapi.co/json/', { next: { revalidate: 0 } });
    const data = await res.json();
    return NextResponse.json({
      city: data.city || 'Неизвестный город',
      country: data.country_name || 'Неизвестная страна',
    });
  } catch {
    return NextResponse.json({ city: 'Неизвестный город', country: 'Неизвестная страна' });
  }
}