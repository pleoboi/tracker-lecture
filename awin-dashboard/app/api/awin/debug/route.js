import { NextResponse } from 'next/server';

// Returns the raw first transaction from a programme to inspect field names
// Usage: /api/awin/debug?advertiserId=65152&startDate=2026-06-01&endDate=2026-06-11
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const advertiserId = searchParams.get('advertiserId') || '65152';
  const startDate = searchParams.get('startDate') || '2026-06-01';
  const endDate = searchParams.get('endDate') || '2026-06-11';
  const token = process.env.AWIN_API_TOKEN;

  const url = `https://api.awin.com/advertisers/${advertiserId}/transactions/?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59&timezone=Europe%2FParis&pageSize=3&page=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  return NextResponse.json({
    status: res.status,
    // Show all field names of the first transaction
    firstTransactionKeys: Array.isArray(data) && data[0] ? Object.keys(data[0]) : [],
    firstTransaction: Array.isArray(data) ? data[0] : data,
    raw: text.slice(0, 2000),
  });
}
