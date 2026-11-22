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
            <span className="text-[9px] font-medium opacity-80">Consolidado</span>
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
            <span className="text-[9px] font-medium opacity-80">{rawData.payments.length} cobros</span>
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
            <span className="text-[9px] font-medium opacity-80">0 cobros</span>
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

      {/* 2. SUMA TOTAL COBROS FUTUROS & BOTÓN FISCALIDAD ESPAÑOLA 19% */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
              Suma Total Cobros Futuros Proyectados
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {filteredFutureCalendar.length} Pagos Estimados
          </span>
        </div>

        {/* BOTÓN CONMUTADOR: BRUTO vs NETO (19% IRPF ESPAÑA) */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl mb-4 border border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => setTaxRateSpanish19(false)}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              !taxRateSpanish19
                ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>💶 Dividendos Brutos</span>
          </button>
          <button
            type="button"
            onClick={() => setTaxRateSpanish19(true)}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              taxRateSpanish19
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🇪🇸 Neto (-19% IRPF España)</span>
          </button>
        </div>

        {/* Cifra Grande Principal Dinámica */}
        <div className="text-center py-1">
          <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            +{formatEUR(taxRateSpanish19 ? futureNet19Sum : futureGrossSum, hideFigures)}
          </div>
          <div className="text-xs font-medium text-slate-300 mt-1 flex items-center justify-center gap-1.5">
            <span>{taxRateSpanish19 ? 'Neto en Cuenta (Tras 19% Fiscalidad Española)' : 'Importe Total Bruto Estimado'}</span>
          </div>
        </div>

        {/* Desglose de Retenciones y Neto */}
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
            <div className="text-[10px] text-emerald-400 font-bold uppercase">Neto en Banco</div>
            <div className="text-xs font-black text-emerald-400 mt-0.5">
              +{formatEUR(futureNet19Sum, hideFigures)}
            </div>
          </div>
        </div>

        {/* Nota legal / tributaria de la retención del 19% en España */}
        <div className="mt-3.5 bg-slate-900/90 rounded-2xl p-2.5 text-[11px] text-slate-300 border border-slate-800 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span className="leading-snug">
            <strong>Fiscalidad Española:</strong> Retención aplicada del <strong>19%</strong> correspondiente al primer tramo de la base liquidable del ahorro (&lt; 6.000 € anuales en IRPF). Formulario W-8BEN aplicado en dividendos USA (15% en origen + 4% complementario).
          </span>
        </div>
      </div>

      {/* 3. HISTÓRICO ACUMULADO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
              Historial Cobrado Real ({filteredPayments.length} abonos)
            </h3>
          </div>
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
            +{formatEUR(currentNet, hideFigures)} neto
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="text-[10px] text-slate-400 font-bold">Total Bruto</div>
            <div className="text-xs font-black text-slate-800 dark:text-slate-200">{formatEUR(currentGross, hideFigures)}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="text-[10px] text-slate-400 font-bold">Retenciones</div>
            <div className="text-xs font-black text-rose-500">-{formatEUR(currentTaxes, hideFigures)}</div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">Neto Cobrado</div>
            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatEUR(currentNet, hideFigures)}</div>
          </div>
        </div>
      </div>

      {/* 4. NAVEGACIÓN INTERNA: MAPA FUTURO | HISTORIAL | POR EMPRESA */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab('mapa-futuro')}
          className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'mapa-futuro'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <span>📅 Mapa Futuro</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('historial')}
          className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all ${
            activeTab === 'historial'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          📜 Historial ({filteredPayments.length})
        </button>

        <button
          onClick={() => setActiveTab('empresas')}
          className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all ${
            activeTab === 'empresas'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          🏢 Por Activo
        </button>
      </div>

      {/* CONTENIDO PESTAÑA: MAPA FUTURO */}
      {activeTab === 'mapa-futuro' && (
        <div className="space-y-4">
          {/* TARJETA DESTACADA: SUMA TOTAL ANUAL EN MAPA FUTURO */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 shadow-lg border border-slate-700/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Proyección Anual 2027 • Suma Total de Cartera
                  </div>
                  <h3 className="text-base font-extrabold text-white">
                    {futureDistinctAssets.length} {futureDistinctAssets.length === 1 ? 'Activo' : 'Activos'} con Dividendo ({filteredFutureCalendar.length} Cobros en el Año)
                  </h3>
                </div>
              </div>

              {/* Botón selector Bruto / Neto 19% */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTaxRateSpanish19(false)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    !taxRateSpanish19 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  💶 Bruto
                </button>
                <button
                  type="button"
                  onClick={() => setTaxRateSpanish19(true)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    taxRateSpanish19 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🇪🇸 Neto (-19% IRPF)
                </button>
              </div>
            </div>

            {/* 3 Columnas de Totales Anuales */}
            <div className="grid grid-cols-3 gap-3 pt-3.5 text-center">
              <div className="bg-white/5 rounded-2xl p-2.5 border border-white/5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Bruto Anual
                </div>
                <div className="text-base sm:text-lg font-black text-white mt-0.5">
                  +{formatEUR(futureGrossSum, hideFigures)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5 font-medium">100% devengado</div>
              </div>

              <div className="bg-rose-500/10 rounded-2xl p-2.5 border border-rose-500/20">
                <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                  Retenciones (19%)
                </div>
                <div className="text-base sm:text-lg font-black text-rose-400 mt-0.5">
                  -{formatEUR(futureSpanishTax19Sum, hideFigures)}
                </div>
                <div className="text-[9px] text-rose-300/80 mt-0.5 font-medium">IRPF España</div>
              </div>

              <div className="bg-emerald-500/15 rounded-2xl p-2.5 border border-emerald-500/30">
                <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Total Neto Anual
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                  +{formatEUR(futureNet19Sum, hideFigures)}
                </div>
                <div className="text-[9px] text-emerald-300/80 mt-0.5 font-medium">Líquido a percibir</div>
              </div>
            </div>

            {/* Resumen por Activo */}
            <div className="mt-3.5 pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-300">
              <span className="font-semibold text-slate-400">Activos en el cómputo anual:</span>
              <div className="flex flex-wrap items-center gap-2">
                {futureDistinctAssets.map(a => (
                  <span key={a.isin} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-white font-bold border border-white/10">
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

          {/* Tarjeta explicativa de los activos de José Manuel */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-3xl p-4 text-xs">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Activos con Dividendo en tu Cartera Real DEGIRO</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px] mt-1">
              En tu cartera actual generas dividendos trimestrales continuos a través del ETF de renta fija <strong>iShares EUR Ultrashort Bond UCITS ETF (Dist)</strong> (58 títulos) y de las acciones de <strong>Visa Inc. Class A</strong> (2 acciones). Los ETFs como <strong>Xtrackers Overnight Rate</strong>, <strong>Gold 3X</strong> y <strong>Nasdaq 3X</strong> capitalizan o acumulan rendimientos.
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Activo / Producto
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Neto Cobrado Real
            </span>
          </div>

          <div className="space-y-1">
            {rawData.productSummary.map((prod, idx) => (
              <div
                key={prod.isin || idx}
                className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="text-sm shrink-0">{prod.flag}</span>
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                      {prod.product}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {prod.count} pagos • Bruto: {prod.gross.toFixed(2)} € • Ret.: -{prod.tax.toFixed(2)} €
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                    +{formatEUR(prod.net, hideFigures)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
