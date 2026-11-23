import React, { useState, useMemo } from 'react';
import {
  PositionItem,
  InicioSubTab,
  TimeRange,
  AssetType,
  FinancialEvent,
  TradingAnalytics,
  PortfolioMeta,
} from '../types/portfolio';
import {
  formatEUR,
  formatHeaderEUR,
  formatPercent,
  calculatePortfolioMetrics,
} from '../utils/calculations';
import { MOCK_CHART_DATA } from '../data/mockPortfolio';
import { Sparkline } from './Sparkline';
import { InteractiveChart } from './InteractiveChart';
import { HistoricalAssetModal } from './HistoricalAssetModal';
import { DividendAuditView } from './DividendAuditView';
import { CommissionsModal } from './CommissionsModal';
import { NetCashFlowModal } from './NetCashFlowModal';
import { ClosedProfitsModal } from './ClosedProfitsModal';
import { formatDateToSpanish } from '../utils/historicalPriceEstimator';
import degiroData from '../data/degiroPositionsData.json';
import {
  Search,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Trash2,
  X,
  Target,
  Wallet,
  PieChart,
  Calendar,
  RefreshCw,
  ChevronDown,
  Check,
  Upload,
  TrendingUp,
  Building2,
  GripVertical,
  Sparkles,
} from 'lucide-react';

interface PortfolioViewProps {
  positions: PositionItem[];
  cash: number;
  goalAmount: number;
  hideFigures: boolean;
  selectedTimeRange: TimeRange;
  events: FinancialEvent[];
  tradingAnalytics?: TradingAnalytics;
  portfolios?: PortfolioMeta[];
  activePortfolioId?: string;
  onSwitchPortfolio?: (portfolioId: string) => void;
  onAddPortfolio?: (name: string, broker?: string, icon?: string, cash?: number) => void;
  onToggleHideFigures: () => void;
  onSelectTimeRange: (range: TimeRange) => void;
  onOpenSearch: () => void;
  onGoToProfile: () => void;
  onUpdateCash: (newCash: number) => void;
  onUpdatePosition: (position: PositionItem) => void;
  onDeletePosition: (id: string) => void;
  onOpenImport: () => void;
  onRefreshLiveQuotes?: () => void;
  isRefreshingLive?: boolean;
  lastUpdatedTime?: string;
  onReorderPortfolios?: (newPortfolios: PortfolioMeta[]) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  positions,
  cash,
  goalAmount,
  hideFigures,
  selectedTimeRange,
  events,
  tradingAnalytics,
  portfolios = [],
  activePortfolioId = 'todas',
  onSwitchPortfolio,
  onAddPortfolio,
  onToggleHideFigures,
  onSelectTimeRange,
  onOpenSearch,
  onGoToProfile,
  onUpdateCash,
  onUpdatePosition,
  onDeletePosition,
  onOpenImport,
  onRefreshLiveQuotes,
  isRefreshingLive = false,
  lastUpdatedTime,
  onReorderPortfolios,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<InicioSubTab>('portafolio');
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<'Todos' | AssetType>('Todos');
  const [urbanitaeSubFilter, setUrbanitaeSubFilter] = useState<'todos' | 'plusvalia' | 'prestamo'>('todos');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [positionSort, setPositionSort] = useState<'degiro' | 'value-desc' | 'change-asc' | 'change-desc' | 'name-asc'>('degiro');
  const [selectedPosition, setSelectedPosition] = useState<PositionItem | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashInput, setCashInput] = useState(cash.toString());
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const [showCommissionsModal, setShowCommissionsModal] = useState(false);
  const [showNetCashFlowModal, setShowNetCashFlowModal] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);

  // Selector estilo DEGIRO: Posiciones abiertas / Posiciones cerradas / Todas las posiciones
  const [positionViewMode, setPositionViewMode] = useState<'abiertas' | 'cerradas' | 'todas'>('abiertas');
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false);

  // Reordenación táctil con el dedo y orden inteligente por uso
  const [draggedPortfolioId, setDraggedPortfolioId] = useState<string | null>(null);
  const [dragOverPortfolioId, setDragOverPortfolioId] = useState<string | null>(null);
  const [sortNotification, setSortNotification] = useState<string | null>(null);

  const touchStateRef = React.useRef<{
    fromId: string | null;
    currentOverId: string | null;
    startY: number;
    hasMoved: boolean;
  }>({ fromId: null, currentOverId: null, startY: 0, hasMoved: false });

  const handleSortByUsage = () => {
    if (!portfolios || !onReorderPortfolios) return;
    const todas = portfolios.find(p => p.id === 'todas');
    const others = portfolios.filter(p => p.id !== 'todas');
    
    others.sort((a, b) => {
      const countA = a.accessCount || 0;
      const countB = b.accessCount || 0;
      if (countB !== countA) return countB - countA;
      return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0);
    });

    const newOrder = todas ? [todas, ...others] : others;
    onReorderPortfolios(newOrder);
    setSortNotification('✓ Ordenadas');
    setTimeout(() => setSortNotification(null), 2000);
  };

  const handleMovePortfolio = (fromId: string, toId: string) => {
    if (!portfolios || !onReorderPortfolios || fromId === toId) return;
    const currentList = [...portfolios];
    const fromIndex = currentList.findIndex(p => p.id === fromId);
    const toIndex = currentList.findIndex(p => p.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = currentList.splice(fromIndex, 1);
    currentList.splice(toIndex, 0, moved);
    onReorderPortfolios(currentList);
  };

  const handleTouchStartGrip = (e: React.TouchEvent, portId: string) => {
    e.stopPropagation();
    touchStateRef.current = {
      fromId: portId,
      currentOverId: portId,
      startY: e.touches[0].clientY,
      hasMoved: false,
    };
    setDraggedPortfolioId(portId);
    setDragOverPortfolioId(portId);
  };

  const handleTouchMoveGrip = (e: React.TouchEvent) => {
    if (!touchStateRef.current.fromId) return;
    const touch = e.touches[0];
    const diff = Math.abs(touch.clientY - touchStateRef.current.startY);
    if (diff > 4) {
      touchStateRef.current.hasMoved = true;
    }
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemElem = elem?.closest('[data-portfolio-id]');
    if (itemElem) {
      const overId = itemElem.getAttribute('data-portfolio-id');
      if (overId && overId !== touchStateRef.current.currentOverId) {
        touchStateRef.current.currentOverId = overId;
        setDragOverPortfolioId(overId);
      }
    }
  };

  const handleTouchEndGrip = (e: React.TouchEvent) => {
    const { fromId, currentOverId, hasMoved } = touchStateRef.current;
    if (fromId && currentOverId && hasMoved && fromId !== currentOverId) {
      handleMovePortfolio(fromId, currentOverId);
    }
    touchStateRef.current = { fromId: null, currentOverId: null, startY: 0, hasMoved: false };
    setDraggedPortfolioId(null);
    setDragOverPortfolioId(null);
  };

  const closedPositions = (degiroData.closedPositions || []) as any[];
  const accountSummary = degiroData.accountSummary || {
    cuentaCompleta: 25869.94,
    cartera: 21509.72,
    efectivoEur: 4360.22,
    margenLibre: 4360.22,
    diaBp: 0.00,
    diaBpPct: 0.00,
    totalBpDegiro: 8408.91,
    historicoCerradoPnl: 8408.91,
  };

  // Posiciones filtradas según la cartera activa (o todas si 'todas')
  const currentPortfolioPositions = useMemo(() => {
    if (!activePortfolioId || activePortfolioId === 'todas') {
      const hiddenIds = new Set(portfolios.filter(p => p.hidden).map(p => p.id));
      return positions.filter(p => !p.portfolioId || !hiddenIds.has(p.portfolioId));
    }
    return positions.filter(p => {
      if (activePortfolioId === 'degiro') {
        return p.portfolioId === 'degiro' || p.broker === 'DEGIRO' || (!p.portfolioId && !p.broker);
      }
      if (activePortfolioId === 'myinvestor') {
        return p.portfolioId === 'myinvestor' || p.broker === 'MyInvestor';
      }
      if (activePortfolioId === 'kraken') {
        return p.portfolioId === 'kraken' || p.broker === 'Kraken';
      }
      if (activePortfolioId === 'bbva') {
        return p.portfolioId === 'bbva' || p.broker === 'BBVA';
      }
      return p.portfolioId === activePortfolioId;
    });
  }, [positions, activePortfolioId, portfolios]);

  // Efectivo activo según la cartera
  const activeCash = useMemo(() => {
    if (!activePortfolioId || activePortfolioId === 'todas') {
      return cash;
    }
    const found = portfolios.find(p => p.id === activePortfolioId);
    return found?.cash !== undefined ? found.cash : cash;
  }, [activePortfolioId, portfolios, cash]);

  // Valor invertido en la cartera activa
  const activeCarteraVal = useMemo(() => {
    return currentPortfolioPositions.reduce((acc, p) => acc + p.totalValue, 0);
  }, [currentPortfolioPositions]);

  // Total cuenta (cartera activa + efectivo activo)
  const isDegiroOnly = activePortfolioId === 'degiro';
  const isDegiroOrConsolidated = !activePortfolioId || activePortfolioId === 'todas' || activePortfolioId === 'degiro';
  const totalMarketVal = isDegiroOnly ? accountSummary.cuentaCompleta : (activeCarteraVal + activeCash);
  const headerFormatted = formatHeaderEUR(totalMarketVal, hideFigures);
  const displayCarteraVal = isDegiroOnly ? accountSummary.cartera : activeCarteraVal;
  const displayCashVal = isDegiroOnly ? accountSummary.efectivoEur : activeCash;
  const displayMargenLibre = isDegiroOnly ? accountSummary.margenLibre : activeCash;

  // Métricas calculadas para la cartera activa
  const metrics = calculatePortfolioMetrics(currentPortfolioPositions, activeCash);
  const displayDiaBp = isDegiroOnly ? accountSummary.diaBp : metrics.dailyChangeValue;
  const displayDiaBpPct = isDegiroOnly ? accountSummary.diaBpPct : metrics.dailyChangePct;
  const displayTotalBp = isDegiroOnly ? accountSummary.totalBpDegiro : metrics.unrealizedGainLoss;
  const chartPoints = MOCK_CHART_DATA[selectedTimeRange] || MOCK_CHART_DATA['1D'];

  // Filtrado y ordenación de posiciones abiertas
  const filteredPositions = currentPortfolioPositions
    .filter(pos => selectedAssetFilter === 'Todos' || pos.type === selectedAssetFilter)
    .sort((a, b) => {
      if (positionSort === 'degiro') return 0;
      if (positionSort === 'value-desc') return b.totalValue - a.totalValue;
      if (positionSort === 'name-asc') return a.name.localeCompare(b.name);
      if (positionSort === 'change-desc') return b.dailyChangePct - a.dailyChangePct;
      if (positionSort === 'change-asc') return a.dailyChangePct - b.dailyChangePct;
      return 0;
    });

  // Filtrado de posiciones cerradas (solo si estamos en DEGIRO o Todas)
  const filteredClosedPositions = (isDegiroOrConsolidated ? closedPositions : [])
    .filter(pos => selectedAssetFilter === 'Todos' || pos.type === selectedAssetFilter)
    .sort((a, b) => b.realized_pnl - a.realized_pnl);

  // Separación explícita por clases de activos
  const stockPositions = filteredPositions.filter(p => p.type === 'Acciones');
  const fondosPositions = filteredPositions.filter(p => p.type === 'Fondos' && p.broker !== 'Urbanitae');
  const inmobiliarioPositions = filteredPositions.filter(p => p.type === 'Inmobiliario' || p.broker === 'Urbanitae');
  const etfPositions = filteredPositions.filter(p => p.type === 'ETFs');
  const cryptoPositions = filteredPositions.filter(p => p.type === 'Cripto');
  const etfAndCryptoPositions = filteredPositions.filter(p => p.type === 'ETFs' || p.type === 'Cripto');

  // Separación individual de proyectos Urbanitae: Plusvalía (Equity) vs Préstamos (Deuda Garantizada)
  const plusvaliaPositions = useMemo(() => {
    return inmobiliarioPositions.filter(p =>
      (p.market && p.market.toLowerCase().includes('plusvalía')) ||
      p.id.includes('martinica') ||
      p.id.includes('nervion') ||
      p.id.includes('francos') ||
      p.id.includes('lavapies') ||
      p.name.includes('Martinica') ||
      p.name.includes('Nervión') ||
      p.name.includes('Francos') ||
      p.name.includes('Lavapiés')
    );
  }, [inmobiliarioPositions]);

  const prestamoPositions = useMemo(() => {
    const plusvaliaIds = new Set(plusvaliaPositions.map(p => p.id));
    return inmobiliarioPositions.filter(p => !plusvaliaIds.has(p.id));
  }, [inmobiliarioPositions, plusvaliaPositions]);

  const plusvaliaVal = useMemo(() => plusvaliaPositions.reduce((acc, p) => acc + p.totalValue, 0), [plusvaliaPositions]);
  const prestamoVal = useMemo(() => prestamoPositions.reduce((acc, p) => acc + p.totalValue, 0), [prestamoPositions]);

  const closedStocks = filteredClosedPositions.filter(p => p.type === 'Acciones');
  const closedFondos = filteredClosedPositions.filter(p => p.type === 'Fondos' && p.broker !== 'Urbanitae');
  const closedInmobiliario = filteredClosedPositions.filter(p => p.type === 'Inmobiliario' || p.broker === 'Urbanitae');
  const closedEtfsAndCrypto = filteredClosedPositions.filter(p => p.type === 'ETFs' || p.type === 'Cripto');

  // Cálculo de distribución por tipo
  const totalPosValue = currentPortfolioPositions.reduce((acc, p) => acc + p.totalValue, 0) || 1;
  const accionesVal = currentPortfolioPositions.filter(p => p.type === 'Acciones').reduce((a, b) => a + b.totalValue, 0);
  const etfsVal = currentPortfolioPositions.filter(p => p.type === 'ETFs').reduce((a, b) => a + b.totalValue, 0);
  const fondosVal = currentPortfolioPositions.filter(p => p.type === 'Fondos' && p.broker !== 'Urbanitae').reduce((a, b) => a + b.totalValue, 0);
  const inmobiliarioVal = currentPortfolioPositions.filter(p => p.type === 'Inmobiliario' || p.broker === 'Urbanitae').reduce((a, b) => a + b.totalValue, 0);
  const criptoVal = currentPortfolioPositions.filter(p => p.type === 'Cripto').reduce((a, b) => a + b.totalValue, 0);

  const accionesPct = Math.round((accionesVal / totalPosValue) * 100);
  const etfsPct = Math.round((etfsVal / totalPosValue) * 100);
  const fondosPct = Math.round((fondosVal / totalPosValue) * 100);
  const inmobiliarioPct = Math.round((inmobiliarioVal / totalPosValue) * 100);
  const criptoPct = Math.max(0, 100 - accionesPct - etfsPct - fondosPct - inmobiliarioPct);

  // Meta de inversión calculada
  const goalProgress = Math.min(100, Math.round((metrics.totalMarketValue / goalAmount) * 100));

  // Próximos dividendos
  const upcomingDividends = events.filter(e => e.type === 'pago-dividendo' || e.type === 'ex-dividend');

  return (
    <div className="pb-24 pt-2">
      {/* 1. Cabecera José Manuel Portafolio */}
      <header className="flex items-center justify-between px-4 pt-1 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-1.5">
            <span>José Manuel</span>
            <span className="text-xl">💼</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-semibold -mt-0.5">Control Patrimonial Multicartera</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSearch}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Buscar activos"
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
          </button>
          <button
            onClick={onGoToProfile}
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-slate-900 text-white font-black text-xs flex items-center justify-center hover:opacity-90 transition-opacity shadow-xs"
            title="Perfil de José Manuel"
          >
            JM
          </button>
        </div>
      </header>

      {/* 1.5. SELECTOR DE CARTERA DESPLEGABLE + ACCESO DIRECTO A DIVIDENDOS */}
      <div className="px-4 mb-3 flex items-center justify-between gap-2 relative">
        {/* Botón Desplegable de Cartera */}
        <div className="relative">
          <button
            onClick={() => setShowPortfolioDropdown(!showPortfolioDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all active:scale-[0.98]"
            title="Cambiar cartera activa"
          >
            <span className="text-base">{((portfolios || []).find(p => p.id === (activePortfolioId || 'todas'))?.icon) || '🌐'}</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">
              {((portfolios || []).find(p => p.id === (activePortfolioId || 'todas'))?.name) || 'Todas las Carteras'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showPortfolioDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Menú Desplegable Flotante */}
          {showPortfolioDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowPortfolioDropdown(false)}
              />
              <div className="absolute left-0 mt-1.5 w-68 sm:w-72 z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 animate-fadeIn">
                <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <span>Carteras</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortByUsage();
                    }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors normal-case cursor-pointer"
                    title="Ordenar carteras automáticamente según las más usadas"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                    <span>{sortNotification || 'Ordenar por uso'}</span>
                  </button>
                </div>

                <div className="space-y-0.5">
                  {(portfolios || []).filter(p => !p.hidden).map(port => {
                    const isSelected = (activePortfolioId || 'todas') === port.id;
                    const isBeingDragged = draggedPortfolioId === port.id;
                    const isOver = dragOverPortfolioId === port.id && draggedPortfolioId !== port.id;

                    return (
                      <div
                        key={port.id}
                        data-portfolio-id={port.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverPortfolioId !== port.id) setDragOverPortfolioId(port.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const srcId = e.dataTransfer.getData('text/plain') || draggedPortfolioId;
                          if (srcId && srcId !== port.id) handleMovePortfolio(srcId, port.id);
                          setDraggedPortfolioId(null);
                          setDragOverPortfolioId(null);
                        }}
                        className={`group relative flex items-center rounded-xl transition-all ${
                          isBeingDragged
                            ? 'opacity-40 scale-[0.98] ring-1 ring-slate-400/50'
                            : isOver
                            ? 'ring-2 ring-indigo-500/80 bg-indigo-50/50 dark:bg-indigo-950/40'
                            : ''
                        }`}
                      >
                        {/* Tirador táctil sutil para mover con el dedo */}
                        <div
                          onTouchStart={(e) => handleTouchStartGrip(e, port.id)}
                          onTouchMove={handleTouchMoveGrip}
                          onTouchEnd={handleTouchEndGrip}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', port.id);
                            setDraggedPortfolioId(port.id);
                          }}
                          onDragEnd={() => {
                            setDraggedPortfolioId(null);
                            setDragOverPortfolioId(null);
                          }}
                          className="touch-none cursor-grab active:cursor-grabbing p-2 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 select-none shrink-0"
                          title="Arrastrar con el dedo para mover"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        {/* Botón de selección de cartera */}
                        <button
                          onClick={() => {
                            onSwitchPortfolio?.(port.id);
                            setShowPortfolioDropdown(false);
                          }}
                          className={`flex-1 flex items-center justify-between py-2 pr-3 pl-0.5 text-xs font-bold transition-colors rounded-r-xl ${
                            isSelected
                              ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{port.icon || '💼'}</span>
                            <span className="truncate">{port.name}</span>
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setShowPortfolioDropdown(false);
                      onGoToProfile();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                    <span>Gestionar / Añadir carteras</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Conmutador Superior: Cartera vs Dividendos */}
        <div className="inline-flex p-0.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shrink-0">
          <button
            onClick={() => setActiveSubTab('portafolio')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeSubTab === 'portafolio'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            💼 Cartera
          </button>
          <button
            onClick={() => setActiveSubTab('dividendos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 ${
              activeSubTab === 'dividendos'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600'
            }`}
          >
            <span>💰 Dividendos</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO SEGÚN LA SUB-PESTAÑA ACTIVA */}
      {activeSubTab === 'portafolio' && (
        <>
          {/* 3. Bloque "VALOR DE MERCADO" con ojo, variación diaria y P/G abierto */}
          <section className="text-center px-4 pt-1 pb-2">
            <div className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase mb-0.5">
              <span>VALOR DE MERCADO</span>
              <button
                onClick={onToggleHideFigures}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-0.5 transition-colors"
                title={hideFigures ? 'Mostrar cifras' : 'Ocultar cifras'}
              >
                {hideFigures ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Cifra grande principal formateada: €25.869,94 */}
            <div className="flex items-baseline justify-center tracking-tight text-slate-950 dark:text-white font-black text-4xl sm:text-5xl my-0.5">
              <span className="text-2xl sm:text-3xl font-bold mr-0.5">€</span>
              <span>{headerFormatted.integerPart}</span>
              <span className="text-2xl sm:text-3xl font-bold">,{headerFormatted.decimalPart}</span>
            </div>

            {/* Métricas Oficiales DEGIRO / Cartera */}
            <div className="flex items-center justify-center gap-3 text-xs font-semibold mt-1.5">
              <span className={`inline-flex items-center gap-1 font-bold ${displayDiaBp >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                <span>Día B/P:</span>
                <span>{displayDiaBp >= 0 ? '+' : ''}{formatEUR(displayDiaBp, hideFigures)} ({displayDiaBpPct >= 0 ? '+' : ''}{displayDiaBpPct.toFixed(2)}%)</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className={`inline-flex items-center gap-1 font-extrabold ${displayTotalBp >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                <span>Total B/P:</span>
                <span>{displayTotalBp >= 0 ? '+' : ''}{formatEUR(displayTotalBp, hideFigures)}</span>
              </span>
            </div>

            {/* Fila de desglose DEGIRO / Cartera: Cartera + EUR + Margen Libre */}
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              <span>Cartera: <strong className="text-slate-800 dark:text-slate-200">{formatEUR(displayCarteraVal, hideFigures)}</strong></span>
              <span>•</span>
              <span>EUR: <strong className="text-emerald-500">{formatEUR(displayCashVal, hideFigures)}</strong></span>
              <span>•</span>
              <span>Margen libre: <strong className="text-slate-700 dark:text-slate-300">{formatEUR(displayMargenLibre, hideFigures)}</strong></span>
            </div>

            {/* Indicador de actualización de cotizaciones en tiempo real */}
            {onRefreshLiveQuotes && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  onClick={onRefreshLiveQuotes}
                  disabled={isRefreshingLive}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200/80 dark:border-slate-700/80 shadow-2xs disabled:opacity-60"
                  title="Actualizar cotizaciones en vivo con Yahoo Finance y CoinGecko"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{isRefreshingLive ? 'Actualizando...' : 'Cotizaciones en vivo'}</span>
                  <RefreshCw className={`w-3 h-3 ${isRefreshingLive ? 'animate-spin text-emerald-500' : 'text-slate-400'}`} />
                </button>
                {lastUpdatedTime && (
                  <span className="text-[10px] text-slate-400">
                    {lastUpdatedTime}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* 4. Gráfico interactivo con selector de rango */}
          <section className="mt-2 mb-4">
            <InteractiveChart
              data={chartPoints}
              selectedRange={selectedTimeRange}
              onRangeChange={onSelectTimeRange}
              onExpand={() => setShowChartModal(true)}
              hideFigures={hideFigures}
            />
          </section>

          {/* 5. Tarjetas horizontales ("Analíticas", "Efectivo", "Meta") */}
          <section className="px-4 mb-5">
            <div className="grid grid-cols-3 gap-2.5">
              {/* Tarjeta 1: Analíticas con gráfico circular tipo donut */}
              <button
                onClick={() => setShowAnalyticsModal(true)}
                className="bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 text-left hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs flex flex-col justify-between h-24"
              >
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Analíticas</span>
                <div className="flex items-center justify-between">
                  {/* Donut mini SVG */}
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" strokeWidth="4" className="dark:stroke-slate-800" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="4"
                      strokeDasharray={`${accionesPct} 100`}
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#EAB308"
                      strokeWidth="4"
                      strokeDasharray={`${etfsPct} 100`}
                      strokeDashoffset={`-${accionesPct}`}
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#A855F7"
                      strokeWidth="4"
                      strokeDasharray={`${criptoPct} 100`}
                      strokeDashoffset={`-${accionesPct + etfsPct}`}
                    />
                  </svg>
                  <span className="text-[10px] text-slate-400 font-medium">Ver</span>
                </div>
              </button>

              {/* Tarjeta 2: Efectivo */}
              <button
                onClick={() => setShowCashModal(true)}
                className="bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 text-left hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs flex flex-col justify-between h-24"
              >
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Efectivo</span>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {formatEUR(cash, hideFigures)}
                  </div>
                  <span className="text-[10px] text-emerald-500 font-semibold">+ Ajustar</span>
                </div>
              </button>

              {/* Tarjeta 3: Meta de inversión */}
              <button
                onClick={() => alert(`Meta de ahorro e inversión: ${goalProgress}% alcanzado de ${formatEUR(goalAmount, hideFigures)}`)}
                className="bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 text-left hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs flex flex-col justify-between h-24"
              >
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Meta</span>
                <div className="flex items-center justify-between">
                  {/* Circular progress */}
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="4" className="dark:stroke-slate-800" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="#F97316"
                        strokeWidth="4"
                        strokeDasharray={`${goalProgress} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-[9px] font-extrabold text-slate-700 dark:text-slate-200">{goalProgress}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{formatEUR(goalAmount, true)}</span>
                </div>
              </button>
            </div>
          </section>

          {/* Historial Global DEGIRO & Rendimiento Realizado (Solo en DEGIRO o Todas) */}
          {tradingAnalytics && isDegiroOrConsolidated && (
            <section className="px-4 mb-4">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 dark:from-slate-900/90 dark:to-slate-950/90 text-white rounded-3xl p-4 shadow-xl border border-slate-800">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs">
                      📈
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">Historial Financiero DEGIRO</h3>
                      <p className="text-[10px] text-slate-400">
                        {tradingAnalytics.startDate} al {tradingAnalytics.endDate} • {tradingAnalytics.totalTrades.toLocaleString('es-ES')} operaciones
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Auditado
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                  {/* 1. Casilla Beneficio Cerrado -> Abre ventana de beneficio cerrado */}
                  <button
                    type="button"
                    onClick={() => setShowClosedModal(true)}
                    className="bg-slate-800/50 hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-slate-700/50 cursor-pointer group focus:outline-none"
                    title="Ver detalle de beneficio cerrado y posiciones ganadoras/perdedoras"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 block">Beneficio Cerrado</span>
                      <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 transition">↗</span>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">
                      +{formatEUR(tradingAnalytics.totalRealizedPnl, hideFigures)}
                    </span>
                  </button>

                  {/* 2. Casilla Flujo Neto Retirado -> Abre ventana de flujo neto y transferencias */}
                  {tradingAnalytics.netCashFlow !== undefined && (
                    <button
                      type="button"
                      onClick={() => setShowNetCashFlowModal(true)}
                      className="bg-slate-800/50 hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-slate-700/50 cursor-pointer group focus:outline-none"
                      title="Ver detalle de depósitos, retiradas a banco y saldo neto extraído"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-400 block">Flujo Neto Retirado</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-emerald-300 transition">↗</span>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-300 mt-0.5 block">
                        +{formatEUR(tradingAnalytics.netCashFlow, hideFigures)}
                      </span>
                    </button>
                  )}

                  {/* 3. Casilla Dividendos Netos -> Navega directamente a la página de dividendos */}
                  {tradingAnalytics.totalDividendsReceived !== undefined && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab('dividendos');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="bg-slate-800/50 hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-slate-700/50 cursor-pointer group focus:outline-none"
                      title="Ir a la página y desglose de dividendos"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-400 block">Dividendos Netos</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-white transition">➔</span>
                      </div>
                      <span className="text-sm font-extrabold text-white mt-0.5 block">
                        +{formatEUR(tradingAnalytics.totalDividendsReceived, hideFigures)}
                      </span>
                    </button>
                  )}

                  {/* 4. Casilla Comisiones DEGIRO -> Abre ventana con todas las comisiones reflejadas */}
                  <button
                    type="button"
                    onClick={() => setShowCommissionsModal(true)}
                    className="bg-slate-800/50 hover:bg-slate-800 transition-all active:scale-[0.98] text-left rounded-2xl p-2.5 border border-slate-700/50 cursor-pointer group focus:outline-none"
                    title="Ver desglose completo de comisiones de corretaje, conectividad y cambio"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 block">Comisiones DEGIRO</span>
                      <span className="text-[10px] text-slate-500 group-hover:text-amber-400 transition">↗</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-300 mt-0.5 block">
                      {formatEUR(tradingAnalytics.totalFeesPaid, hideFigures)}
                    </span>
                  </button>
                </div>

                {/* Botón para ver desglose de beneficio por activo (117 activos) */}
                <button
                  onClick={() => setShowHistoricalModal(true)}
                  className="w-full mt-3 py-2 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-300 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <span>📊</span>
                  <span>Ver Beneficio Histórico por Acción & ETF (12 activos)</span>
                </button>
              </div>
            </section>
          )}

          {/* 6. Sección de Activos / Posiciones: Selector DEGIRO (Abiertas / Cerradas / Todas) */}
          <section className="px-4">
            <div className="flex items-center justify-between mb-3">
              {/* Botón selector idéntico al de DEGIRO */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowViewDropdown(!showViewDropdown)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white shadow-2xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  <span>
                    {positionViewMode === 'abiertas'
                      ? 'Posiciones abiertas'
                      : positionViewMode === 'cerradas'
                      ? 'Posiciones cerradas'
                      : 'Todas las posiciones'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showViewDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showViewDropdown && (
                  <div className="absolute left-0 top-10 z-40 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 w-64 text-xs">
                    <button
                      type="button"
                      onClick={() => { setPositionViewMode('abiertas'); setShowViewDropdown(false); }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        positionViewMode === 'abiertas'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">Posiciones abiertas</div>
                        <div className="text-[10px] text-slate-400">7 activos en cartera (Alemania y Milán)</div>
                      </div>
                      {positionViewMode === 'abiertas' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setPositionViewMode('cerradas'); setShowViewDropdown(false); }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        positionViewMode === 'cerradas'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">Posiciones cerradas</div>
                        <div className="text-[10px] text-slate-400">116 activos cerrados (+28.145,97 € B/P)</div>
                      </div>
                      {positionViewMode === 'cerradas' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setPositionViewMode('todas'); setShowViewDropdown(false); }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        positionViewMode === 'todas'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs">Todas las posiciones</div>
                        <div className="text-[10px] text-slate-400">123 activos totales (abiertas + cerradas)</div>
                      </div>
                      {positionViewMode === 'todas' && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Botón de orden/filtro con icono de deslizadores */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                  {positionViewMode === 'abiertas'
                    ? `${filteredPositions.length} abiertas`
                    : positionViewMode === 'cerradas'
                    ? `${filteredClosedPositions.length} cerradas`
                    : `${filteredPositions.length + filteredClosedPositions.length} total`}
                </span>

                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
                    title="Ordenar posiciones"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-10 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 w-52 text-xs">
                      <div className="px-3 py-1 font-bold text-slate-400 uppercase text-[10px]">Ordenar por</div>
                      <button
                        onClick={() => { setPositionSort('value-desc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'value-desc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Mayor valor / beneficio</span>
                        {positionSort === 'value-desc' && <span>✓</span>}
                      </button>
                      <button
                        onClick={() => { setPositionSort('change-desc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'change-desc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Mayor rentabilidad</span>
                        {positionSort === 'change-desc' && <span>✓</span>}
                      </button>
                      <button
                        onClick={() => { setPositionSort('change-asc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'change-asc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Mayor caída</span>
                        {positionSort === 'change-asc' && <span>✓</span>}
                      </button>
                      <button
                        onClick={() => { setPositionSort('name-asc'); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between ${positionSort === 'name-asc' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span>Nombre alfabético</span>
                        {positionSort === 'name-asc' && <span>✓</span>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chips de filtro rápido por tipo */}
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
              {(['Todos', 'Acciones', 'ETFs', 'Fondos', 'Inmobiliario', 'Cripto'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedAssetFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors shrink-0 ${
                    selectedAssetFilter === f
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f === 'Inmobiliario' ? 'Inmobiliario (Urbanitae)' : f}
                </button>
              ))}
            </div>

            {/* VISTA 1: POSICIONES ABIERTAS (O TODAS) */}
            {(positionViewMode === 'abiertas' || positionViewMode === 'todas') && (
              <>
                {filteredPositions.length === 0 && (
                  <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 my-4">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl mb-2.5 shadow-2xs">
                      {portfolios.find(p => p.id === activePortfolioId)?.icon || '💼'}
                    </div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                      Cartera {portfolios.find(p => p.id === activePortfolioId)?.name || ''} sin activos registrados
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Esta cartera está vacía. No se muestran datos ficticios; solo datos 100% reales cuando se registren.
                    </p>
                    <button
                      onClick={onOpenImport}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Importar o Añadir Activo</span>
                    </button>
                  </div>
                )}

                {/* 1. SECCIÓN: ACCIONES (ARRIBA) */}
                {filteredPositions.length > 0 && (selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Acciones') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Acciones ({stockPositions.length})
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {formatEUR(accionesVal, hideFigures)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {stockPositions.length > 0 ? (
                        stockPositions.map(pos => {
                          const isLoss = pos.dailyChangePct < 0;
                          return (
                            <div
                              key={pos.id}
                              onClick={() => setSelectedPosition(pos)}
                              className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${pos.logoBg || 'bg-slate-800'}`}>
                                  {pos.logoText || pos.ticker.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                    <span>{pos.name}</span>
                                    {pos.countryFlag && <span className="text-xs">{pos.countryFlag}</span>}
                                    {positionViewMode === 'todas' && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                        Abierta
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                    {pos.exchange || (pos.currency === 'USD' ? 'NYSE' : 'BME')} | {pos.currency === 'USD' ? '$' : '€'} {pos.currentPrice} × {pos.shares}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                  {formatEUR(pos.totalValue, hideFigures)}
                                </div>
                                {pos.unrealizedGainLoss !== undefined && pos.unrealizedGainLoss !== 0 ? (
                                  <div className={`text-[11px] font-bold ${pos.unrealizedGainLoss < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {pos.unrealizedGainLoss > 0 ? '+' : ''}{formatEUR(pos.unrealizedGainLoss, hideFigures)} ({pos.unrealizedGainLossPct !== undefined ? `${pos.unrealizedGainLossPct > 0 ? '+' : ''}${pos.unrealizedGainLossPct.toFixed(2)}%` : ''})
                                  </div>
                                ) : (
                                  <div className={`text-[11px] font-bold ${isLoss ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {pos.dailyChangeValue > 0 ? '+' : ''}{formatEUR(pos.dailyChangeValue, hideFigures)} ({pos.dailyChangePct > 0 ? '+' : ''}{pos.dailyChangePct.toFixed(2)}%)
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400 py-2 italic text-center">No hay acciones abiertas</p>
                      )}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 1: FONDOS DE INVERSIÓN (MYINVESTOR / FONDOS INDEXADOS) */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Fondos') && fondosPositions.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        <span>
                          {activePortfolioId === 'bbva'
                            ? `Planes de Pensiones BBVA (${fondosPositions.length})`
                            : activePortfolioId === 'myinvestor'
                            ? `Fondos de Inversión MyInvestor (${fondosPositions.length})`
                            : `Fondos de Inversión y Pensiones (${fondosPositions.length})`}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {formatEUR(fondosVal, hideFigures)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {fondosPositions.map(pos => (
                        <div
                          key={pos.id}
                          onClick={() => setSelectedPosition(pos)}
                          className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${pos.logoBg || 'bg-emerald-700'}`}>
                              {pos.logoText || pos.ticker.slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                <span>{pos.name}</span>
                                {pos.countryFlag && <span className="text-xs">{pos.countryFlag}</span>}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                                {pos.market || (pos.broker === 'BBVA' ? 'BBVA Pensiones' : 'MyInvestor')} | € {pos.currentPrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {pos.shares} part.
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                              {formatEUR(pos.totalValue, hideFigures)}
                            </div>
                            {pos.unrealizedGainLoss !== undefined && pos.unrealizedGainLoss !== 0 ? (
                              <div className={`text-[11px] font-bold ${pos.unrealizedGainLoss < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {pos.unrealizedGainLoss > 0 ? '+' : ''}{formatEUR(pos.unrealizedGainLoss, hideFigures)} ({pos.unrealizedGainLossPct !== undefined ? `${pos.unrealizedGainLossPct > 0 ? '+' : ''}${pos.unrealizedGainLossPct.toFixed(2)}%` : ''})
                              </div>
                            ) : (
                              <div className="text-[11px] font-semibold text-emerald-500">
                                {pos.purchaseDate ? formatDateToSpanish(pos.purchaseDate) : 'Fondo Indexado'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 2: CROWDFUNDING INMOBILIARIO (URBANITAE) */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Inmobiliario') && inmobiliarioPositions.length > 0 && (
                  <div className="mb-6 bg-slate-50/70 dark:bg-slate-900/40 p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800">
                    {/* Encabezado General */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Crowdfunding Inmobiliario ({inmobiliarioPositions.length} Proyectos)</span>
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          Inversión inmobiliaria participativa en SPVs y Préstamos garantizados (Urbanitae • CNMV nº 4)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {formatEUR(inmobiliarioVal, hideFigures)}
                        </span>
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          100% Financiados
                        </div>
                      </div>
                    </div>

                    {/* Selector de Separación Individual: Todos / Plusvalía / Préstamos */}
                    <div className="flex items-center gap-1.5 mb-3.5 overflow-x-auto no-scrollbar pb-1">
                      <button
                        onClick={() => setUrbanitaeSubFilter('todos')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                          urbanitaeSubFilter === 'todos'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Ver Todos ({inmobiliarioPositions.length})
                      </button>
                      <button
                        onClick={() => setUrbanitaeSubFilter('plusvalia')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                          urbanitaeSubFilter === 'plusvalia'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>📈 Plusvalía ({plusvaliaPositions.length})</span>
                        <span className="text-[10px] opacity-80 font-mono">({formatEUR(plusvaliaVal, hideFigures)})</span>
                      </button>
                      <button
                        onClick={() => setUrbanitaeSubFilter('prestamo')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                          urbanitaeSubFilter === 'prestamo'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>🤝 Préstamos ({prestamoPositions.length})</span>
                        <span className="text-[10px] opacity-80 font-mono">({formatEUR(prestamoVal, hideFigures)})</span>
                      </button>
                    </div>

                    {/* BLOQUE A: PROYECTOS DE PLUSVALÍA (EQUITY) */}
                    {(urbanitaeSubFilter === 'todos' || urbanitaeSubFilter === 'plusvalia') && plusvaliaPositions.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                              Proyectos en Plusvalía / Equity ({plusvaliaPositions.length})
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                            {formatEUR(plusvaliaVal, hideFigures)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {plusvaliaPositions.map(pos => (
                            <div
                              key={pos.id}
                              onClick={() => setSelectedPosition(pos)}
                              className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/90 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                    •U
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1">
                                      <span>{pos.name}</span>
                                      {pos.countryFlag && <span>{pos.countryFlag}</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                      {pos.ticker}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-black text-slate-950 dark:text-white text-xs">
                                    {formatEUR(pos.totalValue, hideFigures)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 mt-1">
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  Plusvalía • SPV
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
                                  {(pos.market || '').replace(/Urbanitae • Crowdfunding Inmobiliario \((Plusvalía • )?/, '').replace(/\)$/, '')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* BLOQUE B: PROYECTOS DE PRÉSTAMO (DEUDA GARANTIZADA) */}
                    {(urbanitaeSubFilter === 'todos' || urbanitaeSubFilter === 'prestamo') && prestamoPositions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
                              Proyectos en Préstamo / Deuda Garantizada ({prestamoPositions.length})
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                            {formatEUR(prestamoVal, hideFigures)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {prestamoPositions.map(pos => (
                            <div
                              key={pos.id}
                              onClick={() => setSelectedPosition(pos)}
                              className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/90 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                    •U
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1">
                                      <span>{pos.name}</span>
                                      {pos.countryFlag && <span>{pos.countryFlag}</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                      {pos.ticker}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-black text-slate-950 dark:text-white text-xs">
                                    {formatEUR(pos.totalValue, hideFigures)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 mt-1">
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                                  Préstamo • Garantía
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
                                  {(pos.market || '').replace(/Urbanitae • Crowdfunding Inmobiliario \((Préstamo • )?/, '').replace(/\)$/, '')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SECCIÓN 3: TRACKERS (ETFS) */}
                {filteredPositions.length > 0 && (selectedAssetFilter === 'Todos' || selectedAssetFilter === 'ETFs') && etfPositions.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Trackers (ETFs) ({etfPositions.length})
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {formatEUR(etfsVal, hideFigures)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {etfPositions.map(pos => (
                        <div
                          key={pos.id}
                          onClick={() => setSelectedPosition(pos)}
                          className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${pos.logoBg || 'bg-blue-700'}`}>
                              {pos.logoText || pos.ticker.slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                <span>{pos.name}</span>
                                {pos.countryFlag && <span className="text-xs">{pos.countryFlag}</span>}
                                {positionViewMode === 'todas' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    Abierta
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                {pos.exchange || 'XETR'} | € {pos.currentPrice} × {pos.shares}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                              {formatEUR(pos.totalValue, hideFigures)}
                            </div>
                            {pos.unrealizedGainLoss !== undefined && pos.unrealizedGainLoss !== 0 ? (
                              <div className={`text-[11px] font-bold ${pos.unrealizedGainLoss < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {pos.unrealizedGainLoss > 0 ? '+' : ''}{formatEUR(pos.unrealizedGainLoss, hideFigures)} ({pos.unrealizedGainLossPct !== undefined ? `${pos.unrealizedGainLossPct > 0 ? '+' : ''}${pos.unrealizedGainLossPct.toFixed(2)}%` : ''})
                              </div>
                            ) : (
                              <div className={`text-[11px] font-bold ${pos.dailyChangePct < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {pos.dailyChangeValue > 0 ? '+' : ''}{formatEUR(pos.dailyChangeValue, hideFigures)} ({pos.dailyChangePct > 0 ? '+' : ''}{pos.dailyChangePct.toFixed(2)}%)
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 4: CRIPTOACTIVOS (KRAKEN / OTROS) */}
                {filteredPositions.length > 0 && (selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Cripto') && (cryptoPositions.length > 0 || activePortfolioId === 'kraken') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>🐙</span>
                        <span>Criptoactivos {activePortfolioId === 'kraken' ? 'Kraken' : ''} ({cryptoPositions.length + (activePortfolioId === 'kraken' ? 1 : 0)})</span>
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {formatEUR(criptoVal + (activePortfolioId === 'kraken' ? activeCash : 0), hideFigures)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {cryptoPositions.map(pos => {
                        const isBitcoin = pos.ticker === 'BTC' || pos.name.toUpperCase().includes('BITCOIN');
                        const isEth = pos.ticker === 'ETH' || pos.name.toUpperCase().includes('ETHEREUM');
                        const isPaxg = pos.ticker === 'PAXG' || pos.name.toUpperCase().includes('GOLD');

                        return (
                          <div
                            key={pos.id}
                            onClick={() => setSelectedPosition(pos)}
                            className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${isBitcoin ? 'bg-amber-600' : isEth ? 'bg-indigo-600' : isPaxg ? 'bg-amber-500' : pos.logoBg || 'bg-purple-700'}`}>
                                {isBitcoin ? '₿' : isEth ? 'Ξ' : isPaxg ? '🥇' : pos.logoText || pos.ticker.slice(0, 3)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                  <span>{pos.name}</span>
                                  <span className="text-xs">{pos.ticker}</span>
                                  {pos.broker === 'Kraken' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                                      Kraken
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                  {pos.market || 'Kraken'} | € {pos.currentPrice} × {pos.shares}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {formatEUR(pos.totalValue, hideFigures)}
                              </div>
                              {pos.unrealizedGainLoss !== undefined && pos.unrealizedGainLoss !== 0 ? (
                                <div className={`text-[11px] font-bold ${pos.unrealizedGainLoss < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {pos.unrealizedGainLoss > 0 ? '+' : ''}{formatEUR(pos.unrealizedGainLoss, hideFigures)} ({pos.unrealizedGainLossPct !== undefined ? `${pos.unrealizedGainLossPct > 0 ? '+' : ''}${pos.unrealizedGainLossPct.toFixed(2)}%` : ''})
                                </div>
                              ) : (
                                <div className={`text-[11px] font-bold ${pos.dailyChangePct < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {pos.dailyChangeValue > 0 ? '+' : ''}{formatEUR(pos.dailyChangeValue, hideFigures)} ({pos.dailyChangePct > 0 ? '+' : ''}{pos.dailyChangePct.toFixed(2)}%)
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Fila de Efectivo EUR en Kraken si estamos en la cartera Kraken */}
                      {activePortfolioId === 'kraken' && (
                        <div className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 bg-emerald-600">
                              €
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                                <span>Euro Efectivo</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  Liquidez
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                Kraken EUR Cash | Coste 1.014,87 €
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                              {formatEUR(activeCash, hideFigures)}
                            </div>
                            <div className="text-[11px] font-bold text-rose-500">
                              -4,79 € (-0,47%)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VISTA 2: POSICIONES CERRADAS (O TODAS) */}
            {(positionViewMode === 'cerradas' || positionViewMode === 'todas') && (
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="bg-slate-900 text-white rounded-2xl p-3 mb-4 shadow-sm flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Total Beneficio Cerrado</span>
                    <span className="text-base font-black text-emerald-400">+{formatEUR(accountSummary.historicoCerradoPnl, hideFigures)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold">Total Operaciones</span>
                    <span className="text-xs font-bold text-slate-200">{tradingAnalytics?.totalTrades || 190} trades (2022–2026)</span>
                  </div>
                </div>

                {/* Acciones Cerradas */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'Acciones') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        🏢 Acciones Cerradas ({closedStocks.length})
                      </span>
                    </div>

                    <div className="space-y-1">
                      {closedStocks.map(pos => {
                        const isPos = pos.realized_pnl >= 0;
                        return (
                          <div
                            key={pos.id}
                            className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-9 h-9 rounded-xl bg-slate-800 text-white text-xs font-black flex items-center justify-center shrink-0">
                                {pos.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                  <span>{pos.name}</span>
                                  <span className="text-xs">{pos.flag}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    Cerrada
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {pos.exchange} • {pos.trades_count} trades • {pos.first_trade} → {pos.last_trade}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-black text-xs ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isPos ? '+' : ''}{formatEUR(pos.realized_pnl, hideFigures)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Com: {pos.total_fees.toFixed(2)} €
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ETFs Cerrados */}
                {(selectedAssetFilter === 'Todos' || selectedAssetFilter === 'ETFs' || selectedAssetFilter === 'Cripto') && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        📈 Trackers (ETFs) Cerrados ({closedEtfsAndCrypto.length})
                      </span>
                    </div>

                    <div className="space-y-1">
                      {closedEtfsAndCrypto.map(pos => {
                        const isPos = pos.realized_pnl >= 0;
                        return (
                          <div
                            key={pos.id}
                            className="flex items-center justify-between py-2.5 px-2.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-9 h-9 rounded-xl bg-blue-800 text-white text-xs font-black flex items-center justify-center shrink-0">
                                {pos.name.slice(0, 3)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                  <span>{pos.name}</span>
                                  <span className="text-xs">{pos.flag}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    Cerrada
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {pos.exchange} • {pos.trades_count} trades • {pos.first_trade} → {pos.last_trade}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-black text-xs ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isPos ? '+' : ''}{formatEUR(pos.realized_pnl, hideFigures)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Com: {pos.total_fees.toFixed(2)} €
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botón inferior para importar más posiciones */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2.5">
              <button
                onClick={onOpenImport}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Subir DEGIRO / MyInvestor</span>
              </button>
              <button
                onClick={onOpenSearch}
                className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Añadir manual</span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* PESTAÑA: DIVIDENDOS */}
      {activeSubTab === 'dividendos' && (
        <section className="px-4">
          <DividendAuditView hideFigures={hideFigures} />
        </section>
      )}



      {/* MODAL DETALLE DE POSICIÓN */}
      {selectedPosition && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${selectedPosition.logoBg || 'bg-slate-800'}`}>
                  {selectedPosition.logoText || selectedPosition.ticker.slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedPosition.name}</h3>
                  <div className="text-xs text-slate-500">{selectedPosition.ticker} • {selectedPosition.type}</div>
                </div>
              </div>
              <button onClick={() => setSelectedPosition(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedPosition.purchaseDate && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-2.5 rounded-2xl my-3 flex items-center justify-between text-xs">
                <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Fecha de compra:</span>
                </span>
                <span className="font-extrabold text-emerald-900 dark:text-emerald-200">
                  {formatDateToSpanish(selectedPosition.purchaseDate)}
                </span>
              </div>
            )}

            {selectedPosition.broker === 'Urbanitae' ? (
              <div className="space-y-3 my-4">
                <div className="flex items-center justify-between p-3 rounded-2xl border text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700">
                  <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <span>Tipo de Inversión:</span>
                  </span>
                  {selectedPosition.market?.includes('Plusvalía') ? (
                    <span className="font-black px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      📈 Plusvalía (Equity SPV)
                    </span>
                  ) : (
                    <span className="font-black px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                      🤝 Préstamo a Tipo Fijo (Garantía)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Inversión Aportada</span>
                    <div className="text-base font-black text-slate-900 dark:text-white">{formatEUR(selectedPosition.totalValue)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Estado</span>
                    <div className="text-base font-black text-emerald-600">Financiado</div>
                  </div>
                  <div className="col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Regulación & Plataforma</span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                      Urbanitae (PSFP nº 4 CNMV) • Crowdfunding Inmobiliario
                    </div>
                  </div>
                  <div className="col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Detalles de Participación</span>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      {selectedPosition.market}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500">Títulos en posesión</span>
                  <div className="text-base font-bold text-slate-900">{selectedPosition.shares}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500">Precio de compra medio</span>
                  <div className="text-base font-bold text-slate-900">{formatEUR(selectedPosition.avgPrice)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500">Cotización actual</span>
                  <div className="text-base font-bold text-slate-900">{formatEUR(selectedPosition.currentPrice)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500">Valor de posición</span>
                  <div className="text-base font-bold text-slate-900">{formatEUR(selectedPosition.totalValue)}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  const promptMsg = selectedPosition.broker === 'Urbanitae' ? 'Modificar importe invertido (€):' : 'Modificar número de títulos:';
                  const defaultVal = selectedPosition.broker === 'Urbanitae' ? selectedPosition.totalValue.toString() : selectedPosition.shares.toString();
                  const newVal = prompt(promptMsg, defaultVal);
                  if (newVal && !isNaN(Number(newVal))) {
                    const valNum = Number(newVal);
                    if (selectedPosition.broker === 'Urbanitae') {
                      onUpdatePosition({
                        ...selectedPosition,
                        avgPrice: valNum,
                        currentPrice: valNum,
                        totalValue: valNum,
                      });
                    } else {
                      onUpdatePosition({
                        ...selectedPosition,
                        shares: valNum,
                        totalValue: Number((valNum * selectedPosition.currentPrice).toFixed(2)),
                      });
                    }
                    setSelectedPosition(null);
                  }
                }}
                className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-slate-800 transition-colors"
              >
                {selectedPosition.broker === 'Urbanitae' ? 'Editar importe (€)' : 'Editar títulos'}
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar ${selectedPosition.name} de la cartera?`)) {
                    onDeletePosition(selectedPosition.id);
                    setSelectedPosition(null);
                  }
                }}
                className="w-10 h-10 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                title="Eliminar posición"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EFECTIVO */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base mb-1">Efectivo disponible</h3>
            <p className="text-xs text-slate-500 mb-4">Indica la liquidez sin invertir en tu cuenta broker.</p>
            <input
              type="number"
              step="any"
              value={cashInput}
              onChange={e => setCashInput(e.target.value)}
              className="w-full text-2xl font-bold text-slate-900 border border-slate-300 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              placeholder="0,00"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCashModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(cashInput) || 0;
                  onUpdateCash(val);
                  setShowCashModal(false);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ANALÍTICAS DE DISTRIBUCIÓN */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Distribución de activos</h3>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Acciones</span>
                  <span>{accionesPct}% ({formatEUR(accionesVal, hideFigures)})</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${accionesPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Trackers (ETFs)</span>
                  <span>{etfsPct}% ({formatEUR(etfsVal, hideFigures)})</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${etfsPct}%` }}></div>
                </div>
              </div>

              {fondosVal > 0 && (
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{activePortfolioId === 'bbva' ? 'Planes de Pensiones' : 'Fondos de Inversión / Pensiones'}</span>
                    <span>{fondosPct}% ({formatEUR(fondosVal, hideFigures)})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${fondosPct}%` }}></div>
                  </div>
                </div>
              )}

              {inmobiliarioVal > 0 && (
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>Crowdfunding Inmobiliario</span>
                    <span>{inmobiliarioPct}% ({formatEUR(inmobiliarioVal, hideFigures)})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${inmobiliarioPct}%` }}></div>
                  </div>
                </div>
              )}

              {criptoVal > 0 && (
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>Cripto</span>
                    <span>{criptoPct}% ({formatEUR(criptoVal, hideFigures)})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${criptoPct}%` }}></div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAnalyticsModal(false)}
              className="w-full mt-6 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL GRÁFICO AMPLIADO */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs text-slate-400">VALOR EN TIEMPO REAL</span>
              <div className="text-2xl font-black">{formatEUR(metrics.totalMarketValue, hideFigures)}</div>
            </div>
            <button
              onClick={() => setShowChartModal(false)}
              className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <InteractiveChart
              data={chartPoints}
              selectedRange={selectedTimeRange}
              onRangeChange={onSelectTimeRange}
              hideFigures={hideFigures}
            />
          </div>
          <div className="text-center text-xs text-slate-400 pb-4">
            Toca o desliza sobre el gráfico para consultar los puntos horarios
          </div>
        </div>
      )}

      {/* MODAL BENEFICIO HISTÓRICO POR ACCIÓN O ETF (117 ACTIVOS) */}
      <HistoricalAssetModal
        isOpen={showHistoricalModal}
        onClose={() => setShowHistoricalModal(false)}
        hideFigures={hideFigures}
      />

      {/* MODAL COMISIONES DEGIRO */}
      <CommissionsModal
        isOpen={showCommissionsModal}
        onClose={() => setShowCommissionsModal(false)}
        hideFigures={hideFigures}
      />

      {/* MODAL FLUJO NETO Y MOVIMIENTO DE FONDOS */}
      <NetCashFlowModal
        isOpen={showNetCashFlowModal}
        onClose={() => setShowNetCashFlowModal(false)}
        hideFigures={hideFigures}
      />

      {/* MODAL BENEFICIO CERRADO */}
      <ClosedProfitsModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        hideFigures={hideFigures}
      />
    </div>
  );
};
