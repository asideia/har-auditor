import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EnrichedHarEntry } from '../types/har.ts';

export interface InvestigationEntryNote {
  entryId: string;
  note: string;
  tags: string[];
  updatedAt: string; // ISO string
}

export interface IncidentReportSummary {
  reportTitle: string;
  incidentSummary: string;
  generatedAt: string;
  sourceFile: string;
  totalEntriesAnalyzed: number;
  totalPinned: number;
  criticalIssuesFound: number;
  items: Array<{
    entry: EnrichedHarEntry;
    diagnosis?: InvestigationEntryNote;
    isPinned: boolean;
  }>;
}

export const PRESET_DIAGNOSIS_TAGS = [
  { id: 'auth_jwt', label: 'Auth / JWT', color: 'purple' },
  { id: 'permission_403', label: '403 Forbidden', color: 'rose' },
  { id: 'slow_ttfb', label: 'Latência / TTFB Alto', color: 'amber' },
  { id: 'server_5xx', label: '5xx Servidor', color: 'red' },
  { id: 'cors_blocked', label: 'CORS Bloqueado', color: 'blue' },
  { id: 'token_leak', label: 'Vazamento de Chave / Token', color: 'rose' },
  { id: 'bad_payload', label: 'Payload Inválido', color: 'orange' },
  { id: 'suspect_ip', label: 'IP / Origem Suspeita', color: 'yellow' },
  { id: 'false_positive', label: 'Falso Positivo', color: 'zinc' },
] as const;

interface InvestigationState {
  // Set of pinned entry IDs (stored as array for JSON serialization)
  pinnedIds: string[];
  // Map of entryId -> InvestigationEntryNote
  notes: Record<string, InvestigationEntryNote>;
  // Active filter state
  onlyPinned: boolean;
  // Right aside drawer state
  isAsideOpen: boolean;
  asideWidth: number;

  // Actions
  togglePin: (entryId: string) => void;
  isPinned: (entryId: string) => boolean;
  setNote: (entryId: string, noteText: string, tags?: string[]) => void;
  getNote: (entryId: string) => InvestigationEntryNote | undefined;
  addTag: (entryId: string, tag: string) => void;
  removeTag: (entryId: string, tag: string) => void;
  toggleTag: (entryId: string, tag: string) => void;
  deleteNote: (entryId: string) => void;
  setOnlyPinned: (only: boolean) => void;
  toggleOnlyPinned: () => void;
  setAsideOpen: (open: boolean) => void;
  toggleAside: () => void;
  setAsideWidth: (width: number) => void;
  clearInvestigation: () => void;
}

export const useInvestigationStore = create<InvestigationState>()(
  persist(
    (set, get) => ({
      pinnedIds: [],
      notes: {},
      onlyPinned: false,
      isAsideOpen: false,
      asideWidth: 384,

      togglePin: (entryId: string) => {
        set((state) => {
          const exists = state.pinnedIds.includes(entryId);
          if (exists) {
            return { pinnedIds: state.pinnedIds.filter((id) => id !== entryId) };
          } else {
            return {
              pinnedIds: [entryId, ...state.pinnedIds],
              isAsideOpen: true, // Auto-open aside on pinning
            };
          }
        });
      },

      setAsideOpen: (open: boolean) => {
        set({ isAsideOpen: open });
      },

      toggleAside: () => {
        set((state) => ({ isAsideOpen: !state.isAsideOpen }));
      },

      setAsideWidth: (width: number) => {
        // Clamp width between 280px and 900px
        const clamped = Math.max(280, Math.min(width, 900));
        set({ asideWidth: clamped });
      },

      isPinned: (entryId: string) => {
        return get().pinnedIds.includes(entryId);
      },

      setNote: (entryId: string, noteText: string, tags?: string[]) => {
        set((state) => {
          const existing = state.notes[entryId];
          const updatedNote: InvestigationEntryNote = {
            entryId,
            note: noteText,
            tags: tags !== undefined ? tags : existing?.tags || [],
            updatedAt: new Date().toISOString(),
          };
          return {
            notes: {
              ...state.notes,
              [entryId]: updatedNote,
            },
          };
        });
      },

      getNote: (entryId: string) => {
        return get().notes[entryId];
      },

      addTag: (entryId: string, tag: string) => {
        set((state) => {
          const current = state.notes[entryId] || {
            entryId,
            note: '',
            tags: [],
            updatedAt: new Date().toISOString(),
          };
          if (current.tags.includes(tag)) return state;
          return {
            notes: {
              ...state.notes,
              [entryId]: {
                ...current,
                tags: [...current.tags, tag],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      removeTag: (entryId: string, tag: string) => {
        set((state) => {
          const current = state.notes[entryId];
          if (!current) return state;
          return {
            notes: {
              ...state.notes,
              [entryId]: {
                ...current,
                tags: current.tags.filter((t) => t !== tag),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      toggleTag: (entryId: string, tag: string) => {
        const current = get().notes[entryId];
        if (current?.tags.includes(tag)) {
          get().removeTag(entryId, tag);
        } else {
          get().addTag(entryId, tag);
        }
      },

      deleteNote: (entryId: string) => {
        set((state) => {
          const nextNotes = { ...state.notes };
          delete nextNotes[entryId];
          return { notes: nextNotes };
        });
      },

      setOnlyPinned: (only: boolean) => {
        set({ onlyPinned: only });
      },

      toggleOnlyPinned: () => {
        set((state) => ({ onlyPinned: !state.onlyPinned }));
      },

      clearInvestigation: () => {
        set({ pinnedIds: [], notes: {}, onlyPinned: false });
      },
    }),
    {
      name: 'har_investigation_store_v1',
    }
  )
);
