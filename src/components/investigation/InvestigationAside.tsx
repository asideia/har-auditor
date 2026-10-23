import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useHarStore } from '../../store/useHarStore.ts';
import { useInvestigationStore } from '../../store/useInvestigationStore.ts';
import {
  Star,
  X,
  FileText,
  Trash2,
  Tag,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Clock,
  HardDrive,
  Sparkles,
  Shield,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
  ArrowRightLeft,
} from 'lucide-react';
import type { InvestigationTag } from '../../types/investigation.ts';
import type { EnrichedHarEntry } from '../../types/har.ts';
import { IncidentReportModal } from './IncidentReportModal.tsx';
import { useComparisonStore } from '../../store/useComparisonStore.ts';

const PREDEFINED_TAGS: { name: InvestigationTag; colorClass: string; activeClass: string }[] = [
  {
    name: 'Bug',
    colorClass: 'border-rose-300 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40',
    activeClass: 'bg-rose-600 text-white dark:bg-rose-600 dark:text-white border-rose-600',
  },
  {
    name: 'Auth',
    colorClass: 'border-indigo-300 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40',
    activeClass: 'bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white border-indigo-600',
  },
  {
    name: 'Segurança',
    colorClass: 'border-amber-300 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40',
    activeClass: 'bg-amber-600 text-white dark:bg-amber-600 dark:text-white border-amber-600',
  },
  {
    name: 'Performance',
    colorClass: 'border-cyan-300 dark:border-cyan-900/60 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40',
    activeClass: 'bg-cyan-600 text-white dark:bg-cyan-600 dark:text-white border-cyan-600',
  },
];

export const InvestigationAside: React.FC = () => {
  const {
    entries,
    fileName,
    setSelectedEntryId,
    setActiveTool,
    selectedEntryId,
  } = useHarStore();

  const {
    pinnedIds,
    notes,
    isAsideOpen,
    asideWidth,
    togglePin,
    setNote,
    toggleTag,
    setAsideOpen,
    toggleAside,
    setAsideWidth,
    clearInvestigation,
  } = useInvestigationStore();

  const { setComparisonPair, setEntryAId } = useComparisonStore();

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Map pinned IDs to actual entries
  const pinnedEntries: EnrichedHarEntry[] = useMemo(() => {
    const entryMap = new Map<string, EnrichedHarEntry>(entries.map((e) => [e.id, e]));
    return pinnedIds
      .map((id) => entryMap.get(id))
      .filter((e): e is EnrichedHarEntry => Boolean(e));
  }, [entries, pinnedIds]);

  // Width Resizing logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResetWidth = () => {
    setAsideWidth(384);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const calculatedWidth = window.innerWidth - e.clientX;
      const maxWidth = Math.max(380, Math.min(900, window.innerWidth - 300));
      const clampedWidth = Math.max(280, Math.min(calculatedWidth, maxWidth));
      setAsideWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setAsideWidth]);

  // Collapsed Ribbon View
  if (!isAsideOpen) {
    return (
      <>
        <aside
          className="w-11 flex-shrink-0 h-full border-l border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md flex flex-col items-center py-3 z-20 shadow-xs select-none transition-all group hover:bg-slate-50 dark:hover:bg-zinc-900"
          aria-label="Painel Lateral de Investigação (Recolhido)"
        >
          {/* Expand Toggle Button */}
          <button
            onClick={() => setAsideOpen(true)}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
            title="Expandir Central Forense e Notas"
            aria-label="Expandir painel de investigação"
          >
            <PanelRightOpen size={18} />
          </button>

          {/* Star Icon & Pinned Counter */}
          <button
            onClick={() => setAsideOpen(true)}
            className="mt-3 relative p-1.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:scale-105 transition cursor-pointer"
            title={`${pinnedEntries.length} requisições marcadas na investigação`}
          >
            <Star
              size={16}
              className={pinnedEntries.length > 0 ? 'fill-amber-400 text-amber-500' : 'text-zinc-400'}
            />
            {pinnedEntries.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-mono font-bold bg-amber-500 text-white shadow-xs">
                {pinnedEntries.length}
              </span>
            )}
          </button>

          {/* Vertical Spine Title */}
          <div
            onClick={() => setAsideOpen(true)}
            className="flex-1 flex items-center justify-center cursor-pointer my-4 py-2 hover:opacity-100 transition opacity-75"
            title="Clique para expandir a Central Forense de Diagnóstico"
          >
            <span
              className="text-[11px] font-bold tracking-widest text-zinc-500 dark:text-zinc-400 uppercase font-mono select-none"
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
              }}
            >
              Investigação & Notas
            </span>
          </div>

          {/* Quick Incident Report button in collapsed mode */}
          {pinnedEntries.length > 0 && (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
              title="Gerar Relatório do Incidente"
            >
              <FileText size={16} />
            </button>
          )}
        </aside>

        {/* Incident Report Modal */}
        <IncidentReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          fileName={fileName}
          pinnedEntries={pinnedEntries}
          investigationNotes={notes}
        />
      </>
    );
  }

  const handleSelectEntry = (id: string) => {
    setSelectedEntryId(id);
    setActiveTool('requests-inspector');
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800';
    if (status >= 300 && status < 400) return 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800';
    if (status >= 400 && status < 500) return 'text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800';
    if (status >= 500) return 'text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800';
    return 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <>
      <aside
        style={{ width: `${asideWidth}px` }}
        className="relative flex-shrink-0 h-full border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col z-20 shadow-xl transition-[width] duration-75 select-text"
        aria-label="Painel Lateral de Investigação e Notas"
      >
        {/* Drag Resize Handle on Left Border */}
        <div
          onMouseDown={startResizing}
          onDoubleClick={handleResetWidth}
          className={`absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group flex items-center justify-center transition-colors select-none ${
            isResizing ? 'bg-amber-500/30' : 'hover:bg-amber-400/20'
          }`}
          title="Arraste para redimensionar a largura (duplo clique para redefinir para 384px)"
        >
          <div
            className={`w-0.5 rounded-full transition-all ${
              isResizing
                ? 'bg-amber-500 h-16 w-1 shadow-sm'
                : 'bg-zinc-300 dark:bg-zinc-700 h-8 group-hover:bg-amber-400 dark:group-hover:bg-amber-400 group-hover:h-12'
            }`}
          />
        </div>

        {/* Aside Header */}
        <div className="h-14 px-3 sm:px-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/80 dark:bg-zinc-900/90 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 flex-shrink-0">
              <Star size={16} className="fill-amber-400 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 truncate">
                  Investigação & Notas
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex-shrink-0">
                  {pinnedEntries.length}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                Central forense de diagnóstico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Current Width Badge */}
            <span
              className="hidden sm:inline-block text-[9px] font-mono text-zinc-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 px-1.5 py-0.5 rounded cursor-col-resize select-none"
              title="Largura configurável. Arraste a borda esquerda para ajustar ou dê duplo clique para 384px."
            >
              {Math.round(asideWidth)}px
            </span>

            {pinnedEntries.length > 0 && (
              <>
                {showClearConfirm ? (
                  <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/70 p-1 rounded border border-rose-300 dark:border-rose-800">
                    <span className="text-[10px] text-rose-700 dark:text-rose-300 font-medium">Limpar?</span>
                    <button
                      onClick={() => {
                        clearInvestigation();
                        setShowClearConfirm(false);
                      }}
                      className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] rounded hover:bg-rose-700 transition"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] rounded hover:bg-zinc-300 transition"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    title="Desafixar todas as requisições"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}

            {/* Toggle / Encolher Aside Button */}
            <button
              onClick={() => setAsideOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center gap-1"
              title="Encolher / Recolher central forense"
              aria-label="Encolher painel de notas"
            >
              <PanelRightClose size={16} />
            </button>

            {/* Close Button */}
            <button
              onClick={() => setAsideOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Fechar painel de notas"
              aria-label="Fechar painel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Generate Report & Side-by-Side Quick Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center gap-2 select-none">
          <button
            onClick={() => setIsReportModalOpen(true)}
            disabled={pinnedEntries.length === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold shadow-xs transition ${
              pinnedEntries.length > 0
                ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer active:scale-[0.99]'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
            }`}
          >
            <FileText size={14} />
            <span className="truncate">Gerar Relatório</span>
          </button>

          {pinnedEntries.length >= 2 && (
            <button
              onClick={() => {
                setComparisonPair(pinnedEntries[0].id, pinnedEntries[1].id);
                setActiveTool('request-comparator');
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition cursor-pointer active:scale-[0.99]"
              title="Comparar as 2 primeiras requisições pinadas no comparador lado a lado"
            >
              <ArrowRightLeft size={14} />
              <span className="whitespace-nowrap">Comparar 2</span>
            </button>
          )}
        </div>

        {/* Pinned Entries List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {pinnedEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 dark:text-zinc-500 space-y-3 select-none">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Star size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Nenhuma chamada pinada
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs">
                  Clique na estrela (★) de qualquer requisição na tabela para adicioná-la a esta área e redigir anotações de diagnóstico.
                </p>
              </div>
            </div>
          ) : (
            pinnedEntries.map((entry, index) => {
              const noteData = notes[entry.id] || {
                entryId: entry.id,
                note: '',
                tags: [],
                updatedAt: '',
              };
              const isSelected = selectedEntryId === entry.id;
              const urlObj = new URL(entry.request.url);

              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border transition-all text-xs ${
                    isSelected
                      ? 'border-cyan-500 dark:border-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/20 ring-1 ring-cyan-500/40'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Card Header: Status, Method, Actions */}
                  <div className="p-2.5 pb-2 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                        #{index + 1}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getStatusColor(
                          entry.response.status
                        )}`}
                      >
                        {entry.response.status}
                      </span>
                      <span className="font-mono font-bold text-[11px] text-zinc-800 dark:text-zinc-200">
                        {entry.request.method}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEntryAId(entry.id);
                          setActiveTool('request-comparator');
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        title="Comparar no comparador lado a lado"
                      >
                        <ArrowRightLeft size={13} />
                      </button>
                      <button
                        onClick={() => handleSelectEntry(entry.id)}
                        className="p-1 rounded text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        title="Focar requisição na tabela principal"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => togglePin(entry.id)}
                        className="p-1 rounded text-amber-500 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        title="Remover dos pinados"
                      >
                        <Star size={14} className="fill-amber-400 text-amber-500" />
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Endpoint & Metrics */}
                  <div
                    onClick={() => handleSelectEntry(entry.id)}
                    className="px-2.5 py-2 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition"
                  >
                    <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate" title={entry.request.url}>
                      <span className="text-zinc-400 dark:text-zinc-500">{urlObj.origin}</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{urlObj.pathname}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-zinc-400" />
                        {Math.round(entry.time)}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive size={11} className="text-zinc-400" />
                        {formatBytes(entry.response.content.size)}
                      </span>
                      {entry.serverIPAddress && (
                        <span className="truncate max-w-[100px]" title={entry.serverIPAddress}>
                          IP: {entry.serverIPAddress}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Diagnostic Tags */}
                  <div className="px-2.5 py-1.5 border-t border-slate-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <div className="flex items-center gap-1 mb-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                      <Tag size={10} />
                      <span>Classificação:</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {PREDEFINED_TAGS.map(t => {
                        const isActive = noteData.tags.includes(t.name);
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => toggleTag(entry.id, t.name)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition select-none ${
                              isActive ? t.activeClass : t.colorClass
                            }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Diagnostic Notes Textarea (Exclusive Editing Location) */}
                  <div className="p-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between mb-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Nota de Diagnóstico:
                      </span>
                      {noteData.note.trim() && (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono">
                          ✓ Salvo
                        </span>
                      )}
                    </div>
                    <textarea
                      value={noteData.note}
                      onChange={(e) => setNote(entry.id, e.target.value)}
                      placeholder="Ex: Falha 403 por falta de claim no JWT; timeout no upstream..."
                      rows={2}
                      className="w-full text-xs font-sans p-2 rounded border border-slate-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 resize-y min-h-[50px]"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Aside Footer Summary */}
        {pinnedEntries.length > 0 && (
          <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/90 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 select-none">
            <span className="font-mono">
              Total: {pinnedEntries.length} {pinnedEntries.length === 1 ? 'item' : 'itens'}
            </span>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
            >
              Exportar (.md / .json)
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </aside>

      {/* Incident Report Modal */}
      <IncidentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        fileName={fileName}
        pinnedEntries={pinnedEntries}
        investigationNotes={notes}
      />
    </>
  );
};
