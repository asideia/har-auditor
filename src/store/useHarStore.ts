import { create } from 'zustand';
import type { HarRoot, HarMetrics, EnrichedHarEntry } from '../types/har.ts';
import type { WorkerInMessage, WorkerOutMessage } from '../workers/harParser.worker.ts';
import { generateSampleHarJson } from '../utils/demoHar.ts';
import type { InvestigationEntryNote, InvestigationTag } from '../types/investigation.ts';

export type ParsingStage = 'idle' | 'reading' | 'parsing' | 'analyzing' | 'ready' | 'error';

interface HarState {
  // Data
  har: HarRoot | null;
  fileName: string | null;
  fileSize: number;
  entries: EnrichedHarEntry[];
  metrics: HarMetrics;

  // Processing state
  parsingStage: ParsingStage;
  progress: number;
  progressMessage: string;
  errorMessage: string | null;

  // UI state
  activeToolId: string;
  sidebarCollapsed: boolean;
  selectedEntryId: string | null;
  searchQuery: string;

  // Investigation & Notes State
  pinnedEntryIds: string[];
  investigationNotes: Record<string, InvestigationEntryNote>;
  isInvestigationAsideOpen: boolean;

  // Actions
  loadFile: (file: File) => Promise<void>;
  loadSampleHar: () => void;
  loadRawJson: (jsonString: string, name?: string) => void;
  setActiveTool: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedEntryId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearFile: () => void;

  // Investigation Actions
  togglePinEntry: (id: string) => void;
  isPinned: (id: string) => boolean;
  setEntryNote: (id: string, note: string) => void;
  toggleEntryTag: (id: string, tag: InvestigationTag) => void;
  setInvestigationAsideOpen: (open: boolean) => void;
  toggleInvestigationAside: () => void;
  clearAllPinned: () => void;
}

const initialMetrics: HarMetrics = {
  totalRequests: 0,
  totalSize: 0,
  totalTransferred: 0,
  totalErrors: 0,
  totalDurationMs: 0,
  statusCounts: {
    ok: 0,
    redirect: 0,
    clientError: 0,
    serverError: 0,
    failed: 0,
  },
  methodCounts: {},
  mimeTypeCounts: {},
  domainsCount: 0,
  thirdPartyCount: 0,
  securitySummary: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0,
  },
};

let activeWorker: Worker | null = null;

function createWorker(): Worker {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  // Vite-compatible standard web worker initialization
  const worker = new Worker(
    new URL('../workers/harParser.worker.ts', import.meta.url),
    { type: 'module' }
  );
  activeWorker = worker;
  return worker;
}

export const useHarStore = create<HarState>((set, get) => ({
  har: null,
  fileName: null,
  fileSize: 0,
  entries: [],
  metrics: initialMetrics,

  parsingStage: 'idle',
  progress: 0,
  progressMessage: '',
  errorMessage: null,

  activeToolId: 'requests-inspector',
  sidebarCollapsed: false,
  selectedEntryId: null,
  searchQuery: '',

  // Investigation & Notes initial state
  pinnedEntryIds: [],
  investigationNotes: {},
  isInvestigationAsideOpen: false,

  loadFile: async (file: File) => {
    set({
      parsingStage: 'reading',
      progress: 5,
      progressMessage: `Inicializando leitura de ${file.name}...`,
      errorMessage: null,
      fileName: file.name,
      fileSize: file.size,
    });

    const worker = createWorker();

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'PROGRESS') {
        set({
          parsingStage: msg.stage,
          progress: msg.progress,
          progressMessage: msg.message || 'Processando...',
        });
      } else if (msg.type === 'SUCCESS') {
        set({
          har: msg.har,
          metrics: msg.metrics,
          entries: msg.har.log.entries,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          parsingStage: 'ready',
          progress: 100,
          progressMessage: 'Análise concluída com sucesso.',
          errorMessage: null,
        });
      } else if (msg.type === 'ERROR') {
        set({
          parsingStage: 'error',
          errorMessage: msg.error,
          progressMessage: '',
        });
      }
    };

    worker.onerror = (err) => {
      set({
        parsingStage: 'error',
        errorMessage: err.message || 'Erro inesperado no Web Worker de processamento HAR.',
      });
    };

    const payload: WorkerInMessage = {
      type: 'PARSE_FILE',
      file,
    };
    worker.postMessage(payload);
  },

  loadSampleHar: () => {
    const json = generateSampleHarJson();
    get().loadRawJson(json, 'demo-security-audit.har');
  },

  loadRawJson: (jsonString: string, name = 'custom-import.har') => {
    const size = new Blob([jsonString]).size;
    set({
      parsingStage: 'parsing',
      progress: 20,
      progressMessage: 'Processando arquivo HAR...',
      errorMessage: null,
      fileName: name,
      fileSize: size,
    });

    const worker = createWorker();

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'PROGRESS') {
        set({
          parsingStage: msg.stage,
          progress: msg.progress,
          progressMessage: msg.message || 'Processando...',
        });
      } else if (msg.type === 'SUCCESS') {
        set({
          har: msg.har,
          metrics: msg.metrics,
          entries: msg.har.log.entries,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          parsingStage: 'ready',
          progress: 100,
          progressMessage: 'Análise concluída.',
          errorMessage: null,
        });
      } else if (msg.type === 'ERROR') {
        set({
          parsingStage: 'error',
          errorMessage: msg.error,
        });
      }
    };

    const payload: WorkerInMessage = {
      type: 'PARSE_TEXT',
      text: jsonString,
      fileName: name,
      fileSize: size,
    };
    worker.postMessage(payload);
  },

  setActiveTool: (id: string) => {
    set({ activeToolId: id });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
  },

  setSelectedEntryId: (id: string | null) => {
    set({ selectedEntryId: id });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearFile: () => {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    set({
      har: null,
      fileName: null,
      fileSize: 0,
      entries: [],
      metrics: initialMetrics,
      parsingStage: 'idle',
      progress: 0,
      progressMessage: '',
      errorMessage: null,
      selectedEntryId: null,
      searchQuery: '',
      pinnedEntryIds: [],
      investigationNotes: {},
      isInvestigationAsideOpen: false,
    });
  },

  togglePinEntry: (id: string) => {
    set((state) => {
      const isAlreadyPinned = state.pinnedEntryIds.includes(id);
      if (isAlreadyPinned) {
        return {
          pinnedEntryIds: state.pinnedEntryIds.filter((item) => item !== id),
        };
      } else {
        const now = new Date().toISOString();
        const existingNote = state.investigationNotes[id];
        return {
          pinnedEntryIds: [id, ...state.pinnedEntryIds],
          isInvestigationAsideOpen: true, // Auto-open aside on pinning
          investigationNotes: {
            ...state.investigationNotes,
            [id]: existingNote || {
              entryId: id,
              note: '',
              tags: [],
              pinnedAt: now,
              updatedAt: now,
            },
          },
        };
      }
    });
  },

  isPinned: (id: string) => {
    return get().pinnedEntryIds.includes(id);
  },

  setEntryNote: (id: string, note: string) => {
    set((state) => {
      const now = new Date().toISOString();
      const current = state.investigationNotes[id] || {
        entryId: id,
        note: '',
        tags: [],
        pinnedAt: now,
        updatedAt: now,
      };
      return {
        investigationNotes: {
          ...state.investigationNotes,
          [id]: {
            ...current,
            note,
            updatedAt: now,
          },
        },
      };
    });
  },

  toggleEntryTag: (id: string, tag: InvestigationTag) => {
    set((state) => {
      const now = new Date().toISOString();
      const current = state.investigationNotes[id] || {
        entryId: id,
        note: '',
        tags: [],
        pinnedAt: now,
        updatedAt: now,
      };
      const hasTag = current.tags.includes(tag);
      const newTags = hasTag
        ? current.tags.filter((t) => t !== tag)
        : [...current.tags, tag];
      return {
        investigationNotes: {
          ...state.investigationNotes,
          [id]: {
            ...current,
            tags: newTags,
            updatedAt: now,
          },
        },
      };
    });
  },

  setInvestigationAsideOpen: (open: boolean) => {
    set({ isInvestigationAsideOpen: open });
  },

  toggleInvestigationAside: () => {
    set((state) => ({ isInvestigationAsideOpen: !state.isInvestigationAsideOpen }));
  },

  clearAllPinned: () => {
    set({ pinnedEntryIds: [] });
  },
}));
