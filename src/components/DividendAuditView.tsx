import React, { useState, useMemo } from 'react';
import { formatEUR } from '../utils/calculations';
import dividendsRaw from '../data/degiroDividendsData.json';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Search,
  Building2,
  Clock,
  Sparkles,
  PieChart,
  HelpCircle,
  PlusCircle,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DividendAuditViewProps {
  hideFigures?: boolean;
}

export const DividendAuditView: React.FC<DividendAuditViewProps> = ({ hideFigures = false }) => {
  const [selectedBroker, setSelectedBroker] = useState<'Todas' | 'DEGIRO' | 'MyInvestor' | 'Kraken'>('Todas');
  const [selectedYear, setSelectedYear] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<'historial' | 'mapa-futuro' | 'empresas'>('historial');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Activo seleccionado en la pestaña 'Por Activo'
  const [selectedProductIsin, setSelectedProductIsin] = useState<string>('TODOS');

  // Botón solicitado: Dividendos netos con retención 19% (fiscalidad española) vs. Brutos
  const [taxRateSpanish19, setTaxRateSpanish19] = useState<boolean>(true);

  const rawData = dividendsRaw as {
    totalHistoricalNet: number;
    totalHistoricalGross: number;
    totalHistoricalTaxes: number;
    totalPaymentsCount: number;
    yearsAvailable: string[];
    brokersAvailable: string[];
    annualSummary: Array<{ year: string; gross: number; tax: number; net: number; count: number }>;
    productSummary: Array<{ product: string; isin: string; flag: string; gross: number; tax: number; net: number; count: number }>;
    payments: Array<{
      date: string;
      year: string;
      month: string;
      product: string;
      isin: string;
      gross: number;
      tax: number;
      net: number;
      currency: string;
      broker: string;
      flag: string;
      descriptions?: string[];
    }>;
    futureCalendar: Array<{
      id: string;
      product: string;
      ticker: string;
      isin: string;
      shares: number;
      broker: string;
      flag: string;
      month: string;
      quarter: string;
      estimatedDate: string;
      dividendPerShare: number;
      currency: string;
      estimatedGrossEUR: number;
      estimatedTaxEUR: number;
      estimatedNetEUR: number;
      frequency: string;
      status: string;
    }>;
  };

  // Filtrado de pagos históricos
  const filteredPayments = useMemo(() => {
    return rawData.payments.filter(p => {
      const matchBroker = selectedBroker === 'Todas' || p.broker.toUpperCase() === selectedBroker.toUpperCase();
      const matchYear = selectedYear === 'Todos' || p.year === selectedYear;
      const matchSearch =
        searchTerm === '' ||
        p.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.isin.toLowerCase().includes(searchTerm.toLowerCase());
      return matchBroker && matchYear && matchSearch;
    });
  }, [rawData.payments, selectedBroker, selectedYear, searchTerm]);

  // Filtrado de calendario futuro según broker
  const filteredFutureCalendar = useMemo(() => {
    return rawData.futureCalendar.filter(ev => {
      return selectedBroker === 'Todas' || ev.broker.toUpperCase() === selectedBroker.toUpperCase();
    });
  }, [rawData.futureCalendar, selectedBroker]);

  // Suma total de cobros futuros proyectados (Bruto, Retención 19% España y Neto)
  const futureGrossSum = useMemo(() => {
    return filteredFutureCalendar.reduce((acc, ev) => acc + ev.estimatedGrossEUR, 0);
  }, [filteredFutureCalendar]);

  const futureSpanishTax19Sum = useMemo(() => {
    return futureGrossSum * 0.19;
  }, [futureGrossSum]);

  const futureNet19Sum = useMemo(() => {
    return futureGrossSum * 0.81;
  }, [futureGrossSum]);

  const futureDistinctAssets = useMemo(() => {
    const map = new Map<string, { product: string; ticker: string; isin: string; flag: string; annualGross: number; count: number }>();
    filteredFutureCalendar.forEach(ev => {
      const existing = map.get(ev.isin);
      if (existing) {
        existing.annualGross += ev.estimatedGrossEUR;
        existing.count += 1;
      } else {
        map.set(ev.isin, {
          product: ev.product,
          ticker: ev.ticker,
          isin: ev.isin,
          flag: ev.flag,
          annualGross: ev.estimatedGrossEUR,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [filteredFutureCalendar]);

  // Cálculos dinámicos según filtros aplicados para historial
  const currentNet = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.net, 0);
  }, [filteredPayments]);

  const currentGross = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.gross, 0);
  }, [filteredPayments]);

  const currentTaxes = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.tax, 0);
  }, [filteredPayments]);

  // Máximo para escala del gráfico de barras anual
  const maxAnnualNet = useMemo(() => {
    return Math.max(...rawData.annualSummary.map(a => a.net), 1);
  }, [rawData.annualSummary]);

  // Datos consolidados o específicos para la pestaña 'Por Activo'
  const selectedProductData = useMemo(() => {
    if (selectedProductIsin === 'TODOS') {
      const gross = rawData.productSummary.reduce((acc, p) => acc + p.gross, 0);
      const tax = rawData.productSummary.reduce((acc, p) => acc + p.tax, 0);
      const net = rawData.productSummary.reduce((acc, p) => acc + p.net, 0);
      const count = rawData.productSummary.reduce((acc, p) => acc + p.count, 0);
      return {
        product: 'Todos los Activos con Dividendo',
        ticker: `${rawData.productSummary.length} activos`,
        isin: 'TODOS',
        flag: '💼',
        gross,
        tax,
        net,
        count,
      };
    }
    const found = rawData.productSummary.find(p => p.isin === selectedProductIsin);
    if (found) return found;
    return rawData.productSummary[0] || {
      product: 'Activo',
      ticker: '',
      isin: '',
      flag: '📄',
      gross: 0,
      tax: 0,
      net: 0,
      count: 0,
    };
  }, [selectedProductIsin, rawData.productSummary]);

  const selectedProductPayments = useMemo(() => {
    if (selectedProductIsin === 'TODOS') return rawData.payments;
    return rawData.payments.filter(p => p.isin === selectedProductIsin);
  }, [selectedProductIsin, rawData.payments]);

  return (
    <div className="space-y-4">
      {/* 1. SELECTOR DE CARTERA / BROKER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cartera de origen
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
            José Manuel • 2025–2027
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => setSelectedBroker('Todas')}
            className={`py-2 px-2 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedBroker === 'Todas'
                ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>🌐 Todas</span>
            <span className="text-[9px] font-medium opacity-80">{rawData.payments.length} cobros</span>
          </button>

          <button
            onClick={() => setSelectedBroker('DEGIRO')}
            className={`py-2 px-2 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedBroker === 'DEGIRO'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>🏛️ DEGIRO</span>
            <span className="text-[9px] font-medium opacity-80">{rawData.payments.filter(p => p.broker === 'DEGIRO').length} cobros</span>
          </button>

          <button
            onClick={() => setSelectedBroker('MyInvestor')}
            className={`py-2 px-2 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedBroker === 'MyInvestor'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>🏦 MyInv.</span>
            <span className="text-[9px] font-medium opacity-80">{rawData.payments.filter(p => p.broker === 'MyInvestor').length} cobros</span>
          </button>

          <button
            onClick={() => setSelectedBroker('Kraken')}
            className={`py-2 px-2 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 ${
              selectedBroker === 'Kraken'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>🐙 Kraken</span>
            <span className="text-[9px] font-medium opacity-80">0 cobros</span>
          </button>
        </div>
      </div>

      {/* 2. NAVEGACIÓN PRINCIPAL DE PESTAÑAS (ARRIBA DEL TODO) */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl gap-1 shadow-inner border border-slate-200/60 dark:border-slate-700/60">
        <button
          onClick={() => setActiveTab('historial')}
          className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'historial'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📜 Historial</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {filteredPayments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('mapa-futuro')}
          className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'mapa-futuro'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📅 Mapa Futuro</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('empresas')}
          className={`flex-1 py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'empresas'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🏢 Por Activo</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {rawData.productSummary.length}
          </span>
        </button>
      </div>

      {/* 3. PANEL HERO DINÁMICO (CUADRO AZUL QUE REACCIONA A LA PESTAÑA Y AL ACTIVO SELECCIONADO) */}
      {activeTab === 'historial' && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                Historial de Dividendos Cobrados
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {filteredPayments.length} Cobros Reales Registrados
            </span>
          </div>

          <div className="text-center py-2">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400">
              +{formatEUR(currentNet, hideFigures)}
            </div>
            <div className="text-xs font-medium text-slate-300 mt-1">
              Neto Líquido Real Ingresado en Cuenta
            </div>
          </div>

          {/* 3 Columnas: Bruto, Retenciones, Neto */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Bruto</div>
              <div className="text-xs font-black text-slate-200 mt-0.5">
                +{formatEUR(currentGross, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Retenciones</div>
              <div className="text-xs font-black text-rose-400 mt-0.5">
                -{formatEUR(currentTaxes, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Neto Cobrado</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">
                +{formatEUR(currentNet, hideFigures)}
              </div>
            </div>
          </div>

          {/* Selector de Años en el Historial */}
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 font-semibold">Filtrar por año:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['Todos', ...rawData.yearsAvailable].map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    selectedYear === y
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mapa-futuro' && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                Proyección Anual 2027 • Cobros Futuros
              </span>
            </div>

            {/* BOTÓN CONMUTADOR: BRUTO vs NETO (19% IRPF ESPAÑA) */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700/60 shadow-inner self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTaxRateSpanish19(false)}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all ${
                  !taxRateSpanish19
                    ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-500'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                💶 Bruto
              </button>
              <button
                type="button"
                onClick={() => setTaxRateSpanish19(true)}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-black transition-all ${
                  taxRateSpanish19
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇪🇸 Neto (-19% IRPF)
              </button>
            </div>
          </div>

          <div className="text-center py-2">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              +{formatEUR(taxRateSpanish19 ? futureNet19Sum : futureGrossSum, hideFigures)}
            </div>
            <div className="text-xs font-medium text-slate-300 mt-1">
              {taxRateSpanish19
                ? 'Neto Anual Proyectado (Tras 19% Fiscalidad Española)'
                : 'Importe Total Bruto Proyectado'}
            </div>
          </div>

          {/* 3 Columnas: Bruto, Retención 19%, Neto */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Bruto</div>
              <div className="text-xs font-black text-slate-200 mt-0.5">
                +{formatEUR(futureGrossSum, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Retención 19%</div>
              <div className="text-xs font-black text-rose-400 mt-0.5">
                -{formatEUR(futureSpanishTax19Sum, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Neto Anual</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">
                +{formatEUR(futureNet19Sum, hideFigures)}
              </div>
            </div>
          </div>

          {/* Resumen de activos que reparten en el año */}
          <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-400">Activos en el cómputo anual:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {futureDistinctAssets.map(a => (
                <span key={a.isin} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 text-white font-bold border border-white/10 text-[10px]">
                  <span>{a.flag}</span>
                  <span>{a.product}</span>
                  <span className="text-emerald-400">
                    (+{formatEUR(taxRateSpanish19 ? a.annualGross * 0.81 : a.annualGross, hideFigures)})
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'empresas' && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 truncate max-w-[220px]">
                {selectedProductData.product}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {selectedProductData.count} Cobros Realizados
            </span>
          </div>

          <div className="text-center py-2">
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400">
              +{formatEUR(selectedProductData.net, hideFigures)}
            </div>
            <div className="text-xs font-medium text-slate-300 mt-1">
              Neto Real Cobrado de {selectedProductData.product}
            </div>
          </div>

          {/* 3 Columnas: Bruto, Retención, Neto */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Bruto</div>
              <div className="text-xs font-black text-slate-200 mt-0.5">
                +{formatEUR(selectedProductData.gross, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-800">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Retenciones</div>
              <div className="text-xs font-black text-rose-400 mt-0.5">
                -{formatEUR(selectedProductData.tax, hideFigures)}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-xl p-2 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Neto Total</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">
                +{formatEUR(selectedProductData.net, hideFigures)}
              </div>
            </div>
          </div>

          {/* Selector Rápido de Activo en la Tarjeta */}
          <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 font-semibold">Tocar activo:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedProductIsin('TODOS')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedProductIsin === 'TODOS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                🌐 Todos
              </button>
              {rawData.productSummary.map(prod => (
                <button
                  key={prod.isin}
                  type="button"
                  onClick={() => setSelectedProductIsin(prod.isin)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                    selectedProductIsin === prod.isin
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{prod.flag}</span>
                  <span>{prod.product.includes('Visa') ? 'Visa Inc.' : 'Bono EUR'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA: MAPA FUTURO */}
      {activeTab === 'mapa-futuro' && (
        <div className="space-y-4">
          {/* Tarjeta explicativa de los activos de José Manuel */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-3xl p-4 text-xs">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {selectedBroker === 'DEGIRO'
                  ? 'Activos con Dividendo en tu Cartera Real DEGIRO'
                  : selectedBroker === 'MyInvestor'
                  ? 'Activos con Dividendo en tu Cartera Real MyInvestor'
                  : 'Activos con Dividendo en tus Carteras (DEGIRO & MyInvestor)'}
              </span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px] mt-1">
              {selectedBroker === 'MyInvestor' ? (
                <>
                  En tu cartera de <strong>MyInvestor</strong> cobras dividendos recurrentes de acciones españolas de alto dividendo (<strong>Metrovacesa</strong>, <strong>Iberdrola</strong>, <strong>Logista</strong>, <strong>Sabadell</strong>, <strong>Viscofan</strong>, <strong>Mapfre</strong>, <strong>Enagás</strong>, <strong>Redeia</strong>) y de ETFs de distribución (<strong>Lyxor Europe Select Div</strong>, <strong>iShares Global Select Div</strong>, <strong>Vanguard High Div Yield</strong>, <strong>iShares UK Div</strong>, etc.), con retención del 19% en origen aplicada por el banco.
                </>
              ) : selectedBroker === 'DEGIRO' ? (
                <>
                  En tu cartera actual generas dividendos trimestrales continuos a través del ETF de renta fija <strong>iShares EUR Ultrashort Bond UCITS ETF (Dist)</strong> (58 títulos) y de las acciones de <strong>Visa Inc. Class A</strong> (2 acciones). Los ETFs como <strong>Xtrackers Overnight Rate</strong>, <strong>Gold 3X</strong> y <strong>Nasdaq 3X</strong> capitalizan o acumulan rendimientos.
                </>
              ) : (
                <>
                  Control consolidado de dividendos de <strong>DEGIRO</strong> (renta fija ultracorta y Visa) y <strong>MyInvestor</strong> (acciones IBEX 35 de alto rendimiento y ETFs globales de dividendos), aplicando retención en origen española del 19% según IRPF.
                </>
              )}
            </p>
          </div>

          {/* Listado de Cobros Futuros con Botón Neto 19% Integrado */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  Calendario Proyectado 2027
                </h4>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                {taxRateSpanish19 ? 'Mostrando Neto (-19%)' : 'Mostrando Bruto'}
              </span>
            </div>

            <div className="space-y-2.5">
              {filteredFutureCalendar.map(ev => {
                const gross = ev.estimatedGrossEUR;
                const tax19 = gross * 0.19;
                const net19 = gross * 0.81;
                const displayVal = taxRateSpanish19 ? net19 : gross;

                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        {ev.flag}
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                          <span>{ev.product}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {ev.ticker}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {ev.estimatedDate} • {ev.month} • {ev.shares} títulos
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Bruto: {gross.toFixed(2)} € • IRPF 19%: -{tax19.toFixed(2)} €
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        +{formatEUR(displayVal, hideFigures)}
                      </div>
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {taxRateSpanish19 ? 'Neto (-19%)' : 'Bruto'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA: HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="space-y-3">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por activo o ISIN..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            {filteredPayments.length > 0 ? (
              filteredPayments.map((p, idx) => (
                <div
                  key={`${p.date}_${p.isin}_${idx}`}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 flex items-center justify-between shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {p.flag}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                        <span>{p.product}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {p.broker}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {p.date} • Bruto: {p.gross.toFixed(2)} € • Retención: -{p.tax.toFixed(2)} €
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                      +{formatEUR(p.net, hideFigures)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Neto cobrado</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 italic bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4">
                No se encontraron cobros para los filtros seleccionados
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA: POR ACTIVO */}
      {activeTab === 'empresas' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Selecciona un Activo para Ver sus Datos Arriba
              </span>
              <span className="text-xs font-bold text-slate-400">
                {rawData.productSummary.length} activos
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {/* Botón para ver todos */}
              <button
                type="button"
                onClick={() => setSelectedProductIsin('TODOS')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border text-left ${
                  selectedProductIsin === 'TODOS'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/30'
                    : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-black text-sm flex items-center justify-center">
                    🌐
                  </div>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white text-xs">
                      Todos los Activos Consolidados
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Suma total de cobros históricos de la cartera
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                    +{formatEUR(rawData.totalHistoricalNet, hideFigures)}
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Neto Total</div>
                </div>
              </button>

              {/* Lista de cada activo */}
              {rawData.productSummary.map((prod) => {
                const isSelected = selectedProductIsin === prod.isin;
                return (
                  <button
                    key={prod.isin}
                    type="button"
                    onClick={() => setSelectedProductIsin(prod.isin)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border text-left ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/30'
                        : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {prod.flag}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 dark:text-white text-xs truncate">
                          {prod.product}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {prod.count} pagos • Bruto: {prod.gross.toFixed(2)} € • Retención: -{prod.tax.toFixed(2)} €
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                        +{formatEUR(prod.net, hideFigures)}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">
                        {isSelected ? '✓ Seleccionado' : 'Tocar para ver'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Historial detallado de cobros del activo seleccionado */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <span>Cobros de {selectedProductData.product} ({selectedProductPayments.length} abonos)</span>
              </h4>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                +{formatEUR(selectedProductData.net, hideFigures)}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {selectedProductPayments.map((p, idx) => (
                <div
                  key={`${p.date}_${p.isin}_${idx}`}
                  className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="text-base shrink-0">{p.flag}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {p.product}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {p.date} • Bruto: {p.gross.toFixed(2)} € • Ret.: -{p.tax.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                      +{formatEUR(p.net, hideFigures)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
