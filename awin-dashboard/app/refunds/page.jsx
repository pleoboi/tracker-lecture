'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/app/context/DataContext';
import { Card, CardHeader, ProgressBar, EmptyState, LoadingSpinner, fmt, Badge } from '@/app/components/ui';

export default function RefundsPage() {
  const { data, aggregated, loading, error, submitRefunds } = useData();
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [filterPublisher, setFilterPublisher] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [sortBy, setSortBy] = useState('sale_desc');

  if (loading) return <LoadingSpinner message="Chargement..." />;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!aggregated) return (
    <div className="p-8">
      <EmptyState icon="↩" message="Aucune donnée chargée" sub="Utilise les filtres dans la barre latérale" />
    </div>
  );

  const candidates = aggregated.allCandidates;
  const channels = [...new Set(candidates.map(c => c.programmeName))].sort();

  const publisherIds = [...new Set(candidates.map(c => c.publisherId))];
  const publishers = publisherIds.map(id => ({
    id, name: candidates.find(c => c.publisherId === id)?.publisherName || `Publisher ${id}`,
  }));

  const filtered = useMemo(() => {
    let list = [...candidates];
    if (filterPublisher) list = list.filter(c => c.publisherId === Number(filterPublisher));
    if (filterChannel !== 'all') list = list.filter(c => c.programmeName === filterChannel);
    if (sortBy === 'sale_desc') list.sort((a, b) => b.saleAmount - a.saleAmount);
    else if (sortBy === 'sale_asc') list.sort((a, b) => a.saleAmount - b.saleAmount);
    else if (sortBy === 'date_desc') list.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
    else if (sortBy === 'publisher') list.sort((a, b) => a.publisherName.localeCompare(b.publisherName));
    return list;
  }, [candidates, filterPublisher, filterChannel, sortBy]);

  const selectedCount = Object.keys(selected).length;
  const selectedCommission = Object.values(selected).reduce((sum, c) => sum + c.commissionAmount, 0);

  function toggle(c) {
    setSelected(prev => {
      const next = { ...prev };
      if (next[c.id]) delete next[c.id];
      else next[c.id] = c;
      return next;
    });
  }

  function selectAll() {
    const next = {};
    filtered.forEach(c => { next[c.id] = c; });
    setSelected(next);
  }

  function clearAll() { setSelected({}); }

  // Smart suggestion: select the right amount per channel to reach 15%
  function smartSelect() {
    if (!data) return;
    const next = {};
    const toSelectPerChannel = {};

    for (const item of data) {
      if (item.stats.toDeclineCount > 0) {
        toSelectPerChannel[item.programme.name] = item.stats.toDeclineCount;
      }
    }

    // Group candidates by channel, spread across publishers
    const byChannel = {};
    for (const c of candidates) {
      if (!byChannel[c.programmeName]) byChannel[c.programmeName] = [];
      byChannel[c.programmeName].push(c);
    }

    for (const [channelName, needed] of Object.entries(toSelectPerChannel)) {
      const channelCandidates = byChannel[channelName] || [];
      // Sort by publisher to spread evenly
      const sorted = [...channelCandidates].sort((a, b) => a.publisherName.localeCompare(b.publisherName));
      let selected_count = 0;
      for (const c of sorted) {
        if (selected_count >= needed) break;
        next[c.id] = c;
        selected_count++;
      }
    }

    setSelected(next);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setResult(null);
    try {
      const items = Object.values(selected).map(c => ({
        advertiserId: c.advertiserId,
        transactionId: c.id,
      }));
      const res = await submitRefunds(items);
      setResult(res);
      if (res.success) setSelected({});
    } catch (e) {
      setResult({ success: false, error: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Remboursements</h1>
        <p className="text-slate-500 text-sm mt-1">Objectif : 15% de taux de remboursement par channel</p>
      </div>

      {/* Progress per channel */}
      <Card>
        <CardHeader title="Progression par channel" subtitle="Taux actuel vs objectif 15%" />
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.map(item => {
            const s = item.stats;
            const rate = s.refundRate;
            return (
              <div key={item.programme.id} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">{item.programme.name}</span>
                  <div className="flex items-center gap-2">
                    {s.toDeclineCount > 0 && (
                      <span className="text-xs text-orange-500 font-medium">−{s.toDeclineCount} restants</span>
                    )}
                    <span className={`text-xs font-semibold ${rate >= 15 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fmt(rate, 1)}%
                    </span>
                  </div>
                </div>
                <ProgressBar value={rate} showLabel={false} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Candidate table */}
      {candidates.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-slate-400">
            <p className="font-medium">Aucun candidat trouvé</p>
            <p className="text-sm mt-1">Transactions pending entre 40 et 90 € avec commission ~7%</p>
          </div>
        </Card>
      ) : (
        <Card>
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800">Candidats au remboursement</h2>
                {(() => {
                  const primary = candidates.filter(c => c.tier === 'primary').length;
                  const fallback = candidates.filter(c => c.tier === 'fallback').length;
                  return (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {candidates.length} transaction(s) · pending
                      {primary > 0 && ` · ${primary} à ~7%`}
                      {fallback > 0 && ` · ${fallback} à ≤6% (hors cashback)`}
                    </p>
                  );
                })()}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={smartSelect} className="text-sm font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-lg transition-colors">
                  ✦ Sélection intelligente
                </button>
                <button onClick={selectAll} className="text-sm text-slate-500 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-lg">
                  Tout sélectionner
                </button>
                <button onClick={clearAll} className="text-sm text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg">
                  Désélectionner
                </button>
                {selectedCount > 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    {submitting ? 'Envoi…' : `Rembourser ${selectedCount} transaction(s) — ${fmt(selectedCommission, 2)} €`}
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filterChannel}
                onChange={e => setFilterChannel(e.target.value)}
                className="border border-slate-200 text-slate-600 text-xs rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="all">Tous les channels</option>
                {channels.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterPublisher}
                onChange={e => setFilterPublisher(e.target.value)}
                className="border border-slate-200 text-slate-600 text-xs rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="">Tous les éditeurs</option>
                {publishers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="border border-slate-200 text-slate-600 text-xs rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="sale_desc">Vente ↓</option>
                <option value="sale_asc">Vente ↑</option>
                <option value="date_desc">Date récente</option>
                <option value="publisher">Éditeur A-Z</option>
              </select>
            </div>
          </div>

          {/* Result banner */}
          {result && (
            <div className={`px-5 py-3 text-sm font-medium border-b ${result.success ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {result.success ? (
                <span>✓ Remboursements soumis avec succès. Les données ont été mises à jour.</span>
              ) : (
                <div>
                  <p className="font-semibold">Erreur lors des remboursements :</p>
                  {result.error && <p className="text-xs mt-1 font-mono">{result.error}</p>}
                  {result.results?.map((r, i) => (
                    <div key={i} className="text-xs mt-1 font-mono">
                      {r.transactions?.map((t, j) => (
                        <p key={j}>
                          Transaction {t.transactionId} → HTTP {t.status} : {typeof t.data === 'string' ? t.data : JSON.stringify(t.data)}
                        </p>
                      ))}
                      {!r.transactions && <p>Advertiser {r.advertiserId} → {JSON.stringify(r)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(c => selected[c.id])}
                      onChange={e => e.target.checked ? selectAll() : clearAll()}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Channel</th>
                  <th className="px-4 py-3 font-semibold">Éditeur</th>
                  <th className="px-4 py-3 font-semibold">Réf. commande</th>
                  <th className="px-4 py-3 font-semibold text-right">Vente</th>
                  <th className="px-4 py-3 font-semibold text-right">Commission</th>
                  <th className="px-4 py-3 font-semibold text-right">Taux</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isSelected = !!selected[c.id];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => toggle(c)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="cursor-pointer accent-red-500" />
                      </td>
                      <td className="px-4 py-3">
                        <Badge color="blue">{c.programmeName.replace(' FR', ' 🇫🇷').replace(' DE', ' 🇩🇪').replace(' ES', ' 🇪🇸').replace(' NL', ' 🇳🇱').replace(' IT', ' 🇮🇹')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{c.publisherName}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.orderRef}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(c.saleAmount, 2)} {c.currency}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">{fmt(c.commissionAmount, 2)} {c.currency}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={c.tier === 'fallback' ? 'text-amber-500 font-medium' : 'text-slate-500'}>
                          {fmt(c.commissionRate, 1)}%
                        </span>
                        {c.tier === 'fallback' && (
                          <span className="ml-1 text-xs text-amber-400" title="Candidat de secours (≤6%)">↓</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{c.transactionDate?.slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          {selectedCount > 0 && (
            <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between text-sm">
              <p className="text-red-700">
                <strong>{selectedCount}</strong> transaction(s) sélectionnée(s) · Commission économisée : <strong>{fmt(selectedCommission, 2)} €</strong>
              </p>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
              >
                {submitting ? 'Envoi en cours…' : 'Confirmer les remboursements'}
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
