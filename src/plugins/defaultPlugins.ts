import React from 'react';
import { toolRegistry } from './ToolRegistry.ts';
import type { ToolPlugin } from '../types/plugin.ts';
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Clock,
  Globe,
  GitCompare,
  Code2,
  Zap,
} from 'lucide-react';

import { RequestsInspector } from './modules/RequestsInspector.tsx';
import { SanitizerTool } from '../tools/sanitizer/SanitizerTool.tsx';
import { SecurityAuditTool } from '../tools/securityAudit/SecurityAuditTool.tsx';
import { JwtDecoderTool } from '../tools/jwtDecoder/JwtDecoderTool.tsx';
import { AnomaliesTool } from '../tools/anomalies/AnomaliesTool.tsx';
import { HarDiffTool } from '../tools/diff/HarDiffTool.tsx';
import { MockExporterTool } from '../tools/mockExporter/MockExporterTool.tsx';
import { WaterfallTimings } from './modules/WaterfallTimings.tsx';
import { DomainTelemetry } from './modules/DomainTelemetry.tsx';

export function initializeDefaultPlugins(): void {
  // 1. Requests Inspector (Network)
  const requestsPlugin: ToolPlugin = {
    id: 'requests-inspector',
    name: 'Inspeção de Requisições',
    shortName: 'Requisições',
    description: 'Tabela interativa de tráfego com análise de cabeçalhos, payloads e status.',
    category: 'network',
    icon: Activity,
    getAlertCount: (metrics, entries) => {
      return entries.filter((e) => e.isError).length;
    },
    badgeVariant: 'warning',
    render: (context) => React.createElement(RequestsInspector, context),
  };

  // 2. Sanitizador & Privacidade (LGPD)
  const sanitizerPlugin: ToolPlugin = {
    id: 'sanitizer-privacy',
    name: 'Sanitizador & Privacidade (LGPD)',
    shortName: 'Sanitizador LGPD',
    description: 'Limpeza de headers de autenticação, cookies, tokens e dados pessoais para compartilhamento seguro.',
    category: 'privacy',
    icon: ShieldCheck,
    getAlertCount: (metrics, entries) => {
      let sensitiveCount = 0;
      entries.forEach((e) => {
        const hasAuth = e.request.headers.some((h) =>
          ['authorization', 'cookie', 'x-api-key'].includes(h.name.toLowerCase())
        );
        if (hasAuth) sensitiveCount++;
      });
      return sensitiveCount > 0 ? sensitiveCount : 0;
    },
    badgeVariant: 'info',
    render: (context) => React.createElement(SanitizerTool, context),
  };

  // 3. Auditoria de Segurança
  const securityAuditPlugin: ToolPlugin = {
    id: 'security-audit',
    name: 'Auditoria de Segurança',
    shortName: 'Auditoria OWASP',
    description: 'Varredura de JWTs expostos em URLs, PIIs (emails, CPFs) em texto claro e ausência de headers de proteção.',
    category: 'security',
    icon: ShieldAlert,
    getAlertCount: (metrics) => {
      return metrics.securitySummary.critical + metrics.securitySummary.high;
    },
    badgeVariant: 'danger',
    render: (context) => React.createElement(SecurityAuditTool, context),
  };

  // 4. JWT Decoder
  const jwtDecoderPlugin: ToolPlugin = {
    id: 'jwt-decoder',
    name: 'JWT Decoder',
    shortName: 'JWT Decoder',
    description: 'Leitor e decodificador automático de tokens Bearer/JWT encontrados na requisição, com validação de expiração.',
    category: 'auth',
    icon: KeyRound,
    getAlertCount: (metrics, entries) => {
      let jwtCount = 0;
      entries.forEach((e) => {
        const hasBearer = e.request.headers.some(
          (h) => h.name.toLowerCase() === 'authorization' && h.value.startsWith('Bearer ey')
        );
        const hasJwtQuery = e.request.queryString.some(
          (q) => q.value.startsWith('ey') && q.value.includes('.')
        );
        if (hasBearer || hasJwtQuery) jwtCount++;
      });
      return jwtCount;
    },
    badgeVariant: 'warning',
    render: (context) => React.createElement(JwtDecoderTool, context),
  };

  // 5. Anomalias de Rede (N+1 & Race Condition)
  const anomaliesPlugin: ToolPlugin = {
    id: 'anomalies',
    name: 'Anomalias de Rede (Falhas, N+1 & Race)',
    shortName: 'Anomalias & Falhas',
    description: 'Detecção de falhas de comunicação (Status 0), chamadas idênticas em janela de 500ms e inversão assíncrona de respostas.',
    category: 'performance',
    icon: Zap,
    getAlertCount: (metrics, entries) => {
      let duplicateCount = 0;
      let commFailures = 0;
      const seen = new Map<string, number>();
      entries.forEach((e) => {
        const key = `${e.request.method} ${e.request.url}`;
        const prev = seen.get(key) || 0;
        seen.set(key, prev + 1);
        if (prev === 1) duplicateCount++;

        // Status 0 / Failed communication
        if (e.response.status === 0 || !e.response.status || e.statusCategory === 'failed') {
          commFailures++;
        }
      });
      return duplicateCount + commFailures;
    },
    badgeVariant: 'danger',
    render: (context) => React.createElement(AnomaliesTool, context),
  };

  // 6. HAR Diff (Comparador)
  const harDiffPlugin: ToolPlugin = {
    id: 'har-diff',
    name: 'HAR Diff (Comparador)',
    shortName: 'HAR Diff',
    description: 'Comparação de estatísticas, requisições faltantes e regressões entre dois arquivos HAR.',
    category: 'performance',
    icon: GitCompare,
    badgeVariant: 'info',
    render: (context) => React.createElement(HarDiffTool, context),
  };

  // 7. Exportador de Mocks
  const mockExporterPlugin: ToolPlugin = {
    id: 'mock-exporter',
    name: 'Exportador de Mocks',
    shortName: 'Gerador de Mocks',
    description: 'Geração de mocks prontos para MSW, Cypress, Playwright e Postman Collection v2.1.',
    category: 'network',
    icon: Code2,
    badgeVariant: 'neutral',
    render: (context) => React.createElement(MockExporterTool, context),
  };

  // 8. Waterfall & Timings
  const waterfallPlugin: ToolPlugin = {
    id: 'waterfall-timings',
    name: 'Linha do Tempo (Waterfall)',
    shortName: 'Waterfall',
    description: 'Análise de performance, TTFB, resolução DNS e tempo de resposta.',
    category: 'performance',
    icon: Clock,
    getAlertCount: (metrics, entries) => {
      return entries.filter((e) => e.time > 1500).length;
    },
    badgeVariant: 'neutral',
    render: (context) => React.createElement(WaterfallTimings, context),
  };

  // 9. Domains & 3rd-Party Telemetry
  const domainsPlugin: ToolPlugin = {
    id: 'domain-telemetry',
    name: 'Domínios & 3rd-Party',
    shortName: 'Domínios',
    description: 'Mapeamento de 1st party vs 3rd party, rastreadores e CDNs.',
    category: 'privacy',
    icon: Globe,
    getAlertCount: (metrics) => {
      return metrics.thirdPartyCount > 0 ? metrics.thirdPartyCount : 0;
    },
    badgeVariant: 'info',
    render: (context) => React.createElement(DomainTelemetry, context),
  };

  toolRegistry.register(requestsPlugin);
  toolRegistry.register(sanitizerPlugin);
  toolRegistry.register(securityAuditPlugin);
  toolRegistry.register(jwtDecoderPlugin);
  toolRegistry.register(anomaliesPlugin);
  toolRegistry.register(harDiffPlugin);
  toolRegistry.register(mockExporterPlugin);
  toolRegistry.register(waterfallPlugin);
  toolRegistry.register(domainsPlugin);
}
