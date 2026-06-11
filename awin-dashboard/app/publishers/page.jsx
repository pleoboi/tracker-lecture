'use client';

import { useState } from 'react';
import { useData } from '@/app/context/DataContext';
import { Card, CardHeader, EmptyState, LoadingSpinner, fmt, Badge } from '@/app/components/ui';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const DEFAULT_COMMISSION = 7;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>Commission : {fmt(p.value, 2)} €</p>
      ))}
    </div>
  );
}

export default function PublishersPage() {
  const { aggregated, loading, error } = useData();
  const [tab, setTab] = useState('top');
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION);
  const [copiedId, setCopiedId] = useState(null);

  if (loading) return <LoadingSpinner message="Chargement..." />;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!aggregated) return (
    <div className="p-8">
      <EmptyState icon="◈" message="Aucune donnée chargée" sub="Utilise les filtres dans la barre latérale" />
    </div>
  );

  const { topPublishers, recruitmentSuggestions } = aggregated;
  const top10 = topPublishers.slice(0, 10);

  function copyPublisherId(id) {
    navigator.clipboard?.writeText(String(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Éditeurs</h1>
        <p className="text-slate-500 text-sm mt-1">Performance et recrutement</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { key: 'top', label: `Top éditeurs (${topPublishers.length})` },
          { key: 'recruit', label: `Recrutement (${recruitmentSuggestions.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'top' && (
        <div className="space-y-4">
          {/* Chart */}
          <Card>
            <CardHeader title="Top 10 éditeurs" subtitle="Par commission générée sur la période" />
            <div className="p-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10.map(p => ({ name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name, commission: Math.round(p.commission * 100) / 100 }))} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v} €`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={140} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="commission" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Full table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 font-semibold w-8">#</th>
                    <th className="px-4 py-3 font-semibold">Éditeur</th>
                    <th className="px-4 py-3 font-semibold text-right">Transactions</th>
                    <th className="px-4 py-3 font-semibold text-right">Commissions</th>
                    <th className="px-4 py-3 font-semibold">Programmes actifs</th>
                  </tr>
                </thead>
                <tbody>
                  {topPublishers.map((pub, i) => (
                    <tr key={pub.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{pub.name}</p>
                        <p className="text-xs text-slate-400">ID : {pub.id}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmt(pub.transactions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-purple-600">{fmt(pub.commission, 2)} €</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {pub.programmes.slice(0, 4).map(p => (
                            <Badge key={p} color="blue">{p.replace(' FR', '').replace(' DE', '').replace(' ES', '').replace(' NL', '').replace(' IT', '')}</Badge>
                          ))}
                          {pub.programmes.length > 4 && <Badge color="slate">+{pub.programmes.length - 4}</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'recruit' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Recommandations de recrutement"
              subtitle="Éditeurs actifs dans certains programmes mais absents d'autres — triés par commission potentielle"
              action={
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Commission proposée</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={commissionRate}
                      onChange={e => setCommissionRate(Number(e.target.value))}
                      min={1} max={30} step={0.5}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                </div>
              }
            />
            {recruitmentSuggestions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Charge plusieurs groupes de programmes pour voir les recommandations de recrutement.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3 font-semibold">Éditeur</th>
                      <th className="px-4 py-3 font-semibold">Actif sur</th>
                      <th className="px-4 py-3 font-semibold">À recruter sur</th>
                      <th className="px-4 py-3 font-semibold text-right">Commission actuelle</th>
                      <th className="px-4 py-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recruitmentSuggestions.map(pub => (
                      <tr key={pub.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{pub.name}</p>
                          <p className="text-xs text-slate-400">ID : {pub.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {pub.presentGroups.map(g => <Badge key={g} color="green">{g}</Badge>)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {pub.missingGroups.map(g => <Badge key={g} color="orange">{g}</Badge>)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-purple-600">
                          {fmt(pub.commission, 2)} €
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-center">
                            <a
                              href={`https://ui.awin.com/merchant/publisher-management`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Inviter sur Awin
                            </a>
                            <button
                              onClick={() => copyPublisherId(pub.id)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              {copiedId === pub.id ? '✓ Copié' : 'Copier l\'ID'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Comment inviter un éditeur ?</p>
            <p>Sur Awin, va dans <strong>Publisher Management → Invite Publisher</strong>, saisis l'ID de l'éditeur et configure le taux de commission ({commissionRate}%). L'éditeur recevra une invitation automatique.</p>
          </div>
        </div>
      )}
    </div>
  );
}
