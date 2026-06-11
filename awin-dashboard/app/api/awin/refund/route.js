import { NextResponse } from 'next/server';

const AWIN_API = 'https://api.awin.com';

export async function POST(request) {
  const token = process.env.AWIN_API_TOKEN;
  const body = await request.json();
  const items = body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 });
  }

  // Group by advertiserId
  const byAdvertiser = {};
  for (const item of items) {
    if (!byAdvertiser[item.advertiserId]) byAdvertiser[item.advertiserId] = [];
    byAdvertiser[item.advertiserId].push(item.transactionId);
  }

  const results = [];

  for (const [advertiserId, transactionIds] of Object.entries(byAdvertiser)) {
    const url = `${AWIN_API}/advertisers/${advertiserId}/transactions/batch`;

    // Send all transactions for this advertiser in a single batch call
    const batchBody = transactionIds.map(transactionId => ({
      action: 'decline',
      transaction: { transactionId, declineReason: 'order returned' },
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchBody),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    results.push({
      advertiserId,
      transactions: [{ transactionId: transactionIds.join(','), status: res.status, ok: res.ok, data }],
      ok: res.ok,
    });
  }

  const allOk = results.every(r => r.ok);
  return NextResponse.json({ success: allOk, results }, { status: allOk ? 200 : 207 });
}
