import { NextResponse } from 'next/server';
import { getProgrammesByGroup } from '@/lib/programmes';

export const maxDuration = 300;

const AWIN_API = 'https://api.awin.com';

const CASHBACK_KEYWORDS = [
  'cashback', 'cash back', 'cash-back',
  'igraal', 'ebuyclub', 'poulpeo', 'shoop', 'quidco', 'topcashback',
  'remboursement', 'rakuten', 'webloyalty',
];

function isCashback(t) {
  const name = (getPublisherName(t) || '').toLowerCase();
  return CASHBACK_KEYWORDS.some(kw => name.includes(kw));
}

function mapToCandidate(t, programme, tier) {
  const sale = getSaleAmount(t);
  const comm = getCommissionAmount(t);
  const pid = t.publisherId ?? t.affiliateId;
  return {
    id: t.id,
    advertiserId: programme.id,
    programmeName: programme.name,
    publisherId: pid,
    publisherName: getPublisherName(t),
    saleAmount: sale,
    commissionAmount: comm,
    commissionRate: sale > 0 ? Math.round((comm / sale) * 1000) / 10 : 0,
    currency: t.saleAmount?.currency ?? t.currency ?? programme.currency,
    transactionDate: t.transactionDate,
    orderRef: t.orderRef,
    tier,
  };
}

function getPublisherName(t) {
  return (
    (t.siteName && t.siteName.trim() !== '' ? t.siteName : null) ||
    t.publisherName ||
    t.publisher?.name ||
    (t.publisherId ? `Éditeur ${t.publisherId}` : 'Inconnu')
  );
}

function getSaleAmount(t) {
  const raw = t.saleAmount?.amount ?? t.saleAmount ?? t.sale ?? 0;
  return typeof raw === 'number' ? raw : parseFloat(raw) || 0;
}

function getCommissionAmount(t) {
  const raw = t.commissionAmount?.amount ?? t.commissionAmount ?? t.commission ?? 0;
  return typeof raw === 'number' ? raw : parseFloat(raw) || 0;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchAllTransactions(advertiserId, startDate, endDate, token) {
  const allTransactions = [];
  let page = 1;
  const opts = {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  };

  while (true) {
    const url = `${AWIN_API}/advertisers/${advertiserId}/transactions/?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59&timezone=Europe%2FParis&pageSize=200&page=${page}`;

    let res = await fetch(url, opts);

    // Rate limit : attendre 6s et réessayer une fois
    if (res.status === 429) {
      await sleep(6000);
      res = await fetch(url, opts);
    }

    // Toujours rate-limité ou autre erreur : retourner ce qu'on a (le programme restera visible avec 0)
    if (!res.ok) return allTransactions;

    const data = await res.json();
    const transactions = Array.isArray(data) ? data : [];
    allTransactions.push(...transactions);
    if (transactions.length < 200) break;
    page++;
  }

  return allTransactions;
}

function computeStats(transactions, programme) {
  const total = transactions.length;
  const declined = transactions.filter(t => t.commissionStatus === 'declined').length;
  const pending = transactions.filter(t => t.commissionStatus === 'pending');
  const approved = transactions.filter(t => t.commissionStatus === 'approved').length;

  let totalSale = 0;
  let totalCommission = 0;
  const publisherMap = {};

  for (const t of transactions) {
    const sale = getSaleAmount(t);
    const comm = getCommissionAmount(t);
    totalSale += sale;
    totalCommission += comm;

    const pid = t.publisherId ?? t.affiliateId;
    const pname = getPublisherName(t);

    if (pid) {
      if (!publisherMap[pid]) publisherMap[pid] = { id: pid, name: pname, commission: 0, transactions: 0 };
      publisherMap[pid].commission += comm;
      publisherMap[pid].transactions += 1;
    }
  }

  const topPublishers = Object.values(publisherMap)
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 15);

  const refundRate = total > 0 ? (declined / total) * 100 : 0;
  const avgBasket = total > 0 ? totalSale / total : 0;
  const targetDeclined = Math.ceil(total * 0.15);
  const toDeclineCount = Math.max(0, targetDeclined - declined);

  const nonCashbackPending = pending.filter(t => !isCashback(t));

  const primaryCandidates = nonCashbackPending
    .filter(t => {
      const sale = getSaleAmount(t);
      const comm = getCommissionAmount(t);
      const rate = sale > 0 ? (comm / sale) * 100 : 0;
      return sale >= 40 && sale <= 90 && rate >= 6 && rate <= 8;
    })
    .map(t => mapToCandidate(t, programme, 'primary'));

  const fallbackCandidates = nonCashbackPending
    .filter(t => {
      const sale = getSaleAmount(t);
      const comm = getCommissionAmount(t);
      if (sale <= 0 || comm <= 0) return false;
      const rate = (comm / sale) * 100;
      return rate <= 6;
    })
    .map(t => mapToCandidate(t, programme, 'fallback'));

  const refundCandidates = primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates;

  return {
    programme,
    stats: {
      total, approved, pending: pending.length, declined,
      refundRate: Math.round(refundRate * 10) / 10,
      totalSale: Math.round(totalSale * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      avgBasket: Math.round(avgBasket * 100) / 100,
      toDeclineCount,
    },
    topPublishers,
    refundCandidates,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const group = searchParams.get('group') || 'all';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const token = process.env.AWIN_API_TOKEN;
  const programmes = getProgrammesByGroup(group);
  const results = [];

  // Toujours par batches de 5 max pour respecter le rate limit Awin
  // Délai entre batches : 10s pour "all", 4s pour un groupe unique
  const BATCH_SIZE = 5;
  const DELAY = group === 'all' ? 10000 : 4000;

  for (let i = 0; i < programmes.length; i += BATCH_SIZE) {
    const batch = programmes.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (prog) => {
        const transactions = await fetchAllTransactions(prog.id, startDate, endDate, token);
        return computeStats(transactions, prog);
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }

    if (DELAY > 0 && i + BATCH_SIZE < programmes.length) {
      await sleep(DELAY);
    }
  }

  return NextResponse.json(results);
}
