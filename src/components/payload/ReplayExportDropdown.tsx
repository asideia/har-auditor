import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  ChevronDown,
  Check,
  Code2,
  FileCode,
  Copy,
  Layers,
} from 'lucide-react';
import type { EnrichedHarEntry } from '../../types/har.ts';

interface ReplayExportDropdownProps {
  entry: EnrichedHarEntry;
}

export const generateCurlCommand = (entry: EnrichedHarEntry, platform: 'bash' | 'cmd' = 'bash'): string => {
  const method = entry.request.method.toUpperCase();
  const url = entry.request.url;
  const isCmd = platform === 'cmd';
  const lineContinuation = isCmd ? ' ^\n  ' : ' \\\n  ';

  const parts: string[] = ['curl'];
  parts.push(`-X ${method}`);
  parts.push(`"${url}"`);

  (entry.request.headers || []).forEach((h) => {
    // Strip HTTP/2 pseudo headers like :authority, :method, :path, :scheme
    if (!h.name.startsWith(':')) {
      const escapedValue = isCmd
        ? h.value.replace(/"/g, '""')
        : h.value.replace(/"/g, '\\"');
      parts.push(`-H "${h.name}: ${escapedValue}"`);
    }
  });

  if (entry.request.postData?.text) {
    const body = entry.request.postData.text;
    if (isCmd) {
      parts.push(`--data-raw "${body.replace(/"/g, '""')}"`);
    } else {
      parts.push(`--data-raw '${body.replace(/'/g, "'\\''")}'`);
    }
  }

  return parts.join(lineContinuation);
};

export const generateFetchSnippet = (entry: EnrichedHarEntry): string => {
  const method = entry.request.method.toUpperCase();
  const url = entry.request.url;

  const headersObj: Record<string, string> = {};
  (entry.request.headers || []).forEach((h) => {
    if (!h.name.startsWith(':')) {
      headersObj[h.name] = h.value;
    }
  });

  const options: Record<string, unknown> = {
    method,
    headers: headersObj,
  };

  const bodyText = entry.request.postData?.text;
  let bodyCode = '';
  if (bodyText) {
    try {
      // If it's valid JSON, format as JSON.stringify object
      const parsed = JSON.parse(bodyText);
      bodyCode = `,\n  body: JSON.stringify(${JSON.stringify(parsed, null, 4)})`;
    } catch {
      bodyCode = `,\n  body: ${JSON.stringify(bodyText)}`;
    }
  }

  return `// Replay com Fetch API (Console do Navegador ou Node.js 18+)
fetch(${JSON.stringify(url)}, {
  method: ${JSON.stringify(method)},
  headers: ${JSON.stringify(headersObj, null, 2).replace(/\n/g, '\n  ')}${bodyCode}
})
  .then(response => {
    console.log('Status:', response.status);
    return response.text();
  })
  .then(data => console.log('Response:', data))
  .catch(err => console.error('Fetch error:', err));`;
};

export const generatePowerShellSnippet = (entry: EnrichedHarEntry): string => {
  const method = entry.request.method.toUpperCase();
  const url = entry.request.url;

  const headerLines: string[] = [];
  (entry.request.headers || []).forEach((h) => {
    if (!h.name.startsWith(':')) {
      headerLines.push(`    "${h.name}" = "${h.value.replace(/"/g, '`"')}"`);
    }
  });

  const body = entry.request.postData?.text;

  let script = `# PowerShell Forensic Replay Script
$headers = @{
${headerLines.join('\n')}
}
`;

  if (body) {
    script += `\n$body = @"\n${body}\n"@\n\n`;
    script += `Invoke-RestMethod -Uri "${url}" -Method ${method} -Headers $headers -Body $body\n`;
  } else {
    script += `\nInvoke-RestMethod -Uri "${url}" -Method ${method} -Headers $headers\n`;
  }

  return script;
};

export const ReplayExportDropdown: React.FC<ReplayExportDropdownProps> = ({ entry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Esc
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCopyFormat = (formatId: string, snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedFormat(formatId);
    setTimeout(() => {
      setCopiedFormat(null);
      setIsOpen(false);
    }, 1200);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 transition"
        title="Menu de Exportação para Replay (cURL, Fetch, PowerShell)"
      >
        {copiedFormat ? (
          <>
            <Check size={12} className="text-emerald-500" />
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Copiado!</span>
          </>
        ) : (
          <>
            <Terminal size={12} className="text-cyan-600 dark:text-cyan-400" />
            <span className="text-[11px]">Replay</span>
            <ChevronDown size={11} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 rounded-md shadow-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 z-50 py-1 text-xs divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Exportar para Reprodução
          </div>

          <div className="py-1">
            {/* cURL Bash */}
            <button
              onClick={() => handleCopyFormat('curl-bash', generateCurlCommand(entry, 'bash'))}
              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between group transition"
            >
              <div className="flex items-center gap-2">
                <Terminal size={13} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                    cURL (Bash / Terminal)
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Sintaxe Linux, macOS e Git Bash
                  </div>
                </div>
              </div>
              {copiedFormat === 'curl-bash' ? (
                <Check size={13} className="text-emerald-500 shrink-0" />
              ) : (
                <Copy size={12} className="text-zinc-400 opacity-0 group-hover:opacity-100 shrink-0" />
              )}
            </button>

            {/* cURL CMD Windows */}
            <button
              onClick={() => handleCopyFormat('curl-cmd', generateCurlCommand(entry, 'cmd'))}
              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between group transition"
            >
              <div className="flex items-center gap-2">
                <Terminal size={13} className="text-sky-600 dark:text-sky-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                    cURL (Windows CMD)
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Sintaxe cmd.exe com escape ^
                  </div>
                </div>
              </div>
              {copiedFormat === 'curl-cmd' ? (
                <Check size={13} className="text-emerald-500 shrink-0" />
              ) : (
                <Copy size={12} className="text-zinc-400 opacity-0 group-hover:opacity-100 shrink-0" />
              )}
            </button>

            {/* Fetch API JS */}
            <button
              onClick={() => handleCopyFormat('fetch-js', generateFetchSnippet(entry))}
              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between group transition"
            >
              <div className="flex items-center gap-2">
                <FileCode size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                    Fetch API (JavaScript)
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Pronto para DevTools ou Node.js
                  </div>
                </div>
              </div>
              {copiedFormat === 'fetch-js' ? (
                <Check size={13} className="text-emerald-500 shrink-0" />
              ) : (
                <Copy size={12} className="text-zinc-400 opacity-0 group-hover:opacity-100 shrink-0" />
              )}
            </button>

            {/* PowerShell */}
            <button
              onClick={() => handleCopyFormat('powershell', generatePowerShellSnippet(entry))}
              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between group transition"
            >
              <div className="flex items-center gap-2">
                <Code2 size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                    PowerShell (Windows)
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Invoke-RestMethod com Headers
                  </div>
                </div>
              </div>
              {copiedFormat === 'powershell' ? (
                <Check size={13} className="text-emerald-500 shrink-0" />
              ) : (
                <Copy size={12} className="text-zinc-400 opacity-0 group-hover:opacity-100 shrink-0" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
