import type { EnrichedHarEntry } from '../../types/har.ts';

export interface HeaderDiffItem {
  name: string;
  valueA: string | null;
  valueB: string | null;
  status: 'identical' | 'modified' | 'only_a' | 'only_b';
  isCsrf: boolean;
  isAuth: boolean;
  isCookie: boolean;
}

export interface CookieDiffItem {
  name: string;
  valueA: string | null;
  valueB: string | null;
  status: 'identical' | 'modified' | 'only_a' | 'only_b';
  isSessionOrToken: boolean;
}

export interface JsonDiffResult {
  isBothJson: boolean;
  keysOnlyInA: string[];
  keysOnlyInB: string[];
  keysModified: Array<{ key: string; valA: any; valB: any }>;
  formattedA: string;
  formattedB: string;
}

export interface QueryParamDiffItem {
  name: string;
  valueA: string | null;
  valueB: string | null;
  status: 'identical' | 'modified' | 'only_a' | 'only_b';
}

const CSRF_HEADER_PATTERNS = [
  'x-csrf-token',
  'x-xsrf-token',
  'csrf-token',
  'xsrf-token',
  'x-csrf',
  '_csrf',
  'x-authenticity-token',
];

const AUTH_HEADER_PATTERNS = [
  'authorization',
  'x-api-key',
  'apikey',
  'x-auth-token',
  'token',
];

export function parseCookieString(cookieStr?: string): Record<string, string> {
  if (!cookieStr) return {};
  const result: Record<string, string> = {};
  cookieStr.split(';').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.substring(0, eqIdx).trim();
      const v = trimmed.substring(eqIdx + 1).trim();
      result[k] = v;
    } else {
      result[trimmed] = '';
    }
  });
  return result;
}

export function diffHeaders(
  headersA: Array<{ name: string; value: string }> = [],
  headersB: Array<{ name: string; value: string }> = []
): HeaderDiffItem[] {
  const mapA = new Map<string, string>();
  const mapB = new Map<string, string>();
  const displayNames = new Map<string, string>();

  headersA.forEach((h) => {
    const lower = h.name.toLowerCase();
    mapA.set(lower, h.value);
    displayNames.set(lower, h.name);
  });

  headersB.forEach((h) => {
    const lower = h.name.toLowerCase();
    mapB.set(lower, h.value);
    if (!displayNames.has(lower)) {
      displayNames.set(lower, h.name);
    }
  });

  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

  return allKeys.map((key) => {
    const valA = mapA.get(key) ?? null;
    const valB = mapB.get(key) ?? null;
    const name = displayNames.get(key) || key;

    let status: HeaderDiffItem['status'] = 'identical';
    if (valA !== null && valB === null) {
      status = 'only_a';
    } else if (valA === null && valB !== null) {
      status = 'only_b';
    } else if (valA !== valB) {
      status = 'modified';
    }

    const isCsrf = CSRF_HEADER_PATTERNS.includes(key);
    const isAuth = AUTH_HEADER_PATTERNS.includes(key);
    const isCookie = key === 'cookie' || key === 'set-cookie';

    return {
      name,
      valueA: valA,
      valueB: valB,
      status,
      isCsrf,
      isAuth,
      isCookie,
    };
  });
}

export function diffCookies(
  headersA: Array<{ name: string; value: string }> = [],
  headersB: Array<{ name: string; value: string }> = []
): CookieDiffItem[] {
  const cookieHeaderA = headersA.find((h) => h.name.toLowerCase() === 'cookie')?.value || '';
  const cookieHeaderB = headersB.find((h) => h.name.toLowerCase() === 'cookie')?.value || '';

  const parsedA = parseCookieString(cookieHeaderA);
  const parsedB = parseCookieString(cookieHeaderB);

  const allCookieNames = Array.from(new Set([...Object.keys(parsedA), ...Object.keys(parsedB)])).sort();

  return allCookieNames.map((name) => {
    const valA = parsedA[name] !== undefined ? parsedA[name] : null;
    const valB = parsedB[name] !== undefined ? parsedB[name] : null;

    let status: CookieDiffItem['status'] = 'identical';
    if (valA !== null && valB === null) {
      status = 'only_a';
    } else if (valA === null && valB !== null) {
      status = 'only_b';
    } else if (valA !== valB) {
      status = 'modified';
    }

    const lower = name.toLowerCase();
    const isSessionOrToken =
      lower.includes('sess') ||
      lower.includes('token') ||
      lower.includes('auth') ||
      lower.includes('jwt') ||
      lower.includes('csrf') ||
      lower.includes('xsrf') ||
      lower.includes('id');

    return {
      name,
      valueA: valA,
      valueB: valB,
      status,
      isSessionOrToken,
    };
  });
}

export function diffQueryParams(
  queryA: Array<{ name: string; value: string }> = [],
  queryB: Array<{ name: string; value: string }> = []
): QueryParamDiffItem[] {
  const mapA = new Map<string, string>();
  const mapB = new Map<string, string>();

  queryA.forEach((q) => mapA.set(q.name, q.value));
  queryB.forEach((q) => mapB.set(q.name, q.value));

  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

  return allKeys.map((name) => {
    const valA = mapA.get(name) ?? null;
    const valB = mapB.get(name) ?? null;

    let status: QueryParamDiffItem['status'] = 'identical';
    if (valA !== null && valB === null) {
      status = 'only_a';
    } else if (valA === null && valB !== null) {
      status = 'only_b';
    } else if (valA !== valB) {
      status = 'modified';
    }

    return {
      name,
      valueA: valA,
      valueB: valB,
      status,
    };
  });
}

export function diffJsonPayloads(textA?: string, textB?: string): JsonDiffResult {
  let parsedA: any = null;
  let parsedB: any = null;
  let isAJson = false;
  let isBJson = false;

  if (textA?.trim()) {
    try {
      parsedA = JSON.parse(textA);
      isAJson = true;
    } catch {
      // not JSON
    }
  }

  if (textB?.trim()) {
    try {
      parsedB = JSON.parse(textB);
      isBJson = true;
    } catch {
      // not JSON
    }
  }

  const formattedA = isAJson ? JSON.stringify(parsedA, null, 2) : (textA || '');
  const formattedB = isBJson ? JSON.stringify(parsedB, null, 2) : (textB || '');

  if (!isAJson || !isBJson || typeof parsedA !== 'object' || typeof parsedB !== 'object' || parsedA === null || parsedB === null) {
    return {
      isBothJson: false,
      keysOnlyInA: [],
      keysOnlyInB: [],
      keysModified: [],
      formattedA,
      formattedB,
    };
  }

  const keysA = Object.keys(parsedA);
  const keysB = Object.keys(parsedB);

  const keysOnlyInA = keysA.filter((k) => !(k in parsedB));
  const keysOnlyInB = keysB.filter((k) => !(k in parsedA));
  const commonKeys = keysA.filter((k) => k in parsedB);

  const keysModified: Array<{ key: string; valA: any; valB: any }> = [];
  commonKeys.forEach((k) => {
    const vA = JSON.stringify(parsedA[k]);
    const vB = JSON.stringify(parsedB[k]);
    if (vA !== vB) {
      keysModified.push({
        key: k,
        valA: parsedA[k],
        valB: parsedB[k],
      });
    }
  });

  return {
    isBothJson: true,
    keysOnlyInA,
    keysOnlyInB,
    keysModified,
    formattedA,
    formattedB,
  };
}

export function generateComparisonMarkdown(
  entryA: EnrichedHarEntry,
  entryB: EnrichedHarEntry
): string {
  const headerDiff = diffHeaders(entryA.request.headers, entryB.request.headers);
  const cookieDiff = diffCookies(entryA.request.headers, entryB.request.headers);
  const timeDiff = entryB.time - entryA.time;
  const timeDiffStr = timeDiff >= 0 ? `+${Math.round(timeDiff)}ms mais lenta` : `${Math.round(timeDiff)}ms mais rápida`;

  const csrfDiff = headerDiff.find((h) => h.isCsrf && h.status !== 'identical');

  let md = `# Relatório de Comparação de Requisições (Side-by-Side)\n\n`;
  md += `**Gerado em:** ${new Date().toLocaleString()}\n\n`;

  md += `## 1. Visão Geral Comparativa\n\n`;
  md += `| Métrica | Requisição A (Base) | Requisição B (Comparada) | Diferença |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **Status** | \`${entryA.response.status} ${entryA.response.statusText}\` | \`${entryB.response.status} ${entryB.response.statusText}\` | ${entryA.response.status !== entryB.response.status ? '⚠️ Status Diferente' : 'Idêntico'} |\n`;
  md += `| **Método** | \`${entryA.request.method}\` | \`${entryB.request.method}\` | ${entryA.request.method !== entryB.request.method ? 'Modificado' : 'Idêntico'} |\n`;
  md += `| **Endpoint** | \`${entryA.parsedUrl.pathname}\` | \`${entryB.parsedUrl.pathname}\` | ${entryA.parsedUrl.pathname !== entryB.parsedUrl.pathname ? 'URLs Diferentes' : 'Mesmo Endpoint'} |\n`;
  md += `| **Tempo Total** | \`${Math.round(entryA.time)}ms\` | \`${Math.round(entryB.time)}ms\` | **${timeDiffStr}** |\n`;
  md += `| **Tamanho Resposta** | \`${entryA.response.content.size} B\` | \`${entryB.response.content.size} B\` | \`${entryB.response.content.size - entryA.response.content.size} B\` |\n\n`;

  if (csrfDiff) {
    md += `> ⚠️ **ALERTA CRÍTICO DE SEGURANÇA/CSRF**: Detectada discrepância no cabeçalho CSRF (\`${csrfDiff.name}\`).\n`;
    md += `> - Req A: \`${csrfDiff.valueA || '(Ausente)'}\`\n`;
    md += `> - Req B: \`${csrfDiff.valueB || '(Ausente)'}\`\n\n`;
  }

  // Header diff table
  const changedHeaders = headerDiff.filter((h) => h.status !== 'identical');
  md += `## 2. Diferenças de Cabeçalhos Enviados (${changedHeaders.length} discrepâncias)\n\n`;
  if (changedHeaders.length === 0) {
    md += `*Nenhuma diferença encontrada nos cabeçalhos enviados.*\n\n`;
  } else {
    md += `| Cabeçalho | Requisição A | Requisição B | Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    changedHeaders.forEach((h) => {
      const vA = h.valueA ? `\`${h.valueA.length > 50 ? h.valueA.slice(0, 50) + '...' : h.valueA}\`` : '*(Ausente)*';
      const vB = h.valueB ? `\`${h.valueB.length > 50 ? h.valueB.slice(0, 50) + '...' : h.valueB}\`` : '*(Ausente)*';
      md += `| \`${h.name}\` | ${vA} | ${vB} | **${h.status.toUpperCase()}** |\n`;
    });
    md += `\n`;
  }

  // Cookie diff table
  const changedCookies = cookieDiff.filter((c) => c.status !== 'identical');
  if (changedCookies.length > 0) {
    md += `## 3. Diferenças nos Cookies Enviados (${changedCookies.length} discrepâncias)\n\n`;
    md += `| Cookie | Requisição A | Requisição B | Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    changedCookies.forEach((c) => {
      const vA = c.valueA ? `\`${c.valueA.length > 30 ? c.valueA.slice(0, 30) + '...' : c.valueA}\`` : '*(Ausente)*';
      const vB = c.valueB ? `\`${c.valueB.length > 30 ? c.valueB.slice(0, 30) + '...' : c.valueB}\`` : '*(Ausente)*';
      md += `| \`${c.name}\` | ${vA} | ${vB} | **${c.status.toUpperCase()}** |\n`;
    });
    md += `\n`;
  }

  // Latency breakdown
  md += `## 4. Decomposição de Latência e Gargalo\n\n`;
  md += `| Fase HTTP | Req A (ms) | Req B (ms) | Delta (ms) |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  const phases = [
    { label: 'DNS Lookup', a: entryA.timings?.dns, b: entryB.timings?.dns },
    { label: 'TCP Connect', a: entryA.timings?.connect, b: entryB.timings?.connect },
    { label: 'SSL Handshake', a: entryA.timings?.ssl, b: entryB.timings?.ssl },
    { label: 'Wait (TTFB / Servidor)', a: entryA.timings?.wait, b: entryB.timings?.wait },
    { label: 'Download Conteúdo', a: entryA.timings?.receive, b: entryB.timings?.receive },
  ];
  phases.forEach((p) => {
    const valA = Math.max(0, Math.round(p.a ?? 0));
    const valB = Math.max(0, Math.round(p.b ?? 0));
    const delta = valB - valA;
    const deltaStr = delta >= 0 ? `+${delta}ms` : `${delta}ms`;
    md += `| ${p.label} | ${valA}ms | ${valB}ms | ${deltaStr} |\n`;
  });
  md += `\n---\n*Relatório exportado via har-auditor*`;

  return md;
}
