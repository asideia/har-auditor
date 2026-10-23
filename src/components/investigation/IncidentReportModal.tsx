import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileText,
  FileCode,
  ShieldAlert,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { EnrichedHarEntry } from '../../types/har.ts';
import type { InvestigationEntryNote } from '../../store/useInvestigationStore.ts';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string | null;
  pinnedEntries: EnrichedHarEntry[];
  investigationNotes: Record<string, InvestigationEntryNote>;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  onClose,
  fileName,
  pinnedEntries,
  investigationNotes,
}) => {
  const [activeFormat, setActiveFormat] = useState<'markdown' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  // Generate markdown report
  const markdownContent = useMemo(() => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const title = `# Relatório de Investigação de Incidente / Bug Bounty`;
    const metadata = `**Arquivo HAR:** \`${fileName || 'har-capture.har'}\`  \n**Data da Investigação:** ${timestamp}  \n**Total de Requisições Investigadas:** ${pinnedEntries.length} chamadas`;

    // Summary table
    let table = `\n### 1. Resumo das Requisições sob Investigação\n\n`;
    table += `| # | Status | Método | Domínio & Path | Tags | Diagnóstico / Notas |\n`;
    table += `|---|---|---|---|---|---|\n`;

    pinnedEntries.forEach((entry, idx) => {
      const noteData = investigationNotes[entry.id];
      const noteText = noteData?.note?.trim()
        ? noteData.note.replace(/\n/g, ' ')
        : '_Sem anotações_';
      const tagsText = noteData?.tags?.length ? noteData.tags.join(', ') : '_Nenhuma_';
      const urlObj = new URL(entry.request.url);
      const shortPath = urlObj.pathname.length > 30 ? urlObj.pathname.substring(0, 30) + '...' : urlObj.pathname;
      table += `| ${idx + 1} | \`${entry.response.status} ${entry.response.statusText}\` | \`${entry.request.method}\` | \`${urlObj.host}${shortPath}\` | ${tagsText} | ${noteText} |\n`;
    });

    // Detailed breakdown per request
    let details = `\n### 2. Detalhamento Forense por Chamada\n\n`;

    pinnedEntries.forEach((entry, idx) => {
      const noteData = investigationNotes[entry.id];
      const tagsText = noteData?.tags?.length ? noteData.tags.map(t => `\`[${t}]\``).join(' ') : '`[Não categorizado]`';
      
      // cURL reproduction command
      let curlCmd = `curl -X ${entry.request.method} '${entry.request.url}'`;
      const relevantHeaders = entry.request.headers.filter(
        h => !h.name.startsWith(':') && !['content-length', 'host'].includes(h.name.toLowerCase())
      );
      relevantHeaders.slice(0, 8).forEach(h => {
        curlCmd += ` \\\n  -H '${h.name}: ${h.value.replace(/'/g, "'\\''")}'`;
      });
      if (entry.request.postData?.text) {
        curlCmd += ` \\\n  --data-raw '${entry.request.postData.text.replace(/'/g, "'\\''")}'`;
      }

      details += `#### Requisição #${idx + 1}: ${entry.request.method} ${entry.request.url}\n\n`;
      details += `- **Tags:** ${tagsText}\n`;
      details += `- **Status HTTP:** \`${entry.response.status} ${entry.response.statusText}\`\n`;
      details += `- **Tempo Total:** \`${Math.round(entry.time)}ms\` (DNS: \`${Math.round(entry.timings.dns || 0)}ms\`, Espera/TTFB: \`${Math.round(entry.timings.wait || 0)}ms\`)\n`;
      details += `- **Tamanho:** \`${entry.response.content.size} bytes\` (MIME: \`${entry.response.content.mimeType || 'unknown'}\`)\n`;
      if (entry.serverIPAddress) {
        details += `- **IP do Servidor:** \`${entry.serverIPAddress}\`\n`;
      }
      if (noteData?.note?.trim()) {
        details += `- **Anotações de Diagnóstico:**\n  > ${noteData.note.replace(/\n/g, '\n  > ')}\n`;
      } else {
        details += `- **Anotações de Diagnóstico:** _Nenhum diagnóstico registrado._\n`;
      }
      details += `\n**Comando de Reprodução (cURL):**\n\`\`\`bash\n${curlCmd}\n\`\`\`\n\n---\n\n`;
    });

    const footer = `\n_Relatório gerado automaticamente via HAR Auditor Forensic Console._\n`;

    return `${title}\n\n${metadata}\n\n${table}\n${details}${footer}`;
  }, [fileName, pinnedEntries, investigationNotes]);

  // Generate structured JSON report
  const jsonContent = useMemo(() => {
    const report = {
      reportType: 'incident-investigation-report',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      harFileName: fileName || 'unknown.har',
      summary: {
        totalInvestigatedRequests: pinnedEntries.length,
        statusBreakdown: pinnedEntries.reduce((acc, curr) => {
          const s = curr.response.status;
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {} as Record<number, number>),
        tagsBreakdown: pinnedEntries.reduce((acc, curr) => {
          const noteData = investigationNotes[curr.id];
          noteData?.tags?.forEach(tag => {
            acc[tag] = (acc[tag] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>),
      },
      investigatedEntries: pinnedEntries.map(entry => {
        const noteData = investigationNotes[entry.id];
        return {
          id: entry.id,
          timestamp: entry.startedDateTime,
          totalTimeMs: entry.time,
          request: {
            method: entry.request.method,
            url: entry.request.url,
            headersCount: entry.request.headers.length,
            postDataSnippet: entry.request.postData?.text?.substring(0, 500),
          },
          response: {
            status: entry.response.status,
            statusText: entry.response.statusText,
            mimeType: entry.response.content.mimeType,
            contentSize: entry.response.content.size,
          },
          serverIP: entry.serverIPAddress,
          investigation: {
            tags: noteData?.tags || [],
            diagnosticNotes: noteData?.note || '',
            updatedAt: noteData?.updatedAt,
          },
        };
      }),
    };
    return JSON.stringify(report, null, 2);
  }, [fileName, pinnedEntries, investigationNotes]);

  if (!isOpen) return null;

  const currentContent = activeFormat === 'markdown' ? markdownContent : jsonContent;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const ext = activeFormat === 'markdown' ? 'md' : 'json';
    const mime = activeFormat === 'markdown' ? 'text/markdown' : 'application/json';
    const blob = new Blob([currentContent], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedFileName = (fileName || 'investigation').replace(/\.[^/.]+$/, '');
    link.download = `relatorio-incidente-${sanitizedFileName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Exportar Relatório de Incidente
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {pinnedEntries.length} {pinnedEntries.length === 1 ? 'requisição' : 'requisições'}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Resumo formatado com diagnóstico e notas para Jira, GitHub, Slack ou relatórios de segurança
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Fechar (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Format Selector + Action Buttons */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-zinc-200/80 dark:bg-zinc-800/80 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveFormat('markdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeFormat === 'markdown'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <FileText size={14} />
              <span>Markdown (Jira / GitHub)</span>
            </button>
            <button
              onClick={() => setActiveFormat('json')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeFormat === 'json'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <FileCode size={14} />
              <span>JSON Estruturado</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                copied
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200'
              }`}
              title="Copiar relatório para área de transferência"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado!' : 'Copiar Relatório'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition"
              title="Baixar arquivo de relatório"
            >
              <Download size={14} />
              <span>Baixar .{activeFormat === 'markdown' ? 'md' : 'json'}</span>
            </button>
          </div>
        </div>

        {/* Content Preview Body */}
        <div className="flex-1 p-5 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed selection:bg-cyan-500/30">
          <pre className="whitespace-pre-wrap break-all font-mono">
            {currentContent}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5 font-sans">
            <Sparkles size={13} className="text-amber-500" />
            Contém comandos cURL e anotações para rápida triagem técnica
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-sans font-medium transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
