'use client';

import { useState } from 'react';
import { useData } from '@/app/context/DataContext';
import { Card, CardHeader, ProgressBar, EmptyState, LoadingSpinner, fmt, Badge } from '@/app/components/ui';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value, 0)}{p.name === 'CA' || p.name === 'Commission' ? ' €' : ''}
        </p>
      ))}
    </div>
  );
}

export default function ChannelsPage() {
  const { data, aggregated, loading, error } = useData();
  const [view, setView] = useState('table');
  const [selectedGroup, setSelectedGroup] = useState('all');

  if (loading) return <LoadingSpinner message="Chargement..." />;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return (
    <div className="p-8">
      <EmptyState icon="≡" message="Aucune donnée chargée" sub="Utilise les filtres dans la barre latérale" />
    </div>
  );

  const groups = [...new Set(data.map(d => d.programme.group))];
  const filtered = selectedGroup === 'all' ? data : data.filter(d => d.programme.group === selectedGroup);

  const chartData = filtered
    .filter(d => d.stats.totalSale > 0)
    .map(d => ({
      name: d.programme.name.replace(d.programme.group + ' ', ''),
      fullName: d.programme.name,
      ca: Math.round(d.stats.totalSale),
      commission: Math.round(d.stats.totalCommission),
      transactions: d.stats.total,
    }))
    .sort((a, b) => b.ca - a.ca);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Channels</h1>
          <p className="text-slate-500 text-sm mt-1">Détail par programme Awin</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Toutes les enseignes</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="flex bg-slate-100 rounded-lg p-1">
            {['table', 'chart'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                {v === 'table' ? '≡ Tableau' : '▦ Graphique'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'chart' && chartData.length > 0 && (
        <Card>
          <CardHeader title="CA et commissions par channel" />
          <div className="p-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v.toLocaleString('fr')} €`} />
                <YAxis type="category" dataKey="fullName" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ca" name="CA" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="commission" name="Commission" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {view === 'table' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 font-semibold">Channel</th>
                  <th className="px-4 py-3 font-semibold text-right">Transactions</th>
                  <th className="px-4 py-3 font-semibold text-right">CA</th>
                  <th className="px-4 py-3 font-semibold text-right">Commissions</th>
                  <th className="px-4 py-3 font-semibold text-right">Panier moy.</th>
                  <th className="px-4 py-3 font-semibold text-right">Remboursées</th>
                  <th className="px-4 py-3 font-semibold">Taux remb.</th>
                  <th className="px-4 py-3 font-semibold text-center">Manque</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const s = item.stats;
                  const isOk = s.refundRate >= 15;
                  return (
                    <tr key={item.programme.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{item.programme.name}</p>
                          <p className="text-xs text-slate-400">{item.programme.country} · {item.programme.currency}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmt(s.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">{fmt(s.totalSale, 0)} {item.programme.currency}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(s.totalCommission, 2)} {item.programme.currency}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.avgBasket, 0)} {item.programme.currency}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.declined)}</td>
                      <td className="px-4 py-3">
                        <ProgressBar value={s.refundRate} showLabel={false} />
                        <p className={`text-xs font-semibold mt-1 ${isOk ? 'text-emerald-600' : 'text-red-500'}`}>
                          {fmt(s.refundRate, 1)}%
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.toDeclineCount > 0 ? (
                          <Badge color="orange">-{s.toDeclineCount}</Badge>
                        ) : (
                          <Badge color="green">✓</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
