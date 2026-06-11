import { NextResponse } from 'next/server';

// Retourne tous les programmes rejoints par le publisher
// Usage: /api/awin/programmes?publisherId=XXXXX
// Le publisherId se trouve dans l'URL Awin : ui.awin.com/publisher/{publisherId}/...
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const publisherId = searchParams.get('publisherId');
  const countryCode = searchParams.get('countryCode') || '';

  if (!publisherId) {
    return NextResponse.json({
      error: 'publisherId requis. Trouvez votre ID dans Awin : ui.awin.com/publisher/{publisherId}/...',
    }, { status: 400 });
  }

  const token = process.env.AWIN_API_TOKEN;
  const ccParam = countryCode ? `&countryCode=${countryCode}` : '';
  const url = `https://api.awin.com/publishers/${publisherId}/programmes/joined/?relationship=joined${ccParam}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Awin API ${res.status}`, raw: text.slice(0, 500) }, { status: res.status });
  }

  const programmes = await res.json();
  const list = Array.isArray(programmes) ? programmes : [];

  return NextResponse.json({
    total: list.length,
    publisherId,
    programmes: list.map(p => ({
      id: p.id,
      name: p.name,
      countryCode: p.countryCode,
      primarySector: p.primarySector,
      status: p.status,
    })).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
  });
}
