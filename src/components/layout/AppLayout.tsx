import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useHarStore } from '../../store/useHarStore.ts';
import { useInvestigationStore } from '../../store/useInvestigationStore.ts';
import { toolRegistry } from '../../plugins/ToolRegistry.ts';
import { Sidebar } from './Sidebar.tsx';
import { ThemeSelector } from '../common/ThemeSelector.tsx';
import { InvestigationAside } from '../investigation/InvestigationAside.tsx';
import {
  UploadCloud,
  FileCode,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Sparkles,
  Lock,
  Menu,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Star,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const {
    har,
    fileName,
    fileSize,
    metrics,
    entries,
    parsingStage,
    progress,
    progressMessage,
    errorMessage,
    activeToolId,
    setActiveTool,
    selectedEntryId,
    setSelectedEntryId,
    searchQuery,
    setSearchQuery,
    loadFile,
    loadSampleHar,
    toggleSidebar,
    clearFile,
  } = useHarStore();

  const {
    pinnedIds,
    isAsideOpen,
    toggleAside,
  } = useInvestigationStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePlugin = toolRegistry.get(activeToolId) || toolRegistry.getAll()[0];

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.har') || file.name.endsWith('.json') || file.type.includes('json')) {
        await loadFile(file);
      } else {
        alert('Por favor, selecione um arquivo válido no formato .HAR ou .json');
      }
    }
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await loadFile(file);
    }
  };

  const handleSelectEntry = (id: string | null) => {
    setSelectedEntryId(id);
    if (id && activeToolId !== 'requests-inspector') {
      setActiveTool('requests-inspector');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getParserStatusBadge = () => {
    switch (parsingStage) {
      case 'reading':
      case 'parsing':
      case 'analyzing':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 text-xs font-mono">
            <RefreshCw size={12} className="animate-spin text-cyan-600 dark:text-cyan-400" />
            <span className="capitalize">{parsingStage} ({progress}%)</span>
          </div>
        );
      case 'ready':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 text-xs font-mono">
            <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span>Pronto / Analisado</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-mono">
            <AlertTriangle size={12} className="text-rose-600 dark:text-rose-400" />
            <span>Erro no Parser</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
            <span>Aguardando Arquivo</span>
          </div>
        );
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 font-sans relative select-none transition-colors duration-200"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".har,application/json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Global Drag-and-Drop Active Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-cyan-950/80 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center pointer-events-none transition-all">
          <UploadCloud size={64} className="text-cyan-400 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold text-cyan-100">Solte o arquivo .HAR para iniciar a análise</h2>
          <p className="text-sm text-cyan-300/80 mt-1">O streaming e auditoria iniciarão instantaneamente no navegador</p>
        </div>
      )}

      {/* Collapsible Left Sidebar */}
      <Sidebar />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100/60 dark:bg-zinc-950">
        {/* Global Metric Header */}
        <header className="h-14 border-b border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/60 backdrop-blur-md px-4 flex items-center justify-between gap-4 z-10 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition lg:hidden"
              title="Alternar Menu"
            >
              <Menu size={18} />
            </button>

            {/* File info pill */}
            {fileName ? (
              <div className="flex items-center gap-2 min-w-0 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800">
                <FileCode size={15} className="text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-[160px] sm:max-w-[260px]">
                  {fileName}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  ({formatBytes(fileSize)})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-mono">
                <span className="font-bold text-zinc-800 dark:text-zinc-200">har-auditor</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono tracking-wide bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
                  BETA
                </span>
                <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">•</span>
                <span className="hidden sm:inline">Aguardando arquivo .HAR</span>
              </div>
            )}
          </div>

          {/* Metric Badges + Theme Switcher + Import Button */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {har && (
              <>
                {/* Total Requests Metric */}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 dark:text-zinc-400">Total:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-100">{metrics.totalRequests}</span>
                  <span className="text-zinc-400 text-[10px]">reqs</span>
                </div>

                {/* Total Size Metric */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 dark:text-zinc-400">Tamanho:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-300">{formatBytes(metrics.totalSize)}</span>
                </div>

                {/* Errors Metric */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono ${
                    metrics.totalErrors > 0
                      ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800/80 text-amber-800 dark:text-amber-300'
                      : 'bg-zinc-100 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <AlertTriangle size={13} className={metrics.totalErrors > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'} />
                  <span>Erros:</span>
                  <span className="font-bold">{metrics.totalErrors}</span>
                </div>

                {/* Security Alerts Metric */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono ${
                    metrics.securitySummary.critical + metrics.securitySummary.high > 0
                      ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800/80 text-rose-800 dark:text-rose-300'
                      : 'bg-zinc-100 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <ShieldAlert size={13} className={metrics.securitySummary.critical > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400'} />
                  <span>Alertas:</span>
                  <span className="font-bold">{metrics.securitySummary.total}</span>
                </div>

                {/* Investigation / Pinned Notes Toggle Button */}
                <button
                  onClick={toggleAside}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition cursor-pointer select-none ${
                    isAsideOpen
                      ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-2xs font-semibold'
                      : pinnedIds.length > 0
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                      : 'bg-zinc-100 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-400 dark:hover:border-amber-600'
                  }`}
                  title="Abrir/Fechar Painel de Investigação e Notas"
                >
                  <Star
                    size={13}
                    className={
                      pinnedIds.length > 0
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-zinc-400'
                    }
                  />
                  <span className="hidden sm:inline">Investigação:</span>
                  <span className="font-bold">{pinnedIds.length}</span>
                </button>
              </>
            )}

            {/* Parser Status */}
            {getParserStatusBadge()}

            {/* Theme Selector in Header */}
            <div className="hidden sm:block">
              <ThemeSelector />
            </div>
            <div className="sm:hidden">
              <ThemeSelector compact />
            </div>

            {/* Quick Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition"
              title="Importar outro arquivo .HAR"
            >
              <FolderOpen size={14} />
              <span className="hidden md:inline">Importar HAR</span>
            </button>
          </div>
        </header>

        {/* Streaming Progress Bar */}
        {(parsingStage === 'reading' || parsingStage === 'parsing' || parsingStage === 'analyzing') && (
          <div className="w-full bg-cyan-50 dark:bg-zinc-900 border-b border-cyan-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-between text-xs font-mono text-cyan-800 dark:text-cyan-300 animate-pulse">
            <div className="flex items-center gap-2">
              <RefreshCw size={13} className="animate-spin text-cyan-600 dark:text-cyan-400" />
              <span>{progressMessage}</span>
            </div>
            <div className="w-48 bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-cyan-500 dark:bg-cyan-400 h-2 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message banner */}
        {parsingStage === 'error' && errorMessage && (
          <div className="p-3 bg-rose-100 dark:bg-rose-950/80 border-b border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
              <span>Erro de Processamento: {errorMessage}</span>
            </div>
            <button
              onClick={clearFile}
              className="px-2 py-1 bg-rose-600 text-white dark:bg-rose-900 rounded text-[11px] hover:bg-rose-700 dark:hover:bg-rose-800 transition"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Content Body: Empty State or Active Plugin */}
        <main className="flex-1 overflow-hidden relative">
          {!har ? (
            /* Empty State / Welcome Dropzone */
            <div className="h-full overflow-y-auto p-6 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <div className="max-w-2xl w-full text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-100/90 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-xs font-mono font-medium shadow-2xs">
                  <ShieldAlert size={15} className="text-cyan-600 dark:text-cyan-400" />
                  <span className="font-bold">har-auditor</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider bg-cyan-600 text-white dark:bg-cyan-500 dark:text-zinc-950">
                    BETA
                  </span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Auditoria Forense e Investigação de Arquivos <span className="text-cyan-600 dark:text-cyan-400">.HAR</span>
                  </h1>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
                    Analise requisições HTTP, verifique vazamentos de tokens e credenciais em URLs, inspecione cookies inseguros, cabeçalhos de segurança e gargalos de latência no navegador.
                  </p>
                </div>

                {/* Dropzone Card */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-cyan-500 dark:hover:border-cyan-500/70 rounded-xl bg-white dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer transition-all group shadow-xs"
                >
                  <UploadCloud size={44} className="mx-auto text-zinc-400 dark:text-zinc-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:scale-110 transition-all mb-3" />
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-200">
                    Arraste e solte seu arquivo .HAR aqui
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    ou clique para procurar no seu computador
                  </div>
                  <div className="inline-block mt-4 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 group-hover:bg-cyan-600 group-hover:text-white text-zinc-700 dark:text-zinc-300 transition">
                    Selecionar Arquivo .HAR
                  </div>
                </div>

                {/* Sample HAR Quick Loader */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={loadSampleHar}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-900/60 hover:border-cyan-500 dark:hover:border-cyan-700 transition w-full sm:w-auto justify-center shadow-xs"
                  >
                    <Sparkles size={15} className="text-cyan-600 dark:text-cyan-400" />
                    <span>Carregar HAR de Amostra (Auditoria de Teste)</span>
                  </button>
                </div>

                {/* Privacy & Architecture Guarantee */}
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      <Lock size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>100% Client-Side</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                      Arquivos processados inteiramente no navegador via Web Streams. Nenhum dado ou token trafega para servidores.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      <HardDrive size={13} className="text-cyan-600 dark:text-cyan-400" />
                      <span>Web Worker Streaming</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                      Parser isolado em background thread. Não congela a interface mesmo com arquivos HAR pesados.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      <ShieldAlert size={13} className="text-rose-600 dark:text-rose-400" />
                      <span>Heurísticas OWASP</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                      Inspeção de CWE-319, CWE-598, cabeçalhos CSP/HSTS ausentes e políticas fracas de cookies.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Render Active Plugin View */
            <div className="h-full w-full overflow-hidden bg-slate-100/40 dark:bg-zinc-950">
              {activePlugin.render({
                har,
                metrics,
                selectedEntryId,
                onSelectEntry: handleSelectEntry,
                entries,
                searchQuery,
                setSearchQuery,
              })}
            </div>
          )}
        </main>

        {/* Global Footer */}
        <footer className="h-8 border-t border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-md px-4 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex-shrink-0 z-10 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">har-auditor</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono tracking-wide bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
              BETA
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="truncate">Todos os direitos reservados © 2026</span>
          </div>

          <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              100% Client-Side • Privacidade Garantida
            </span>
            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
            <span className="text-zinc-500 dark:text-zinc-400 font-mono">v0.9.4-beta</span>
          </div>
        </footer>
      </div>

      {/* Collapsible Right Investigation Aside */}
      {har && <InvestigationAside />}
    </div>
  );
};
