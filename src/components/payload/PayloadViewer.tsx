import React, { useState, useMemo } from 'react';
import {
  FolderTree,
  FileCode,
  FileText,
  Search,
  X,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  WrapText,
  ChevronsUpDown,
} from 'lucide-react';
import { JsonTreeView } from './JsonTreeView.tsx';

interface PayloadViewerProps {
  content?: string;
  mimeType?: string;
  encoding?: string;
  title: string;
}

export const PayloadViewer: React.FC<PayloadViewerProps> = ({
  content,
  mimeType = 'application/json',
  encoding,
  title,
}) => {
  const [copied, setCopied] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');
  const [wordWrap, setWordWrap] = useState(true);
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);

  // Auto Base64 text decode if specified
  const decodedContent = useMemo(() => {
    if (!content) return '';
    if (encoding === 'base64') {
      try {
        return atob(content);
      } catch {
        return content;
      }
    }
    return content;
  }, [content, encoding]);

  // Attempt JSON parsing
  const { isJson, parsedJson, formattedJson } = useMemo(() => {
    if (!decodedContent.trim()) {
      return { isJson: false, parsedJson: null, formattedJson: '' };
    }
    try {
      const parsed = JSON.parse(decodedContent);
      return {
        isJson: true,
        parsedJson: parsed,
        formattedJson: JSON.stringify(parsed, null, 2),
      };
    } catch {
      return { isJson: false, parsedJson: null, formattedJson: decodedContent };
    }
  }, [decodedContent]);

  // Visual mode state (default to 'tree' if valid JSON, otherwise 'pretty' or 'raw')
  const [viewMode, setViewMode] = useState<'tree' | 'pretty' | 'raw'>(isJson ? 'tree' : 'pretty');

  // Search occurrence count
  const searchMatchCount = useMemo(() => {
    if (!internalSearch.trim() || !decodedContent) return 0;
    try {
      const regex = new RegExp(internalSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = decodedContent.match(regex);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }, [internalSearch, decodedContent]);

  const handleCopy = () => {
    const textToCopy = viewMode === 'pretty' && isJson ? formattedJson : decodedContent;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!content) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
        <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
          {title} ({mimeType})
        </div>
        <div className="p-6 text-center text-zinc-400 dark:text-zinc-500 font-sans text-xs">
          Corpo da mensagem vazio ou não capturado no arquivo HAR.
        </div>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/40 overflow-hidden flex flex-col">
      {/* Top Controls Bar */}
      <div className="px-3 py-2 bg-zinc-100/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        {/* Title & Mode Switcher */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
            {title}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
            ({mimeType})
          </span>

          {/* Mode Tabs */}
          <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-md text-[11px]">
            {isJson && (
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                  viewMode === 'tree'
                    ? 'bg-white dark:bg-zinc-700 text-cyan-700 dark:text-cyan-300 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
                title="Visualizador em Árvore Interativa com nós recolhíveis"
              >
                <FolderTree size={12} />
                <span>Árvore</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('pretty')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                viewMode === 'pretty'
                  ? 'bg-white dark:bg-zinc-700 text-cyan-700 dark:text-cyan-300 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Visualizador Formatado com Indentação (Pretty Print)"
            >
              <FileCode size={12} />
              <span>Formatado</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                viewMode === 'raw'
                  ? 'bg-white dark:bg-zinc-700 text-cyan-700 dark:text-cyan-300 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Texto Bruto sem formatação adicional"
            >
              <FileText size={12} />
              <span>Bruto</span>
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-1.5 flex-1 max-w-sm justify-end">
          {/* Internal Search */}
          <div className="relative flex-1 min-w-[120px] max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={11} />
            <input
              type="text"
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              placeholder="Buscar no conteúdo..."
              className="w-full pl-6 pr-6 py-0.5 text-[11px] rounded bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-cyan-500"
            />
            {internalSearch && (
              <button
                type="button"
                onClick={() => setInternalSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {internalSearch && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">
              {searchMatchCount} {searchMatchCount === 1 ? 'resultado' : 'resultados'}
            </span>
          )}

          {/* Tree View Controls */}
          {viewMode === 'tree' && isJson && (
            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-1.5">
              <button
                type="button"
                onClick={() => setExpandSignal((s) => s + 1)}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded text-[10px] transition"
                title="Expandir todos os nós da árvore"
              >
                <Maximize2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => setCollapseSignal((s) => s + 1)}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded text-[10px] transition"
                title="Recolher todos os nós da árvore"
              >
                <Minimize2 size={12} />
              </button>
            </div>
          )}

          {/* Word Wrap Toggle for Pretty/Raw */}
          {viewMode !== 'tree' && (
            <button
              type="button"
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1 rounded text-[10px] transition ${
                wordWrap
                  ? 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title={wordWrap ? 'Quebra de linha ativa' : 'Quebra de linha desativada'}
            >
              <WrapText size={12} />
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-200/70 dark:bg-zinc-800 hover:bg-zinc-300/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded text-[11px] font-medium transition"
            title="Copiar conteúdo"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">Copiado</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span className="text-[10px]">Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-3 text-xs overflow-auto max-h-[480px]">
        {viewMode === 'tree' && isJson ? (
          <div className="space-y-1">
            <JsonTreeView
              data={parsedJson}
              searchQuery={internalSearch}
              expandAllSignal={expandSignal}
              collapseAllSignal={collapseSignal}
              rootPath="root"
            />
          </div>
        ) : (
          <pre
            className={`font-mono text-xs text-zinc-800 dark:text-zinc-200 ${
              wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
            }`}
          >
            {viewMode === 'pretty' && isJson ? formattedJson : decodedContent}
          </pre>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1 bg-zinc-100/60 dark:bg-zinc-900/60 border-t border-zinc-200/60 dark:border-zinc-800/60 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center justify-between">
        <span>
          Tamanho: {new Blob([decodedContent]).size} bytes
          {encoding ? ` · Codificação: ${encoding}` : ''}
        </span>
        {isJson && (
          <span className="text-cyan-600 dark:text-cyan-400 font-sans font-medium">
            JSON Estruturado Válido
          </span>
        )}
      </div>
    </div>
  );
};
