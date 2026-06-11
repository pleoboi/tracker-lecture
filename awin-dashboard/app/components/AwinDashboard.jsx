'use client';

import { useState, useMemo } from 'react';
import { GROUPS } from '@/lib/programmes';

const TODAY = new Date().toISOString().slice(0, 10);
const FIRST_OF_MONTH = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, target = 15, label }) {
  const pct = Math.min((value / target) * 100, 100);
  const color = value >= target ? 'bg-green-500' : value >= target * 0.8 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{fmt(value, 1)}% / {target}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AwinDashboard() {
  const [startDate, setStartDate] = useState(FIRST_OF_MONTH);
  const [endDate, setEndDate] = useState(TODAY);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRefunds, setSelectedRefunds] = useState({});
  const [refundStatus, setRefundStatus] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    setData(null);
    setSelectedRefunds({});
    setRefundStatus(null);

    const programmes = selectedGroup === 'all' ? 35 : { 'Basket-Center': 5, 'Direct-Running': 7, 'Direct-Volley': 6, 'Endurance-Store': 1, 'Handball-Store': 6, 'Smash-Expert': 4, 'Trek-Expert': 5 }[selectedGroup] || 5;
    const batches = Math.ceil(programmes / 5);
    const estimatedSecs = batches > 1 ? `~${(batches - 1) * 15 + 5}s` : '~5s';
    setLoadingMsg(`Chargement de ${programmes} programme(s)... (${estimatedSecs})`);

    try {
      const res = await fetch(`/api/awin/transactions?startDate=${startDate}&endDate=${endDate}&group=${selectedGroup}`);
      if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const aggregated = useMemo(() => {
    if (!data) return null;
    let total = 0, approved = 0, pending = 0, declined = 0, totalSale = 0, totalCommission = 0;
    const publisherMap = {};
    const allCandidates = [];

    for (const item of data) {
      const s = item.stats;
      total += s.total;
      approved += s.approved;
      pending += s.pending;
      declined += s.declined;
      totalSale += s.totalSale;
      totalCommission += s.totalCommission;

      for (const pub of item.topPublishers) {
        if (!publisherMap[pub.id]) publisherMap[pub.id] = { id: pub.id, name: pub.name, commission: 0, transactions: 0 };
        publisherMap[pub.id].commission += pub.commission;
        publisherMap[pub.id].transactions += pub.transactions;
      }

      allCandidates.push(...item.refundCandidates);
    }

    const topPublishers = Object.values(publisherMap).sort((a, b) => b.commission - a.commission).slice(0, 10);
    const refundRate = total > 0 ? (declined / total) * 100 : 0;
    const avgBasket = total > 0 ? totalSale / total : 0;
    const targetDeclined = Math.ceil(total * 0.15);
    const toDeclineCount = Math.max(0, targetDeclined - declined);

    return {
      total, approved, pending, declined,
      totalSale: Math.round(totalSale * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      refundRate: Math.round(refundRate * 10) / 10,
      avgBasket: Math.round(avgBasket * 100) / 100,
      topPublishers,
      allCandidates,
      toDeclineCount,
    };
  }, [data]);

  function toggleRefund(transactionId, item) {
    setSelectedRefunds(prev => {
      const next = { ...prev };
      if (next[transactionId]) {
        delete next[transactionId];
      } else {
        next[transactionId] = item;
      }
      return next;
    });
  }

  function selectAllCandidates(candidates) {
    const next = {};
    for (const c of candidates) {
      next[c.id] = c;
    }
    setSelectedRefunds(next);
  }

  async function submitRefunds() {
    const items = Object.values(selectedRefunds).map(c => ({
      advertiserId: c.advertiserId,
      transactionId: c.id,
    }));
    if (items.length === 0) return;

    setRefundLoading(true);
    setRefundStatus(null);
    try {
      const res = await fetch('/api/awin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      setRefundStatus(json);
      if (json.success) {
        setSelectedRefunds({});
        await loadData();
      }
    } catch (e) {
      setRefundStatus({ success: false, error: e.message });
    } finally {
      setRefundLoading(false);
    }
  }

  const selectedCount = Object.keys(selectedRefunds).length;
  const candidates = aggregated?.allCandidates ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Awin Dashboard</h1>
            <p className="text-sm text-gray-500">Team All-Play</p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
            />
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">Tous les programmes</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button
              onClick={loadData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Chargement...' : 'Charger'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">{loadingMsg}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
            {error}
          </div>
        )}

        {/* Tabs */}
        {aggregated && !loading && (
          <>
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
              {['dashboard', 'channels', 'remboursements'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {tab === 'remboursements' ? `Remboursements${candidates.length > 0 ? ` (${candidates.length})` : ''}` : tab === 'dashboard' ? 'Vue globale' : 'Par channel'}
                </button>
              ))}
            </div>

            {/* Dashboard tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <KpiCard label="Transactions" value={fmt(aggregated.total)} />
                  <KpiCard label="CA total" value={`${fmt(aggregated.totalSale, 0)} €`} />
                  <KpiCard label="Commissions" value={`${fmt(aggregated.totalCommission, 0)} €`} />
                  <KpiCard label="Panier moyen" value={`${fmt(aggregated.avgBasket, 0)} €`} />
                  <KpiCard label="Remboursées" value={fmt(aggregated.declined)} sub={`sur ${fmt(aggregated.total)}`} />
                  <KpiCard
                    label="Taux remb."
                    value={`${fmt(aggregated.refundRate, 1)}%`}
                    color={aggregated.refundRate >= 15 ? 'text-green-600' : 'text-red-500'}
                    sub="Objectif : 15%"
                  />
                </div>

                {/* Refund progress */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h2 className="font-semibold text-gray-800 mb-4">Taux de remboursement global</h2>
                  <ProgressBar value={aggregated.refundRate} label="Toutes enseignes" />
                  {aggregated.toDeclineCount > 0 && (
                    <p className="text-sm text-orange-600 mt-3">
                      Il manque <strong>{aggregated.toDeclineCount} transaction(s)</strong> à rembourser pour atteindre 15%.{' '}
                      {candidates.length > 0 && (
                        <button onClick={() => setActiveTab('remboursements')} className="underline text-blue-600">
                          Voir les candidats
                        </button>
                      )}
                    </p>
                  )}
                </div>

                {/* Top publishers */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h2 className="font-semibold text-gray-800 mb-4">Top éditeurs (commissions)</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">Éditeur</th>
                          <th className="pb-2 font-medium text-right">Transactions</th>
                          <th className="pb-2 font-medium text-right">Commissions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aggregated.topPublishers.map((pub, i) => (
                          <tr key={pub.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 text-gray-400">{i + 1}</td>
                            <td className="py-2 text-gray-800">{pub.name}</td>
                            <td className="py-2 text-right text-gray-700">{fmt(pub.transactions)}</td>
                            <td className="py-2 text-right text-gray-700 font-medium">{fmt(pub.commission, 2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Channels tab */}
            {activeTab === 'channels' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 font-medium">Channel</th>
                        <th className="px-4 py-3 font-medium text-right">Transactions</th>
                        <th className="px-4 py-3 font-medium text-right">CA</th>
                        <th className="px-4 py-3 font-medium text-right">Commissions</th>
                        <th className="px-4 py-3 font-medium text-right">Panier moy.</th>
                        <th className="px-4 py-3 font-medium text-right">Remboursées</th>
                        <th className="px-4 py-3 font-medium text-right">Taux remb.</th>
                        <th className="px-4 py-3 font-medium text-right">Manque</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map(item => {
                        const s = item.stats;
                        const isOk = s.refundRate >= 15;
                        return (
                          <tr key={item.programme.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{item.programme.name}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(s.total)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(s.totalSale, 0)} {item.programme.currency}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(s.totalCommission, 2)} {item.programme.currency}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(s.avgBasket, 0)} {item.programme.currency}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(s.declined)}</td>
                            <td className={`px-4 py-3 text-right font-medium ${isOk ? 'text-green-600' : 'text-red-500'}`}>
                              {fmt(s.refundRate, 1)}%
                            </td>
                            <td className="px-4 py-3 text-right text-orange-600">
                              {s.toDeclineCount > 0 ? `-${s.toDeclineCount}` : '✓'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Refund tab */}
            {activeTab === 'remboursements' && (
              <div className="space-y-4">
                {/* Summary per programme */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h2 className="font-semibold text-gray-800 mb-4">Progression par channel</h2>
                  <div className="space-y-3">
                    {data.map(item => (
                      <ProgressBar key={item.programme.id} value={item.stats.refundRate} label={item.programme.name} />
                    ))}
                  </div>
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                    Aucun candidat au remboursement (transactions pending entre 40-90€ avec commission ~7%).
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                      <div>
                        <h2 className="font-semibold text-gray-800">Candidats au remboursement</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Pending · 40-90€ · Commission ~7%</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => selectAllCandidates(candidates)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Tout sélectionner
                        </button>
                        <button
                          onClick={() => setSelectedRefunds({})}
                          className="text-sm text-gray-400 hover:underline"
                        >
                          Tout désélectionner
                        </button>
                        {selectedCount > 0 && (
                          <button
                            onClick={submitRefunds}
                            disabled={refundLoading}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            {refundLoading ? 'Envoi...' : `Rembourser (${selectedCount})`}
                          </button>
                        )}
                      </div>
                    </div>

                    {refundStatus && (
                      <div className={`px-5 py-3 text-sm ${refundStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {refundStatus.success ? `${selectedCount} remboursement(s) soumis avec succès.` : `Erreur : ${refundStatus.error || 'Certains remboursements ont échoué.'}`}
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 w-8" />
                            <th className="px-4 py-3 font-medium">Channel</th>
                            <th className="px-4 py-3 font-medium">Éditeur</th>
                            <th className="px-4 py-3 font-medium">Réf. commande</th>
                            <th className="px-4 py-3 font-medium text-right">Vente</th>
                            <th className="px-4 py-3 font-medium text-right">Commission</th>
                            <th className="px-4 py-3 font-medium text-right">Taux</th>
                            <th className="px-4 py-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidates.map(c => {
                            const checked = !!selectedRefunds[c.id];
                            return (
                              <tr
                                key={c.id}
                                onClick={() => toggleRefund(c.id, c)}
                                className={`border-b border-gray-100 cursor-pointer ${checked ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                              >
                                <td className="px-4 py-2 text-center">
                                  <input type="checkbox" checked={checked} onChange={() => {}} className="cursor-pointer" />
                                </td>
                                <td className="px-4 py-2 text-gray-700">{c.programmeName}</td>
                                <td className="px-4 py-2 text-gray-700">{c.publisherName}</td>
                                <td className="px-4 py-2 text-gray-500 font-mono text-xs">{c.orderRef}</td>
                                <td className="px-4 py-2 text-right text-gray-700 font-medium">{fmt(c.saleAmount, 2)} {c.currency}</td>
                                <td className="px-4 py-2 text-right text-gray-700">{fmt(c.commissionAmount, 2)} {c.currency}</td>
                                <td className="px-4 py-2 text-right text-gray-500">{fmt(c.commissionRate, 1)}%</td>
                                <td className="px-4 py-2 text-gray-400 text-xs">{c.transactionDate?.slice(0, 10)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg font-medium">Sélectionne une période et clique sur Charger</p>
            <p className="text-sm mt-1">Les données Awin apparaîtront ici</p>
          </div>
        )}
      </div>
    </div>
  );
}
