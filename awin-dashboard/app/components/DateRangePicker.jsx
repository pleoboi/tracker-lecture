'use client';

import { useState, useRef, useEffect } from 'react';

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fromIso(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function fmtShort(iso) {
  return fromIso(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

const todayIso = () => toIso(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return toIso(d); };
const monthStart = (offset=0) => { const d=new Date(); return toIso(new Date(d.getFullYear(), d.getMonth()+offset, 1)); };
const monthEnd   = (offset=0) => { const d=new Date(); return toIso(new Date(d.getFullYear(), d.getMonth()+offset+1, 0)); };

const QUICK = [
  { label: "Aujourd'hui",      fn: () => [todayIso(), todayIso()] },
  { label: 'Hier',             fn: () => [daysAgo(1), daysAgo(1)] },
  { label: '7 derniers jours', fn: () => [daysAgo(7), todayIso()] },
  { label: '30 derniers jours',fn: () => [daysAgo(30), todayIso()] },
  { label: 'Ce mois-ci',       fn: () => [monthStart(0), todayIso()] },
  { label: 'Mois dernier',     fn: () => [monthStart(-1), monthEnd(-1)] },
  { label: '3 derniers mois',  fn: () => [monthStart(-3), todayIso()] },
];

function CalendarGrid({ year, month, tmpStart, tmpEnd, hover, selecting, onDay }) {
  const todIso = todayIso();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  let startDow = first.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rawEnd = selecting === 'end' && hover ? hover : tmpEnd;
  const [rangeS, rangeE] = tmpStart && rawEnd
    ? (tmpStart <= rawEnd ? [tmpStart, rawEnd] : [rawEnd, tmpStart])
    : [null, null];

  return (
    <div className="grid grid-cols-7 gap-y-0.5">
      {DAYS_FR.map(d => (
        <div key={d} className="text-center text-xs text-slate-400 font-medium pb-1.5 pt-0.5">{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`e${i}`} className="h-8" />;
        const iso = toIso(new Date(year, month, day));
        const isFuture = iso > todIso;
        const isStart = iso === tmpStart;
        const isEnd   = rangeE && iso === rangeE;
        const inRange = rangeS && rangeE && iso > rangeS && iso < rangeE;
        const isToday = iso === todIso;

        return (
          <button
            key={iso}
            onClick={() => !isFuture && onDay(iso, false)}
            onMouseEnter={() => !isFuture && onDay(iso, true)}
            className={[
              'h-8 flex items-center justify-center text-xs rounded transition-colors select-none',
              isFuture ? 'text-slate-300 cursor-default' : 'cursor-pointer',
              isStart || isEnd ? 'bg-blue-600 text-white font-bold z-10' : '',
              inRange && !isStart && !isEnd ? 'bg-blue-100 text-blue-700 rounded-none' : '',
              !isStart && !isEnd && !inRange && !isFuture
                ? `hover:bg-slate-100 ${isToday ? 'font-bold text-blue-600' : 'text-slate-700'}` : '',
            ].filter(Boolean).join(' ')}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

export default function DateRangePicker({ startDate, endDate, onChange }) {
  const [open, setOpen]       = useState(false);
  const [tmpS, setTmpS]       = useState(startDate);
  const [tmpE, setTmpE]       = useState(endDate);
  const [selecting, setSel]   = useState('start');
  const [hover, setHover]     = useState(null);
  const [vy, setVy]           = useState(() => fromIso(startDate).getFullYear());
  const [vm, setVm]           = useState(() => fromIso(startDate).getMonth());

  const btnRef   = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  function openPicker() {
    setTmpS(startDate);
    setTmpE(endDate);
    setSel('start');
    setHover(null);
    const d = fromIso(startDate);
    setVy(d.getFullYear());
    setVm(d.getMonth());
    setOpen(true);
  }

  function onDay(iso, isHover) {
    if (isHover) { if (selecting === 'end') setHover(iso); return; }
    setHover(null);
    if (selecting === 'end') {
      if (iso < tmpS) { setTmpE(tmpS); setTmpS(iso); }
      else setTmpE(iso);
      setSel(null);
    } else {
      setTmpS(iso); setTmpE(null); setSel('end');
    }
  }

  function apply() {
    const s = tmpS, e = tmpE || tmpS;
    onChange({ start: s < e ? s : e, end: s < e ? e : s });
    setOpen(false);
  }

  function pickQuick(fn) {
    const [s, e] = fn();
    onChange({ start: s, end: e });
    setOpen(false);
  }

  function prevMonth() {
    if (vm === 0) { setVm(11); setVy(y => y-1); } else setVm(m => m-1);
  }
  function nextMonth() {
    if (vm === 11) { setVm(0); setVy(y => y+1); } else setVm(m => m+1);
  }

  function panelPos() {
    if (!btnRef.current) return { top: 16, left: 248 };
    const r = btnRef.current.getBoundingClientRect();
    const panelH = 400;
    const left = Math.round(r.right + 8);
    let top = Math.round(r.top);
    if (top + panelH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - panelH - 8);
    }
    return { top, left };
  }

  const label = startDate === endDate
    ? fmtShort(startDate)
    : `${fmtShort(startDate)} – ${fmtShort(endDate)}`;

  const footerLabel = selecting === 'end'
    ? 'Sélectionne la date de fin'
    : selecting === 'start'
    ? 'Sélectionne la date de début'
    : `${fmtShort(tmpS)} → ${fmtShort(tmpE || tmpS)}`;

  return (
    <div>
      <button
        ref={btnRef}
        onClick={openPicker}
        className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-2 text-left hover:border-blue-500 focus:outline-none focus:border-blue-500 transition-colors"
      >
        <span className="text-slate-400 mr-1.5">⬡</span>
        <span>{label}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{ ...panelPos(), position: 'fixed', zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex overflow-hidden"
          onMouseLeave={() => setHover(null)}
        >
          {/* Calendrier */}
          <div className="p-4 w-60">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 text-lg leading-none">‹</button>
              <span className="text-sm font-semibold text-slate-800">{MONTHS_FR[vm]} {vy}</span>
              <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 text-lg leading-none">›</button>
            </div>

            <CalendarGrid
              year={vy} month={vm}
              tmpStart={tmpS} tmpEnd={tmpE}
              hover={hover} selecting={selecting}
              onDay={onDay}
            />

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400 italic truncate">{footerLabel}</span>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => setOpen(false)} className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
                  Annuler
                </button>
                <button
                  onClick={apply}
                  disabled={!tmpS}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>

          {/* Raccourcis */}
          <div className="w-40 bg-slate-50 border-l border-slate-100 p-3 flex flex-col">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Raccourcis</p>
            <div className="space-y-0.5">
              {QUICK.map(q => {
                const [s, e] = q.fn();
                const active = s === startDate && e === endDate;
                return (
                  <button
                    key={q.label}
                    onClick={() => pickQuick(q.fn)}
                    className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
