import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { EnrichedHarEntry } from '../../types/har.ts';
import {
  Activity,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Zap,
  Info,
  CheckCircle2,
  GitCompare,
  WifiOff,
  AlertOctagon,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

export interface DuplicateCluster {
  id: string;
  method: string;
  url: string;
  count: number;
  timeWindowMs: number;
  wastedBytes: number;
  entries: EnrichedHarEntry[];
  firstStartTime: number;
}

export interface RaceHazard {
  id: string;
  method: string;
  url: string;
  reqA: EnrichedHarEntry;
  reqB: EnrichedHarEntry;
  startDelayMs: number;
  inversionDeltaMs: number;
}

export interface CommunicationFailure {
  id: string;
  entry: EnrichedHarEntry;
  reason: 'connection_refused' | 'timeout' | 'cors_blocked' | 'client_aborted' | 'unknown_failure';
  reasonCategory: string;
  reasonTitle: string;
  reasonDescription: string;
  probableFix: string;
  durationMs: number;
  url: string;
  method: string;
  hostname: string;
  ip: string;
  statusText: string;
}

export const AnomaliesTool: React.FC<ToolPluginContext> = ({ entries, onSelectEntry }) => {
  // Default to communication_failures if any exist, otherwise n_plus_one
  const [activeTab, setActiveTab] = useState<'communication_failures' | 'n_plus_one' | 'race_conditions'>('communication_failures');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Detecção Forense de Falhas de Comunicação de Rede (Status 0 / Failed / Net Errors)
  const communicationFailures = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const failures: CommunicationFailure[] = [];

    entries.forEach((entry) => {
      const status = entry.response?.status;
      const isZero = status === 0 || status === undefined || status === null;
      const isFailed = entry.statusCategory === 'failed';
      const statusText = (entry.response?.statusText || '').toLowerCase();
      const isNetError = statusText.includes('err_') || statusText.includes('failed');

      if (isZero || isFailed || isNetError) {
        const urlLower = entry.request.url.toLowerCase();
        const duration = Math.round(entry.time || 0);
        const method = entry.request.method.toUpperCase();
        const originHeader = entry.request.headers.find((h) => h.name.toLowerCase() === 'origin');

        let reason: CommunicationFailure['reason'] = 'connection_refused';
        let reasonCategory = 'Conexão Recusada';
        let reasonTitle = 'Falha de Conexão (net::ERR_CONNECTION_REFUSED)';
        let reasonDescription = 'O navegador tentou estabelecer conexão de rede com o endpoint, mas o host rejeitou ou o serviço estava offline.';
        let probableFix = 'Certifique-se de que a API/serviço remoto está em execução na porta correta e sem bloqueios de firewall ou proxy.';

        if (
          statusText.includes('blocked_by_client') ||
          urlLower.includes('analytics') ||
          urlLower.includes('tracker') ||
          urlLower.includes('telemetry') ||
          urlLower.includes('pixel') ||
          urlLower.includes('doubleclick') ||
          urlLower.includes('adservice')
        ) {
          reason = 'client_aborted';
          reasonCategory = 'Bloqueio no Cliente';
          reasonTitle = 'Bloqueado por Extensão / AdBlocker (net::ERR_BLOCKED_BY_CLIENT)';
          reasonDescription = 'A requisição para endpoint de telemetria/analítica foi interceptada e cancelada pelo navegador ou extensão de privacidade.';
          probableFix = 'Para recursos essenciais, hospede proxies reversos no mesmo domínio principal (First-Party) para evitar bloqueio por listas adblock.';
        } else if (duration >= 4000 || statusText.includes('timed_out') || statusText.includes('timeout')) {
          reason = 'timeout';
          reasonCategory = 'Timeout de Rede';
          reasonTitle = `Timeout de Comunicação (net::ERR_TIMED_OUT - ${duration}ms)`;
          reasonDescription = `A requisição permaneceu aguardando resposta por ${duration}ms até o cancelamento forçado por esgotamento de tempo.`;
          probableFix = 'Aumente o timeout de gateway se necessário, monitore gargalos de banco/serviço ou implemente respostas assíncronas com webhook.';
        } else if (method === 'OPTIONS' || (originHeader && entry.parsedUrl.isThirdParty) || statusText.includes('cors')) {
          reason = 'cors_blocked';
          reasonCategory = 'Bloqueio de CORS';
          reasonTitle = 'Bloqueio de Política CORS / Preflight Rejeitado (net::ERR_FAILED)';
          reasonDescription = 'Requisição cross-origin não concluiu o handshake CORS. O servidor não retornou cabeçalhos válidos ou bloqueou a origem.';
          probableFix = 'Configure os cabeçalhos Access-Control-Allow-Origin, Access-Control-Allow-Methods e Access-Control-Allow-Headers no backend.';
        } else if (entry.parsedUrl.protocol === 'http:' && !entry.parsedUrl.isHttps) {
          reason = 'unknown_failure';
          reasonCategory = 'Transporte Inseguro';
          reasonTitle = 'Falha de Transporte HTTP Não-Seguro';
          reasonDescription = 'Requisição sem criptografia HTTP pode ter sido abortada por política de segurança ou upgrade obrigatório para HTTPS.';
          probableFix = 'Transfira todo o tráfego para HTTPS e utilize certificados TLS válidos.';
        }

        failures.push({
          id: `comm-fail-${entry.id}`,
          entry,
          reason,
          reasonCategory,
          reasonTitle,
          reasonDescription,
          probableFix,
          durationMs: duration,
          url: entry.request.url,
          method: entry.request.method,
          hostname: entry.parsedUrl.hostname,
          ip: entry.serverIPAddress || 'Não resolvido',
          statusText: entry.response?.statusText || 'Falha de comunicação (Status 0)',
        });
      }
    });

    return failures;
  }, [entries]);

  // 2. Algoritmo N+1 Queries / Chamadas Idênticas em Janela de 500ms
  const duplicateClusters = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const sorted = [...entries].sort(
      (a, b) => new Date(a.startedDateTime).getTime() - new Date(b.startedDateTime).getTime()
    );

    const visited = new Set<string>();
    const clusters: DuplicateCluster[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const base = sorted[i];
      if (visited.has(base.id)) continue;

      const baseTime = new Date(base.startedDateTime).getTime();
      const clusterEntries: EnrichedHarEntry[] = [base];
      visited.add(base.id);

      for (let j = i + 1; j < sorted.length; j++) {
        const candidate = sorted[j];
        const candidateTime = new Date(candidate.startedDateTime).getTime();

        if (candidateTime - baseTime > 500) {
          break;
        }

        if (
          candidate.request.method === base.request.method &&
          candidate.request.url === base.request.url
        ) {
          clusterEntries.push(candidate);
          visited.add(candidate.id);
        }
      }

      if (clusterEntries.length > 1) {
        const lastTime = new Date(
          clusterEntries[clusterEntries.length - 1].startedDateTime
        ).getTime();
        const wasted = clusterEntries
          .slice(1)
          .reduce(
            (sum, e) => sum + (e.response.content?.size || e.response.bodySize || 0),
            0
          );

        clusters.push({
          id: `cluster-${base.id}`,
          method: base.request.method,
          url: base.request.url,
          count: clusterEntries.length,
          timeWindowMs: Math.max(1, lastTime - baseTime),
          wastedBytes: wasted,
          entries: clusterEntries,
          firstStartTime: baseTime,
        });
      }
    }

    return clusters.sort((a, b) => b.count - a.count);
  }, [entries]);

  // 3. Algoritmo de Race Condition (Inversão de Ordem de Chegada)
  const raceHazards = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const hazards: RaceHazard[] = [];
    const sorted = [...entries].sort(
      (a, b) => new Date(a.startedDateTime).getTime() - new Date(b.startedDateTime).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const reqA = sorted[i];
      const startA = new Date(reqA.startedDateTime).getTime();
      const endA = startA + reqA.time;

      for (let j = i + 1; j < sorted.length; j++) {
        const reqB = sorted[j];
        const startB = new Date(reqB.startedDateTime).getTime();
        const endB = startB + reqB.time;

        if (startB > endA) break;

        if (
          reqA.parsedUrl.pathname === reqB.parsedUrl.pathname &&
          reqA.parsedUrl.hostname === reqB.parsedUrl.hostname
        ) {
          if (endB < endA) {
            hazards.push({
              id: `race-${reqA.id}-${reqB.id}`,
              method: reqA.request.method,
              url: reqA.request.url,
              reqA,
              reqB,
              startDelayMs: startB - startA,
              inversionDeltaMs: Math.round(endA - endB),
            });
          }
        }
      }
    }

    return hazards;
  }, [entries]);

  // Filtered lists
  const filteredFailures = useMemo(() => {
    if (!searchFilter.trim()) return communicationFailures;
    const q = searchFilter.toLowerCase();
    return communicationFailures.filter(
      (f) =>
        f.url.toLowerCase().includes(q) ||
        f.method.toLowerCase().includes(q) ||
        f.hostname.toLowerCase().includes(q) ||
        f.reasonTitle.toLowerCase().includes(q) ||
        f.reasonCategory.toLowerCase().includes(q)
    );
  }, [communicationFailures, searchFilter]);

  const filteredClusters = useMemo(() => {
    if (!searchFilter.trim()) return duplicateClusters;
    const q = searchFilter.toLowerCase();
    return duplicateClusters.filter(
      (c) => c.url.toLowerCase().includes(q) || c.method.toLowerCase().includes(q)
    );
  }, [duplicateClusters, searchFilter]);

  const filteredHazards = useMemo(() => {
    if (!searchFilter.trim()) return raceHazards;
    const q = searchFilter.toLowerCase();
    return raceHazards.filter(
      (h) => h.url.toLowerCase().includes(q) || h.method.toLowerCase().includes(q)
    );
  }, [raceHazards, searchFilter]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalDuplicateRequests = useMemo(() => {
    return duplicateClusters.reduce((sum, c) => sum + (c.count - 1), 0);
  }, [duplicateClusters]);

  const totalWastedBytes = useMemo(() => {
    return duplicateClusters.reduce((sum, c) => sum + c.wastedBytes, 0);
  }, [duplicateClusters]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/60 dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors font-sans">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Activity className="text-cyan-600 dark:text-cyan-400" size={22} />
          Anomalias de Rede: Falhas de Comunicação, N+1 Queries & Race Conditions
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Diagnóstico automatizado de chamadas com Status 0 (quedas de conexão, bloqueios de CORS, timeouts), rajadas redundantes em janela &le; 500ms e inversões assíncronas de resposta.
        </p>
      </div>

      {/* Top Impact KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Communication Failures (Status 0) */}
        <div
          onClick={() => setActiveTab('communication_failures')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-2xs ${
            activeTab === 'communication_failures'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 dark:border-rose-700 ring-1 ring-rose-500'
              : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-900/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-800 dark:text-rose-400 font-semibold uppercase tracking-wider">
            <span>Falhas de Comunicação</span>
            <WifiOff size={16} />
          </div>
          <div className="text-3xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
            {communicationFailures.length} <span className="text-sm font-normal text-zinc-500">chamadas</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Status 0, quedas de conexão, CORS e timeouts
          </div>
        </div>

        {/* N+1 Bursts */}
        <div
          onClick={() => setActiveTab('n_plus_one')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-2xs ${
            activeTab === 'n_plus_one'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400'
              : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-400 font-semibold uppercase tracking-wider">
            <span>Rajadas N+1 (500ms)</span>
            <Layers size={16} />
          </div>
          <div className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {duplicateClusters.length} <span className="text-sm font-normal text-zinc-500">grupos</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {totalDuplicateRequests} requisições redundantes ({formatBytes(totalWastedBytes)} desperdiçados)
          </div>
        </div>

        {/* Race Conditions */}
        <div
          onClick={() => setActiveTab('race_conditions')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-2xs ${
            activeTab === 'race_conditions'
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 ring-1 ring-purple-400'
              : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-purple-800 dark:text-purple-400 font-semibold uppercase tracking-wider">
            <span>Race Conditions</span>
            <GitCompare size={16} />
          </div>
          <div className="text-3xl font-bold font-mono text-purple-700 dark:text-purple-400 mt-1">
            {raceHazards.length} <span className="text-sm font-normal text-zinc-500">conflitos</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Respostas fora de ordem que sobrescrevem a UI
          </div>
        </div>

        {/* Global Connection Health */}
        <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
            <span>Confiabilidade de Rede</span>
            <Zap size={16} className="text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-cyan-700 dark:text-cyan-400 mt-1">
            {entries.length > 0
              ? `${Math.max(
                  0,
                  Math.round(
                    ((entries.length - communicationFailures.length) / entries.length) * 100
                  )
                )}%`
              : '100%'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Taxa de sucesso sem quedas de conexão ou status 0</div>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto py-0.5">
          <button
            onClick={() => setActiveTab('communication_failures')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'communication_failures'
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <WifiOff size={13} className={communicationFailures.length > 0 ? 'text-rose-600 dark:text-rose-400' : ''} />
            <span>Falhas de Comunicação & Status 0 ({communicationFailures.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('n_plus_one')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'n_plus_one'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Layers size={13} />
            <span>Rajadas N+1 ({duplicateClusters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('race_conditions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
              activeTab === 'race_conditions'
                ? 'bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <GitCompare size={13} />
            <span>Race Conditions ({raceHazards.length})</span>
          </button>
        </div>

        <input
          type="text"
          placeholder="Filtrar por URL, método ou diagnóstico..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full sm:w-72 px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
        />
      </div>

      {/* TAB 1: FALHAS DE COMUNICAÇÃO (STATUS 0) */}
      {activeTab === 'communication_failures' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-1">
            <span>
              Mostrando {filteredFailures.length} chamadas com falha de comunicação ou retorno 0 (Abortadas / Quedas de Conexão)
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">Impacto crítico: usuário sem dados ou fluxo travado</span>
          </div>

          {filteredFailures.length === 0 ? (
            <div className="p-12 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-zinc-500">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhuma falha de comunicação (Status 0) identificada!
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Todas as requisições receberam resposta HTTP do servidor sem quedas abruptas de conexão ou bloqueios.
              </p>
            </div>
          ) : (
            filteredFailures.map((failure) => (
              <div
                key={failure.id}
                className="p-4 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-zinc-900/60 space-y-3 shadow-2xs hover:border-rose-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      STATUS 0 · FALHA DE COMUNICAÇÃO
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {failure.reasonCategory}
                    </span>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {failure.reasonTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-mono">
                      Duração: <strong>{failure.durationMs}ms</strong>
                    </span>
                    <button
                      onClick={() => onSelectEntry(failure.entry.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded border border-cyan-300 dark:border-cyan-800 transition"
                    >
                      <span>Inspecionar Req #{failure.entry.index + 1}</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>

                {/* URL and Host Box */}
                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="truncate flex-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 mr-2">
                      {failure.method}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{failure.url}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(failure.url, failure.id)}
                    className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100 text-zinc-400 transition"
                    title="Copiar URL"
                  >
                    {copiedId === failure.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>

                {/* Details Breakdown Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80">
                    <span className="text-zinc-500 text-[11px] block">Host Alvo / IP:</span>
                    <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                      {failure.hostname} {failure.ip !== 'Não resolvido' ? `(${failure.ip})` : ''}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80">
                    <span className="text-zinc-500 text-[11px] block">Status Text do HAR:</span>
                    <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                      {failure.statusText}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80">
                    <span className="text-zinc-500 text-[11px] block">Momento da Chamada:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                      {new Date(failure.entry.startedDateTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Diagnostic explanation & fix recommendation */}
                <div className="p-3 rounded bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
                  <div className="flex items-start gap-2">
                    <AlertOctagon size={15} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    <div>
                      <strong>Diagnóstico da Falha:</strong> {failure.reasonDescription}
                    </div>
                  </div>
                  <div className="pl-6 text-zinc-700 dark:text-zinc-300 font-sans">
                    <strong>Ação Recomendada:</strong> {failure.probableFix}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: N+1 QUERIES / BURSTS */}
      {activeTab === 'n_plus_one' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-1">
            <span>
              Mostrando {filteredClusters.length} ocorrências de chamadas idênticas em janela &le; 500ms
            </span>
            <span className="text-zinc-400">Recomendação: Implementar Stale-While-Revalidate / Deduplicação</span>
          </div>

          {filteredClusters.length === 0 ? (
            <div className="p-12 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-zinc-500">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhuma anomalia N+1 detectada!
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Não foram encontradas requisições idênticas disparadas simultaneamente dentro de 500ms.
              </p>
            </div>
          ) : (
            filteredClusters.map((cluster) => (
              <div
                key={cluster.id}
                className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-zinc-900/60 space-y-3 shadow-2xs hover:border-amber-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      {cluster.count}x Disparos Idênticos
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      Janela: {cluster.timeWindowMs} ms
                    </span>
                    {cluster.wastedBytes > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                        {formatBytes(cluster.wastedBytes)} redundantes
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-zinc-500 font-mono">
                    Método: <strong>{cluster.method}</strong>
                  </span>
                </div>

                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800 break-all">
                  {cluster.url}
                </div>

                {/* Individual requests timeline in this burst */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Requisições na Rajada:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cluster.entries.map((entry) => {
                      const offsetMs =
                        new Date(entry.startedDateTime).getTime() - cluster.firstStartTime;
                      return (
                        <div
                          key={entry.id}
                          onClick={() => onSelectEntry(entry.id)}
                          className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-cyan-500 cursor-pointer transition text-xs font-mono flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              Req #{entry.index + 1}
                            </span>
                            <span className="text-[10px] text-zinc-500 ml-1.5">
                              (+{offsetMs}ms)
                            </span>
                          </div>
                          <span className="text-cyan-700 dark:text-cyan-400 text-[11px]">
                            {Math.round(entry.time)}ms &rarr;
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300">
                  <strong>Causa Raiz Provável:</strong> Loop de renderização no frontend (re-render sem useMemo/useCallback), múltiplos componentes filhos consultando a mesma query sem cache compartilhado ou falta de debouncing.
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: RACE CONDITIONS */}
      {activeTab === 'race_conditions' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-1">
            <span>
              Mostrando {filteredHazards.length} conflitos onde a ordem de resposta mudou em relação à ordem de envio
            </span>
            <span className="text-zinc-400">Risco: UI exibindo estado antigo sobrescrevendo estado novo</span>
          </div>

          {filteredHazards.length === 0 ? (
            <div className="p-12 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-zinc-500">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhuma Race Condition identificada!
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Todas as requisições paralelas terminaram em ordem consistente com os momentos de envio.
              </p>
            </div>
          ) : (
            filteredHazards.map((hazard) => (
              <div
                key={hazard.id}
                className="p-4 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-zinc-900/60 space-y-3 shadow-2xs hover:border-purple-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                      RACE HAZARD
                    </span>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Inversão de Resposta ({hazard.inversionDeltaMs}ms de atraso relativo)
                    </span>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">
                    Endpoint: {hazard.reqA.parsedUrl.pathname}
                  </span>
                </div>

                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800 break-all">
                  {hazard.url}
                </div>

                {/* Visual comparative explanation of the race */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  {/* Req A: Started first, finished LAST */}
                  <div
                    onClick={() => onSelectEntry(hazard.reqA.id)}
                    className="p-3 rounded bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 cursor-pointer hover:border-purple-400 transition"
                  >
                    <div className="flex items-center justify-between font-bold text-purple-800 dark:text-purple-300">
                      <span>Requisição Anterior (#{hazard.reqA.index + 1})</span>
                      <span className="text-[10px] uppercase text-rose-600">Chegou Por Último ⚠️</span>
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                      Iniciou primeiro, mas durou {Math.round(hazard.reqA.time)}ms.
                    </div>
                    <div className="text-[10px] text-rose-700 dark:text-rose-400 mt-1 font-sans">
                      &rarr; Perigo: Pode sobrescrever a resposta da Req #{hazard.reqB.index + 1} com dados velhos!
                    </div>
                  </div>

                  {/* Req B: Started later, finished FIRST */}
                  <div
                    onClick={() => onSelectEntry(hazard.reqB.id)}
                    className="p-3 rounded bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 cursor-pointer hover:border-emerald-400 transition"
                  >
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                      <span>Requisição Mais Recente (#{hazard.reqB.index + 1})</span>
                      <span className="text-[10px] uppercase text-emerald-600">Chegou Primeiro &check;</span>
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                      Iniciou +{hazard.startDelayMs}ms depois, respondeu rápido em {Math.round(hazard.reqB.time)}ms.
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-sans">
                      &rarr; Estado mais novo que arrisca ser descartado pelo cliente.
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-300">
                  <strong>Correção Recomendada:</strong> Utilize <code>AbortController</code> para cancelar requisições anteriores quando uma nova for despachada (ex: busca rápida / auto-complete), ou vincule timestamps/sequence IDs para descartar respostas obsoletas.
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
