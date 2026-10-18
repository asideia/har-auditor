import React, { useState, useMemo } from 'react';
import {
  Image as ImageIcon,
  Download,
  Copy,
  Check,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Info,
  ExternalLink,
} from 'lucide-react';
import type { HarResponse } from '../../types/har.ts';

interface ResponseMediaPreviewProps {
  response: HarResponse;
  url: string;
}

export const ResponseMediaPreview: React.FC<ResponseMediaPreviewProps> = ({ response, url }) => {
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [fitMode, setFitMode] = useState<'fit' | 'original'>('fit');
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  const content = response.content;
  const mimeType = (content?.mimeType || '').toLowerCase();
  const rawText = content?.text || '';
  const encoding = content?.encoding;

  // Determine media category and construct secure preview data URI
  const mediaInfo = useMemo(() => {
    if (!rawText) {
      return { isMedia: false, type: 'none', dataUri: '', fileName: 'asset' };
    }

    const isExplicitImage =
      mimeType.startsWith('image/') ||
      mimeType.includes('svg') ||
      mimeType.includes('icon') ||
      url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)(\?.*)?$/i);

    const isSvgText =
      mimeType.includes('svg') ||
      rawText.trim().startsWith('<svg') ||
      rawText.includes('xmlns="http://www.w3.org/2000/svg"');

    // Detect base64 image prefix
    const isBase64Image =
      encoding === 'base64' &&
      (mimeType.startsWith('image/') ||
        rawText.startsWith('iVBORw0KGgo') || // PNG
        rawText.startsWith('/9j/') || // JPEG
        rawText.startsWith('R0lGOD') || // GIF
        rawText.startsWith('UklGR') || // WebP
        rawText.startsWith('PHN2Zy')); // SVG in base64

    let dataUri = '';
    let type: 'raster' | 'svg' | 'other' = 'raster';
    let fileExt = 'png';

    if (isSvgText) {
      type = 'svg';
      fileExt = 'svg';
      if (encoding === 'base64') {
        dataUri = `data:image/svg+xml;base64,${rawText}`;
      } else {
        dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawText)}`;
      }
    } else if (isBase64Image || isExplicitImage) {
      type = 'raster';
      const cleanMime = mimeType.startsWith('image/') ? mimeType : 'image/png';
      fileExt = cleanMime.split('/')[1]?.split(';')[0] || 'png';
      dataUri = rawText.startsWith('data:') ? rawText : `data:${cleanMime};base64,${rawText}`;
    }

    // Extract filename from URL
    let fileName = 'downloaded_asset.' + fileExt;
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/');
      const last = segments[segments.length - 1];
      if (last && last.includes('.')) {
        fileName = last;
      }
    } catch {
      // fallback to generated
    }

    return {
      isMedia: Boolean(dataUri),
      type,
      dataUri,
      fileName,
      mimeType: mimeType || (type === 'svg' ? 'image/svg+xml' : 'image/png'),
    };
  }, [rawText, mimeType, encoding, url]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!mediaInfo.dataUri) return;
    const a = document.createElement('a');
    a.href = mediaInfo.dataUri;
    a.download = mediaInfo.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!mediaInfo.isMedia) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/40 p-8 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
          <ImageIcon size={22} />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
            Nenhuma Mídia Visual Detectada
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            O corpo desta resposta é do tipo <code className="font-mono text-cyan-600 dark:text-cyan-400">{response.content?.mimeType || 'não especificado'}</code>.
            Para visualizar o conteúdo em formato JSON, Árvore ou Texto, acerte na aba <strong>Payload / Resposta</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Top Media Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-zinc-100 dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-mono text-[11px] font-semibold">
            {mediaInfo.mimeType}
          </div>
          {imgDimensions && (
            <span className="text-zinc-500 dark:text-zinc-400 text-[11px] font-mono tabular-nums">
              {imgDimensions.width} × {imgDimensions.height} px
            </span>
          )}
          <span className="text-zinc-400 dark:text-zinc-500 text-[11px] font-mono">
            ({content?.size ? `${(content.size / 1024).toFixed(1)} KB` : 'Tamanho não informado'})
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Zoom & Fit Controls */}
          <div className="flex items-center bg-zinc-200 dark:bg-zinc-800 rounded p-0.5">
            <button
              onClick={() => setFitMode((m) => (m === 'fit' ? 'original' : 'fit'))}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                fitMode === 'fit'
                  ? 'bg-white dark:bg-zinc-700 text-cyan-700 dark:text-cyan-300 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Ajustar imagem ao painel ou exibir tamanho real (100%)"
            >
              {fitMode === 'fit' ? 'Ajustar' : '100% Real'}
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
              className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded"
              title="Diminuir Zoom"
            >
              <ZoomOut size={12} />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
              className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded"
              title="Aumentar Zoom"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded text-xs font-medium transition"
            title={`Baixar ${mediaInfo.fileName}`}
          >
            <Download size={12} />
            <span>Baixar</span>
          </button>

          {/* Copy Data URI / Base64 */}
          <button
            onClick={() => handleCopy(mediaInfo.dataUri)}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded text-xs font-medium transition"
            title="Copiar Data URI em Base64"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">Copiado</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span className="text-[11px]">Data URI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Media Canvas with Checkerboard Background */}
      <div className="relative border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center min-h-[300px] max-h-[500px] p-4">
        {/* Subtle SVG Checkerboard for Transparency */}
        <div
          className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)`,
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          }}
        />

        {/* Rendered Media Asset */}
        <div className="relative z-10 overflow-auto max-h-[460px] max-w-full flex items-center justify-center">
          <img
            src={mediaInfo.dataUri}
            alt="Resposta renderizada"
            referrerPolicy="no-referrer"
            onLoad={(e) => {
              const img = e.currentTarget;
              setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }}
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out',
            }}
            className={`shadow-md rounded border border-zinc-300/60 dark:border-zinc-800 ${
              fitMode === 'fit' ? 'max-h-[420px] max-w-full object-contain' : 'max-w-none'
            }`}
          />
        </div>
      </div>

      {/* Forensic Media Details Box */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
          <Info size={13} className="text-cyan-600 dark:text-cyan-400" />
          <span>Metadados Forenses da Imagem</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block">Tipo MIME:</span>
            <span className="text-zinc-800 dark:text-zinc-200">{mediaInfo.mimeType}</span>
          </div>
          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block">Dimensões:</span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {imgDimensions ? `${imgDimensions.width} × ${imgDimensions.height} px` : 'Calculando...'}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block">Codificação:</span>
            <span className="text-zinc-800 dark:text-zinc-200">{encoding || 'Binário Direto'}</span>
          </div>
          <div>
            <span className="text-zinc-400 dark:text-zinc-500 block">Arquivo Sugerido:</span>
            <span className="text-zinc-800 dark:text-zinc-200 truncate block" title={mediaInfo.fileName}>
              {mediaInfo.fileName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
