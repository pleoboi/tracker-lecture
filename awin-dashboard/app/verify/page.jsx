'use client';

import { useState } from 'react';
import { PROGRAMMES } from '@/lib/programmes';

function statusColor(ok, total) {
  if (!ok) return 'bg-red-100 text-red-700';
  if (total > 2000) return 'bg-amber-100 text-amber-700';
  if (total === 0) return 'bg-slate-100 text-slate-400';
  return 'bg-emerald-50 text-emerald-700';
}

export default function VerifyPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [publisherId, setPublisherId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [programmes, setProgrammes] = useState(null);
  const [loadingProg, setLoadingProg] = useState(false);

  async function runScan() {
    setScanning(true);
    setResults(null);
    try {
      const res = await fetch(`/api/awin/scan?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setResults(data);
    } finally {
      setScanning(false);
    }
  }

  async function loadProgrammes() {
    if (!publisherId.trim()) return;
    setLoadingProg(true);
    setProgrammes(null);
    try {
      const res = await fetch(`/api/awin/programmes?publisherId=${publisherId.trim()}`);
      const data = await res.json();
      setProgrammes(data);
    } finally {
      setLoadingProg(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vérification des IDs de programmes</h1>
        <p className="text-slate-500 text-sm mt-1">Diagnostique les IDs incorrects en comparant les comptes de transactions Awin</p>
      </div>

      {/* Section 1: Scan des transactions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">1. Comptes de transactions par programme</h2>
        <p className="text-sm text-slate-500">Un programme avec un nombre anormalement élevé a probablement un mauvais ID. Handball-Store FR devrait avoir ~281 transactions.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Début</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-5 py-2 rounded-lg text-sm"
          >
            {scanning ? 'Scan en cours (~40s)…' : `Scanner ${PROGRAMMES.length} programmes`}
          </button>
        </div>

        {results && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Programme</th>
                  <th className="py-2 pr-4">ID Awin</th>
                  <th className="py-2 pr-4">Pays</th>
                  <th className="py-2 pr-4 text-right">Transactions</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {results.programmes?.map(p => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-800">{p.name}</td>
                    <td className="py-2 pr-4 font-mono text-slate-500">{p.id}</td>
                    <td className="py-2 pr-4 text-slate-500">{p.country}</td>
                    <td className="py-2 pr-4 text-right font-semibold">
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColor(p.ok, p.total)}`}>
                        {p.ok ? p.total.toLocaleString() : `Erreur ${p.status}`}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-slate-400">
                      {!p.ok && '❌ Accès refusé ou ID invalide'}
                      {p.ok && p.total > 2000 && '⚠️ Nombre suspect — probable mauvais ID'}
                      {p.ok && p.total === 0 && '○ Aucune transaction'}
                      {p.ok && p.total > 0 && p.total <= 2000 && '✓'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Découverte via API Awin */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">2. Récupérer les vrais IDs depuis Awin</h2>
        <p className="text-sm text-slate-500">
          Trouvez votre <strong>Publisher ID</strong> dans l'URL Awin :{' '}
          <code className="bg-slate-100 px-1 rounded text-xs">ui.awin.com/publisher/<strong>XXXXXX</strong>/...</code>
        </p>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Publisher ID Awin</label>
            <input
              type="text"
              value={publisherId}
              onChange={e => setPublisherId(e.target.value)}
              placeholder="ex: 123456"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40"
            />
          </div>
          <button
            onClick={loadProgrammes}
            disabled={loadingProg || !publisherId.trim()}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold px-5 py-2 rounded-lg text-sm"
          >
            {loadingProg ? 'Chargement…' : 'Récupérer les programmes'}
          </button>
        </div>

        {programmes && (
          <div>
            {programmes.error ? (
              <p className="text-red-600 text-sm">{programmes.error} — Vérifiez votre Publisher ID</p>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-3">
                  <strong>{programmes.total}</strong> programmes joints trouvés. Cherchez "Handball" pour identifier l'ID correct.
                </p>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-4">Nom</th>
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Pays</th>
                        <th className="py-2">Secteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programmes.programmes?.map(p => {
                        const isHandball = (p.name || '').toLowerCase().includes('handball');
                        return (
                          <tr key={p.id} className={`border-b border-slate-100 ${isHandball ? 'bg-yellow-50 font-semibold' : ''}`}>
                            <td className="py-2 pr-4 text-slate-800">{p.name} {isHandball && '⭐'}</td>
                            <td className="py-2 pr-4 font-mono text-blue-600">{p.id}</td>
                            <td className="py-2 pr-4 text-slate-500">{p.countryCode}</td>
                            <td className="py-2 text-slate-400 text-xs">{p.primarySector}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 space-y-2">
        <p className="font-semibold">Comment corriger un ID incorrect</p>
        <ol className="list-decimal list-inside space-y-1 text-amber-700">
          <li>Utilisez la section 2 pour récupérer tous vos vrais IDs depuis Awin</li>
          <li>Repérez le bon ID pour Handball-Store FR (surligné en jaune)</li>
          <li>Communiquez l'ID correct et il sera mis à jour dans <code className="bg-amber-100 px-1 rounded">lib/programmes.js</code></li>
        </ol>
      </div>
    </div>
  );
}
