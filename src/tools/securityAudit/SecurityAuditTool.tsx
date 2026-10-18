import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { EnrichedHarEntry } from '../../types/har.ts';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Search,
  ChevronRight,
  Filter,
  CheckCircle2,
  FileCode,
  Copy,
  Check,
  ExternalLink,
  Table,
  LayoutList,
  ArrowRightLeft,
} from 'lucide-react';

export type AuditSeverity = 'Alta' | 'Média' | 'Baixa';

export interface AuditFinding {
  id: string;
  entryId: string;
  entryIndex: number;
  url: string;
  method: string;
  severity: AuditSeverity;
  category: 'JWT Exposto' | 'PII / LGPD' | 'Headers Ausentes' | 'CORS Permissivo' | 'Cookies Inseguros' | 'Transporte HTTP';
  title: string;
  description: string;
  evidence?: string;
  recommendation: string;
  cwe?: string;
}

const JWT_REGEX = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]*/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
const CPF_FORMATTED_REGEX = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;

export const SecurityAuditTool: React.FC<ToolPluginContext> = ({
  entries,
  onSelectEntry,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('Todas');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Comprehensive OWASP heuristic security scanner across entries
  const findings = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const list: AuditFinding[] = [];

    entries.forEach((entry) => {
      const { id, index, request, response, parsedUrl } = entry;
      const urlStr = request.url || '';
      const headersMap = new Map<string, string>();
      (response.headers || []).forEach((h) => {
        if (h.name) headersMap.set(h.name.toLowerCase(), h.value);
      });

      // 1. Transporte HTTP em texto claro
      if (parsedUrl.protocol === 'http:') {
        list.push({
          id: `${id}-cleartext-http`,
          entryId: id,
          entryIndex: index,
          url: urlStr,
          method: request.method,
          severity: 'Alta',
          category: 'Transporte HTTP',
          title: 'Transmissão em Texto Claro (HTTP sem TLS)',
          description: `O tráfego trafega desprotegido para ${parsedUrl.hostname}. Dados de sessão e credenciais podem ser interceptados em redes públicas.`,
          evidence: urlStr,
          recommendation: 'Force HTTPS em todas as comunicações e habilite HSTS.',
          cwe: 'CWE-319: Cleartext Transmission of Sensitive Information',
        });
      }

      // 2. JWT ou Bearer exposto na Query String
      (request.queryString || []).forEach((q) => {
        if (JWT_REGEX.test(q.value) || ['token', 'jwt', 'auth', 'access_token', 'bearer'].includes(q.name.toLowerCase())) {
          list.push({
            id: `${id}-jwt-query-${q.name}`,
            entryId: id,
            entryIndex: index,
            url: urlStr,
            method: request.method,
            severity: 'Alta',
            category: 'JWT Exposto',
            title: `Token de Autenticação Exposto na Query String (${q.name})`,
            description: `O parâmetro "${q.name}" envia credenciais na URL. URLs ficam salvas em logs de servidores proxy, histórico do navegador e cabeçalhos Referer.`,
            evidence: `${q.name}=${q.value.slice(0, 16)}...`,
            recommendation: "Transmita tokens sensíveis via cabeçalho 'Authorization: Bearer <token>' ou no corpo POST cifrado.",
            cwe: 'CWE-598: Use of GET Request Method With Sensitive Query Strings',
          });
        }
      });

      // 3. PII / LGPD em texto claro na URL ou resposta
      const urlMatchesEmail = urlStr.match(EMAIL_REGEX);
      const urlMatchesCpf = urlStr.match(CPF_FORMATTED_REGEX);
      if (urlMatchesEmail || urlMatchesCpf) {
        list.push({
          id: `${id}-pii-url`,
          entryId: id,
          entryIndex: index,
          url: urlStr,
          method: request.method,
          severity: 'Alta',
          category: 'PII / LGPD',
          title: 'Dado Pessoal Sensível (Email / CPF) Vazado na URL',
          description: 'Identificador direto exposto na query string ou path. Infringe princípios da LGPD e OWASP API Security.',
          evidence: urlMatchesEmail ? urlMatchesEmail[0] : urlMatchesCpf?.[0] || 'Dado pessoal em URL',
          recommendation: 'Substitua identificadores diretos por UUIDs opacos ou envie dados pessoais via corpo criptografado.',
          cwe: 'CWE-359: Exposure of Private Personal Information (PII)',
        });
      }

      // Headers de Segurança ausentes em documentos HTML
      const mime = (response.content?.mimeType || '').toLowerCase();
      const isHtml = mime.includes('text/html');

      if (isHtml && !headersMap.has('content-security-policy')) {
        list.push({
          id: `${id}-missing-csp`,
          entryId: id,
          entryIndex: index,
          url: urlStr,
          method: request.method,
          severity: 'Média',
          category: 'Headers Ausentes',
          title: 'Content-Security-Policy (CSP) Ausente',
          description: 'O documento HTML não define uma política CSP para mitigar injeção de scripts (XSS) e carregamento de fontes não autorizadas.',
          recommendation: "Adicione o cabeçalho 'Content-Security-Policy: default-src 'self''.",
          cwe: 'CWE-1021: Improper Restriction of Rendered UI Layers or Scripts',
        });
      }

      // HSTS ausente em HTTPS
      if (parsedUrl.isHttps && !headersMap.has('strict-transport-security')) {
        list.push({
          id: `${id}-missing-hsts`,
          entryId: id,
          entryIndex: index,
          url: urlStr,
          method: request.method,
          severity: 'Média',
          category: 'Headers Ausentes',
          title: 'HSTS (Strict-Transport-Security) Não Configurado',
          description: 'O servidor não instrui o navegador a comunicar-se exclusivamente via HTTPS em visitas futuras.',
          recommendation: "Envie 'Strict-Transport-Security: max-age=31536000; includeSubDomains'.",
          cwe: 'CWE-523: Unprotected Transport-Layer Information Pre-condition',
        });
      }

      // X-Content-Type-Options ausente
      if (!headersMap.has('x-content-type-options')) {
        list.push({
          id: `${id}-missing-nosniff`,
          entryId: id,
          entryIndex: index,
          url: urlStr,
          method: request.method,
          severity: 'Baixa',
          category: 'Headers Ausentes',
          title: 'Header X-Content-Type-Options: nosniff Ausente',
          description: 'A resposta não impede MIME-sniffing pelo navegador, o que pode induzir execução indevida de arquivos estáticos.',
          recommendation: "Configure 'X-Content-Type-Options: nosniff' no servidor web.",
          cwe: 'CWE-79: Cross-site Scripting via MIME Confusion',
        });
      }

      // 4. CORS Permissivo com Autenticação
      const allowOrigin = headersMap.get('access-control-allow-origin');
      const hasAuth = (request.headers || []).some(
        (h) => h.name.toLowerCase() === 'authorization' || h.name.toLowerCase() === 'cookie'
      );
      if (allowOrigin === '*' && hasAuth) {
        list.push({
          id: `${id}-cors-wildcard`,
          entryId: id,
          entryIndex: index,
          url: urlStr,
          method: request.method,
          severity: 'Alta',
          category: 'CORS Permissivo',
          title: 'CORS com Origem Irrestrita (*) em Rota Autenticada',
          description: 'O endpoint retorna "Access-Control-Allow-Origin: *" enquanto processa credenciais ou cookies autenticados.',
          evidence: 'Access-Control-Allow-Origin: *',
          recommendation: 'Restrinja os domínios aceitos na política CORS e recuse o wildcard em rotas privadas.',
          cwe: 'CWE-942: Permissive Cross-Domain Policy with Credentials',
        });
      }

      // 5. Cookies Inseguros (Missing SameSite, Secure, HttpOnly)
      (response.cookies || []).forEach((c) => {
        if (!c.sameSite || c.sameSite.toLowerCase() === 'none') {
          list.push({
            id: `${id}-cookie-${c.name}-samesite`,
            entryId: id,
            entryIndex: index,
            url: urlStr,
            method: request.method,
            severity: 'Média',
            category: 'Cookies Inseguros',
            title: `Cookie "${c.name}" com SameSite Fraco ou Ausente`,
            description: `Cookie sem proteção CSRF adequada. Pode ser enviado em requisições cross-site não intencionais.`,
            evidence: `Cookie: ${c.name}; SameSite=${c.sameSite || 'None'}`,
            recommendation: 'Defina SameSite=Lax ou SameSite=Strict.',
            cwe: 'CWE-1275: Sensitive Cookie with Improper SameSite Attribute',
          });
        }

        if (!c.secure) {
          list.push({
            id: `${id}-cookie-${c.name}-nosecure`,
            entryId: id,
            entryIndex: index,
            url: urlStr,
            method: request.method,
            severity: 'Alta',
            category: 'Cookies Inseguros',
            title: `Cookie "${c.name}" sem Flag "Secure"`,
            description: 'O cookie pode ser transmitido em conexões sem criptografia, suscetível a interceptação em trânsito.',
            evidence: `Set-Cookie: ${c.name}=...`,
            recommendation: 'Adicione o atributo "; Secure" na criação do cookie.',
            cwe: 'CWE-614: Sensitive Cookie in HTTPS Session Without Secure Attribute',
          });
        }
      });
    });

    return list;
  }, [entries]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((item) => {
      if (selectedSeverity !== 'Todas' && item.severity !== selectedSeverity) return false;
      if (selectedCategory !== 'Todas' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesUrl = item.url.toLowerCase().includes(q);
        const matchesEvidence = (item.evidence || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesUrl && !matchesEvidence) return false;
      }
      return true;
    });
  }, [findings, selectedSeverity, selectedCategory, searchQuery]);

  // Counts by severity
  const severityCounts = useMemo(() => {
    return {
      Alta: findings.filter((f) => f.severity === 'Alta').length,
      Média: findings.filter((f) => f.severity === 'Média').length,
      Baixa: findings.filter((f) => f.severity === 'Baixa').length,
      Total: findings.length,
    };
  }, [findings]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityBadge = (severity: AuditSeverity) => {
    const badges = {
      Alta: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      Média: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      Baixa: 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border whitespace-nowrap ${badges[severity]}`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors font-sans">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ShieldAlert className="text-rose-600 dark:text-rose-400" size={22} />
          Auditoria Automatizada de Segurança & Conformidade OWASP
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Varredura heurística para tokens JWT vazados em query strings, PIIs desprotegidos, ausência de headers defensivos e políticas fracas de cookies.
        </p>
      </div>

      {/* Severity Tally Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Total Findings */}
        <div
          onClick={() => setSelectedSeverity('Todas')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-xs ${
            selectedSeverity === 'Todas'
              ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium">
            Total de Ocorrências
          </div>
          <div className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {severityCounts.Total}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Diagnósticos catalogados</div>
        </div>

        {/* Alta Severity */}
        <div
          onClick={() => setSelectedSeverity('Alta')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-xs ${
            selectedSeverity === 'Alta'
              ? 'bg-rose-100 dark:bg-rose-950/70 border-rose-500 ring-1 ring-rose-500'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-900/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-semibold uppercase tracking-wider">
            <span>Severidade Alta</span>
            <AlertTriangle size={15} />
          </div>
          <div className="text-3xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
            {severityCounts.Alta}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">JWTs em URL, CPFs expostos, CORS livre</div>
        </div>

        {/* Média Severity */}
        <div
          onClick={() => setSelectedSeverity('Média')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-xs ${
            selectedSeverity === 'Média'
              ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-500 ring-1 ring-amber-500'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-900/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider">
            <span>Severidade Média</span>
            <Info size={15} />
          </div>
          <div className="text-3xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
            {severityCounts.Média}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Ausência de CSP, HSTS, SameSite fraco</div>
        </div>

        {/* Baixa Severity */}
        <div
          onClick={() => setSelectedSeverity('Baixa')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-xs ${
            selectedSeverity === 'Baixa'
              ? 'bg-sky-100 dark:bg-sky-950/70 border-sky-500 ring-1 ring-sky-500'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-sky-300 dark:hover:border-sky-900/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sky-700 dark:text-sky-400 font-semibold uppercase tracking-wider">
            <span>Severidade Baixa</span>
            <Info size={15} />
          </div>
          <div className="text-3xl font-bold font-mono text-sky-700 dark:text-sky-400 mt-1">
            {severityCounts.Baixa}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">MIME-sniffing, X-Content-Type</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
          <input
            type="text"
            placeholder="Buscar por vulnerabilidade, URL ou evidência..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">Categoria:</span>
          {[
            'Todas',
            'JWT Exposto',
            'PII / LGPD',
            'Headers Ausentes',
            'CORS Permissivo',
            'Cookies Inseguros',
            'Transporte HTTP',
          ].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-xs transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-zinc-800 dark:bg-zinc-700 text-white font-medium shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Findings Area Header with View Switcher */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Relatório de Alertas ({filteredFindings.length} encontrados)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 font-medium">
              <ArrowRightLeft size={11} />
              Barra de rolagem horizontal ativa
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition text-xs ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-zinc-800 text-cyan-700 dark:text-cyan-300 font-medium shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Visualização em Tabela com Rolagem Horizontal"
            >
              <Table size={13} />
              <span>Tabela Forense</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition text-xs ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-zinc-800 text-cyan-700 dark:text-cyan-300 font-medium shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Visualização em Cartões Detalhados"
            >
              <LayoutList size={13} />
              <span>Cartões Detalhados</span>
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Table / DataGrid Container */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/40 shadow-xs">
          {filteredFindings.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhuma inconformidade encontrada para este filtro.
              </p>
              <p className="text-xs text-zinc-400 mt-1">Nenhum alerta reportado nesta categoria.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE MODE: Explicit Horizontal Scroll */
            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full text-left text-xs min-w-[1360px] border-collapse">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 w-28 whitespace-nowrap">Severidade</th>
                    <th className="py-2.5 px-3 w-36 whitespace-nowrap">Categoria</th>
                    <th className="py-2.5 px-3 w-72 whitespace-nowrap">Vulnerabilidade / Título</th>
                    <th className="py-2.5 px-3 w-80 whitespace-nowrap">Método &amp; Endpoint Alvo</th>
                    <th className="py-2.5 px-3 w-72 whitespace-nowrap">Evidência Forense</th>
                    <th className="py-2.5 px-3 w-48 whitespace-nowrap">CWE / Referência</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Recomendação Técnica</th>
                    <th className="py-2.5 px-3 w-28 text-center whitespace-nowrap sticky right-0 bg-zinc-100 dark:bg-zinc-900/95 shadow-xs">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-sans">
                  {filteredFindings.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => onSelectEntry(item.entryId)}
                      className="hover:bg-cyan-50/50 dark:hover:bg-zinc-900/70 transition-colors cursor-pointer group"
                    >
                      {/* Severidade */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        {getSeverityBadge(item.severity)}
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {item.category}
                        </span>
                      </td>

                      {/* Título & Descrição */}
                      <td className="py-3 px-3 align-top max-w-[280px]">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                          {item.description}
                        </div>
                      </td>

                      {/* Endpoint / URL */}
                      <td className="py-3 px-3 align-top max-w-[320px]">
                        <div className="font-mono text-[11px] text-zinc-800 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-1.5">
                          <span className="font-bold text-cyan-700 dark:text-cyan-400 shrink-0">
                            {item.method}
                          </span>
                          <span className="truncate flex-1" title={item.url}>
                            {item.url}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyText(item.url, item.id);
                            }}
                            className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100 text-zinc-400 transition shrink-0"
                            title="Copiar URL"
                          >
                            {copiedId === item.id ? (
                              <Check size={12} className="text-emerald-500" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Evidência */}
                      <td className="py-3 px-3 align-top max-w-[280px]">
                        {item.evidence ? (
                          <div className="text-[11px] font-mono text-amber-800 dark:text-amber-300/90 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-1.5 rounded truncate" title={item.evidence}>
                            {item.evidence}
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400 font-mono">Sem evidência direta</span>
                        )}
                      </td>

                      {/* CWE */}
                      <td className="py-3 px-3 align-top max-w-[190px]">
                        <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 block truncate" title={item.cwe}>
                          {item.cwe || 'OWASP Checklist'}
                        </span>
                      </td>

                      {/* Recomendação */}
                      <td className="py-3 px-3 align-top">
                        <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-1.5 rounded border border-emerald-200 dark:border-emerald-900/40 leading-snug">
                          {item.recommendation}
                        </div>
                      </td>

                      {/* Ação (Inspecionar) */}
                      <td className="py-3 px-3 align-top text-center sticky right-0 bg-white dark:bg-zinc-900/95 shadow-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEntry(item.entryId);
                          }}
                          title="Abrir detalhes forenses completos desta requisição no Inspetor de Requisições"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900 rounded-md border border-cyan-300 dark:border-cyan-800 transition whitespace-nowrap shadow-2xs"
                        >
                          <span>Inspecionar Req #{item.entryIndex + 1}</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* CARDS MODE: Wrapped in horizontal scroll container */
            <div className="overflow-x-auto w-full p-4 space-y-3">
              <div className="min-w-[700px] space-y-3">
                {filteredFindings.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectEntry(item.entryId)}
                    className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer transition space-y-2 group shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(item.severity)}
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {item.category}
                        </span>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                          {item.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform font-medium">
                        <span>Inspecionar Req #{item.entryIndex + 1}</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>

                    <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-900 flex items-center justify-between">
                      <div className="truncate flex-1">
                        <span className="text-cyan-700 dark:text-cyan-400 font-bold mr-2">
                          {item.method}
                        </span>
                        <span>{item.url}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyText(item.url, item.id);
                        }}
                        className="ml-2 p-1 hover:text-zinc-900 dark:hover:text-zinc-100 text-zinc-400 transition"
                        title="Copiar URL"
                      >
                        {copiedId === item.id ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {item.description}
                    </p>

                    {item.evidence && (
                      <div className="text-xs font-mono text-amber-800 dark:text-amber-300/90 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-2 rounded break-all">
                        Evidência: {item.evidence}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
                      <span className="text-zinc-500 font-mono text-[11px]">
                        {item.cwe || 'Auditoria Automatizada'}
                      </span>
                      <div className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">
                        <strong>Recomendação:</strong> {item.recommendation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
