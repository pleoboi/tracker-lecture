'use client';

import { createContext, useContext, useState, useMemo } from 'react';

const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

const DataContext = createContext(null);

function aggregate(data) {
  if (!data || data.length === 0) return null;

  let total = 0, approved = 0, pending = 0, declined = 0;
  let totalSale = 0, totalCommission = 0;
  const publisherMap = {};
  const allCandidates = [];
  const byGroup = {};

  for (const item of data) {
    const s = item.stats;
    total += s.total;
    approved += s.approved;
    pending += s.pending;
    declined += s.declined;
    totalSale += s.totalSale;
    totalCommission += s.totalCommission;

    for (const pub of item.topPublishers) {
      if (!publisherMap[pub.id]) {
        publisherMap[pub.id] = { id: pub.id, name: pub.name, commission: 0, transactions: 0, programmes: [] };
      }
      publisherMap[pub.id].commission += pub.commission;
      publisherMap[pub.id].transactions += pub.transactions;
      if (!publisherMap[pub.id].programmes.includes(item.programme.name)) {
        publisherMap[pub.id].programmes.push(item.programme.name);
      }
    }

    allCandidates.push(...item.refundCandidates);

    const g = item.programme.group;
    if (!byGroup[g]) byGroup[g] = { group: g, total: 0, approved: 0, pending: 0, declined: 0, totalSale: 0, totalCommission: 0, programmes: [] };
    byGroup[g].total += s.total;
    byGroup[g].approved += s.approved;
    byGroup[g].pending += s.pending;
    byGroup[g].declined += s.declined;
    byGroup[g].totalSale += s.totalSale;
    byGroup[g].totalCommission += s.totalCommission;
    byGroup[g].programmes.push(item);
  }

  const topPublishers = Object.values(publisherMap).sort((a, b) => b.commission - a.commission);
  const refundRate = total > 0 ? Math.round((declined / total) * 1000) / 10 : 0;
  const avgBasket = total > 0 ? Math.round((totalSale / total) * 100) / 100 : 0;
  const targetDeclined = Math.ceil(total * 0.15);
  const toDeclineCount = Math.max(0, targetDeclined - declined);

  // Publisher recruitment: publishers in some programmes but not all within same group
  const recruitmentMap = {};
  for (const item of data) {
    const g = item.programme.group;
    for (const pub of item.topPublishers) {
      if (!recruitmentMap[pub.id]) {
        recruitmentMap[pub.id] = { id: pub.id, name: pub.name, inGroups: {}, commission: pub.commission };
      }
      if (!recruitmentMap[pub.id].inGroups[g]) recruitmentMap[pub.id].inGroups[g] = [];
      recruitmentMap[pub.id].inGroups[g].push(item.programme.id);
    }
  }
  // Find publishers in one group but missing from another
  const recruitmentSuggestions = [];
  const groupNames = Object.keys(byGroup);
  for (const pub of Object.values(recruitmentMap)) {
    const presentGroups = Object.keys(pub.inGroups);
    const missingGroups = groupNames.filter(g => !pub.inGroups[g]);
    if (presentGroups.length > 0 && missingGroups.length > 0 && pub.commission > 0) {
      recruitmentSuggestions.push({ ...pub, presentGroups, missingGroups });
    }
  }
  recruitmentSuggestions.sort((a, b) => b.commission - a.commission);

  // CA by channel for charts
  const caByChannel = data
    .filter(item => item.stats.totalSale > 0)
    .map(item => ({ name: item.programme.name.replace(item.programme.group + ' ', ''), fullName: item.programme.name, ca: item.stats.totalSale, commission: item.stats.totalCommission, group: item.programme.group }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 12);

  const caByGroup = Object.values(byGroup)
    .map(g => ({ name: g.group.replace('-', '‑'), ca: Math.round(g.totalSale), commission: Math.round(g.totalCommission), total: g.total }))
    .sort((a, b) => b.ca - a.ca);

  return {
    total, approved, pending, declined,
    totalSale: Math.round(totalSale * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    refundRate, avgBasket, topPublishers, allCandidates, toDeclineCount,
    byGroup, caByChannel, caByGroup,
    recruitmentSuggestions: recruitmentSuggestions.slice(0, 50),
  };
}

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ startDate: firstOfMonth, endDate: today, group: 'all' });

  const aggregated = useMemo(() => aggregate(data), [data]);

  async function loadData(overrideFilters) {
    const f = overrideFilters || filters;
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const res = await fetch(`/api/awin/transactions?startDate=${f.startDate}&endDate=${f.endDate}&group=${f.group}`);
      if (!res.ok) throw new Error(`Erreur API Awin : ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRefunds(items) {
    const res = await fetch('/api/awin/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok && res.status !== 207) {
      throw new Error(`Erreur API remboursement : ${res.status}`);
    }
    const json = await res.json();

    if (json.success) {
      const declinedIds = new Set(items.map(i => String(i.transactionId)));
      setData(prev => {
        if (!prev) return prev;
        return prev.map(prog => {
          const affectedCount = items.filter(i => Number(i.advertiserId) === prog.programme.id).length;
          if (affectedCount === 0) return prog;

          const newDeclined = prog.stats.declined + affectedCount;
          const newPending  = prog.stats.pending  - affectedCount;
          const total = prog.stats.total;
          const newRefundRate    = total > 0 ? Math.round((newDeclined / total) * 1000) / 10 : 0;
          const newToDeclineCount = Math.max(0, Math.ceil(total * 0.15) - newDeclined);

          return {
            ...prog,
            stats: {
              ...prog.stats,
              declined: newDeclined,
              pending:  newPending,
              refundRate: newRefundRate,
              toDeclineCount: newToDeclineCount,
            },
            refundCandidates: prog.refundCandidates.filter(c => !declinedIds.has(String(c.id))),
          };
        });
      });
    }

    return json;
  }

  return (
    <DataContext.Provider value={{ data, aggregated, loading, error, filters, setFilters, loadData, submitRefunds }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
