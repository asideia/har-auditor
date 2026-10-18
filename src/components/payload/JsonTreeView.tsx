import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Copy, Check, Hash, Code2 } from 'lucide-react';

interface JsonTreeViewProps {
  data: unknown;
  searchQuery?: string;
  expandAllSignal?: number;
  collapseAllSignal?: number;
  rootPath?: string;
}

interface TreeNodeProps {
  keyName: string;
  value: unknown;
  path: string;
  searchQuery: string;
  defaultExpanded?: boolean;
  expandAllSignal?: number;
  collapseAllSignal?: number;
  depth: number;
}

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-amber-300 dark:bg-amber-500/40 text-zinc-950 dark:text-amber-200 px-0.5 rounded font-bold">
        {match}
      </mark>
      <HighlightMatch text={after} query={query} />
    </>
  );
};

export const JsonTreeNode: React.FC<TreeNodeProps> = ({
  keyName,
  value,
  path,
  searchQuery,
  defaultExpanded = true,
  expandAllSignal,
  collapseAllSignal,
  depth,
}) => {
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded && depth < 3);
  const [copiedAction, setCopiedAction] = useState<'val' | 'key' | 'path' | null>(null);

  // Auto-expand if search query matches key or children
  useEffect(() => {
    if (searchQuery.trim() && isObject) {
      const serialized = JSON.stringify(value);
      if (
        keyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (serialized && serialized.toLowerCase().includes(searchQuery.toLowerCase()))
      ) {
        setIsExpanded(true);
      }
    }
  }, [searchQuery, isObject, keyName, value]);

  // Synchronize global expand/collapse signals
  useEffect(() => {
    if (expandAllSignal && expandAllSignal > 0) {
      setIsExpanded(true);
    }
  }, [expandAllSignal]);

  useEffect(() => {
    if (collapseAllSignal && collapseAllSignal > 0) {
      setIsExpanded(false);
    }
  }, [collapseAllSignal]);

  const handleCopy = (text: string, action: 'val' | 'key' | 'path', e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedAction(action);
    setTimeout(() => setCopiedAction(null), 1500);
  };

  const formattedValueForCopy = useMemo(() => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  if (!isObject) {
    let valueDisplay: React.ReactNode = null;
    let typeClass = 'text-zinc-700 dark:text-zinc-300';

    if (value === null) {
      valueDisplay = <span className="text-rose-600 dark:text-rose-400 font-semibold italic">null</span>;
    } else if (typeof value === 'boolean') {
      valueDisplay = (
        <span className="text-purple-600 dark:text-purple-400 font-semibold font-mono">
          {value ? 'true' : 'false'}
        </span>
      );
    } else if (typeof value === 'number') {
      valueDisplay = (
        <span className="text-amber-600 dark:text-amber-400 font-mono font-medium">
          <HighlightMatch text={String(value)} query={searchQuery} />
        </span>
      );
    } else if (typeof value === 'string') {
      typeClass = 'text-emerald-700 dark:text-emerald-300 font-mono break-all';
      valueDisplay = (
        <span className={typeClass}>
          &quot;
          <HighlightMatch text={value} query={searchQuery} />
          &quot;
        </span>
      );
    } else {
      valueDisplay = <span>{String(value)}</span>;
    }

    return (
      <div
        className="group relative flex items-start py-0.5 px-1 rounded hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 text-[12px] font-mono transition-colors"
        style={{ paddingLeft: `${Math.max(depth * 16, 6)}px` }}
      >
        <span className="text-sky-700 dark:text-sky-300 font-medium select-none shrink-0 mr-1.5">
          <HighlightMatch text={keyName} query={searchQuery} />:
        </span>
        <div className="flex-1 mr-2 select-text">{valueDisplay}</div>

        {/* Hover Quick Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1 py-0.5 shadow-xs">
          <button
            onClick={(e) => handleCopy(formattedValueForCopy, 'val', e)}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            title="Copiar valor"
          >
            {copiedAction === 'val' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          </button>
          <button
            onClick={(e) => handleCopy(path, 'path', e)}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition text-[10px]"
            title={`Copiar caminho JSON (${path})`}
          >
            {copiedAction === 'path' ? <Check size={11} className="text-emerald-500" /> : <Hash size={11} />}
          </button>
        </div>
      </div>
    );
  }

  // Object or Array node
  const keys = Object.keys(value as Record<string, unknown>);
  const count = keys.length;

  return (
    <div className="text-[12px] font-mono">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-center py-0.5 px-1 rounded hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 cursor-pointer select-none transition-colors"
        style={{ paddingLeft: `${Math.max(depth * 16, 6)}px` }}
      >
        <button
          type="button"
          className="p-0.5 mr-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        <span className="text-sky-700 dark:text-sky-300 font-semibold mr-1.5">
          <HighlightMatch text={keyName} query={searchQuery} />:
        </span>

        <span className="text-zinc-400 dark:text-zinc-500 text-[11px] mr-2">
          {isArray ? `[${count} ${count === 1 ? 'item' : 'itens'}]` : `{${count} ${count === 1 ? 'chave' : 'chaves'}}`}
        </span>

        {/* Hover Quick Actions for Sub-tree */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity ml-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1 py-0.5 shadow-xs">
          <button
            onClick={(e) => handleCopy(formattedValueForCopy, 'val', e)}
            className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-[10px]"
            title="Copiar sub-objeto JSON completo"
          >
            {copiedAction === 'val' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            <span>JSON</span>
          </button>
          <button
            onClick={(e) => handleCopy(path, 'path', e)}
            className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-[10px]"
            title={`Copiar caminho (${path})`}
          >
            {copiedAction === 'path' ? <Check size={11} className="text-emerald-500" /> : <Code2 size={11} />}
            <span>Path</span>
          </button>
        </div>
      </div>

      {/* Render Children if expanded */}
      {isExpanded && (
        <div className="border-l border-zinc-200/80 dark:border-zinc-800/80 ml-2.5">
          {keys.map((k) => {
            const childValue = (value as Record<string, unknown>)[k];
            const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
            return (
              <JsonTreeNode
                key={k}
                keyName={k}
                value={childValue}
                path={childPath}
                searchQuery={searchQuery}
                defaultExpanded={defaultExpanded}
                expandAllSignal={expandAllSignal}
                collapseAllSignal={collapseAllSignal}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({
  data,
  searchQuery = '',
  expandAllSignal,
  collapseAllSignal,
  rootPath = 'root',
}) => {
  const isObject = data !== null && typeof data === 'object';

  if (!isObject) {
    return (
      <div className="p-4 text-xs font-mono text-zinc-600 dark:text-zinc-400">
        Valor não estruturado: {String(data)}
      </div>
    );
  }

  const keys = Object.keys(data as Record<string, unknown>);
  if (keys.length === 0) {
    return (
      <div className="p-4 text-xs font-mono text-zinc-400 dark:text-zinc-500">
        {Array.isArray(data) ? '[] (Array vazio)' : '{} (Objeto vazio)'}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 select-text">
      {keys.map((key) => {
        const value = (data as Record<string, unknown>)[key];
        const path = Array.isArray(data) ? `${rootPath}[${key}]` : `${rootPath}.${key}`;
        return (
          <JsonTreeNode
            key={key}
            keyName={key}
            value={value}
            path={path}
            searchQuery={searchQuery}
            expandAllSignal={expandAllSignal}
            collapseAllSignal={collapseAllSignal}
            depth={0}
          />
        );
      })}
    </div>
  );
};
