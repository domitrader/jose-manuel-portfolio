import React, { useEffect, useMemo, useState } from 'react';
import {
  Flame,
  BarChart3,
  PieChart,
  Trophy,
  ArrowDownUp,
  Briefcase,
  TrendingUp,
  Coins,
  Receipt,
  Wallet,
} from 'lucide-react';
import { PositionItem } from '../types/portfolio';
import { formatEUR } from '../utils/calculations';
import degiroDataRaw from '../data/degiroPositionsData.json';
import degiroChartsDataRaw from '../data/degiroChartsData.json';
import dividendsDataRaw from '../data/degiroDividendsData.json';

interface ChartsHubViewProps {
  positions: PositionItem[];
  activePortfolioId: string;
  activePortfolioName: string;
  activeBrokerLogo?: string | null;
  activeCash: number;
  hideFigures: boolean;
}

type DegiroChartTab = 'heatmap' | 'rendimiento' | 'ranking' | 'distribucion' | 'flujo';
type BrokerChartTab = 'distribucion' | 'abiertas' | 'ranking' | 'capital';
type PeriodGranularity = 'years' | 'months' | 'weeks';

interface MonthEntry {
  m: number;
  netPnl: number;
  fees: number;
  trades: number;
  roiPct: number;
}

interface YearEntry {
  year: number;
  netPnl: number;
  fees: number;
  trades: number;
  deposits: number;
  withdrawals: number;
  netCashFlow: number;
  peakCapital: number;
  roiPct: number;
  months: MonthEntry[];
}

interface WeekEntry {
  w: string;
  label: string;
  netPnl: number;
  fees: number;
  trades: number;
}

interface RankAsset {
  id: string;
  name: string;
  exchange: string;
  netPnl: number;
  fees: number;
  trades: number;
  isOpen: boolean;
}

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const DEGIRO_SUMMARY = (degiroDataRaw as any).accountSummary || {};
const DEGIRO_CHARTS = degiroChartsDataRaw as {
  yearly: YearEntry[];
  weeklyByYear: Record<string, WeekEntry[]>;
  topWinners: RankAsset[];
  topLosers: RankAsset[];
};
const DEGIRO_HEATMAP_YEARS = DEGIRO_CHARTS.yearly;
const DIVIDENDS_DATA = dividendsDataRaw as {
  annualSummary?: { year: string; gross: number; tax: number; net: number; count: number }[];
  payments?: { date: string; year: string; month: string; product: string; net: number; broker?: string }[];
};

function heatColor(val: number, mode: 'pct' | 'eur'): string {
  if (Math.abs(val) < 0.01) {
    return 'bg-slate-100 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500';
  }
  if (val > 0) {
    const strong = mode === 'pct' ? val >= 5 : val >= 1500;
    const med = mode === 'pct' ? val >= 0.8 : val >= 250;
    if (strong) return 'bg-emerald-600 text-white shadow-xs';
    if (med) return 'bg-emerald-500/85 text-white';
    return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300';
  }
  const strong = mode === 'pct' ? val <= -5 : val <= -1500;
  const med = mode === 'pct' ? val <= -0.8 : val <= -250;
  if (strong) return 'bg-rose-600 text-white shadow-xs';
  if (med) return 'bg-rose-500/85 text-white';
  return 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300';
}

export const ChartsHubView: React.FC<ChartsHubViewProps> = ({
  positions,
  activePortfolioId,
  activePortfolioName,
  activeBrokerLogo,
  activeCash,
  hideFigures,
}) => {
  // ESTRICTO AISLAMIENTO: La interfaz histórica DEGIRO (Mapa de Calor, 190 ops, Flujo DEGIRO) SOLO se muestra en la cartera DEGIRO
  const isDegiroOnly = activePortfolioId === 'degiro';
  const isConsolidated = !activePortfolioId || activePortfolioId === 'todas';

  const [degiroTab, setDegiroTab] = useState<DegiroChartTab>('heatmap');
  const [brokerTab, setBrokerTab] = useState<BrokerChartTab>('distribucion');
  const [heatMode, setHeatMode] = useState<'pct' | 'eur'>('pct');
  const [selectedCell, setSelectedCell] = useState<{
    year: number;
    m: number;
    netPnl: number;
    fees: number;
    trades: number;
    roiPct: number;
  } | null>(null);
  const [rankMode, setRankMode] = useState<'winners' | 'losers'>('winners');
  const [perfGranularity, setPerfGranularity] = useState<PeriodGranularity>('years');
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Al cambiar de cartera, limpiar celda seleccionada y resetear pestaña apropiada
  useEffect(() => {
    setSelectedCell(null);
    setRankMode('winners');
    if (isDegiroOnly) {
      setDegiroTab('heatmap');
    } else {
      setBrokerTab('distribucion');
    }
  }, [activePortfolioId, isDegiroOnly]);

  // Distribución en vivo (100% exclusiva de las posiciones de ESTA cartera)
  const liveDistribution = useMemo(() => {
    const total = positions.reduce((acc, p) => acc + (p.totalValue || 0), 0);
    const safeTotal = total || 1;
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

      const br = p.broker || activePortfolioName || 'Cartera';
      byBroker.set(br, (byBroker.get(br) || 0) + (p.totalValue || 0));
    }

    const typeSlices = Array.from(byType.values())
      .map(s => ({ ...s, pct: (s.value / safeTotal) * 100 }))
      .sort((a, b) => b.value - a.value);

    const brokerSlices = Array.from(byBroker.entries())
      .map(([label, value]) => ({ label, value, pct: (value / safeTotal) * 100 }))
      .sort((a, b) => b.value - a.value);

    const topPositions = [...positions]
      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
      .slice(0, 12)
      .map(p => ({
        id: p.id,
        name: p.name,
        ticker: p.ticker,
        broker: p.broker || activePortfolioName,
        value: p.totalValue || 0,
        pct: ((p.totalValue || 0) / safeTotal) * 100,
      }));

    return { total, typeSlices, brokerSlices, topPositions };
  }, [positions, activePortfolioName]);

  // Métricas en vivo exclusivas de ESTA cartera (para MyInvestor, BBVA, Kraken, Urbanitae, Todas)
  const brokerCapitalSummary = useMemo(() => {
    const marketValue = positions.reduce((acc, p) => acc + (p.totalValue || 0), 0);
    const costBasis = positions.reduce((acc, p) => acc + (p.shares * p.avgPrice || 0), 0);
    const unrealized = positions.reduce((acc, p) => acc + (p.unrealizedGainLoss || 0), 0);
    const unrealizedPct = costBasis > 0 ? (unrealized / costBasis) * 100 : 0;
    const winnersCount = positions.filter(p => (p.unrealizedGainLoss || 0) >= 0).length;
    const losersCount = positions.length - winnersCount;
    return {
      marketValue,
      costBasis,
      unrealized,
      unrealizedPct,
      totalWithCash: marketValue + activeCash,
      winnersCount,
      losersCount,
    };
  }, [positions, activeCash]);

  // Ranking en vivo para carteras NO-DEGIRO (MyInvestor, BBVA, Kraken, Urbanitae, Todas)
  const brokerRanking = useMemo(() => {
    const list = [...positions];
    if (rankMode === 'winners') {
      return list.sort((a, b) => (b.unrealizedGainLoss || 0) - (a.unrealizedGainLoss || 0));
    }
    return list.sort((a, b) => (a.unrealizedGainLoss || 0) - (b.unrealizedGainLoss || 0));
  }, [positions, rankMode]);

  // Ranking histórico DEGIRO auditado (solo usado cuando isDegiroOnly === true)
  const degiroTopWinners = DEGIRO_CHARTS.topWinners;
  const degiroTopLosers = DEGIRO_CHARTS.topLosers;

  // Barras de rendimiento DEGIRO (Años / Meses / Semanas)
  const degiroBarSeries = useMemo(() => {
    if (perfGranularity === 'years') {
      return DEGIRO_HEATMAP_YEARS.map(y => ({
        key: String(y.year),
        label: String(y.year),
        val: y.netPnl,
        sub: `${y.trades} ops · ${y.roiPct > 0 ? '+' : ''}${y.roiPct.toFixed(2)}%`,
      }));
    }
    if (perfGranularity === 'months') {
      const yr = DEGIRO_HEATMAP_YEARS.find(y => y.year === selectedYear) || DEGIRO_HEATMAP_YEARS[0];
      return yr.months.map(mo => ({
        key: `${yr.year}-${mo.m}`,
        label: MONTHS_SHORT[mo.m - 1],
        val: mo.netPnl,
        sub: mo.trades > 0 ? `${mo.trades} ops · comis. ${mo.fees.toFixed(2)}€` : 'Sin operaciones',
      }));
    }
    const wks = DEGIRO_CHARTS.weeklyByYear[String(selectedYear)] || [];
    return wks.map(w => ({
      key: `${selectedYear}-${w.w}`,
      label: `${w.w} (${w.label})`,
      val: w.netPnl,
      sub: `${w.trades} ops · comis. ${w.fees.toFixed(2)}€`,
    }));
  }, [perfGranularity, selectedYear]);

  const maxDegiroBar = useMemo(
    () => Math.max(...degiroBarSeries.map(b => Math.abs(b.val)), 1),
    [degiroBarSeries]
  );

  // ==================== VISTA A: INTERFAZ EXCLUSIVA DEGIRO (IDÉNTICA A DOMINGO, CON DATOS DE JOSÉ MANUEL) ====================
  if (isDegiroOnly) {
    return (
      <div className="px-4 pb-8 space-y-4">
        {/* Cabecera DEGIRO */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeBrokerLogo ? (
              <span className="inline-flex items-center bg-sky-50/80 dark:bg-white px-2 py-1 rounded-xl border border-sky-100 shrink-0">
                <img src={activeBrokerLogo} alt="DEGIRO" className="h-4 w-auto object-contain" />
              </span>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Cartera Analizada
              </span>
              <span className="text-xs font-black text-[#081C3E] dark:text-white truncate block">
                DEGIRO · José Manuel (2022–2026)
              </span>
            </div>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
            {DEGIRO_SUMMARY.totalTrades || 190} ops
          </span>
        </div>

        {/* 5 botones idénticos a Domingo (siempre visibles en 2 filas) */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          {(
            [
              { id: 'heatmap', label: 'Mapa de Calor', icon: Flame },
              { id: 'rendimiento', label: 'Rendimiento', icon: BarChart3 },
              { id: 'ranking', label: 'Top Activos', icon: Trophy },
              { id: 'distribucion', label: 'Distribución', icon: PieChart },
              { id: 'flujo', label: 'Flujo y Comis.', icon: ArrowDownUp },
            ] as const
          ).map(tab => {
            const Icon = tab.icon;
            const active = degiroTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDegiroTab(tab.id)}
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

        {/* 1. MAPA DE CALOR MENSUAL (2026 -> 2022) */}
        {degiroTab === 'heatmap' && (
          <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                  Mapa de Calor Mensual
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Rendimiento neto real DEGIRO (comisiones descontadas) · 2026 → 2022
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-sky-50 dark:bg-slate-800 p-0.5 border border-sky-200/80 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setHeatMode('pct')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition ${
                    heatMode === 'pct'
                      ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-white shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setHeatMode('eur')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition ${
                    heatMode === 'eur'
                      ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-white shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  €
                </button>
              </div>
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-separate border-spacing-1 text-[10px]">
                <thead>
                  <tr>
                    <th className="text-left font-black text-slate-500 px-1 py-1">Año</th>
                    {MONTHS_SHORT.map(m => (
                      <th key={m} className="text-center font-bold text-slate-500 py-1">
                        {m}
                      </th>
                    ))}
                    <th className="text-right font-black text-[#081C3E] dark:text-white px-1 py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {DEGIRO_HEATMAP_YEARS.map(yr => {
                    const yrVal = heatMode === 'pct' ? yr.roiPct : yr.netPnl;
                    return (
                      <tr key={yr.year}>
                        <td className="font-black text-[#081C3E] dark:text-white px-1 py-1 whitespace-nowrap">
                          {yr.year}
                        </td>
                        {yr.months.map(mo => {
                          const val = heatMode === 'pct' ? mo.roiPct : mo.netPnl;
                          const isSelected = selectedCell?.year === yr.year && selectedCell?.m === mo.m;
                          return (
                            <td key={mo.m} className="p-0">
                              <button
                                type="button"
                                onClick={() => setSelectedCell({ year: yr.year, ...mo })}
                                className={`w-full min-w-[34px] py-1.5 px-0.5 rounded-lg font-extrabold text-[9px] text-center transition-all ${heatColor(
                                  val,
                                  heatMode
                                )} ${isSelected ? 'ring-2 ring-sky-500 scale-105' : ''}`}
                              >
                                {Math.abs(val) < 0.01
                                  ? '—'
                                  : heatMode === 'pct'
                                    ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%`
                                    : `${val > 0 ? '+' : ''}${Math.round(val)}`}
                              </button>
                            </td>
                          );
                        })}
                        <td className="text-right pl-1">
                          <span
                            className={`inline-block px-1.5 py-1 rounded-lg font-black text-[9px] whitespace-nowrap ${heatColor(
                              yrVal,
                              heatMode
                            )}`}
                          >
                            {Math.abs(yrVal) < 0.01
                              ? '0'
                              : heatMode === 'pct'
                                ? `${yrVal > 0 ? '+' : ''}${yrVal.toFixed(1)}%`
                                : `${yrVal > 0 ? '+' : ''}${Math.round(yrVal).toLocaleString('es-ES')}€`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedCell && (
              <div className="bg-sky-50/80 dark:bg-slate-800/80 border border-sky-200/80 dark:border-slate-700 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-black text-[#081C3E] dark:text-white block">
                    {MONTHS_SHORT[selectedCell.m - 1]} {selectedCell.year}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {selectedCell.trades} operaciones auditadas
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`font-black block ${
                      selectedCell.netPnl >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
                    }`}
                  >
                    {selectedCell.netPnl > 0 ? '+' : ''}
                    {formatEUR(selectedCell.netPnl, hideFigures)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {selectedCell.roiPct > 0 ? '+' : ''}
                    {selectedCell.roiPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. RENDIMIENTO POR AÑOS / MESES / SEMANAS */}
        {degiroTab === 'rendimiento' && (
          <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                  Rendimiento Real DEGIRO
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Beneficio neto por {perfGranularity === 'years' ? 'año (2022–2026)' : perfGranularity === 'months' ? `meses de ${selectedYear}` : `semanas de ${selectedYear}`}
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-sky-50 dark:bg-slate-800 p-0.5 border border-sky-200/80 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setPerfGranularity('years')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                    perfGranularity === 'years' ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Años
                </button>
                <button
                  type="button"
                  onClick={() => setPerfGranularity('months')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                    perfGranularity === 'months' ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Meses
                </button>
                <button
                  type="button"
                  onClick={() => setPerfGranularity('weeks')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                    perfGranularity === 'weeks' ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Semanas
                </button>
              </div>
            </div>

            {perfGranularity !== 'years' && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {DEGIRO_HEATMAP_YEARS.map(y => (
                  <button
                    key={y.year}
                    type="button"
                    onClick={() => setSelectedYear(y.year)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition ${
                      selectedYear === y.year
                        ? 'bg-[#081C3E] text-white dark:bg-white dark:text-slate-950'
                        : 'bg-sky-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {y.year}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              {degiroBarSeries.map(item => {
                const isPos = item.val >= 0;
                const wPct = Math.max(Math.round((Math.abs(item.val) / maxDegiroBar) * 100), 2);
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-black text-[#081C3E] dark:text-white">{item.label}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{item.sub}</span>
                      </div>
                      <span
                        className={`font-black ${
                          Math.abs(item.val) < 0.01
                            ? 'text-slate-400'
                            : isPos
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-600'
                        }`}
                      >
                        {item.val > 0 ? '+' : ''}
                        {formatEUR(item.val, hideFigures)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          Math.abs(item.val) < 0.01
                            ? 'bg-slate-200 dark:bg-slate-700'
                            : isPos
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                              : 'bg-gradient-to-r from-rose-400 to-rose-600'
                        }`}
                        style={{ width: `${wPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. TOP ACTIVOS DEGIRO (GANADORAS / PERDEDORAS) */}
        {degiroTab === 'ranking' && (
          <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                  Top Activos Históricos DEGIRO
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Beneficio neto realizado auditado (190 operaciones)
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-sky-50 dark:bg-slate-800 p-0.5 border border-sky-200/80 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setRankMode('winners')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                    rankMode === 'winners' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Ganadoras
                </button>
                <button
                  type="button"
                  onClick={() => setRankMode('losers')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                    rankMode === 'losers' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Perdedoras
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {(() => {
                const list = rankMode === 'winners' ? degiroTopWinners : degiroTopLosers;
                if (list.length === 0) {
                  return <p className="text-xs text-slate-400 text-center py-4">Sin activos en esta categoría.</p>;
                }
                const maxVal = Math.max(...list.map(x => Math.abs(x.netPnl)), 1);
                return list.map(item => {
                  const wPct = Math.max(Math.round((Math.abs(item.netPnl) / maxVal) * 100), 4);
                  const isWin = item.netPnl >= 0;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-extrabold text-[#081C3E] dark:text-white truncate block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.exchange} • {item.trades} ops • Comis. {formatEUR(item.fees, hideFigures)} • {item.isOpen ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>
                        <span className={`font-black shrink-0 ${isWin ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {item.netPnl > 0 ? '+' : ''}
                          {formatEUR(item.netPnl, hideFigures)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isWin ? 'bg-emerald-500' : 'bg-rose-500'}`}
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

        {/* 4. DISTRIBUCIÓN EN VIVO DEGIRO */}
        {degiroTab === 'distribucion' && (
          <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                Distribución en Vivo · DEGIRO
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Valor actual en DEGIRO: <strong>{formatEUR(liveDistribution.total, hideFigures)}</strong> · {positions.length} posiciones
              </p>
            </div>

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

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {liveDistribution.topPositions.map(pos => (
                <div key={pos.id} className="flex items-center justify-between text-xs gap-2 py-1">
                  <div className="min-w-0">
                    <span className="font-bold text-[#081C3E] dark:text-white truncate block">{pos.name}</span>
                    <span className="text-[10px] text-slate-400">{pos.ticker}</span>
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

        {/* 5. FLUJO Y COMISIONES DEGIRO */}
        {degiroTab === 'flujo' && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                  Flujo de Capital y Comisiones · DEGIRO
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
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Comisiones DEGIRO</span>
                  <span className="text-base font-black text-amber-700 dark:text-amber-400">
                    -{formatEUR(DEGIRO_SUMMARY.totalComisiones || 509.53, hideFigures)}
                  </span>
                </div>
              </div>
            </div>

            {DIVIDENDS_DATA.annualSummary && DIVIDENDS_DATA.annualSummary.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-black text-[#081C3E] dark:text-white">
                    Dividendos Netos Cobrados por Año
                  </h3>
                </div>
                <div className="space-y-2">
                  {DIVIDENDS_DATA.annualSummary.map(d => (
                    <div key={d.year} className="flex items-center justify-between text-xs bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl px-3 py-2 border border-emerald-200/60 dark:border-emerald-900/50">
                      <span className="font-black text-[#081C3E] dark:text-white">
                        {d.year} <span className="text-[10px] font-semibold text-slate-500">({d.count} pagos)</span>
                      </span>
                      <span className="font-black text-emerald-700 dark:text-emerald-400">
                        +{formatEUR(d.net, hideFigures)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==================== VISTA B: CARTERAS INDEPENDIENTES (MyInvestor, BBVA, Kraken, Urbanitae, Todas) — CERO DATOS DE DEGIRO ====================
  return (
    <div className="px-4 pb-8 space-y-4">
      {/* Cabecera exclusiva de ESTA cartera (con su propio logo oficial, cero menciones a DEGIRO) */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {activeBrokerLogo ? (
            <span className="inline-flex items-center bg-sky-50/80 dark:bg-white px-2.5 py-1 rounded-xl border border-sky-100 shrink-0">
              <img src={activeBrokerLogo} alt={activePortfolioName} className="h-4 w-auto object-contain max-w-[92px]" />
            </span>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Gráficos Exclusivos
            </span>
            <span className="text-xs font-black text-[#081C3E] dark:text-white truncate block">
              {activePortfolioName} · José Manuel
            </span>
          </div>
        </div>
        <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 shrink-0">
          {positions.length} activos
        </span>
      </div>

      {/* 4 pestañas propias de esta cartera (sin datos de DEGIRO) */}
      <div className="flex flex-wrap gap-1.5 pb-1">
        {(
          [
            { id: 'distribucion', label: 'Distribución', icon: PieChart },
            { id: 'abiertas', label: 'Rentabilidad P/G', icon: BarChart3 },
            { id: 'ranking', label: 'Top Posiciones', icon: Trophy },
            { id: 'capital', label: 'Capital', icon: Wallet },
          ] as const
        ).map(tab => {
          const Icon = tab.icon;
          const active = brokerTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBrokerTab(tab.id)}
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

      {/* 1. DISTRIBUCIÓN EXCLUSIVA DE ESTA CARTERA */}
      {brokerTab === 'distribucion' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
              Distribución · {activePortfolioName}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Valor invertido: <strong>{formatEUR(liveDistribution.total, hideFigures)}</strong> · {positions.length} posiciones
            </p>
          </div>

          {positions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Esta cartera aún no tiene posiciones registradas.
            </p>
          ) : (
            <>
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

              {isConsolidated && liveDistribution.brokerSlices.length > 1 && (
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

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Mayores Posiciones en {activePortfolioName}
                </h3>
                {liveDistribution.topPositions.map(pos => (
                  <div key={pos.id} className="flex items-center justify-between text-xs gap-2 py-1">
                    <div className="min-w-0">
                      <span className="font-bold text-[#081C3E] dark:text-white truncate block">{pos.name}</span>
                      <span className="text-[10px] text-slate-400">{pos.ticker}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-[#081C3E] dark:text-white block">{formatEUR(pos.value, hideFigures)}</span>
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pos.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. RENTABILIDAD P/G ABIERTA EXCLUSIVA DE ESTA CARTERA */}
      {brokerTab === 'abiertas' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                Rentabilidad P/G · {activePortfolioName}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                P/G total en esta cartera:{' '}
                <strong className={brokerCapitalSummary.unrealized >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {brokerCapitalSummary.unrealized > 0 ? '+' : ''}
                  {formatEUR(brokerCapitalSummary.unrealized, hideFigures)}
                </strong>
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>

          <div className="space-y-2.5">
            {(() => {
              const sorted = [...positions].sort((a, b) => (b.unrealizedGainLoss || 0) - (a.unrealizedGainLoss || 0));
              const maxAbs = Math.max(...sorted.map(p => Math.abs(p.unrealizedGainLoss || 0)), 1);
              return sorted.map(pos => {
                const pnl = pos.unrealizedGainLoss || 0;
                const pct = pos.unrealizedGainLossPct || 0;
                const isPos = pnl >= 0;
                const wPct = Math.max(Math.round((Math.abs(pnl) / maxAbs) * 100), 3);
                return (
                  <div key={pos.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-extrabold text-[#081C3E] dark:text-white truncate block">{pos.name}</span>
                        <span className="text-[10px] text-slate-500">
                          Valor {formatEUR(pos.totalValue, hideFigures)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-black block ${isPos ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
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
              });
            })()}
          </div>
        </div>
      )}

      {/* 3. TOP POSICIONES EXCLUSIVAS DE ESTA CARTERA */}
      {brokerTab === 'ranking' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
                Top Posiciones · {activePortfolioName}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {brokerCapitalSummary.winnersCount} en verde · {brokerCapitalSummary.losersCount} en rojo
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-sky-50 dark:bg-slate-800 p-0.5 border border-sky-200/80 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setRankMode('winners')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                  rankMode === 'winners' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                Mejores
              </button>
              <button
                type="button"
                onClick={() => setRankMode('losers')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                  rankMode === 'losers' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                Peores
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {(() => {
              const slice = brokerRanking.slice(0, 10);
              const maxAbs = Math.max(...slice.map(p => Math.abs(p.unrealizedGainLoss || 0)), 1);
              return slice.map(pos => {
                const pnl = pos.unrealizedGainLoss || 0;
                const isPos = pnl >= 0;
                const wPct = Math.max(Math.round((Math.abs(pnl) / maxAbs) * 100), 4);
                return (
                  <div key={pos.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-[#081C3E] dark:text-white truncate">{pos.name}</span>
                      <span className={`font-black shrink-0 ${isPos ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {pnl > 0 ? '+' : ''}{formatEUR(pnl, hideFigures)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}
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

      {/* 4. RESUMEN DE CAPITAL EXCLUSIVO DE ESTA CARTERA */}
      {brokerTab === 'capital' && (
        <div className="bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-black text-[#081C3E] dark:text-white">
              Resumen de Capital · {activePortfolioName}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="fintech-card-blue rounded-2xl p-3 border border-sky-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Coste Invertido</span>
              <span className="text-base font-black text-[#081C3E] dark:text-white">
                {formatEUR(brokerCapitalSummary.costBasis, hideFigures)}
              </span>
            </div>
            <div className="fintech-card-blue rounded-2xl p-3 border border-sky-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Valor Mercado</span>
              <span className="text-base font-black text-[#081C3E] dark:text-white">
                {formatEUR(brokerCapitalSummary.marketValue, hideFigures)}
              </span>
            </div>
            <div className="fintech-card-mint rounded-2xl p-3 border border-emerald-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">P/G Latente</span>
              <span className={`text-base font-black ${brokerCapitalSummary.unrealized >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                {brokerCapitalSummary.unrealized > 0 ? '+' : ''}
                {formatEUR(brokerCapitalSummary.unrealized, hideFigures)}
              </span>
            </div>
            <div className="fintech-card-gold rounded-2xl p-3 border border-amber-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">Efectivo Disponible</span>
              <span className="text-base font-black text-[#081C3E] dark:text-white">
                {formatEUR(activeCash, hideFigures)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
