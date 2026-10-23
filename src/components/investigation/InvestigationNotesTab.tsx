import React, { useState, useEffect } from 'react';
import {
  Star,
  Tag,
  Plus,
  Trash2,
  Check,
  Copy,
  Clock,
  Sparkles,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { EnrichedHarEntry } from '../../types/har.ts';
import {
  useInvestigationStore,
  PRESET_DIAGNOSIS_TAGS,
} from '../../store/useInvestigationStore.ts';

interface InvestigationNotesTabProps {
  entry: EnrichedHarEntry;
}

export const InvestigationNotesTab: React.FC<InvestigationNotesTabProps> = ({ entry }) => {
  const {
    isPinned,
    togglePin,
    getNote,
    setNote,
    deleteNote,
    toggleTag,
    addTag,
    removeTag,
  } = useInvestigationStore();

  const currentDiagnosis = getNote(entry.id);
  const pinned = isPinned(entry.id);

  const [noteContent, setNoteContent] = useState(currentDiagnosis?.note || '');
  const [customTagInput, setCustomTagInput] = useState('');
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);

  // Sync internal state when entry changes
  useEffect(() => {
    setNoteContent(currentDiagnosis?.note || '');
    setCustomTagInput('');
  }, [entry.id, currentDiagnosis?.note]);

  const handleSaveNote = () => {
    setNote(entry.id, noteContent);
    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 2000);
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    addTag(entry.id, trimmed);
    setCustomTagInput('');
  };

  const handleCopyNote = () => {
    if (!noteContent.trim()) return;
    const reportText = `[Diagnóstico Forense]\nRequisição: ${entry.request.method} ${entry.request.url}\nStatus: ${entry.response.status}\nTags: ${(currentDiagnosis?.tags || []).join(', ') || 'Nenhuma'}\nNota: ${noteContent}`;
    navigator.clipboard.writeText(reportText);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const getTagBadgeClass = (tag: string) => {
    const preset = PRESET_DIAGNOSIS_TAGS.find((p) => p.label.toLowerCase() === tag.toLowerCase() || p.id === tag);
    if (!preset) {
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
    }
    switch (preset.color) {
      case 'purple':
        return 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      case 'rose':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      case 'amber':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'red':
        return 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800';
      case 'blue':
        return 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800';
      case 'orange':
        return 'bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
    }
  };

  const activeTags = currentDiagnosis?.tags || [];

  return (
    <div className="space-y-5 font-sans text-xs">
      {/* 1. Header Card: Pin Status & Quick Summary */}
      <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePin(entry.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs border transition cursor-pointer shadow-2xs ${
                pinned
                  ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Star
                size={14}
                className={pinned ? 'fill-white text-white' : 'text-zinc-400 dark:text-zinc-500'}
              />
              <span>{pinned ? 'Requisição Pinada (Favorita)' : 'Favoritar / Pin'}</span>
            </button>
            {pinned && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                Incluída no Relatório de Incidente
              </span>
            )}
          </div>

          {currentDiagnosis?.updatedAt && (
            <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
              <Clock size={11} />
              <span>Atualizado: {new Date(currentDiagnosis.updatedAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Documente anomalias encontradas nesta chamada (ex.: tokens ausentes, divergência de CORS, falhas de autorização 403, dados sensíveis em trânsito).
        </div>
      </div>

      {/* 2. Diagnostic Tags Section */}
      <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Tag size={13} className="text-cyan-600 dark:text-cyan-400" />
            Tags de Diagnóstico Rápido
          </span>
          <span className="text-[10px] text-zinc-400">Clique para alternar</span>
        </div>

        {/* Preset Tag Buttons */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_DIAGNOSIS_TAGS.map((preset) => {
            const isSelected = activeTags.includes(preset.label);
            return (
              <button
                key={preset.id}
                onClick={() => toggleTag(entry.id, preset.label)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition border cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? `${getTagBadgeClass(preset.label)} font-bold shadow-2xs`
                    : 'bg-zinc-100 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {isSelected && <Check size={11} />}
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Custom Tags / Removable */}
        {activeTags.length > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Ativas:</span>
            {activeTags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${getTagBadgeClass(tag)}`}
              >
                <span>{tag}</span>
                <button
                  onClick={() => removeTag(entry.id, tag)}
                  className="hover:text-rose-500 transition ml-0.5"
                  title="Remover tag"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Custom Tag Input */}
        <form onSubmit={handleAddCustomTag} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="Adicionar tag personalizada (ex: SQL Injection, Missing Header)..."
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            className="flex-1 py-1.5 px-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-mono focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!customTagInput.trim()}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-md font-medium text-xs flex items-center gap-1 transition shadow-2xs"
          >
            <Plus size={12} />
            <span>Adicionar</span>
          </button>
        </form>
      </div>

      {/* 3. Investigation Note Editor */}
      <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <FileText size={13} className="text-cyan-600 dark:text-cyan-400" />
            Anotações de Diagnóstico do Incidente
          </span>
          <div className="flex items-center gap-2">
            {noteContent.trim() && (
              <button
                onClick={handleCopyNote}
                className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1"
                title="Copiar texto do diagnóstico"
              >
                {copiedNote ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                <span>{copiedNote ? 'Copiado!' : 'Copiar'}</span>
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={6}
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          onBlur={handleSaveNote}
          placeholder="Exemplo: Esta chamada retornou 403 por falta de claim no JWT de autenticação. O cabeçalho Authorization continha token expirado às 14:02:11..."
          className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs font-sans text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition leading-relaxed resize-y"
        />

        <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400">
          <div className="flex items-center gap-2">
            <span>{noteContent.length} caracteres</span>
            {showSavedFeedback && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Check size={12} /> Salvo automaticamente
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentDiagnosis && (
              <button
                onClick={() => {
                  deleteNote(entry.id);
                  setNoteContent('');
                }}
                className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs flex items-center gap-1 transition"
                title="Limpar notas e tags desta requisição"
              >
                <Trash2 size={11} />
                <span>Limpar Anotação</span>
              </button>
            )}

            <button
              onClick={handleSaveNote}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-semibold text-xs flex items-center gap-1 transition shadow-2xs"
            >
              <Check size={12} />
              <span>Salvar Nota</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
