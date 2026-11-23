import React, { useState, useEffect } from 'react';
import { PortfolioState, PortfolioMeta } from '../types/portfolio';
import { portfolioService } from '../services/portfolioService';
import { SupabaseService } from '../services/supabaseService';
import { biometricService } from '../services/biometricService';
import {
  User,
  Shield,
  Coins,
  Briefcase,
  Upload,
  Download,
  RotateCcw,
  Plus,
  Check,
  ChevronRight,
  Database,
  CloudCheck,
  Info,
  Sun,
  Moon,
  Laptop,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
  X,
  Wallet,
  RefreshCw,
  Fingerprint,
  GripVertical,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface ProfileViewProps {
  portfolioState: PortfolioState;
  onUpdateCurrency: (currency: 'EUR' | 'USD' | 'GBP') => void;
  onUpdateTheme: (theme: 'light' | 'dark' | 'system') => void;
  onSwitchPortfolio: (portfolioId: string) => void;
  onAddPortfolio: (name: string, broker?: string, icon?: string, cash?: number) => void;
  onToggleHidePortfolio?: (portfolioId: string) => void;
  onDeletePortfolio?: (portfolioId: string) => void;
  onOpenImport: () => void;
  onResetDemo: () => void;
  onRestoreState: (state: PortfolioState) => void;
  hasPin?: boolean;
  onStartSetPin?: () => void;
  onDisablePin?: () => void;
  onLockNow?: () => void;
  onReorderPortfolios?: (newPortfolios: PortfolioMeta[]) => void;
}

const BROKER_OPTIONS = [
  { name: 'DEGIRO', icon: '🏛️' },
  { name: 'MyInvestor', icon: '🏦' },
  { name: 'Kraken', icon: '🐙' },
  { name: 'Interactive Brokers', icon: '📈' },
  { name: 'Trade Republic', icon: '🚀' },
  { name: 'Binance', icon: '⚡' },
  { name: 'Revolut', icon: '💎' },
  { name: 'Indexa Capital', icon: '🌍' },
  { name: 'Otro / Personal', icon: '💼' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  portfolioState,
  onUpdateCurrency,
  onUpdateTheme,
  onSwitchPortfolio,
  onAddPortfolio,
  onToggleHidePortfolio,
  onDeletePortfolio,
  onOpenImport,
  onResetDemo,
  onRestoreState,
  hasPin = false,
  onStartSetPin,
  onDisablePin,
  onLockNow,
  onReorderPortfolios,
}) => {
  const [showAddPort, setShowAddPort] = useState(false);
  const [newPortName, setNewPortName] = useState('');
  const [newPortBroker, setNewPortBroker] = useState('DEGIRO');
  const [newPortIcon, setNewPortIcon] = useState('💼');
  const [newPortCash, setNewPortCash] = useState('0');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(() => biometricService.isEnabled());

  useEffect(() => {
    biometricService.isAvailable().then(setBiometricAvailable);
  }, []);

  // Reordenación táctil con el dedo y orden inteligente por uso
  const [draggedPortfolioId, setDraggedPortfolioId] = useState<string | null>(null);
  const [dragOverPortfolioId, setDragOverPortfolioId] = useState<string | null>(null);
  const [sortNotification, setSortNotification] = useState<string | null>(null);

  const listContainerRef = React.useRef<HTMLDivElement | null>(null);
  const pointerStateRef = React.useRef<{
    fromId: string | null;
    currentOverId: string | null;
    startY: number;
    hasMoved: boolean;
  }>({ fromId: null, currentOverId: null, startY: 0, hasMoved: false });

  const handleSortByUsage = () => {
    if (!portfolioState.portfolios || !onReorderPortfolios) return;
    const todas = portfolioState.portfolios.find(p => p.id === 'todas');
    const others = portfolioState.portfolios.filter(p => p.id !== 'todas');
    
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
    if (!portfolioState.portfolios || !onReorderPortfolios || fromId === toId) return;
    const currentList = [...portfolioState.portfolios];
    const fromIndex = currentList.findIndex(p => p.id === fromId);
    const toIndex = currentList.findIndex(p => p.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = currentList.splice(fromIndex, 1);
    currentList.splice(toIndex, 0, moved);
    onReorderPortfolios(currentList);
  };

  const handleShiftPortfolio = (portId: string, direction: 'up' | 'down') => {
    if (!portfolioState.portfolios || !onReorderPortfolios) return;
    const currentList = [...portfolioState.portfolios];
    const index = currentList.findIndex(p => p.id === portId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const [moved] = currentList.splice(index, 1);
    currentList.splice(targetIndex, 0, moved);
    onReorderPortfolios(currentList);
  };

  const handlePointerDownGrip = (e: React.PointerEvent, portId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    pointerStateRef.current = {
      fromId: portId,
      currentOverId: portId,
      startY: e.clientY,
      hasMoved: false,
    };
    setDraggedPortfolioId(portId);
    setDragOverPortfolioId(portId);
  };

  const handlePointerMoveGrip = (e: React.PointerEvent) => {
    if (!pointerStateRef.current.fromId) return;
    const diff = Math.abs(e.clientY - pointerStateRef.current.startY);
    if (diff > 4) {
      pointerStateRef.current.hasMoved = true;
    }

    const container = listContainerRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>('[data-portfolio-id]');
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const overId = items[i].getAttribute('data-portfolio-id');
        if (overId && overId !== pointerStateRef.current.currentOverId) {
          pointerStateRef.current.currentOverId = overId;
          setDragOverPortfolioId(overId);
        }
        break;
      }
    }
  };

  const handlePointerUpGrip = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    const { fromId, currentOverId, hasMoved } = pointerStateRef.current;
    if (fromId && currentOverId && hasMoved && fromId !== currentOverId) {
      handleMovePortfolio(fromId, currentOverId);
    }
    pointerStateRef.current = { fromId: null, currentOverId: null, startY: 0, hasMoved: false };
    setDraggedPortfolioId(null);
    setDragOverPortfolioId(null);
  };

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      biometricService.disable();
      setBiometricEnabled(false);
    } else {
      const ok = await biometricService.register('José Manuel');
      if (ok) {
        setBiometricEnabled(true);
        alert('👆 Huella / Face ID activado correctamente en este dispositivo.');
      } else {
        alert('No se pudo activar la biometría en este navegador o fue cancelada.');
      }
    }
  };

  // Configuración de Supabase Gratis en la Nube
  const savedCloud = SupabaseService.getSavedConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(savedCloud?.url || '');
  const [supabaseKey, setSupabaseKey] = useState(savedCloud?.anonKey || '');
  const [cloudConnected, setCloudConnected] = useState(Boolean(savedCloud?.enabled));
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudMessage, setCloudMessage] = useState('');
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) return;
    setIsSyncingCloud(true);
    setCloudMessage('');
    const ok = await SupabaseService.init(supabaseUrl, supabaseKey);
    if (ok) {
      const pushed = await SupabaseService.syncNow(portfolioState);
      setCloudConnected(true);
      setCloudMessage(pushed ? '✅ Conectado y datos sincronizados en la nube.' : '✅ Conectado correctamente.');
    } else {
      setCloudConnected(false);
      setCloudMessage('⚠️ No se pudo conectar. Revisa la URL, la Anon Key o que la tabla SQL esté creada.');
    }
    setIsSyncingCloud(false);
  };

  const handleSyncCloudNow = async () => {
    setIsSyncingCloud(true);
    const ok = await SupabaseService.syncNow(portfolioState);
    setCloudMessage(ok ? '✅ Sincronización completada ahora mismo.' : '⚠️ Error al sincronizar con la nube.');
    setIsSyncingCloud(false);
  };

  const handleDisconnectSupabase = () => {
    SupabaseService.saveConfig(null);
    setCloudConnected(false);
    setCloudMessage('Desconectado de la nube (los datos siguen guardados en tu navegador).');
  };

  const handleExportBackup = () => {
    portfolioService.exportToJson(portfolioState);
  };

  const handleExportCsv = () => {
    const header = 'Producto;Ticker;ISIN;Tipo;Broker;Títulos;Precio Compra (EUR);Precio Actual (EUR);Valor Total (EUR);P/G No Realizada (EUR);Fecha Compra';
    const rows = portfolioState.positions.map(p => {
      const formatNum = (n: number) => n.toFixed(2).replace('.', ',');
      return [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.ticker || '',
        p.isin || '',
        p.type || '',
        p.broker || 'DEGIRO',
        p.shares.toString().replace('.', ','),
        formatNum(p.avgPrice),
        formatNum(p.currentPrice),
        formatNum(p.totalValue),
        formatNum(p.unrealizedGainLoss),
        p.purchaseDate || '',
      ].join(';');
    });
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartera_jose_manuel_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const content = ev.target?.result as string;
        const restored = portfolioService.importFromJson(content);
        onRestoreState(restored);
        alert('Copia de seguridad restaurada correctamente.');
      } catch (err: any) {
        alert('Error al restaurar: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleCreatePortfolio = () => {
    if (!newPortName.trim()) return;
    const initialCash = parseFloat(newPortCash) || 0;
    onAddPortfolio(newPortName.trim(), newPortBroker, newPortIcon, initialCash);
    setNewPortName('');
    setNewPortCash('0');
    setShowAddPort(false);
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto min-h-screen bg-gradient-to-b from-[#E6F4FE] via-[#F5FAFF] to-white dark:from-[#0B1221] dark:via-[#0B0F19] dark:to-[#0B0F19]">
      {/* 1. Cabecera */}
      <header className="pt-2 pb-4">
        <h1 className="text-3xl font-black tracking-tight text-[#081C3E] dark:text-white">Perfil & Carteras</h1>
        <p className="text-xs text-[#173A6A]/80 dark:text-slate-400 font-semibold">José Manuel Portafolio • Gestión de carteras y ajustes</p>
      </header>

      {/* 2. Tarjeta de Usuario con Avatar Dorado */}
      <div className="fintech-card-blue border border-sky-200/80 dark:border-slate-800 rounded-3xl p-4 mb-4 flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0F2952] via-[#173566] to-[#0B1D3B] text-white font-black text-xl flex items-center justify-center ring-2 ring-amber-400 border-2 border-amber-200/90 shadow-[0_0_18px_rgba(251,191,36,0.55)] shrink-0">
          JM
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-black text-[#081C3E] dark:text-white text-base">José Manuel</h2>
            <span className="text-[10px] font-extrabold bg-emerald-100/90 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
              Cuenta Activa
            </span>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">jose.manuel@inversor.es • Cartera Privada</span>
        </div>
      </div>

      {/* 3. GESTOR DE CARTERAS (DEGIRO, MyInvestor, Kraken, Todas + Crear y Ocultar) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 mb-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Gestión de Carteras</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSortByUsage}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors"
              title="Ordenar carteras automáticamente según las más usadas"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>{sortNotification || 'Ordenar por uso'}</span>
            </button>
            <button
              onClick={() => setShowAddPort(!showAddPort)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva Cartera
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          Puedes activar una cartera para ver su desglose, o pulsar el <strong>ojo (👁️)</strong> para <strong>esconderla</strong> de las pestañas principales según tus preferencias.
        </p>

        {/* Modal / Formulario para crear nueva cartera */}
        {showAddPort && (
          <div className="mb-4 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white">Crear Nueva Cartera</span>
              <button onClick={() => setShowAddPort(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nombre de la cartera</label>
              <input
                type="text"
                value={newPortName}
                onChange={e => setNewPortName(e.target.value)}
                placeholder="Ej. Trade Republic, Criptomonedas..."
                className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Entidad / Broker</label>
                <select
                  value={newPortBroker}
                  onChange={e => {
                    setNewPortBroker(e.target.value);
                    const opt = BROKER_OPTIONS.find(b => b.name === e.target.value);
                    if (opt) setNewPortIcon(opt.icon);
                  }}
                  className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  {BROKER_OPTIONS.map(b => (
                    <option key={b.name} value={b.name}>
                      {b.icon} {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Saldo inicial efectivo (€)</label>
                <input
                  type="number"
                  value={newPortCash}
                  onChange={e => setNewPortCash(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleCreatePortfolio}
              disabled={!newPortName.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar y Añadir Cartera</span>
            </button>
          </div>
        )}

        {/* Listado de Carteras con selector, visibilidad, reordenación y eliminar */}
        <div ref={listContainerRef} className="space-y-2">
          {portfolioState.portfolios.map((port, idx) => {
            const isSelected = portfolioState.activePortfolioId === port.id;
            const isHidden = port.hidden === true;
            const isProtected = port.id === 'todas';
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
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-slate-950 bg-slate-950 text-white shadow-xs dark:bg-white dark:text-slate-950 dark:border-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                } ${isHidden ? 'opacity-60 bg-slate-100/50 dark:bg-slate-900/50' : ''} ${
                  isBeingDragged
                    ? 'opacity-40 scale-[0.99] ring-1 ring-slate-400/50'
                    : isOver
                    ? 'ring-2 ring-indigo-500/80 bg-indigo-50/50 dark:bg-indigo-950/40'
                    : ''
                }`}
              >
                {/* Tirador táctil ultra-sensible con captura de puntero */}
                <div
                  onPointerDown={(e) => handlePointerDownGrip(e, port.id)}
                  onPointerMove={handlePointerMoveGrip}
                  onPointerUp={handlePointerUpGrip}
                  onPointerCancel={handlePointerUpGrip}
                  style={{ touchAction: 'none' }}
                  className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 select-none shrink-0"
                  title="Mantén pulsado y arrastra con el dedo hacia arriba o abajo"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                <div
                  className="flex-1 cursor-pointer flex items-center gap-3 pl-1"
                  onClick={() => onSwitchPortfolio(port.id)}
                >
                  <span className="text-xl shrink-0">{port.icon || '💼'}</span>
                  <div>
                    <div className="font-extrabold text-xs flex items-center gap-1.5">
                      <span>{port.name}</span>
                      {port.id === 'todas' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-400">
                          Consolidado
                        </span>
                      )}
                      {isHidden && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-500">
                          Oculta en vistas
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] ${isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`}>
                      Broker: {port.broker || port.name} • {port.currency}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Flechas para mover posición arriba o abajo */}
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleShiftPortfolio(port.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-15 transition-colors"
                      title="Mover arriba"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShiftPortfolio(port.id, 'down')}
                      disabled={idx === portfolioState.portfolios.length - 1}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-15 transition-colors"
                      title="Mover abajo"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Botón para esconder / mostrar cartera */}
                  {!isProtected && onToggleHidePortfolio && (
                    <button
                      type="button"
                      onClick={() => onToggleHidePortfolio(port.id)}
                      className={`p-1.5 rounded-xl border transition-colors ${
                        isHidden
                          ? 'text-amber-500 border-amber-300 bg-amber-50 dark:bg-amber-950/40'
                          : isSelected
                          ? 'text-slate-300 border-slate-700 hover:bg-slate-800'
                          : 'text-slate-400 border-slate-200 hover:bg-slate-100 dark:border-slate-700'
                      }`}
                      title={isHidden ? 'Cartera oculta. Pulsa para mostrarla.' : 'Cartera visible. Pulsa para esconderla.'}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Botón eliminar para carteras creadas por el usuario */}
                  {port.id !== 'todas' && port.id !== 'degiro' && port.id !== 'myinvestor' && port.id !== 'urbanitae' && port.id !== 'kraken' && port.id !== 'bbva' && onDeletePortfolio && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar la cartera "${port.name}"?`)) {
                          onDeletePortfolio(port.id);
                        }
                      }}
                      className="p-1.5 rounded-xl text-rose-500 border border-rose-200 hover:bg-rose-50 transition-colors"
                      title="Eliminar cartera"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Indicador de cartera activa */}
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Selector de Tema Visual (Claro / Oscuro AMOLED / Sistema) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 mb-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-indigo-600" />
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Tema Visual</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onUpdateTheme('light')}
            className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              (portfolioState.theme || 'light') === 'light'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-2xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Claro</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateTheme('dark')}
            className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              portfolioState.theme === 'dark'
                ? 'border-slate-900 bg-slate-900 text-white shadow-2xs dark:border-indigo-500 dark:bg-slate-800'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Oscuro</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateTheme('system')}
            className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              portfolioState.theme === 'system'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-2xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-slate-500" />
            <span>Sistema</span>
          </button>
        </div>
      </div>

      {/* 5. Seguridad & Clave PIN Familiar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 mb-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Clave de Acceso Seguro</h3>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              hasPin
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {hasPin ? 'PIN Activado' : 'Sin Protección'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          Protege tu cartera de miradas indiscretas exigiendo un código de 4 dígitos cada vez que abras la aplicación en tu móvil.
        </p>

        <div className="space-y-2">
          {hasPin ? (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onLockNow}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Bloquear Ahora</span>
                </button>
                <button
                  type="button"
                  onClick={onDisablePin}
                  className="py-2 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-colors"
                >
                  Desactivar PIN
                </button>
              </div>
              {biometricAvailable && (
                <button
                  type="button"
                  onClick={handleToggleBiometric}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                    biometricEnabled
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Fingerprint className="w-4 h-4 text-emerald-600" />
                  <span>
                    {biometricEnabled ? 'Huella / Face ID Activado (Tocar para desactivar)' : 'Activar Desbloqueo con Huella / Face ID'}
                  </span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onStartSetPin}
              className="w-full py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Configurar Clave PIN</span>
            </button>
          )}
        </div>
      </div>

      {/* 6. Herramientas de Importación y Respaldo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 mb-4 shadow-xs space-y-2">
        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm mb-2">Datos y Sincronización</h3>

        <button
          onClick={onOpenImport}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
        >
          <div className="flex items-center gap-2.5">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Importar desde DEGIRO / MyInvestor / CSV</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={handleExportCsv}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-blue-600" />
            <span>Exportar cartera a Excel / CSV</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={handleExportBackup}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-slate-500" />
            <span>Descargar copia de seguridad (JSON)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <label className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-slate-500" />
            <span>Restaurar copia de seguridad (JSON)</span>
          </div>
          <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </label>

        <button
          onClick={() => {
            if (confirm('¿Restablecer los datos demo originales? Se perderán las modificaciones locales no exportadas.')) {
              onResetDemo();
            }
          }}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center justify-between text-xs font-bold text-rose-600"
        >
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-4 h-4" />
            <span>Restaurar datos de prueba iniciales</span>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400" />
        </button>
      </div>

      {/* 6. Base de Datos en la Nube (Supabase Gratis 0 €/mes) */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 mb-4 shadow-sm text-xs space-y-3 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <Shield className="w-4 h-4" />
            <span>Base de Datos en la Nube (Supabase Gratis)</span>
          </div>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
            cloudConnected
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {cloudConnected ? '🟢 Conectado' : '⚪ Solo Local'}
          </span>
        </div>

        <p className="text-slate-300 text-[11px] leading-relaxed">
          Conecta tu proyecto gratuito de <strong>Supabase</strong> (0 €/mes) para que todo lo que añadas manualmente no se pierda nunca aunque borres el historial del navegador o cambies de móvil.
        </p>

        {cloudMessage && (
          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-[11px] font-semibold text-emerald-300">
            {cloudMessage}
          </div>
        )}

        <form onSubmit={handleConnectSupabase} className="space-y-2">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Supabase Project URL</label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Supabase Anon Public Key</label>
            <input
              type="password"
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={isSyncingCloud}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span>{cloudConnected ? 'Actualizar Conexión' : 'Conectar Nube Gratis'}</span>
            </button>

            {cloudConnected && (
              <>
                <button
                  type="button"
                  onClick={handleSyncCloudNow}
                  disabled={isSyncingCloud}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-slate-700 transition-colors"
                >
                  Guardar Ahora
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectSupabase}
                  className="py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs border border-rose-800/50 transition-colors"
                >
                  Desconectar
                </button>
              </>
            )}
          </div>
        </form>

        <div className="pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowSqlGuide(v => !v)}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showSqlGuide ? 'Ocultar guía de configuración (1 minuto)' : '¿Cómo crear la tabla gratis en Supabase? Ver guía'}</span>
          </button>

          {showSqlGuide && (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-300 space-y-1.5">
              <p>1. Crea una cuenta gratuita en <strong>supabase.com</strong> y crea un proyecto.</p>
              <p>2. Entra en <strong>SQL Editor</strong>, pega y ejecuta esto:</p>
              <pre className="bg-slate-900 p-2 rounded-lg text-[9px] text-emerald-300 overflow-x-auto font-mono select-all">
{`create table if not exists portfolio_states (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);
alter table portfolio_states enable row level security;
create policy "public_access" on portfolio_states for all using (true) with check (true);`}
              </pre>
              <p>3. Copia tu <strong>Project URL</strong> y <strong>anon public key</strong> de <em>Project Settings → API</em> y pégalos arriba.</p>
            </div>
          )}
        </div>
      </div>

      {/* 7. Aviso legal */}
      <div className="text-[11px] text-slate-400 text-center leading-relaxed px-2">
        <p>José Manuel Portafolio 💼 no constituye asesoramiento financiero ni recomendación de inversión. Las cotizaciones pueden sufrir ligeros retrasos según la bolsa de negociación.</p>
        <p className="mt-1 font-semibold text-slate-500">Versión 1.0.0 • Mobile-first PWA</p>
      </div>
    </div>
  );
};
