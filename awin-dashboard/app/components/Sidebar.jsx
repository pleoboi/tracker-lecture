'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useData } from '@/app/context/DataContext';
import { GROUPS, getProgrammesByGroup } from '@/lib/programmes';
import DateRangePicker from './DateRangePicker';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/channels', label: 'Channels', icon: '≡' },
  { href: '/publishers', label: 'Éditeurs', icon: '◈' },
  { href: '/refunds', label: 'Remboursements', icon: '↩' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { filters, setFilters, loadData, loading, aggregated } = useData();

  function handleLoad() {
    loadData(filters);
  }

  const count = getProgrammesByGroup(filters.group).length;
  const batches = Math.ceil(count / 5);
  const batchDelay = filters.group === 'all' ? 10 : 4;
  const estSeconds = batches > 1 ? (batches - 1) * batchDelay + 5 : 5;

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-700">
        <p className="text-white font-bold text-lg leading-tight">Awin Hub</p>
        <p className="text-slate-400 text-xs mt-0.5">Team All-Play</p>
      </div>

      {/* Nav */}
      <nav className="px-3 py-4 flex-1">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-2 mb-2">Navigation</p>
        {NAV.map(item => {
          const isActive = pathname === item.href;
          const hasBadge = item.href === '/refunds' && aggregated?.toDeclineCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                {item.label}
              </span>
              {hasBadge && (
                <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {aggregated.toDeclineCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Filters */}
      <div className="px-4 py-4 border-t border-slate-700 space-y-3">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Filtres</p>
        <div className="space-y-2">
          <DateRangePicker
            startDate={filters.startDate}
            endDate={filters.endDate}
            onChange={({ start, end }) => setFilters(f => ({ ...f, startDate: start, endDate: end }))}
          />
          <select
            value={filters.group}
            onChange={e => setFilters(f => ({ ...f, group: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tous les programmes</option>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <button
          onClick={handleLoad}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-blue-400 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Chargement...' : `Charger (${count} prog.)`}
        </button>
        {loading && (
          <p className="text-slate-500 text-xs text-center">~{estSeconds}s</p>
        )}
      </div>
    </aside>
  );
}
