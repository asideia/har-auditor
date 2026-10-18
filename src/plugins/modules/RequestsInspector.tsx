import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { EnrichedHarEntry } from '../../types/har.ts';
import {
  Search,
  ShieldAlert,
  X,
  Lock,
  Unlock,
  AlertTriangle,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  FilterX,
  Terminal,
  Code,
} from 'lucide-react';

type SortField = 'status' | 'method' | 'url' | 'domain' | 'size' | 'time' | 'alerts';
type SortOrder = 'asc' | 'desc';

interface ColumnFilters {
  status: string;
  method: string;
  url: string;
  domain: string;
  size: string;
  time: string;
  alerts: string;
}

const initialColumnFilters: ColumnFilters = {
  status: 'all',
  method: 'all',
  url: '',
  domain: 'all',
  size: 'all',
  time: 'all',
  alerts: 'all',
};

export const RequestsInspector: React.FC<ToolPluginContext> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  searchQuery,
  setSearchQuery,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [onlySecurityIssues, setOnlySecurityIssues] = useState(false);
  const [activeTab, setActiveTab] = useState<'headers' | 'payload' | 'cookies' | 'timings' | 'security'>('headers');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Column sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Column filter state
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [colFilters, setColFilters] = useState<ColumnFilters>(initialColumnFilters);

  // Extract unique domains & methods for dropdowns
  const uniqueDomains = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.parsedUrl?.hostname) set.add(e.parsedUrl.hostname);
    });
    return Array.from(set).sort();
  }, [entries]);

  const uniqueMethods = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.request?.method) set.add(e.request.method.toUpperCase());
    });
    return Array.from(set).sort();
  }, [entries]);

  // Count active column filters
  const activeColFiltersCount = useMemo(() => {
    let count = 0;
    if (colFilters.status !== 'all') count++;
    if (colFilters.method !== 'all') count++;
    if (colFilters.url.trim() !== '') count++;
    if (colFilters.domain !== 'all') count++;
    if (colFilters.size !== 'all') count++;
    if (colFilters.time !== 'all') count++;
    if (colFilters.alerts !== 'all') count++;
    return count;
  }, [colFilters]);

  const resetColumnFilters = () => {
    setColFilters(initialColumnFilters);
  };

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 1. Quick toolbar toggles
      if (onlyErrors && !entry.isError) return false;
      if (onlySecurityIssues && entry.securityIssues.length === 0) return false;

      // 2. Resource Type quick filter
      if (filterType !== 'all') {
        if (filterType === 'xhr' && !['xhr', 'fetch'].includes(entry.resourceType)) return false;
        if (filterType === 'doc' && entry.resourceType !== 'document') return false;
        if (filterType === 'js' && entry.resourceType !== 'script') return false;
        if (filterType === 'css' && entry.resourceType !== 'stylesheet') return false;
        if (filterType === 'media' && !['image', 'media', 'font'].includes(entry.resourceType)) return false;
      }

      // 3. Global search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUrl = entry.request.url.toLowerCase().includes(q);
        const matchesMethod = entry.request.method.toLowerCase().includes(q);
        const matchesStatus = String(entry.response.status).includes(q);
        const matchesHost = entry.parsedUrl.hostname.toLowerCase().includes(q);
        if (!matchesUrl && !matchesMethod && !matchesStatus && !matchesHost) return false;
      }

      // 4. Per-column filters
      // Status filter
      if (colFilters.status !== 'all') {
        const st = entry.response.status ?? 0;
        if (colFilters.status === '0') {
          if (st !== 0 && !entry.isError) return false;
        } else if (colFilters.status === '2xx') {
          if (st < 200 || st >= 300) return false;
        } else if (colFilters.status === '3xx') {
          if (st < 300 || st >= 400) return false;
        } else if (colFilters.status === '4xx') {
          if (st < 400 || st >= 500) return false;
        } else if (colFilters.status === '5xx') {
          if (st < 500) return false;
        } else if (String(st) !== colFilters.status) {
          return false;
        }
      }

      // Method filter
      if (colFilters.method !== 'all') {
        if (entry.request.method.toUpperCase() !== colFilters.method.toUpperCase()) return false;
      }

      // Path / Endpoint filter
      if (colFilters.url.trim()) {
        const target = colFilters.url.toLowerCase();
        const fullUrl = entry.request.url.toLowerCase();
        if (!fullUrl.includes(target)) return false;
      }

      // Domain filter
      if (colFilters.domain !== 'all') {
        if (entry.parsedUrl.hostname.toLowerCase() !== colFilters.domain.toLowerCase()) return false;
      }

      // Size filter
      if (colFilters.size !== 'all') {
        const bytes = entry.response.content?.size || entry.response.bodySize || 0;
        if (colFilters.size === '0b' && bytes > 0) return false;
        if (colFilters.size === '>10kb' && bytes <= 10 * 1024) return false;
        if (colFilters.size === '>100kb' && bytes <= 100 * 1024) return false;
        if (colFilters.size === '>1mb' && bytes <= 1024 * 1024) return false;
      }

      // Time filter
      if (colFilters.time !== 'all') {
        const ms = entry.time || 0;
        if (colFilters.time === '>200ms' && ms <= 200) return false;
        if (colFilters.time === '>500ms' && ms <= 500) return false;
        if (colFilters.time === '>1s' && ms <= 1000) return false;
        if (colFilters.time === '>2s' && ms <= 2000) return false;
      }

      // Alerts filter
      if (colFilters.alerts !== 'all') {
        if (colFilters.alerts === 'with_alerts' && entry.securityIssues.length === 0) return false;
        if (colFilters.alerts === 'without_alerts' && entry.securityIssues.length > 0) return false;
        if (
          colFilters.alerts === 'critical_high' &&
          !entry.securityIssues.some((s) => s.severity === 'critical' || s.severity === 'high')
        )
          return false;
      }

      return true;
    });
  }, [entries, filterType, onlyErrors, onlySecurityIssues, searchQuery, colFilters]);

  // Sorted entries according to active column sort
  const sortedEntries = useMemo(() => {
    if (!sortField) return filteredEntries;

    return [...filteredEntries].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'status': {
          const statusA = a.response.status ?? 0;
          const statusB = b.response.status ?? 0;
          comparison = statusA - statusB;
          break;
        }
        case 'method': {
          comparison = a.request.method.localeCompare(b.request.method);
          break;
        }
        case 'url': {
          const urlA = (a.parsedUrl.pathname || '') + (a.parsedUrl.search || '');
          const urlB = (b.parsedUrl.pathname || '') + (b.parsedUrl.search || '');
          comparison = urlA.localeCompare(urlB);
          break;
        }
        case 'domain': {
          comparison = (a.parsedUrl.hostname || '').localeCompare(b.parsedUrl.hostname || '');
          break;
        }
        case 'size': {
          const sizeA = a.response.content?.size || a.response.bodySize || 0;
          const sizeB = b.response.content?.size || b.response.bodySize || 0;
          comparison = sizeA - sizeB;
          break;
        }
        case 'time': {
          comparison = (a.time || 0) - (b.time || 0);
          break;
        }
        case 'alerts': {
          comparison = a.securityIssues.length - b.securityIssues.length;
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredEntries, sortField, sortOrder]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) || null,
    [entries, selectedEntryId]
  );

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const generateCurlCommand = (entry: EnrichedHarEntry): string => {
    const parts: string[] = ['curl'];
    parts.push(`-X ${entry.request.method}`);
    parts.push(`"${entry.request.url}"`);

    (entry.request.headers || []).forEach((h) => {
      // Avoid browser internal pseudo headers
      if (!h.name.startsWith(':')) {
        parts.push(`-H "${h.name}: ${h.value.replace(/"/g, '\\"')}"`);
      }
    });

    if (entry.request.postData?.text) {
      parts.push(`--data-raw '${entry.request.postData.text.replace(/'/g, "'\\''")}'`);
    }

    return parts.join(' \\\n  ');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusBadge = (status: number, isError: boolean) => {
    if (status === 0 || status === undefined) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
          0 FAILED
        </span>
      );
    }
    if (status >= 200 && status < 300) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60">
          {status}
        </span>
      );
    }
    if (status >= 300 && status < 400) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800/60">
          {status}
        </span>
      );
    }
    if (status >= 400 && status < 500) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60">
          {status}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60">
        {status}
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    const m = method.toUpperCase();
    const colors: Record<string, string> = {
      GET: 'text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800/50',
      POST: 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800/50',
      PUT: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800/50',
      PATCH: 'text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800/50',
      DELETE: 'text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800/50',
      OPTIONS: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700',
    };
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${
          colors[m] ||
          'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700'
        }`}
      >
        {m}
      </span>
    );
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-zinc-400 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={13} className="text-cyan-600 dark:text-cyan-400 font-bold" />
    ) : (
      <ArrowDown size={13} className="text-cyan-600 dark:text-cyan-400 font-bold" />
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden transition-colors">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          {/* Global Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Busca global (URL, host, status, método)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 font-mono transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Resource Type Pills */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900/80 p-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs">
            {['all', 'xhr', 'doc', 'js', 'media'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded transition text-[11px] ${
                  filterType === type
                    ? 'bg-cyan-600 text-white font-medium shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {type === 'all'
                  ? 'Todos'
                  : type === 'xhr'
                  ? 'Fetch / XHR'
                  : type === 'doc'
                  ? 'Doc'
                  : type === 'js'
                  ? 'JS'
                  : 'Mídia'}
              </button>
            ))}
          </div>

          {/* Toggle Column Filters Toolbar */}
          <button
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border transition ${
              showColumnFilters
                ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-400 text-cyan-800 dark:text-cyan-300 font-medium'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
            title="Alternar filtros individuais de coluna"
          >
            <Filter size={13} />
            <span>Filtros nas Colunas</span>
            {activeColFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-600 text-white">
                {activeColFiltersCount}
              </span>
            )}
          </button>

          {activeColFiltersCount > 0 && (
            <button
              onClick={resetColumnFilters}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition"
              title="Limpar todos os filtros de coluna"
            >
              <FilterX size={13} />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlySecurityIssues(!onlySecurityIssues)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border transition ${
              onlySecurityIssues
                ? 'bg-rose-100 dark:bg-rose-950/80 border-rose-400 dark:border-rose-600/70 text-rose-800 dark:text-rose-300'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <ShieldAlert size={13} className={onlySecurityIssues ? 'text-rose-600 dark:text-rose-400' : ''} />
            <span>Alertas ({entries.filter((e) => e.securityIssues.length > 0).length})</span>
          </button>

          <button
            onClick={() => setOnlyErrors(!onlyErrors)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border transition ${
              onlyErrors
                ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-600/70 text-amber-800 dark:text-amber-300'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <AlertTriangle size={13} className={onlyErrors ? 'text-amber-600 dark:text-amber-400' : ''} />
            <span>Erros 4xx/5xx ({entries.filter((e) => e.isError).length})</span>
          </button>
        </div>
      </div>

      {/* Main Table + Drawer container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Requests Table */}
        <div
          className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${
            selectedEntry ? 'w-1/2' : 'w-full'
          }`}
        >
          {/* Column Headers with Interactive Sorting */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider select-none">
            {/* Col 1: Status */}
            <div
              onClick={() => handleSortToggle('status')}
              className="col-span-1 flex items-center justify-between cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group"
              title="Clique para ordenar por Status"
            >
              <span>Status</span>
              {renderSortIcon('status')}
            </div>

            {/* Col 2: Method */}
            <div
              onClick={() => handleSortToggle('method')}
              className="col-span-1 flex items-center justify-between cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group"
              title="Clique para ordenar por Método"
            >
              <span>Método</span>
              {renderSortIcon('method')}
            </div>

            {/* Col 3: Path / Endpoint */}
            <div
              onClick={() => handleSortToggle('url')}
              className="col-span-5 flex items-center justify-between cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group"
              title="Clique para ordenar por Caminho / Endpoint"
            >
              <span>Caminho / Endpoint</span>
              {renderSortIcon('url')}
            </div>

            {/* Col 4: Domain */}
            <div
              onClick={() => handleSortToggle('domain')}
              className="col-span-2 flex items-center justify-between cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group"
              title="Clique para ordenar por Domínio"
            >
              <span>Domínio</span>
              {renderSortIcon('domain')}
            </div>

            {/* Col 5: Size */}
            <div
              onClick={() => handleSortToggle('size')}
              className="col-span-1 flex items-center justify-end gap-1 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group text-right"
              title="Clique para ordenar por Tamanho"
            >
              <span>Tamanho</span>
              {renderSortIcon('size')}
            </div>

            {/* Col 6: Time */}
            <div
              onClick={() => handleSortToggle('time')}
              className="col-span-1 flex items-center justify-end gap-1 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group text-right"
              title="Clique para ordenar por Tempo de Resposta"
            >
              <span>Tempo</span>
              {renderSortIcon('time')}
            </div>

            {/* Col 7: Alerts */}
            <div
              onClick={() => handleSortToggle('alerts')}
              className="col-span-1 flex items-center justify-center gap-1 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group text-center"
              title="Clique para ordenar por Alertas de Segurança"
            >
              <span>Alertas</span>
              {renderSortIcon('alerts')}
            </div>
          </div>

          {/* Per-Column Filtering Controls Row */}
          {showColumnFilters && (
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-sans">
              {/* Filter: Status */}
              <div className="col-span-1">
                <select
                  value={colFilters.status}
                  onChange={(e) => setColFilters({ ...colFilters, status: e.target.value })}
                  className={`w-full py-1 px-1 bg-white dark:bg-zinc-950 border rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 ${
                    colFilters.status !== 'all'
                      ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <option value="all">Todos</option>
                  <option value="0">0 (Falha)</option>
                  <option value="2xx">2xx (OK)</option>
                  <option value="3xx">3xx (Redir)</option>
                  <option value="4xx">4xx (Erro)</option>
                  <option value="5xx">5xx (Serv)</option>
                </select>
              </div>

              {/* Filter: Method */}
              <div className="col-span-1">
                <select
                  value={colFilters.method}
                  onChange={(e) => setColFilters({ ...colFilters, method: e.target.value })}
                  className={`w-full py-1 px-1 bg-white dark:bg-zinc-950 border rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 ${
                    colFilters.method !== 'all'
                      ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <option value="all">Todos</option>
                  {uniqueMethods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter: Path / Endpoint */}
              <div className="col-span-5 relative">
                <input
                  type="text"
                  placeholder="Filtrar rota (/api, checkout, etc)..."
                  value={colFilters.url}
                  onChange={(e) => setColFilters({ ...colFilters, url: e.target.value })}
                  className={`w-full py-1 pl-2 pr-6 bg-white dark:bg-zinc-950 border rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 ${
                    colFilters.url.trim()
                      ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 font-medium'
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400'
                  }`}
                />
                {colFilters.url && (
                  <button
                    onClick={() => setColFilters({ ...colFilters, url: '' })}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Filter: Domain */}
              <div className="col-span-2">
                <select
                  value={colFilters.domain}
                  onChange={(e) => setColFilters({ ...colFilters, domain: e.target.value })}
                  className={`w-full py-1 px-1 bg-white dark:bg-zinc-950 border rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 truncate ${
                    colFilters.domain !== 'all'
                      ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <option value="all">Todos Domínios</option>
                  {uniqueDomains.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter: Size */}
              <div className="col-span-1">
                <select
                  value={colFilters.size}
                  onChange={(e) => setColFilters({ ...colFilters, size: e.target.value })}
                  className={`w-full py-1 px-1 bg-white dark:bg-zinc-950 border rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 ${
                    colFilters.size !== 'all'
                      ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <option value="all">Todos</option>
                  <option value="0b">0 B</option>
                  <option value=">10kb">&gt;10 KB</option>
                  <option value=">100kb">&gt;100 KB</option>
                  <option value=">1mb">&gt;1 MB</option>
                </select>
              </div>

              {/* Filter: Time */}
              <div className="col-span-1">
                <select
                  value={colFilters.time}
                  onChange={(e) => setColFilters({ ...colFilters, time: e.target.value })}
                  className={`w-full py-1 px-1 bg-white dark:bg-zinc-950 border rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 ${
                    colFilters.time !== 'all'
                      ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <option value="all">Todos</option>
                  <option value=">200ms">&gt;200ms</option>
                  <option value=">500ms">&gt;500ms</option>
                  <option value=">1s">&gt;1s</option>
                  <option value=">2s">&gt;2s</option>
                </select>
              </div>

              {/* Filter: Alerts */}
              <div className="col-span-1">
                <select
                  value={colFilters.alerts}
                  onChange={(e) => setColFilters({ ...colFilters, alerts: e.target.value })}
                  className={`w-full py-1 px-1 bg-white dark:bg-zinc-950 border rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 ${
                    colFilters.alerts !== 'all'
                      ? 'border-rose-500 text-rose-700 dark:text-rose-300 font-semibold'
                      : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <option value="all">Todos</option>
                  <option value="with_alerts">Com Alertas</option>
                  <option value="critical_high">Crítico / Alto</option>
                  <option value="without_alerts">Sem Alertas</option>
                </select>
              </div>
            </div>
          )}

          {/* Table Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono text-xs">
            {sortedEntries.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 dark:text-zinc-500 space-y-2">
                <div>Nenhuma requisição encontrada com os filtros e ordenação atuais.</div>
                {(activeColFiltersCount > 0 || searchQuery) && (
                  <button
                    onClick={() => {
                      resetColumnFilters();
                      setSearchQuery('');
                      setFilterType('all');
                      setOnlyErrors(false);
                      setOnlySecurityIssues(false);
                    }}
                    className="px-3 py-1 text-xs bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded text-zinc-700 dark:text-zinc-300 transition"
                  >
                    Redefinir todos os filtros
                  </button>
                )}
              </div>
            ) : (
              sortedEntries.map((entry) => {
                const isSelected = entry.id === selectedEntryId;
                const hasSecurity = entry.securityIssues.length > 0;
                return (
                  <div
                    key={entry.id}
                    onClick={() => onSelectEntry(isSelected ? null : entry.id)}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 items-center cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 border-l-2 border-l-cyan-600 dark:border-l-cyan-400'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="col-span-1">{getStatusBadge(entry.response.status, entry.isError)}</div>
                    <div className="col-span-1">{getMethodBadge(entry.request.method)}</div>
                    <div className="col-span-5 truncate text-zinc-800 dark:text-zinc-200 font-sans" title={entry.request.url}>
                      <span className="font-mono text-zinc-900 dark:text-zinc-300 font-medium">
                        {entry.parsedUrl.pathname || '/'}
                      </span>
                      {entry.parsedUrl.search && (
                        <span className="text-zinc-500 font-mono text-[11px]">{entry.parsedUrl.search}</span>
                      )}
                    </div>
                    <div className="col-span-2 truncate text-zinc-500 dark:text-zinc-400 text-[11px]" title={entry.parsedUrl.hostname}>
                      <span className="inline-flex items-center gap-1">
                        {entry.parsedUrl.isHttps ? (
                          <Lock size={10} className="text-emerald-600 dark:text-emerald-500 shrink-0" />
                        ) : (
                          <Unlock size={10} className="text-amber-600 dark:text-amber-500 shrink-0" />
                        )}
                        <span className="truncate">{entry.parsedUrl.hostname}</span>
                      </span>
                    </div>
                    <div className="col-span-1 text-right text-zinc-600 dark:text-zinc-400 text-[11px]">
                      {formatBytes(entry.response.content?.size || entry.response.bodySize || 0)}
                    </div>
                    <div className="col-span-1 text-right text-zinc-600 dark:text-zinc-400 text-[11px]">
                      {Math.round(entry.time)} ms
                    </div>
                    <div className="col-span-1 text-center">
                      {hasSecurity && (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                          {entry.securityIssues.length}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Table Bottom Status Footer */}
          <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-3">
              <span>
                Exibindo <strong>{sortedEntries.length}</strong> de {entries.length} requisições
              </span>
              {sortField && (
                <span className="text-cyan-600 dark:text-cyan-400 font-mono">
                  Ordenado por {sortField} ({sortOrder === 'asc' ? 'crescente' : 'decrescente'})
                </span>
              )}
            </div>
            <span className="text-zinc-400 dark:text-zinc-500 font-mono">
              Clique em qualquer linha para abrir a inspeção forense
            </span>
          </div>
        </div>

        {/* Forensic Inspector Detail Panel (Drawer) */}
        {selectedEntry && (
          <div className="w-1/2 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col overflow-hidden animate-in slide-in-from-right duration-150">
            {/* Header */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(selectedEntry.response.status, selectedEntry.isError)}
                  {getMethodBadge(selectedEntry.request.method)}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {selectedEntry.response.httpVersion || 'HTTP'}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">· {Math.round(selectedEntry.time)}ms</span>
                  {selectedEntry.serverIPAddress && (
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                      ({selectedEntry.serverIPAddress})
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-zinc-900 dark:text-zinc-200 truncate select-all" title={selectedEntry.request.url}>
                  {selectedEntry.request.url}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Copy cURL */}
                <button
                  onClick={() => copyToClipboard(generateCurlCommand(selectedEntry), 'curl')}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-xs transition"
                  title="Copiar comando cURL executável"
                >
                  {copiedKey === 'curl' ? (
                    <>
                      <Check size={12} className="text-emerald-500" />
                      <span className="text-[11px] text-emerald-500 font-bold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Terminal size={12} />
                      <span className="text-[11px]">cURL</span>
                    </>
                  )}
                </button>

                {/* Copy URL */}
                <button
                  onClick={() => copyToClipboard(selectedEntry.request.url, 'url')}
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 rounded transition"
                  title="Copiar URL"
                >
                  {copiedKey === 'url' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>

                {/* Close Drawer */}
                <button
                  onClick={() => onSelectEntry(null)}
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 rounded transition"
                  title="Fechar painel"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Inspector Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 px-2 text-xs">
              <button
                onClick={() => setActiveTab('headers')}
                className={`px-3 py-2 border-b-2 font-medium transition ${
                  activeTab === 'headers'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-300'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Headers ({selectedEntry.request.headers.length + selectedEntry.response.headers.length})
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition ${
                  activeTab === 'security'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-300'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <ShieldAlert size={12} className={selectedEntry.securityIssues.length > 0 ? 'text-rose-500' : ''} />
                Segurança ({selectedEntry.securityIssues.length})
              </button>
              <button
                onClick={() => setActiveTab('payload')}
                className={`px-3 py-2 border-b-2 font-medium transition ${
                  activeTab === 'payload'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-300'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Payload / Resposta
              </button>
              <button
                onClick={() => setActiveTab('cookies')}
                className={`px-3 py-2 border-b-2 font-medium transition ${
                  activeTab === 'cookies'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-300'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Cookies ({selectedEntry.request.cookies.length + selectedEntry.response.cookies.length})
              </button>
              <button
                onClick={() => setActiveTab('timings')}
                className={`px-3 py-2 border-b-2 font-medium transition ${
                  activeTab === 'timings'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-300'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Timings
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
              {activeTab === 'headers' && (
                <div className="space-y-4">
                  {selectedEntry.request.queryString.length > 0 && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
                      <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                        Query Parameters ({selectedEntry.request.queryString.length})
                      </div>
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800/60 p-2 space-y-1">
                        {selectedEntry.request.queryString.map((q, idx) => (
                          <div key={idx} className="flex gap-2 py-1 items-start">
                            <span className="text-cyan-700 dark:text-cyan-400 font-semibold min-w-[120px]">{q.name}:</span>
                            <span className="text-zinc-800 dark:text-zinc-300 break-all flex-1">{q.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response Headers */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
                    <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] flex justify-between">
                      <span>Response Headers ({selectedEntry.response.headers.length})</span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            selectedEntry.response.headers.map((h) => `${h.name}: ${h.value}`).join('\n'),
                            'resp-headers'
                          )
                        }
                        className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-[10px]"
                      >
                        {copiedKey === 'resp-headers' ? 'Copiado!' : 'Copiar todos'}
                      </button>
                    </div>
                    <div className="p-2 space-y-1 divide-y divide-zinc-200 dark:divide-zinc-800/40">
                      {selectedEntry.response.headers.map((h, idx) => (
                        <div key={idx} className="flex gap-2 py-1 items-start">
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold min-w-[160px] truncate">{h.name}:</span>
                          <span className="text-zinc-800 dark:text-zinc-300 break-all flex-1">{h.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Request Headers */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
                    <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] flex justify-between">
                      <span>Request Headers ({selectedEntry.request.headers.length})</span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            selectedEntry.request.headers.map((h) => `${h.name}: ${h.value}`).join('\n'),
                            'req-headers'
                          )
                        }
                        className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-[10px]"
                      >
                        {copiedKey === 'req-headers' ? 'Copiado!' : 'Copiar todos'}
                      </button>
                    </div>
                    <div className="p-2 space-y-1 divide-y divide-zinc-200 dark:divide-zinc-800/40">
                      {selectedEntry.request.headers.map((h, idx) => (
                        <div key={idx} className="flex gap-2 py-1 items-start">
                          <span className="text-cyan-700 dark:text-cyan-400 font-semibold min-w-[160px] truncate">{h.name}:</span>
                          <span className="text-zinc-800 dark:text-zinc-300 break-all flex-1">{h.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-3">
                  {selectedEntry.securityIssues.length === 0 ? (
                    <div className="p-6 text-center border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-900/20 text-emerald-600 dark:text-emerald-400">
                      Nenhuma anomalia de segurança detectada para esta requisição.
                    </div>
                  ) : (
                    selectedEntry.securityIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="p-3 rounded-md border border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/20 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-bold text-rose-800 dark:text-rose-300 text-xs flex items-center gap-1.5">
                            <ShieldAlert size={14} className="text-rose-600 dark:text-rose-400" />
                            {issue.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-200 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                            {issue.severity}
                          </span>
                        </div>
                        <p className="font-sans text-xs text-zinc-700 dark:text-zinc-300">{issue.description}</p>
                        {issue.cwe && (
                          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900/70 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">
                            {issue.cwe}
                          </div>
                        )}
                        {issue.evidence && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 font-mono bg-amber-50 dark:bg-zinc-900/80 p-1.5 rounded border border-amber-200 dark:border-zinc-800 break-all">
                            Evidência: {issue.evidence}
                          </div>
                        )}
                        <div className="font-sans text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded border border-emerald-200 dark:border-emerald-900/50">
                          <strong>Recomendação:</strong> {issue.recommendation}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'payload' && (
                <div className="space-y-4 font-mono">
                  {selectedEntry.request.postData?.text && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
                      <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] flex justify-between">
                        <span>Request Body ({selectedEntry.request.postData.mimeType})</span>
                        <button
                          onClick={() => copyToClipboard(selectedEntry.request.postData?.text || '', 'req-body')}
                          className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-[10px]"
                        >
                          {copiedKey === 'req-body' ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <pre className="p-3 text-xs text-zinc-800 dark:text-zinc-300 overflow-x-auto max-h-56">
                        {selectedEntry.request.postData.text}
                      </pre>
                    </div>
                  )}

                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
                    <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-zinc-700 dark:text-zinc-300 text-[11px] flex justify-between">
                      <span>Response Content ({selectedEntry.response.content?.mimeType || 'unknown'})</span>
                      {selectedEntry.response.content?.text && (
                        <button
                          onClick={() => copyToClipboard(selectedEntry.response.content?.text || '', 'res-body')}
                          className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-[10px]"
                        >
                          {copiedKey === 'res-body' ? 'Copiado!' : 'Copiar'}
                        </button>
                      )}
                    </div>
                    {selectedEntry.response.content?.text ? (
                      <pre className="p-3 text-xs text-zinc-800 dark:text-zinc-300 overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
                        {selectedEntry.response.content.text}
                      </pre>
                    ) : (
                      <div className="p-6 text-center text-zinc-400 dark:text-zinc-500 font-sans text-xs">
                        Corpo da resposta vazio ou binário não incluído no arquivo HAR.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'cookies' && (
                <div className="space-y-4">
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
                    <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                      Response Set-Cookies ({selectedEntry.response.cookies.length})
                    </div>
                    {selectedEntry.response.cookies.length === 0 ? (
                      <div className="p-4 text-center text-zinc-400 dark:text-zinc-500 font-sans text-xs">
                        Nenhum cookie enviado na resposta
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800/40 p-2 space-y-2">
                        {selectedEntry.response.cookies.map((c, i) => (
                          <div key={i} className="py-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-cyan-700 dark:text-cyan-400">{c.name}</span>
                              <div className="flex gap-1">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                                    c.secure
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                                  }`}
                                >
                                  {c.secure ? 'Secure' : 'No-Secure'}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                                    c.httpOnly
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                                  }`}
                                >
                                  {c.httpOnly ? 'HttpOnly' : 'No-HttpOnly'}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                                  SameSite={c.sameSite || 'None'}
                                </span>
                              </div>
                            </div>
                            <div className="text-zinc-600 dark:text-zinc-400 break-all text-[11px]">{c.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'timings' && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 p-4 space-y-3 font-sans text-xs">
                  <div className="font-semibold text-zinc-800 dark:text-zinc-300 mb-2">
                    Detalhamento de Latência de Rede
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                      <span className="text-zinc-600 dark:text-zinc-400">Bloqueado / Aguardando Socket:</span>
                      <span className="text-zinc-900 dark:text-zinc-200">{selectedEntry.timings.blocked ?? 0} ms</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                      <span className="text-zinc-600 dark:text-zinc-400">DNS Lookup:</span>
                      <span className="text-zinc-900 dark:text-zinc-200">{selectedEntry.timings.dns ?? 0} ms</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                      <span className="text-zinc-600 dark:text-zinc-400">TCP Handshake:</span>
                      <span className="text-zinc-900 dark:text-zinc-200">{selectedEntry.timings.connect ?? 0} ms</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                      <span className="text-zinc-600 dark:text-zinc-400">TLS / SSL Handshake:</span>
                      <span className="text-zinc-900 dark:text-zinc-200">{selectedEntry.timings.ssl ?? 0} ms</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                      <span className="text-zinc-600 dark:text-zinc-400">Envio (Send):</span>
                      <span className="text-zinc-900 dark:text-zinc-200">{selectedEntry.timings.send} ms</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                      <span className="text-cyan-700 dark:text-cyan-400 font-semibold">TTFB (Time To First Byte):</span>
                      <span className="text-cyan-800 dark:text-cyan-300 font-semibold">{selectedEntry.timings.wait} ms</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-200 dark:border-zinc-800/60 font-mono">
                      <span className="text-zinc-600 dark:text-zinc-400">Download do Conteúdo:</span>
                      <span className="text-zinc-900 dark:text-zinc-200">{selectedEntry.timings.receive} ms</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      <span>Duração Total:</span>
                      <span>{Math.round(selectedEntry.time)} ms</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
