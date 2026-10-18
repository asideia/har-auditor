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
  Clock,
  Zap,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Activity,
  Layers,
} from 'lucide-react';

type SortField = 'status' | 'method' | 'datetime' | 'url' | 'domain' | 'size' | 'time' | 'alerts';
type SortOrder = 'asc' | 'desc';

interface ColumnFilters {
  status: string;
  method: string;
  datetime: string;
  url: string;
  domain: string;
  size: string;
  time: string;
  alerts: string;
}

const initialColumnFilters: ColumnFilters = {
  status: 'all',
  method: 'all',
  datetime: '',
  url: '',
  domain: 'all',
  size: 'all',
  time: 'all',
  alerts: 'all',
};

export const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '--:--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  } catch {
    return isoString || '--:--:--';
  }
};

export const formatDateDay = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return '';
  }
};

export const RequestsInspector: React.FC<ToolPluginContext> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  searchQuery,
  setSearchQuery,
}) => {
  // Quick type & state filters
  const [filterType, setFilterType] = useState<string>('all');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [onlySecurityIssues, setOnlySecurityIssues] = useState(false);
  const [activeTab, setActiveTab] = useState<'headers' | 'payload' | 'cookies' | 'timings' | 'security'>('headers');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Busca Global em Profundidade (Full-Text Search)
  const [deepSearch, setDeepSearch] = useState(true);

  // 2. Filtro de Domínio com 1 Clique (Pílula ou Dropdown)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  // 3. Filtros por Latência / Gargalos (TTFB & Duração)
  const [latencyFilter, setLatencyFilter] = useState<'all' | '>500ms' | '>1s' | '>2s' | 'slow_ttfb'>('all');

  // 4. Filtros por Código de Status e Métodos HTTP (Múltipla Seleção)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set());

  // Visual panel expansion
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);

  // Column sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Column filter row state
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [colFilters, setColFilters] = useState<ColumnFilters>(initialColumnFilters);

  // Domain statistics for quick pills
  const domainStats = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const host = e.parsedUrl?.hostname || 'desconhecido';
      map.set(host, (map.get(host) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  // Method statistics for quick pills
  const methodStats = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const m = (e.request.method || 'GET').toUpperCase();
      map.set(m, (map.get(m) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  // Status statistics for quick pills
  const statusStats = useMemo(() => {
    const counts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, '0': 0 };
    entries.forEach((e) => {
      const st = e.response.status ?? 0;
      if (st === 0 || (e.isError && st === 0)) counts['0']++;
      else if (st >= 200 && st < 300) counts['2xx']++;
      else if (st >= 300 && st < 400) counts['3xx']++;
      else if (st >= 400 && st < 500) counts['4xx']++;
      else if (st >= 500) counts['5xx']++;
    });
    return counts;
  }, [entries]);

  // Unique domains & methods for dropdowns
  const uniqueDomains = useMemo(() => {
    return domainStats.map((d) => d.domain).sort();
  }, [domainStats]);

  const uniqueMethods = useMemo(() => {
    return methodStats.map((m) => m.method).sort();
  }, [methodStats]);

  // Toggle helpers for multi-select
  const toggleStatusSelection = (category: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleMethodSelection = (method: string) => {
    setSelectedMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method);
      else next.add(method);
      return next;
    });
  };

  // Helper to detect where search matched for forensic transparency
  const getSearchMatchBadges = (entry: EnrichedHarEntry, q: string): string[] => {
    if (!q) return [];
    const query = q.toLowerCase();
    const badges: string[] = [];

    const reqBody = entry.request.postData?.text?.toLowerCase();
    if (reqBody && reqBody.includes(query)) badges.push('Body Req');

    const resBody = entry.response.content?.text?.toLowerCase();
    if (resBody && resBody.includes(query)) badges.push('Body Res');

    const reqHeadersMatch = entry.request.headers.some(
      (h) => h.name.toLowerCase().includes(query) || h.value.toLowerCase().includes(query)
    );
    if (reqHeadersMatch) badges.push('Header');

    const queryParamsMatch = entry.request.queryString.some(
      (qs) => qs.name.toLowerCase().includes(query) || qs.value.toLowerCase().includes(query)
    );
    if (queryParamsMatch) badges.push('Query');

    const cookieMatch =
      entry.request.cookies.some((c) => c.name.toLowerCase().includes(query) || c.value.toLowerCase().includes(query)) ||
      entry.response.cookies.some((c) => c.name.toLowerCase().includes(query) || c.value.toLowerCase().includes(query));
    if (cookieMatch) badges.push('Cookie');

    return badges;
  };

  // Count active multidimensional filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedDomain !== null) count++;
    if (latencyFilter !== 'all') count++;
    if (selectedStatuses.size > 0) count += selectedStatuses.size;
    if (selectedMethods.size > 0) count += selectedMethods.size;
    if (onlyErrors) count++;
    if (onlySecurityIssues) count++;
    if (filterType !== 'all') count++;

    if (colFilters.status !== 'all') count++;
    if (colFilters.method !== 'all') count++;
    if (colFilters.datetime.trim() !== '') count++;
    if (colFilters.url.trim() !== '') count++;
    if (colFilters.domain !== 'all') count++;
    if (colFilters.size !== 'all') count++;
    if (colFilters.time !== 'all') count++;
    if (colFilters.alerts !== 'all') count++;

    return count;
  }, [
    searchQuery,
    selectedDomain,
    latencyFilter,
    selectedStatuses,
    selectedMethods,
    onlyErrors,
    onlySecurityIssues,
    filterType,
    colFilters,
  ]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedDomain(null);
    setLatencyFilter('all');
    setSelectedStatuses(new Set());
    setSelectedMethods(new Set());
    setOnlyErrors(false);
    setOnlySecurityIssues(false);
    setFilterType('all');
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

  // MULTIDIMENSIONAL FILTERING PIPELINE
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

      // 3. Domain 1-click filter
      if (selectedDomain && entry.parsedUrl.hostname.toLowerCase() !== selectedDomain.toLowerCase()) {
        return false;
      }

      // 4. Status multi-select filter (2xx, 3xx, 4xx, 5xx, 0)
      if (selectedStatuses.size > 0) {
        const st = entry.response.status ?? 0;
        let matched = false;
        if (selectedStatuses.has('0') && (st === 0 || (!st && entry.isError))) matched = true;
        if (selectedStatuses.has('2xx') && st >= 200 && st < 300) matched = true;
        if (selectedStatuses.has('3xx') && st >= 300 && st < 400) matched = true;
        if (selectedStatuses.has('4xx') && st >= 400 && st < 500) matched = true;
        if (selectedStatuses.has('5xx') && st >= 500) matched = true;
        if (!matched) return false;
      }

      // 5. Method multi-select filter (GET, POST, PUT, DELETE, PATCH, OPTIONS)
      if (selectedMethods.size > 0) {
        const m = (entry.request.method || 'GET').toUpperCase();
        if (!selectedMethods.has(m)) return false;
      }

      // 6. Latency & Bottleneck filter
      if (latencyFilter !== 'all') {
        const duration = entry.time || 0;
        const waitTtfb = entry.timings?.wait || 0;

        if (latencyFilter === '>500ms' && duration <= 500) return false;
        if (latencyFilter === '>1s' && duration <= 1000) return false;
        if (latencyFilter === '>2s' && duration <= 2000) return false;
        if (latencyFilter === 'slow_ttfb' && waitTtfb < 300) return false;
      }

      // 7. Full-Text Deep Search (URL, host, method, status, request/response body, headers, cookies, query)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUrl = entry.request.url.toLowerCase().includes(q);
        const matchesMethod = entry.request.method.toLowerCase().includes(q);
        const matchesStatus = String(entry.response.status).includes(q);
        const matchesHost = entry.parsedUrl.hostname.toLowerCase().includes(q);

        let matches = matchesUrl || matchesMethod || matchesStatus || matchesHost;

        // If not matched on metadata and deep search is enabled, search in payloads, headers, cookies, and query
        if (!matches && deepSearch) {
          // Request payload body
          const reqBody = entry.request.postData?.text?.toLowerCase();
          if (reqBody && reqBody.includes(q)) matches = true;

          // Response payload body
          if (!matches) {
            const resBody = entry.response.content?.text?.toLowerCase();
            if (resBody && resBody.includes(q)) matches = true;
          }

          // Request headers
          if (!matches) {
            matches = entry.request.headers.some(
              (h) => h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)
            );
          }

          // Response headers
          if (!matches) {
            matches = entry.response.headers.some(
              (h) => h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)
            );
          }

          // Query parameters
          if (!matches) {
            matches = entry.request.queryString.some(
              (qs) => qs.name.toLowerCase().includes(q) || qs.value.toLowerCase().includes(q)
            );
          }

          // Cookies
          if (!matches) {
            matches =
              entry.request.cookies.some((c) => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)) ||
              entry.response.cookies.some((c) => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q));
          }
        }

        if (!matches) return false;
      }

      // 8. Per-column filters
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

      if (colFilters.method !== 'all') {
        if (entry.request.method.toUpperCase() !== colFilters.method.toUpperCase()) return false;
      }

      if (colFilters.datetime.trim()) {
        const target = colFilters.datetime.toLowerCase();
        const rawDate = (entry.startedDateTime || '').toLowerCase();
        const formatted = formatDateTime(entry.startedDateTime).toLowerCase();
        const day = formatDateDay(entry.startedDateTime).toLowerCase();
        if (!rawDate.includes(target) && !formatted.includes(target) && !day.includes(target)) {
          return false;
        }
      }

      if (colFilters.url.trim()) {
        const target = colFilters.url.toLowerCase();
        const fullUrl = entry.request.url.toLowerCase();
        if (!fullUrl.includes(target)) return false;
      }

      if (colFilters.domain !== 'all') {
        if (entry.parsedUrl.hostname.toLowerCase() !== colFilters.domain.toLowerCase()) return false;
      }

      if (colFilters.size !== 'all') {
        const bytes = entry.response.content?.size || entry.response.bodySize || 0;
        if (colFilters.size === '0b' && bytes > 0) return false;
        if (colFilters.size === '>10kb' && bytes <= 10 * 1024) return false;
        if (colFilters.size === '>100kb' && bytes <= 100 * 1024) return false;
        if (colFilters.size === '>1mb' && bytes <= 1024 * 1024) return false;
      }

      if (colFilters.time !== 'all') {
        const ms = entry.time || 0;
        if (colFilters.time === '>200ms' && ms <= 200) return false;
        if (colFilters.time === '>500ms' && ms <= 500) return false;
        if (colFilters.time === '>1s' && ms <= 1000) return false;
        if (colFilters.time === '>2s' && ms <= 2000) return false;
      }

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
  }, [
    entries,
    filterType,
    onlyErrors,
    onlySecurityIssues,
    selectedDomain,
    selectedStatuses,
    selectedMethods,
    latencyFilter,
    searchQuery,
    deepSearch,
    colFilters,
  ]);

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
        case 'datetime': {
          const timeA = a.startedDateTime ? new Date(a.startedDateTime).getTime() : 0;
          const timeB = b.startedDateTime ? new Date(b.startedDateTime).getTime() : 0;
          comparison = timeA - timeB;
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
      {/* 1. TOP CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          {/* Global Search Input with Deep Search Toggle */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={14} />
            <input
              type="text"
              placeholder={
                deepSearch
                  ? 'Busca em profundidade (URL, Payloads JSON, Headers, Cookies, Query)...'
                  : 'Busca rápida (URL, host, status, método)...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 font-mono transition shadow-2xs"
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

          {/* Deep Search (Full-Text) Toggle Button */}
          <button
            onClick={() => setDeepSearch(!deepSearch)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition whitespace-nowrap ${
              deepSearch
                ? 'bg-cyan-50 dark:bg-cyan-950/70 border-cyan-400 text-cyan-800 dark:text-cyan-300 font-semibold shadow-2xs'
                : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
            title="Quando ativado, busca o termo dentro do corpo JSON de requisição/resposta, cabeçalhos e cookies"
          >
            <FileSearch size={13} className={deepSearch ? 'text-cyan-600 dark:text-cyan-400' : ''} />
            <span className="hidden sm:inline">Busca em Profundidade</span>
            <span className="sm:hidden">Full-Text</span>
            {deepSearch && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400 animate-pulse" />
            )}
          </button>

          {/* Toggle Advanced Filters Panel */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition whitespace-nowrap ${
              showAdvancedFilters
                ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Filtros Multidimensionais</span>
            {showAdvancedFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Toggle Column Sub-row Filters */}
          <button
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className={`p-1.5 rounded-md border text-xs transition ${
              showColumnFilters
                ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-400 text-zinc-900 dark:text-zinc-100'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800'
            }`}
            title="Alternar inputs de filtro nas colunas da tabela"
          >
            <Filter size={13} />
          </button>
        </div>

        {/* Quick Summary / Active Count & Reset */}
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800/80 rounded-md hover:bg-rose-100 transition shadow-2xs"
              title="Redefinir e limpar todos os filtros ativos"
            >
              <FilterX size={12} />
              <span>Limpar Filtros ({activeFiltersCount})</span>
            </button>
          )}

          <button
            onClick={() => setOnlySecurityIssues(!onlySecurityIssues)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border transition ${
              onlySecurityIssues
                ? 'bg-rose-100 dark:bg-rose-950/80 border-rose-400 dark:border-rose-600/70 text-rose-800 dark:text-rose-300'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
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
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <AlertTriangle size={13} className={onlyErrors ? 'text-amber-600 dark:text-amber-400' : ''} />
            <span>Erros ({entries.filter((e) => e.isError).length})</span>
          </button>
        </div>
      </div>

      {/* 2. ADVANCED MULTIDIMENSIONAL FORENSIC FILTERS ACCORDION */}
      {showAdvancedFilters && (
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 p-3 space-y-3 animate-in slide-in-from-top-1 duration-150 text-xs select-none">
          {/* Row A: 1-Click Domain Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Globe size={12} className="text-cyan-600 dark:text-cyan-400" />
              Domínio (1 Clique):
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
              {/* All Domains Pill */}
              <button
                onClick={() => setSelectedDomain(null)}
                className={`px-2.5 py-1 rounded-full text-xs transition whitespace-nowrap flex items-center gap-1 font-mono ${
                  selectedDomain === null
                    ? 'bg-cyan-600 text-white font-bold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <span>Todos</span>
                <span className="text-[10px] opacity-80 font-sans">({entries.length})</span>
              </button>

              {/* Unique Domain Pills */}
              {domainStats.map(({ domain, count }) => {
                const isSelected = selectedDomain === domain;
                return (
                  <button
                    key={domain}
                    onClick={() => setSelectedDomain(isSelected ? null : domain)}
                    className={`px-2.5 py-1 rounded-full text-xs transition whitespace-nowrap flex items-center gap-1.5 font-mono ${
                      isSelected
                        ? 'bg-cyan-600 text-white font-bold shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
                    }`}
                    title={`Filtrar apenas chamadas de ${domain}`}
                  >
                    <span className="truncate max-w-[180px]">{domain}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isSelected
                          ? 'bg-cyan-800/80 text-cyan-100'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row B: Multiple Selection by Status & Multiple Selection by Method */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
            {/* Status Multiple Selection */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0">
                Código de Status:
              </span>
              {(['2xx', '3xx', '4xx', '5xx', '0'] as const).map((code) => {
                const isSelected = selectedStatuses.has(code);
                const count = statusStats[code] || 0;
                const labels: Record<string, string> = {
                  '2xx': '2xx OK',
                  '3xx': '3xx Redir',
                  '4xx': '4xx Cliente',
                  '5xx': '5xx Servidor',
                  '0': '0 Falhas',
                };
                return (
                  <button
                    key={code}
                    onClick={() => toggleStatusSelection(code)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition flex items-center gap-1 border ${
                      isSelected
                        ? code === '0'
                          ? 'bg-rose-600 text-white border-rose-700 font-bold'
                          : code === '5xx'
                          ? 'bg-rose-600 text-white border-rose-700 font-bold'
                          : code === '4xx'
                          ? 'bg-amber-600 text-white border-amber-700 font-bold'
                          : code === '3xx'
                          ? 'bg-cyan-600 text-white border-cyan-700 font-bold'
                          : 'bg-emerald-600 text-white border-emerald-700 font-bold'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200'
                    }`}
                  >
                    <span>{labels[code]}</span>
                    <span className="text-[10px] opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Methods Multiple Selection */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0">
                Métodos HTTP:
              </span>
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].map((m) => {
                const isSelected = selectedMethods.has(m);
                const count = methodStats.find((item) => item.method === m)?.count || 0;
                return (
                  <button
                    key={m}
                    onClick={() => toggleMethodSelection(m)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 shadow-2xs'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200'
                    }`}
                  >
                    <span>{m}</span>
                    <span className="text-[10px] font-normal opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Latency & Bottleneck Shortcuts */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Clock size={12} className="text-amber-500" />
                Latência / Gargalos:
              </span>
              {[
                { id: 'all', label: 'Todos' },
                { id: '>500ms', label: '> 500ms' },
                { id: '>1s', label: '> 1s' },
                { id: '>2s', label: '> 2s' },
                { id: 'slow_ttfb', label: 'Slow TTFB (>300ms)' },
              ].map((item) => {
                const isSelected = latencyFilter === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setLatencyFilter(item.id as any)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition border ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-2xs'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200'
                    }`}
                    title={
                      item.id === 'slow_ttfb'
                        ? 'Filtra requisições onde o tempo de espera do servidor (TTFB) superou 300ms'
                        : undefined
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN TABLE + DRAWER CONTAINER */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Requests Table */}
        <div
          className={`flex-1 flex flex-col overflow-x-auto overflow-y-hidden transition-all duration-200 ${
            selectedEntry ? 'w-1/2' : 'w-full'
          }`}
        >
          <div className="min-w-[960px] flex-1 flex flex-col h-full overflow-hidden">
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

              {/* Col 3: Data e Hora Cronológica */}
              <div
                onClick={() => handleSortToggle('datetime')}
                className="col-span-2 flex items-center justify-between cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group"
                title="Clique para ordenar cronologicamente por Data e Hora da requisição"
              >
                <span className="flex items-center gap-1">
                  <Clock size={11} className="text-zinc-400 group-hover:text-cyan-500" />
                  <span>Horário / Data</span>
                </span>
                {renderSortIcon('datetime')}
              </div>

              {/* Col 4: Path / Endpoint */}
              <div
                onClick={() => handleSortToggle('url')}
                className="col-span-3 flex items-center justify-between cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group"
                title="Clique para ordenar por Caminho / Endpoint"
              >
                <span>Caminho / Endpoint</span>
                {renderSortIcon('url')}
              </div>

              {/* Col 5: Domain */}
              <div
                onClick={() => handleSortToggle('domain')}
                className="col-span-2 flex items-center justify-between cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group"
                title="Clique para ordenar por Domínio"
              >
                <span>Domínio</span>
                {renderSortIcon('domain')}
              </div>

              {/* Col 6: Size */}
              <div
                onClick={() => handleSortToggle('size')}
                className="col-span-1 flex items-center justify-end gap-1 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group text-right"
                title="Clique para ordenar por Tamanho"
              >
                <span>Tamanho</span>
                {renderSortIcon('size')}
              </div>

              {/* Col 7: Time */}
              <div
                onClick={() => handleSortToggle('time')}
                className="col-span-1 flex items-center justify-end gap-1 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group text-right"
                title="Clique para ordenar por Tempo de Resposta"
              >
                <span>Tempo</span>
                {renderSortIcon('time')}
              </div>

              {/* Col 8: Alerts */}
              <div
                onClick={() => handleSortToggle('alerts')}
                className="col-span-1 flex items-center justify-center gap-1 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 group text-center"
                title="Clique para ordenar por Alertas de Segurança"
              >
                <span>Alertas</span>
                {renderSortIcon('alerts')}
              </div>
            </div>

            {/* Sub-row: Individual Column Filter Controls */}
            {showColumnFilters && (
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-sans">
                {/* Filter: Status */}
                <div className="col-span-1">
                  <select
                    value={colFilters.status}
                    onChange={(e) => setColFilters({ ...colFilters, status: e.target.value })}
                    className="w-full py-1 px-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500"
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
                    className="w-full py-1 px-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">Todos</option>
                    {uniqueMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter: Horário / Data */}
                <div className="col-span-2 relative">
                  <input
                    type="text"
                    placeholder="Hora (ex: 14:20)..."
                    value={colFilters.datetime}
                    onChange={(e) => setColFilters({ ...colFilters, datetime: e.target.value })}
                    className="w-full py-1 pl-2 pr-6 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500"
                  />
                  {colFilters.datetime && (
                    <button
                      onClick={() => setColFilters({ ...colFilters, datetime: '' })}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Filter: Path / Endpoint */}
                <div className="col-span-3 relative">
                  <input
                    type="text"
                    placeholder="Filtrar rota (/api, etc)..."
                    value={colFilters.url}
                    onChange={(e) => setColFilters({ ...colFilters, url: e.target.value })}
                    className="w-full py-1 pl-2 pr-6 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500"
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
                    className="w-full py-1 px-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500 truncate"
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
                    className="w-full py-1 px-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500"
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
                    className="w-full py-1 px-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500"
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
                    className="w-full py-1 px-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-[11px] font-mono focus:outline-none focus:border-cyan-500"
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
                  <div>Nenhuma requisição encontrada com a combinação atual de filtros.</div>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={resetAllFilters}
                      className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-semibold transition shadow-xs"
                    >
                      Limpar todos os filtros ({activeFiltersCount})
                    </button>
                  )}
                </div>
              ) : (
                sortedEntries.map((entry) => {
                  const isSelected = entry.id === selectedEntryId;
                  const hasSecurity = entry.securityIssues.length > 0;
                  const matchBadges = searchQuery.trim() ? getSearchMatchBadges(entry, searchQuery) : [];

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
                      {/* Status */}
                      <div className="col-span-1">{getStatusBadge(entry.response.status, entry.isError)}</div>

                      {/* Método */}
                      <div className="col-span-1">{getMethodBadge(entry.request.method)}</div>

                      {/* Data e Hora Cronológica */}
                      <div
                        className="col-span-2 truncate text-zinc-600 dark:text-zinc-400 text-[11px] font-mono flex items-center gap-1.5"
                        title={`Início da requisição: ${entry.startedDateTime}`}
                      >
                        <Clock size={11} className="text-zinc-400 shrink-0" />
                        <div className="flex flex-col leading-tight truncate">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                            {formatDateTime(entry.startedDateTime)}
                          </span>
                          {formatDateDay(entry.startedDateTime) && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans">
                              {formatDateDay(entry.startedDateTime)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Caminho / Endpoint */}
                      <div className="col-span-3 truncate text-zinc-800 dark:text-zinc-200 font-sans" title={entry.request.url}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-zinc-900 dark:text-zinc-300 font-medium truncate">
                            {entry.parsedUrl.pathname || '/'}
                          </span>
                          {entry.parsedUrl.search && (
                            <span className="text-zinc-500 font-mono text-[11px] truncate">{entry.parsedUrl.search}</span>
                          )}
                          {/* Deep Search match labels */}
                          {matchBadges.map((badge) => (
                            <span
                              key={badge}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0"
                              title={`Termo pesquisado encontrado em ${badge}`}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Domínio */}
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

                      {/* Tamanho */}
                      <div className="col-span-1 text-right text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {formatBytes(entry.response.content?.size || entry.response.bodySize || 0)}
                      </div>

                      {/* Tempo */}
                      <div className="col-span-1 text-right text-zinc-600 dark:text-zinc-400 text-[11px]">
                        <span className={entry.time > 1000 ? 'text-amber-600 font-bold' : ''}>
                          {Math.round(entry.time)} ms
                        </span>
                      </div>

                      {/* Alertas */}
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
          </div>

          {/* Table Bottom Status Footer */}
          <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-3">
              <span>
                Exibindo <strong>{sortedEntries.length}</strong> de {entries.length} requisições
              </span>
              {selectedDomain && (
                <span className="text-cyan-700 dark:text-cyan-300 font-mono">
                  [Domínio: {selectedDomain}]
                </span>
              )}
              {selectedStatuses.size > 0 && (
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  [Status: {Array.from(selectedStatuses).join(', ')}]
                </span>
              )}
              {selectedMethods.size > 0 && (
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  [Métodos: {Array.from(selectedMethods).join(', ')}]
                </span>
              )}
              {latencyFilter !== 'all' && (
                <span className="text-amber-700 dark:text-amber-400 font-mono">
                  [Latência: {latencyFilter}]
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
