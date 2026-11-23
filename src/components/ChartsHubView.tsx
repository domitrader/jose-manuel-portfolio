import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  PieChart,
  Trophy,
  ArrowDownUp,
  Briefcase,
  TrendingUp,
  Coins,
  Receipt,
} from 'lucide-react';
import { PositionItem } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import degiroDataRaw from '../data/degiroPositionsData.json';
import historicalAssetsRaw from '../data/historicalAssetStats.json';
import dividendsDataRaw from '../data/degiroDividendsData.json';

interface ChartsHubViewProps {
  positions: PositionItem[];
  activePortfolioName: string;
  hideFigures: boolean;
}

type ChartTab = 'ranking' | 'distribucion' | 'abiertas' | 'flujo';

interface HistoricalStat {
  isin: string;
  name: string;
  type: string;
  shares: number;
  realized_pnl: number;
  total_fees: number;
  trades_count: number;
  first_trade: string;
  last_trade: string;
  status: string;
}

const DEGIRO_SUMMARY = (degiroDataRaw as any).accountSummary || {};
const HISTORICAL_ASSETS = (Array.isArray(historicalAssetsRaw) ? historicalAssetsRaw : []) as HistoricalStat[];
const DIVIDENDS_ANNUAL = ((dividendsDataRaw as any).annualSummary || []) as {
  year: string;
  gross: number;
  tax: number;
  net: number;
  count: number;
}[];

export const ChartsHubView: React.FC<ChartsHubViewProps> = ({
  positions,
  activePortfolioName,
  hideFigures,
}) => {
  const [activeChart, setActiveChart] = useState<ChartTab>('ranking');
  const [rankFilter, setRankFilter] = useState<'all' | 'winners' | 'fees'>('all');

  // 1. Ranking histórico real de DEGIRO de José Manuel (12 activos auditados, 190 ops)
  const rankedHistorical = useMemo(() => {
    const list = [...HISTORICAL_ASSETS];
    if (rankFilter === 'winners') {
      return list.filter(a => a.realized_pnl !== 0).sort((a, b) => b.realized_pnl - a.realized_pnl);
    }
    if (rankFilter === 'fees') {
      return list.sort((a, b) => b.total_fees - a.total_fees);
    }
    return list.sort((a, b) => Math.abs(b.realized_pnl) - Math.abs(a.realized_pnl));
  }, [rankFilter]);

  // 2. Distribución en vivo (sincronizada con la cartera activa de José Manuel)
  const liveDistribution = useMemo(() => {
    const total = positions.reduce((acc, p) => acc + (p.totalValue || 0), 0) || 1;
    const typeColors: Record<string, string> = {
      Acciones: '#3B82F6',
      ETFs: '#10B981',
      Fondos: '#8B5CF6',
      Inmobiliario: '#F59E0B',
      Cripto: '#EC4899',
    };

    const byType = new Map<string, { label: string; value: number; color: string }>();
    const byBroker = new Map<string, number>();

    for (const p of positions) {
      const t = p.broker === 'Urbanitae' ? 'Inmobiliario' : p.type || 'Acciones';
      const prev = byType.get(t) || { label: t, value: 0, color: typeColors[t] || '#64748B' };
      prev.value += p.totalValue || 0;
      byType.set(t, prev);

      const br = p.broker || 'DEGIRO';
      byBroker.set(br, (byBroker.get(br) || 0) + (p.totalValue || 0));
    }

    const typeSlices = Array.from(byType.values())
      .map(s => ({ ...s, pct: (s.value / total) * 100 }))
      .sort((a, b) => b.value - a.value);

    const brokerSlices = Array.from(byBroker.entries())
      .map(([label, value]) => ({ label, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value);

    const topPositions = [...positions]
      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        name: p.name,
        ticker: p.ticker,
        broker: p.broker || 'DEGIRO',
        value: p.totalValue || 0,
        pct: ((p.totalValue || 0) / total) * 100,
      }));

    return { total, typeSlices, brokerSlices, topPositions };
  }, [positions]);

  // 3. Rentabilidad abierta en vivo por posición
  const openPerformance = useMemo(() => {
    return [...positions]
      .sort((a, b) => (b.unrealizedGainLoss || 0) - (a.unrealizedGainLoss || 0));
  }, [positions]);

  const maxAbsOpenPnl = useMemo(() => {
    return Math.max(...openPerformance.map(p => Math.abs(p.unrealizedGainLoss || 0)), 1);
  }, [openPerformance]);

  return (
    <div className="px-4 pb-8 space-y-4">
      {/* Cabecera de cartera analizada */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Zona de Gráficos · José Manuel
            </span>
            <span className="text-xs font-black text-[#081C3E] dark:text-white truncate block">
              {activePortfolioName} · DEGIRO Auditado
            </span>
          </div>
        </div>
        <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
          {DEGIRO_SUMMARY.totalTrades || 190} ops
        </span>
      </div>

      {/* Botonera de los 4 gráficos (siempre visible en 2 filas limpias) */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {(
          [
            { id: 'ranking', label: 'Top DEGIRO', icon: Trophy },
            { id: 'distribucion', label: 'Distribución', icon: PieChart },
            { id: 'abiertas', label: 'P/G Abierto', icon: BarChart3 },
            { id: 'flujo', label: 'Flujo y Div.', icon: ArrowDownUp },
          ] as const
        ).map(tab => {
          const Icon = tab.icon;
          const active = activeChart === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveChart(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all active:scale-95 ${
                active
                  ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-[0_4px_12px_rgba(2,132,199,0.35)]'
                  : 'bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 text-[#0B2246] dark:text-slate-200 hover:bg-sky-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== 1. TOP ACTIVOS DEGIRO (HISTÓRICO REAL JOSÉ MANUEL) ==================== */}
      {activeChart === 'ranking' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                Rendimiento Histórico DEGIRO
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                12 activos reales auditados · Beneficio cerrado +{formatEUR(DEGIRO_SUMMARY.historicoCerradoPnl || 8408.91, hideFigures)}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {(
              [
                { id: 'all', label: 'Todos (12)' },
                { id: 'winners', label: 'Con B/P' },
                { id: 'fees', label: 'Comisiones' },
              ] as const
            ).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRankFilter(f.id)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition ${
                  rankFilter === f.id
                    ? 'bg-[#081C3E] text-white dark:bg-white dark:text-slate-950'
                    : 'bg-sky-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 pt-1">
            {(() => {
              const maxVal =
                rankFilter === 'fees'
                  ? Math.max(...rankedHistorical.map(x => x.total_fees), 1)
                  : Math.max(...rankedHistorical.map(x => Math.abs(x.realized_pnl)), 1);

              return rankedHistorical.map(item => {
                const metric = rankFilter === 'fees' ? item.total_fees : item.realized_pnl;
                const wPct = Math.max(Math.round((Math.abs(metric) / maxVal) * 100), 3);
                const isWin = metric >= 0;

                return (
                  <div key={item.isin + item.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-extrabold text-[#081C3E] dark:text-white truncate block">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {item.trades_count} ops • {item.first_trade} → {item.last_trade} • {item.status}
                        </span>
                      </div>
                      <span
                        className={`font-black shrink-0 ${
                          rankFilter === 'fees'
                            ? 'text-amber-600 dark:text-amber-400'
                            : isWin
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {rankFilter === 'fees'
                          ? `-${formatEUR(item.total_fees, hideFigures)}`
                          : `${metric > 0 ? '+' : ''}${formatEUR(metric, hideFigures)}`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          rankFilter === 'fees'
                            ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                            : isWin
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                              : 'bg-gradient-to-r from-rose-400 to-rose-600'
                        }`}
                        style={{ width: `${wPct}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ==================== 2. DISTRIBUCIÓN EN VIVO ==================== */}
      {activeChart === 'distribucion' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
              Distribución en Vivo ({activePortfolioName})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Valor invertido actual: <strong>{formatEUR(liveDistribution.total, hideFigures)}</strong> · {positions.length} posiciones
            </p>
          </div>

          {/* Donut por clase de activo */}
          <div className="flex items-center gap-4">
            <svg className="w-28 h-28 -rotate-90 shrink-0" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" strokeWidth="4.5" className="dark:stroke-slate-800" />
              {(() => {
                let offset = 0;
                return liveDistribution.typeSlices.map(s => {
                  const el = (
                    <circle
                      key={s.label}
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={s.color}
                      strokeWidth="4.5"
                      strokeDasharray={`${s.pct} ${100 - s.pct}`}
                      strokeDashoffset={`-${offset}`}
                    />
                  );
                  offset += s.pct;
                  return el;
                });
              })()}
            </svg>
            <div className="flex-1 space-y-1.5 min-w-0">
              {liveDistribution.typeSlices.map(s => (
                <div key={s.label} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="font-bold text-[#081C3E] dark:text-slate-200 truncate">{s.label}</span>
                  </div>
                  <span className="font-black text-slate-700 dark:text-slate-300 shrink-0">
                    {s.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Desglose por Broker */}
          {liveDistribution.brokerSlices.length > 1 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Peso por Broker / Plataforma
              </h3>
              {liveDistribution.brokerSlices.map(b => (
                <div key={b.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-extrabold text-[#081C3E] dark:text-white">{b.label}</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {formatEUR(b.value, hideFigures)} ({b.pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600"
                      style={{ width: `${Math.max(b.pct, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Top 10 posiciones */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Principales Posiciones
            </h3>
            {liveDistribution.topPositions.map(pos => (
              <div key={pos.id} className="flex items-center justify-between text-xs gap-2 py-1">
                <div className="min-w-0">
                  <span className="font-bold text-[#081C3E] dark:text-white truncate block">{pos.name}</span>
                  <span className="text-[10px] text-slate-400">{pos.ticker} · {pos.broker}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-black text-[#081C3E] dark:text-white block">{formatEUR(pos.value, hideFigures)}</span>
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pos.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== 3. RENTABILIDAD ABIERTA EN VIVO ==================== */}
      {activeChart === 'abiertas' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                P/G Abierto por Posición ({activePortfolioName})
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ganancia o pérdida latente en tiempo real de tus posiciones abiertas
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>

          <div className="space-y-2.5">
            {openPerformance.map(pos => {
              const pnl = pos.unrealizedGainLoss || 0;
              const pct = pos.unrealizedGainLossPct || 0;
              const isPos = pnl >= 0;
              const wPct = Math.max(Math.round((Math.abs(pnl) / maxAbsOpenPnl) * 100), 3);

              return (
                <div key={pos.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-extrabold text-[#081C3E] dark:text-white truncate block">{pos.name}</span>
                      <span className="text-[10px] text-slate-500">
                        {pos.ticker} · {pos.broker || 'DEGIRO'} · Valor {formatEUR(pos.totalValue, hideFigures)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-black block ${isPos ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {pnl > 0 ? '+' : ''}{formatEUR(pnl, hideFigures)}
                      </span>
                      <span className={`text-[10px] font-bold ${isPos ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${wPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 4. FLUJO, COMISIONES Y DIVIDENDOS DEGIRO ==================== */}
      {activeChart === 'flujo' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                Flujo de Capital y Comisiones (DEGIRO)
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="fintech-card-blue rounded-2xl p-3 border border-sky-200/80 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Total Depositado</span>
                <span className="text-base font-black text-[#081C3E] dark:text-white">
                  {formatEUR(DEGIRO_SUMMARY.totalDeposited || 40000, hideFigures)}
                </span>
              </div>
              <div className="fintech-card-mint rounded-2xl p-3 border border-emerald-200/80 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Total Retirado</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                  +{formatEUR(DEGIRO_SUMMARY.totalWithdrawn || 18478.86, hideFigures)}
                </span>
              </div>
              <div className="fintech-card-mint rounded-2xl p-3 border border-emerald-200/80 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Beneficio Cerrado</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                  +{formatEUR(DEGIRO_SUMMARY.historicoCerradoPnl || 8408.91, hideFigures)}
                </span>
              </div>
              <div className="fintech-card-gold rounded-2xl p-3 border border-amber-200/80 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Comisiones Totales</span>
                <span className="text-base font-black text-amber-700 dark:text-amber-400">
                  -{formatEUR(DEGIRO_SUMMARY.totalComisiones || 509.53, hideFigures)}
                </span>
              </div>
            </div>
          </div>

          {DIVIDENDS_ANNUAL.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-black text-[#081C3E] dark:text-white">
                  Dividendos Netos Cobrados por Año
                </h3>
              </div>
              <div className="space-y-2.5">
                {(() => {
                  const maxDiv = Math.max(...DIVIDENDS_ANNUAL.map(d => d.net), 1);
                  return DIVIDENDS_ANNUAL.map(d => {
                    const wPct = Math.max(Math.round((d.net / maxDiv) * 100), 6);
                    return (
                      <div key={d.year} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-[#081C3E] dark:text-white">
                            {d.year} <span className="text-[10px] font-semibold text-slate-400">({d.count} pagos)</span>
                          </span>
                          <span className="font-black text-emerald-700 dark:text-emerald-400">
                            +{formatEUR(d.net, hideFigures)}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                            style={{ width: `${wPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
