import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { EnrichedHarEntry } from '../../types/har.ts';
import { useComparisonStore } from '../../store/useComparisonStore.ts';
import { useInvestigationStore } from '../../store/useInvestigationStore.ts';
import {
  ArrowRightLeft,
  Search,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  HardDrive,
  Copy,
  Check,
  Download,
  Filter,
  FileCode,
  Tag,
  Star,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  Zap,
  Lock,
  Cookie,
  KeyRound,
  FileText,
  X,
} from 'lucide-react';
import {
  diffHeaders,
  diffCookies,
  diffQueryParams,
  diffJsonPayloads,
  generateComparisonMarkdown,
  type HeaderDiffItem,
  type CookieDiffItem,
} from './comparatorUtils.ts';

export const RequestComparatorTool: React.FC<ToolPluginContext> = ({
  entries,
  onSelectEntry,
}) => {
  const {
    entryAId,
    entryBId,
    activeDiffTab,
    onlyDifferences,
    setEntryAId,
    setEntryBId,
    setComparisonPair,
    swapPair,
    clearPair,
    setActiveDiffTab,
    setOnlyDifferences,
    toggleOnlyDifferences,
  } = useComparisonStore();

  const { pinnedIds } = useInvestigationStore();

  // Search & selector modal state
  const [selectorSide, setSelectorSide] = useState<'A' | 'B' | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [selectorFilter, setSelectorFilter] = useState<'all' | 'errors' | 'pinned' | 'same_endpoint'>('all');
  const [headerSearch, setHeaderSearch] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [payloadSubTab, setPayloadSubTab] = useState<'body' | 'query'>('body');

  // Entry lookup map
  const entryMap = useMemo(() => {
    return new Map<string, EnrichedHarEntry>(entries.map((e) => [e.id, e]));
  }, [entries]);

  // If no entryA or entryB selected, try smart default (e.g. first error and a 200 with same endpoint)
  const entryA = entryAId ? entryMap.get(entryAId) : null;
  const entryB = entryBId ? entryMap.get(entryBId) : null;

  // Auto-detect candidate comparison pairs (e.g. same endpoint with different status)
  const suggestedPairs = useMemo(() => {
    const pairs: Array<{
      title: string;
      entryA: EnrichedHarEntry;
      entryB: EnrichedHarEntry;
      reason: string;
      badge: string;
    }> = [];

    // Group entries by method + pathname
    const groups = new Map<string, EnrichedHarEntry[]>();
    entries.forEach((e) => {
      const key = `${e.request.method} ${e.parsedUrl.pathname}`;
      const list = groups.get(key) || [];
      list.push(e);
      groups.set(key, list);
    });

    // Find groups with different status codes (especially 2xx vs 4xx/5xx)
    groups.forEach((groupEntries, endpointKey) => {
      if (groupEntries.length >= 2) {
        const success = groupEntries.find((e) => e.response.status >= 200 && e.response.status < 300);
        const error = groupEntries.find((e) => e.response.status >= 400);

        if (success && error && pairs.length < 4) {
          pairs.push({
            title: endpointKey,
            entryA: success,
            entryB: error,
            reason: `Sucesso (${success.response.status}) vs Erro (${error.response.status})`,
            badge: `${success.response.status} ↔ ${error.response.status}`,
          });
        }
      }
    });

    // If we have pinned entries (>= 2)
    if (pinnedIds.length >= 2 && pairs.length < 6) {
      const pA = entryMap.get(pinnedIds[0]);
      const pB = entryMap.get(pinnedIds[1]);
      if (pA && pB) {
        pairs.push({
          title: `Investigação: ${pA.parsedUrl.pathname} vs ${pB.parsedUrl.pathname}`,
          entryA: pA,
          entryB: pB,
          reason: 'Pares marcados na investigação forense',
          badge: 'Pinados',
        });
      }
    }

    return pairs;
  }, [entries, entryMap, pinnedIds]);

  // Diff Calculations
  const headerDiff = useMemo(() => {
    if (!entryA || !entryB) return [];
    return diffHeaders(entryA.request.headers, entryB.request.headers);
  }, [entryA, entryB]);

  const cookieDiff = useMemo(() => {
    if (!entryA || !entryB) return [];
    return diffCookies(entryA.request.headers, entryB.request.headers);
  }, [entryA, entryB]);

  const queryDiff = useMemo(() => {
    if (!entryA || !entryB) return [];
    return diffQueryParams(entryA.request.queryString, entryB.request.queryString);
  }, [entryA, entryB]);

  const requestJsonDiff = useMemo(() => {
    if (!entryA || !entryB) return null;
    return diffJsonPayloads(entryA.request.postData?.text, entryB.request.postData?.text);
  }, [entryA, entryB]);

  const responseJsonDiff = useMemo(() => {
    if (!entryA || !entryB) return null;
    return diffJsonPayloads(entryA.response.content.text, entryB.response.content.text);
  }, [entryA, entryB]);

  const responseHeaderDiff = useMemo(() => {
    if (!entryA || !entryB) return [];
    return diffHeaders(entryA.response.headers, entryB.response.headers);
  }, [entryA, entryB]);

  // Critical Security & Diagnostic Flags
  const csrfDiff = useMemo(() => {
    return headerDiff.find((h) => h.isCsrf && h.status !== 'identical');
  }, [headerDiff]);

  const authDiff = useMemo(() => {
    return headerDiff.find((h) => h.isAuth && h.status !== 'identical');
  }, [headerDiff]);

  const changedCookiesCount = useMemo(() => {
    return cookieDiff.filter((c) => c.status !== 'identical').length;
  }, [cookieDiff]);

  const changedHeadersCount = useMemo(() => {
    return headerDiff.filter((h) => h.status !== 'identical').length;
  }, [headerDiff]);

  // Filtered Headers List
  const visibleHeaders = useMemo(() => {
    let list = headerDiff;
    if (onlyDifferences) {
      list = list.filter((h) => h.status !== 'identical');
    }
    if (headerSearch.trim()) {
      const q = headerSearch.toLowerCase();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.valueA && h.valueA.toLowerCase().includes(q)) ||
          (h.valueB && h.valueB.toLowerCase().includes(q))
      );
    }
    return list;
  }, [headerDiff, onlyDifferences, headerSearch]);

  // Copy Markdown Report to clipboard
  const handleCopyMarkdown = () => {
    if (!entryA || !entryB) return;
    const md = generateComparisonMarkdown(entryA, entryB);
    navigator.clipboard.writeText(md);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Download Markdown Report
  const handleDownloadMarkdown = () => {
    if (!entryA || !entryB) return;
    const md = generateComparisonMarkdown(entryA, entryB);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `har-diff-${entryA.response.status}-vs-${entryB.response.status}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Helper status color
  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300)
      return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    if (status >= 300 && status < 400)
      return 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800';
    if (status >= 400 && status < 500)
      return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    if (status >= 500)
      return 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Filtered entries for selection modal
  const filteredSelectorEntries = useMemo(() => {
    return entries.filter((e) => {
      // Filter tab
      if (selectorFilter === 'errors' && !e.isError && e.response.status < 400) return false;
      if (selectorFilter === 'pinned' && !pinnedIds.includes(e.id)) return false;
      if (selectorFilter === 'same_endpoint') {
        const target = selectorSide === 'A' ? entryB : entryA;
        if (target && e.parsedUrl.pathname !== target.parsedUrl.pathname) return false;
      }

      // Search text
      if (selectorSearch.trim()) {
        const q = selectorSearch.toLowerCase();
        return (
          e.request.url.toLowerCase().includes(q) ||
          e.request.method.toLowerCase().includes(q) ||
          String(e.response.status).includes(q) ||
          (e.serverIPAddress && e.serverIPAddress.includes(q))
        );
      }
      return true;
    });
  }, [entries, selectorFilter, selectorSearch, selectorSide, entryA, entryB, pinnedIds]);

  return (
    <div className="h-full flex flex-col bg-slate-100/70 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 overflow-hidden select-text">
      {/* Top Banner & Control Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Comparador Rápido de Requisições</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                Side-by-Side Diff
              </span>
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Compare lado a lado duas chamadas do mesmo HAR para diagnosticar discrepâncias de headers, cookies, CSRF, payloads e timings.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {entryA && entryB && (
            <>
              <button
                onClick={swapPair}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition cursor-pointer shadow-xs active:scale-95"
                title="Inverter Lado A e Lado B (A ↔ B)"
              >
                <ArrowRightLeft size={14} className="text-cyan-600 dark:text-cyan-400" />
                <span className="hidden sm:inline">Inverter (A ↔ B)</span>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition cursor-pointer shadow-xs"
                title="Copiar relatório comparativo em Markdown para Jira/Slack"
              >
                {isCopied ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="text-zinc-500" />
                    <span>Copiar (.md)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition cursor-pointer"
                title="Baixar Relatório (.md)"
              >
                <Download size={14} />
                <span className="hidden md:inline">Baixar Relatório</span>
              </button>

              <button
                onClick={clearPair}
                className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                title="Limpar seleção atual"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Suggested Pairs Bar (Quick Jump) */}
      {suggestedPairs.length > 0 && (!entryA || !entryB) && (
        <div className="px-4 py-2.5 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/50 flex items-center gap-2 overflow-x-auto text-xs shrink-0 select-none">
          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold shrink-0">
            <Sparkles size={14} className="text-amber-500" />
            <span>Pares Sugeridos para Diagnóstico:</span>
          </div>
          <div className="flex items-center gap-2">
            {suggestedPairs.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setComparisonPair(p.entryA.id, p.entryB.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800/80 hover:border-amber-500 dark:hover:border-amber-600 text-zinc-800 dark:text-zinc-200 transition cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
                title={`Comparar ${p.reason}`}
              >
                <span className="font-mono font-semibold text-[11px] truncate max-w-[140px]">
                  {p.title}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                  {p.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Dual Cards: Request A (Base) vs Request B (Target) */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 select-none">
        {/* Card Request A */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            entryA
              ? 'bg-white dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800 shadow-xs'
              : 'bg-zinc-50 dark:bg-zinc-900/40 border-dashed border-2 border-slate-300 dark:border-zinc-800 flex flex-col items-center justify-center min-h-[140px]'
          }`}
        >
          {entryA ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                    LADO A (Referência)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${getStatusBadge(entryA.response.status)}`}>
                    {entryA.response.status} {entryA.response.statusText}
                  </span>
                  <span className="font-mono font-bold text-xs text-zinc-800 dark:text-zinc-200">
                    {entryA.request.method}
                  </span>
                </div>

                <button
                  onClick={() => setSelectorSide('A')}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Alterar Lado A
                </button>
              </div>

              <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate select-all" title={entryA.request.url}>
                {entryA.request.url}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-zinc-400" />
                  <strong>{Math.round(entryA.time)}ms</strong>
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive size={12} className="text-zinc-400" />
                  <strong>{formatBytes(entryA.response.content.size)}</strong>
                </span>
                {entryA.serverIPAddress && (
                  <span className="truncate">IP: {entryA.serverIPAddress}</span>
                )}
                <span className="truncate text-[10px]">
                  {new Date(entryA.startedDateTime).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-2 p-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                LADO A (Referência / Ex: Sucesso 200)
              </span>
              <p className="text-xs text-zinc-500">Selecione uma requisição para servir de base</p>
              <button
                onClick={() => setSelectorSide('A')}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Escolher Requisição A
              </button>
            </div>
          )}
        </div>

        {/* Card Request B */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            entryB
              ? 'bg-white dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800 shadow-xs'
              : 'bg-zinc-50 dark:bg-zinc-900/40 border-dashed border-2 border-slate-300 dark:border-zinc-800 flex flex-col items-center justify-center min-h-[140px]'
          }`}
        >
          {entryB ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                    LADO B (Comparada)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${getStatusBadge(entryB.response.status)}`}>
                    {entryB.response.status} {entryB.response.statusText}
                  </span>
                  <span className="font-mono font-bold text-xs text-zinc-800 dark:text-zinc-200">
                    {entryB.request.method}
                  </span>
                </div>

                <button
                  onClick={() => setSelectorSide('B')}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Alterar Lado B
                </button>
              </div>

              <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate select-all" title={entryB.request.url}>
                {entryB.request.url}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-zinc-400" />
                  <strong>{Math.round(entryB.time)}ms</strong>
                  {entryA && (
                    <span
                      className={`text-[10px] font-bold ${
                        entryB.time > entryA.time ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'
                      }`}
                    >
                      ({entryB.time >= entryA.time ? `+${Math.round(entryB.time - entryA.time)}ms` : `${Math.round(entryB.time - entryA.time)}ms`})
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive size={12} className="text-zinc-400" />
                  <strong>{formatBytes(entryB.response.content.size)}</strong>
                </span>
                {entryB.serverIPAddress && (
                  <span className="truncate">IP: {entryB.serverIPAddress}</span>
                )}
                <span className="truncate text-[10px]">
                  {new Date(entryB.startedDateTime).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-2 p-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                LADO B (Alvo / Ex: Erro 500)
              </span>
              <p className="text-xs text-zinc-500">Selecione uma requisição para comparar com o Lado A</p>
              <button
                onClick={() => setSelectorSide('B')}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Escolher Requisição B
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Critical Diagnostic Discrepancies Alerts */}
      {entryA && entryB && (
        <div className="px-4 space-y-2 shrink-0 select-none">
          {/* CSRF Token Alert */}
          {csrfDiff && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
              <div className="p-1 rounded bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5">
                <ShieldAlert size={16} />
              </div>
              <div className="text-xs space-y-0.5">
                <h4 className="font-bold text-rose-800 dark:text-rose-200">
                  Discrepância Crítica no Token CSRF ({csrfDiff.name})
                </h4>
                <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                  O cabeçalho <code className="px-1 py-0.2 bg-rose-200 dark:bg-rose-900 rounded font-mono font-bold">{csrfDiff.name}</code> está{' '}
                  {csrfDiff.valueA ? 'presente no Lado A' : 'ausente no Lado A'} e{' '}
                  {csrfDiff.valueB ? 'presente no Lado B' : 'ausente no Lado B'}. A ausência de token CSRF é a causa mais comum de respostas 403 Forbidden ou 401 Unauthorized após formulários e mutações POST/PUT.
                </p>
              </div>
            </div>
          )}

          {/* Authorization Token Discrepancy */}
          {authDiff && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 flex items-start gap-3">
              <div className="p-1 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                <KeyRound size={16} />
              </div>
              <div className="text-xs space-y-0.5">
                <h4 className="font-bold text-amber-800 dark:text-amber-200">
                  Diferença no Cabeçalho de Autorização ({authDiff.name})
                </h4>
                <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
                  Os valores do cabeçalho <code className="px-1 py-0.2 bg-amber-200 dark:bg-amber-900 rounded font-mono font-bold">{authDiff.name}</code> divergem entre as requisições ({authDiff.status.toUpperCase()}). Verifique expiração de token ou falta de claim no JWT.
                </p>
              </div>
            </div>
          )}

          {/* Cookies Discrepancy Alert */}
          {changedCookiesCount > 0 && (
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                <Cookie size={15} className="text-indigo-600 dark:text-indigo-400" />
                <span>
                  <strong>{changedCookiesCount}</strong> {changedCookiesCount === 1 ? 'cookie com diferença' : 'cookies com diferenças'} detectados entre as chamadas (sessão/autenticação).
                </span>
              </div>
              <button
                onClick={() => setActiveDiffTab('headers')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Ver na aba de Headers →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      {entryA && entryB && (
        <div className="px-4 mt-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0 select-none bg-white/50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveDiffTab('headers')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition ${
                activeDiffTab === 'headers'
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Lock size={14} />
              <span>Cabeçalhos & Cookies</span>
              {changedHeadersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {changedHeadersCount} diffs
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveDiffTab('payload')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition ${
                activeDiffTab === 'payload'
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <FileCode size={14} />
              <span>Payloads & Parâmetros</span>
              {requestJsonDiff && (requestJsonDiff.keysOnlyInA.length > 0 || requestJsonDiff.keysOnlyInB.length > 0 || requestJsonDiff.keysModified.length > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                  {requestJsonDiff.keysOnlyInA.length + requestJsonDiff.keysOnlyInB.length + requestJsonDiff.keysModified.length} diffs
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveDiffTab('response')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition ${
                activeDiffTab === 'response'
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Layers size={14} />
              <span>Respostas (Corpo & Status)</span>
              {entryA.response.status !== entryB.response.status && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                  {entryA.response.status} ≠ {entryB.response.status}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveDiffTab('timings')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition ${
                activeDiffTab === 'timings'
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Clock size={14} />
              <span>Latência & Gargalos</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {Math.abs(Math.round(entryB.time - entryA.time))}ms delta
              </span>
            </button>
          </div>

          {/* Quick Differences Filter Toggle */}
          {activeDiffTab === 'headers' && (
            <div className="flex items-center gap-2 pb-1">
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  onChange={toggleOnlyDifferences}
                  className="rounded text-cyan-600 focus:ring-cyan-500"
                />
                <span>Apenas Diferenças ({changedHeadersCount})</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4">
        {(!entryA || !entryB) ? (
          /* Empty / Selection Prompt View */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <ArrowRightLeft size={32} />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Selecione Duas Requisições para Comparar
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Escolha a requisição de referência (Lado A) e a requisição sob investigação (Lado B) para visualizar instantaneamente diferenças em cabeçalhos de autenticação, cookies, tokens CSRF, payload JSON e tempos de resposta.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setSelectorSide('A')}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Escolher Lado A
              </button>
              <button
                onClick={() => setSelectorSide('B')}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Escolher Lado B
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: HEADERS & COOKIES DIFF */}
            {activeDiffTab === 'headers' && (
              <div className="space-y-6">
                {/* Search Bar for Headers */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome do cabeçalho ou valor..."
                      value={headerSearch}
                      onChange={(e) => setHeaderSearch(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    Exibindo {visibleHeaders.length} de {headerDiff.length} cabeçalhos
                  </span>
                </div>

                {/* Cookies Sub-Section */}
                {cookieDiff.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Cookie size={16} className="text-indigo-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        Cookies Enviados na Requisição ({cookieDiff.length})
                      </h3>
                      {changedCookiesCount > 0 && (
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {changedCookiesCount} diferentes
                        </span>
                      )}
                    </div>

                    <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          <tr>
                            <th className="p-2.5 w-1/4">Nome do Cookie</th>
                            <th className="p-2.5 w-5/12">Lado A (Referência)</th>
                            <th className="p-2.5 w-5/12">Lado B (Comparada)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-mono text-[11px]">
                          {cookieDiff.map((c) => {
                            const isDifferent = c.status !== 'identical';
                            return (
                              <tr
                                key={c.name}
                                className={
                                  isDifferent
                                    ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                    : 'hover:bg-slate-50/50 dark:hover:bg-zinc-800/40'
                                }
                              >
                                <td className="p-2.5 font-semibold text-zinc-800 dark:text-zinc-200 break-all">
                                  <div className="flex items-center gap-1.5">
                                    <span>{c.name}</span>
                                    {c.isSessionOrToken && (
                                      <span className="px-1 py-0.2 rounded text-[9px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-sans">
                                        Auth/Sessão
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5 break-all text-zinc-700 dark:text-zinc-300">
                                  {c.valueA !== null ? (
                                    <span className={c.status === 'only_a' ? 'text-blue-700 dark:text-blue-400 font-medium' : ''}>
                                      {c.valueA}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 italic font-sans">(Ausente)</span>
                                  )}
                                </td>
                                <td className="p-2.5 break-all text-zinc-700 dark:text-zinc-300">
                                  {c.valueB !== null ? (
                                    <span className={c.status === 'only_b' ? 'text-purple-700 dark:text-purple-400 font-medium' : c.status === 'modified' ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
                                      {c.valueB}
                                    </span>
                                  ) : (
                                    <span className="text-rose-500 italic font-sans font-medium">(Ausente no Lado B)</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Headers Main Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={16} className="text-cyan-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        Cabeçalhos HTTP Enviados
                      </h3>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        <tr>
                          <th className="p-2.5 w-1/4">Cabeçalho</th>
                          <th className="p-2.5 w-5/12">Lado A (Referência)</th>
                          <th className="p-2.5 w-5/12">Lado B (Comparada)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-mono text-[11px]">
                        {visibleHeaders.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-6 text-center text-zinc-400 italic">
                              Nenhum cabeçalho corresponde aos filtros aplicados.
                            </td>
                          </tr>
                        ) : (
                          visibleHeaders.map((h) => {
                            const isDifferent = h.status !== 'identical';
                            return (
                              <tr
                                key={h.name}
                                className={
                                  h.isCsrf && isDifferent
                                    ? 'bg-rose-50/60 dark:bg-rose-950/30'
                                    : isDifferent
                                    ? 'bg-amber-50/30 dark:bg-amber-950/15'
                                    : 'hover:bg-slate-50/50 dark:hover:bg-zinc-800/40'
                                }
                              >
                                <td className="p-2.5 font-semibold text-zinc-800 dark:text-zinc-200 break-all align-top">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{h.name}</span>
                                    {h.isCsrf && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                                        CSRF
                                      </span>
                                    )}
                                    {h.isAuth && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                        AUTH
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="p-2.5 break-all text-zinc-700 dark:text-zinc-300 align-top">
                                  {h.valueA !== null ? (
                                    <span className={h.status === 'only_a' ? 'text-blue-700 dark:text-blue-400 font-medium' : ''}>
                                      {h.valueA}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 italic font-sans">(Ausente no Lado A)</span>
                                  )}
                                </td>

                                <td className="p-2.5 break-all text-zinc-700 dark:text-zinc-300 align-top">
                                  {h.valueB !== null ? (
                                    <span
                                      className={
                                        h.isCsrf && h.status !== 'identical'
                                          ? 'text-rose-700 dark:text-rose-400 font-bold'
                                          : h.status === 'only_b'
                                          ? 'text-purple-700 dark:text-purple-400 font-medium'
                                          : h.status === 'modified'
                                          ? 'text-amber-700 dark:text-amber-400 font-medium'
                                          : ''
                                      }
                                    >
                                      {h.valueB}
                                    </span>
                                  ) : (
                                    <span
                                      className={`italic font-sans font-medium ${
                                        h.isCsrf ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-rose-500'
                                      }`}
                                    >
                                      (Ausente no Lado B)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PAYLOADS & PARAMS DIFF */}
            {activeDiffTab === 'payload' && (
              <div className="space-y-4">
                {/* Sub tabs: Body vs Query params */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
                  <button
                    onClick={() => setPayloadSubTab('body')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      payloadSubTab === 'body'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                    }`}
                  >
                    Corpo da Requisição (Post Body / JSON)
                  </button>

                  <button
                    onClick={() => setPayloadSubTab('query')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      payloadSubTab === 'query'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                    }`}
                  >
                    Parâmetros de URL (Query String: {queryDiff.length})
                  </button>
                </div>

                {payloadSubTab === 'body' ? (
                  <div className="space-y-3">
                    {requestJsonDiff?.isBothJson && (
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center gap-4 text-xs">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          Resumo de Chaves JSON:
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                          +{requestJsonDiff.keysOnlyInB.length} novas na Req B
                        </span>
                        <span className="text-rose-700 dark:text-rose-400 font-mono">
                          -{requestJsonDiff.keysOnlyInA.length} ausentes na Req B
                        </span>
                        <span className="text-amber-700 dark:text-amber-400 font-mono">
                          ~{requestJsonDiff.keysModified.length} valores modificados
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Lado A Payload */}
                      <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center justify-between">
                          <span>Lado A Payload ({entryA.request.postData?.mimeType || 'Sem corpo'})</span>
                        </div>
                        <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[480px] text-zinc-800 dark:text-zinc-200 bg-zinc-50/30 dark:bg-zinc-950/50">
                          {requestJsonDiff?.formattedA || entryA.request.postData?.text || '(Nenhum payload de requisição enviado)'}
                        </pre>
                      </div>

                      {/* Lado B Payload */}
                      <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center justify-between">
                          <span>Lado B Payload ({entryB.request.postData?.mimeType || 'Sem corpo'})</span>
                        </div>
                        <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[480px] text-zinc-800 dark:text-zinc-200 bg-zinc-50/30 dark:bg-zinc-950/50">
                          {requestJsonDiff?.formattedB || entryB.request.postData?.text || '(Nenhum payload de requisição enviado)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Query Parameters Diff Table */
                  <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        <tr>
                          <th className="p-2.5 w-1/4">Parâmetro de URL</th>
                          <th className="p-2.5 w-5/12">Lado A</th>
                          <th className="p-2.5 w-5/12">Lado B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-mono text-[11px]">
                        {queryDiff.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-6 text-center text-zinc-400 italic">
                              Nenhum parâmetro de query string encontrado em nenhuma das duas requisições.
                            </td>
                          </tr>
                        ) : (
                          queryDiff.map((q) => (
                            <tr
                              key={q.name}
                              className={
                                q.status !== 'identical'
                                  ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                  : 'hover:bg-slate-50/50 dark:hover:bg-zinc-800/40'
                              }
                            >
                              <td className="p-2.5 font-semibold text-zinc-800 dark:text-zinc-200 break-all">
                                {q.name}
                              </td>
                              <td className="p-2.5 break-all text-zinc-700 dark:text-zinc-300">
                                {q.valueA !== null ? q.valueA : <span className="text-zinc-400 italic font-sans">(Ausente)</span>}
                              </td>
                              <td className="p-2.5 break-all text-zinc-700 dark:text-zinc-300">
                                {q.valueB !== null ? (
                                  <span className={q.status !== 'identical' ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
                                    {q.valueB}
                                  </span>
                                ) : (
                                  <span className="text-rose-500 italic font-sans">(Ausente no Lado B)</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RESPONSE (STATUS, HEADERS & BODY) DIFF */}
            {activeDiffTab === 'response' && (
              <div className="space-y-4">
                {/* Status Code Comparison Bar */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 font-mono">Status Lado A:</span>
                    <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getStatusBadge(entryA.response.status)}`}>
                      {entryA.response.status} {entryA.response.statusText}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 font-mono">Status Lado B:</span>
                    <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getStatusBadge(entryB.response.status)}`}>
                      {entryB.response.status} {entryB.response.statusText}
                    </span>
                    {entryA.response.status !== entryB.response.status && (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                        (Regressão / Discrepância)
                      </span>
                    )}
                  </div>
                </div>

                {/* Side-by-Side Response Bodies */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Lado A Response Body */}
                  <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center justify-between">
                      <span>Lado A: Resposta ({entryA.response.content.mimeType})</span>
                      <span className="text-[11px] text-zinc-500">{formatBytes(entryA.response.content.size)}</span>
                    </div>
                    <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[480px] text-zinc-800 dark:text-zinc-200 bg-zinc-50/30 dark:bg-zinc-950/50">
                      {responseJsonDiff?.formattedA || entryA.response.content.text || '(Corpo de resposta vazio)'}
                    </pre>
                  </div>

                  {/* Lado B Response Body */}
                  <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center justify-between">
                      <span>Lado B: Resposta ({entryB.response.content.mimeType})</span>
                      <span className="text-[11px] text-zinc-500">{formatBytes(entryB.response.content.size)}</span>
                    </div>
                    <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[480px] text-zinc-800 dark:text-zinc-200 bg-zinc-50/30 dark:bg-zinc-950/50">
                      {responseJsonDiff?.formattedB || entryB.response.content.text || '(Corpo de resposta vazio)'}
                    </pre>
                  </div>
                </div>

                {/* Response Headers Differences */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Cabeçalhos de Resposta ({responseHeaderDiff.filter((h) => h.status !== 'identical').length} discrepâncias)
                  </h4>
                  <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        <tr>
                          <th className="p-2.5 w-1/4">Cabeçalho</th>
                          <th className="p-2.5 w-5/12">Lado A</th>
                          <th className="p-2.5 w-5/12">Lado B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-mono text-[11px]">
                        {responseHeaderDiff.filter((h) => h.status !== 'identical').map((h) => (
                          <tr key={h.name} className="bg-amber-50/30 dark:bg-amber-950/15">
                            <td className="p-2.5 font-semibold text-zinc-800 dark:text-zinc-200 break-all">{h.name}</td>
                            <td className="p-2.5 break-all text-zinc-700 dark:text-zinc-300">{h.valueA ?? <span className="text-zinc-400 italic font-sans">(Ausente)</span>}</td>
                            <td className="p-2.5 break-all text-amber-700 dark:text-amber-400">{h.valueB ?? <span className="text-rose-500 italic font-sans">(Ausente)</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TIMINGS & BOTTLENECK DIFF */}
            {activeDiffTab === 'timings' && (
              <div className="space-y-6">
                {/* Total Duration Comparison Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-[10px] text-zinc-500 font-mono uppercase">Tempo Req A</div>
                      <div className="text-xl font-mono font-extrabold text-blue-600 dark:text-blue-400">
                        {Math.round(entryA.time)}ms
                      </div>
                    </div>

                    <div className="text-zinc-400 text-lg">vs</div>

                    <div>
                      <div className="text-[10px] text-zinc-500 font-mono uppercase">Tempo Req B</div>
                      <div className="text-xl font-mono font-extrabold text-purple-600 dark:text-purple-400">
                        {Math.round(entryB.time)}ms
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">Diferença de Duração</div>
                    <div
                      className={`text-lg font-mono font-extrabold ${
                        entryB.time > entryA.time ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'
                      }`}
                    >
                      {entryB.time >= entryA.time ? `+${Math.round(entryB.time - entryA.time)}ms mais lenta` : `${Math.round(entryB.time - entryA.time)}ms mais rápida`}
                    </div>
                  </div>
                </div>

                {/* Network Phases Timing Breakdown */}
                <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 p-4 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Decomposição das Fases HTTP e Gargalos (Waterfall Timing Diff)
                  </h3>

                  <div className="space-y-3 font-mono text-xs">
                    {[
                      { label: 'DNS Lookup', a: entryA.timings?.dns, b: entryB.timings?.dns, color: 'bg-emerald-500' },
                      { label: 'TCP Connect', a: entryA.timings?.connect, b: entryB.timings?.connect, color: 'bg-amber-500' },
                      { label: 'SSL Handshake', a: entryA.timings?.ssl, b: entryB.timings?.ssl, color: 'bg-purple-500' },
                      { label: 'Wait (TTFB / Processamento Servidor)', a: entryA.timings?.wait, b: entryB.timings?.wait, color: 'bg-cyan-500', isKey: true },
                      { label: 'Content Download (Receive)', a: entryA.timings?.receive, b: entryB.timings?.receive, color: 'bg-blue-500' },
                    ].map((phase) => {
                      const valA = Math.max(0, Math.round(phase.a ?? 0));
                      const valB = Math.max(0, Math.round(phase.b ?? 0));
                      const maxVal = Math.max(1, Math.max(valA, valB));
                      const diff = valB - valA;

                      return (
                        <div
                          key={phase.label}
                          className={`p-3 rounded-lg border transition ${
                            phase.isKey && Math.abs(diff) > 200
                              ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-800'
                              : 'bg-zinc-50/40 dark:bg-zinc-900/40 border-slate-100 dark:border-zinc-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${phase.color}`} />
                              <span>{phase.label}</span>
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-500">A: {valA}ms</span>
                              <span className="text-zinc-500">B: {valB}ms</span>
                              <span className={`font-bold ${diff > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                                {diff >= 0 ? `+${diff}ms` : `${diff}ms`}
                              </span>
                            </div>
                          </div>

                          {/* Visual Side-by-Side Bars */}
                          <div className="space-y-1">
                            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden flex items-center">
                              <div
                                className="bg-blue-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, (valA / maxVal) * 100)}%` }}
                              />
                            </div>
                            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden flex items-center">
                              <div
                                className="bg-purple-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, (valB / maxVal) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* SELECTOR MODAL FOR CHOOSING SIDE A OR SIDE B */}
      {selectorSide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-900/90 select-none">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                  selectorSide === 'A'
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                }`}>
                  SELECIONAR LADO {selectorSide}
                </span>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Escolha uma requisição do arquivo HAR
                </h3>
              </div>
              <button
                onClick={() => setSelectorSide(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3 border-b border-slate-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2 select-none">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por endpoint, status, método ou IP..."
                  value={selectorSearch}
                  onChange={(e) => setSelectorSearch(e.target.value)}
                  autoFocus
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto text-xs">
                <button
                  onClick={() => setSelectorFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    selectorFilter === 'all'
                      ? 'bg-cyan-600 text-white font-semibold'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300'
                  }`}
                >
                  Todas ({entries.length})
                </button>

                <button
                  onClick={() => setSelectorFilter('errors')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    selectorFilter === 'errors'
                      ? 'bg-rose-600 text-white font-semibold'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300'
                  }`}
                >
                  Apenas Erros (4xx / 5xx)
                </button>

                {pinnedIds.length > 0 && (
                  <button
                    onClick={() => setSelectorFilter('pinned')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      selectorFilter === 'pinned'
                        ? 'bg-amber-600 text-white font-semibold'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300'
                    }`}
                  >
                    ★ Pinadas ({pinnedIds.length})
                  </button>
                )}

                {(selectorSide === 'A' ? entryB : entryA) && (
                  <button
                    onClick={() => setSelectorFilter('same_endpoint')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      selectorFilter === 'same_endpoint'
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300'
                    }`}
                  >
                    Mesmo Endpoint do outro lado
                  </button>
                )}
              </div>
            </div>

            {/* List of candidate requests */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80">
              {filteredSelectorEntries.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-xs">
                  Nenhuma requisição encontrada com os filtros selecionados.
                </div>
              ) : (
                filteredSelectorEntries.map((e) => {
                  const isCurrent = selectorSide === 'A' ? entryAId === e.id : entryBId === e.id;
                  const isOpposite = selectorSide === 'A' ? entryBId === e.id : entryAId === e.id;

                  return (
                    <div
                      key={e.id}
                      onClick={() => {
                        if (selectorSide === 'A') {
                          setEntryAId(e.id);
                        } else {
                          setEntryBId(e.id);
                        }
                        setSelectorSide(null);
                      }}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                        isCurrent
                          ? 'bg-cyan-50/70 dark:bg-cyan-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${getStatusBadge(e.response.status)}`}>
                          {e.response.status}
                        </span>
                        <span className="font-mono font-bold text-xs text-zinc-800 dark:text-zinc-200">
                          {e.request.method}
                        </span>
                        <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 truncate" title={e.request.url}>
                          {e.parsedUrl.pathname}
                          {e.parsedUrl.search && <span className="text-zinc-400">{e.parsedUrl.search}</span>}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-zinc-500 shrink-0">
                        <span>{Math.round(e.time)}ms</span>
                        <span>{formatBytes(e.response.content.size)}</span>
                        {isOpposite && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            Selecionada no outro lado
                          </span>
                        )}
                        <button className="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-600 hover:text-white text-xs font-semibold transition">
                          Selecionar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
