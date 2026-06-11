'use client';

import Link from 'next/link';
import { useData } from '@/app/context/DataContext';
import { KpiCard, Card, CardHeader, ProgressBar, EmptyState, LoadingSpinner, fmt } from './ui';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const STATUS_COLORS = { pending: '#f59e0b', approved: '#10b981', declined: '#ef4444' };

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

export default function DashboardView() {
  const { aggregated, loading, error } = useData();

  if (loading) return <LoadingSpinner message="Chargement des données Awin..." />;
  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5">{error}</div>
    </div>
  );
  if (!aggregated) return (
    <div className="p-8">
      <EmptyState icon="📊" message="Sélectionne une période et clique sur Charger" sub="Les données Awin apparaîtront ici" />
    </div>
  );

  const statusData = [
    { name: 'Approuvées', value: aggregated.approved },
    { name: 'En attente', value: aggregated.pending },
    { name: 'Remboursées', value: aggregated.declined },
  ].filter(d => d.value > 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vue globale</h1>
        <p className="text-slate-500 text-sm mt-1">Aperçu de l'ensemble des programmes Awin</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Transactions" value={fmt(aggregated.total)} />
        <KpiCard label="CA total" value={`${fmt(aggregated.totalSale, 0)} €`} />
        <KpiCard label="Commissions" value={`${fmt(aggregated.totalCommission, 2)} €`} color="blue" />
        <KpiCard label="Panier moyen" value={`${fmt(aggregated.avgBasket, 0)} €`} />
        <KpiCard label="Remboursées" value={fmt(aggregated.declined)} sub={`sur ${fmt(aggregated.total)}`} />
        <KpiCard
          label="Taux remb."
          value={`${fmt(aggregated.refundRate, 1)}%`}
          sub="Objectif : 15%"
          color={aggregated.refundRate >= 15 ? 'green' : 'red'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* CA by group */}
        <Card className="xl:col-span-2">
          <CardHeader title="CA par enseigne" subtitle="Chiffre d'affaires et commissions" />
          <div className="p-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregated.caByGroup} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ca" name="CA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="commission" name="Commission" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status pie */}
        <Card>
          <CardHeader title="Statut des transactions" />
          <div className="p-5 h-64 flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm">Aucune donnée</p>}
          </div>
        </Card>
      </div>

      {/* Refund progress + top publishers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Refund rates */}
        <Card>
          <CardHeader
            title="Taux de remboursement par enseigne"
            subtitle="Objectif : 15%"
            action={
              aggregated.toDeclineCount > 0 ? (
                <Link href="/refunds" className="text-xs font-semibold text-blue-600 hover:underline">
                  {aggregated.toDeclineCount} à rembourser →
                </Link>
              ) : (
                <span className="text-xs text-emerald-600 font-semibold">✓ Objectif atteint</span>
              )
            }
          />
          <div className="p-5 space-y-4">
            {Object.values(aggregated.byGroup).map(g => {
              const rate = g.total > 0 ? Math.round((g.declined / g.total) * 1000) / 10 : 0;
              return <ProgressBar key={g.group} label={g.group} value={rate} target={15} />;
            })}
          </div>
        </Card>

        {/* Top 5 publishers */}
        <Card>
          <CardHeader
            title="Top éditeurs"
            subtitle="Par commission générée"
            action={<Link href="/publishers" className="text-xs text-blue-600 hover:underline font-semibold">Voir tout →</Link>}
          />
          <div className="divide-y divide-slate-50">
            {aggregated.topPublishers.slice(0, 5).map((pub, i) => (
              <div key={pub.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-sm w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{pub.name}</p>
                    <p className="text-xs text-slate-400">{pub.transactions} transaction(s)</p>
                  </div>
                </div>
                <span className="font-semibold text-slate-700 text-sm">{fmt(pub.commission, 2)} €</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
