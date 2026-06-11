import { NextResponse } from 'next/server';
import { PROGRAMMES } from '@/lib/programmes';

export const maxDuration = 300;

const AWIN_API = 'https://api.awin.com';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function countTransactions(advertiserId, startDate, endDate, token) {
  let total = 0;
  let page = 1;

  while (true) {
    const url = `${AWIN_API}/advertisers/${advertiserId}/transactions/?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59&timezone=Europe%2FParis&pageSize=200&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });

    if (res.status === 429) {
      await sleep(5000);
      continue;
    }
    if (!res.ok) return { total, status: res.status, ok: false };

    const data = await res.json();
    const transactions = Array.isArray(data) ? data : [];
    total += transactions.length;
    if (transactions.length < 200) break;
    page++;
  }

  return { total, status: 200, ok: true };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDate   = searchParams.get('endDate')   || new Date().toISOString().slice(0, 10);
  const token = process.env.AWIN_API_TOKEN;

  const results = [];

  // Batches de 5 avec 3s de délai pour respecter le rate limit
  for (let i = 0; i < PROGRAMMES.length; i += 5) {
    const batch = PROGRAMMES.slice(i, i + 5);
    const batchResults = await Promise.allSettled(
      batch.map(async prog => {
        const { total, status, ok } = await countTransactions(prog.id, startDate, endDate, token);
        return { id: prog.id, name: prog.name, group: prog.group, country: prog.country, total, status, ok };
      })
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
    if (i + 5 < PROGRAMMES.length) await sleep(3000);
  }

  return NextResponse.json({ startDate, endDate, programmes: results }, {
    headers: { 'Content-Type': 'application/json' },
  });
}
