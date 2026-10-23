import { create } from 'zustand';

interface ComparisonState {
  entryAId: string | null;
  entryBId: string | null;
  activeDiffTab: 'headers' | 'payload' | 'response' | 'timings';
  onlyDifferences: boolean;

  setEntryAId: (id: string | null) => void;
  setEntryBId: (id: string | null) => void;
  setComparisonPair: (idA: string | null, idB: string | null) => void;
  swapPair: () => void;
  clearPair: () => void;
  setActiveDiffTab: (tab: 'headers' | 'payload' | 'response' | 'timings') => void;
  setOnlyDifferences: (only: boolean) => void;
  toggleOnlyDifferences: () => void;
}

export const useComparisonStore = create<ComparisonState>((set) => ({
  entryAId: null,
  entryBId: null,
  activeDiffTab: 'headers',
  onlyDifferences: true,

  setEntryAId: (id) => set({ entryAId: id }),
  setEntryBId: (id) => set({ entryBId: id }),
  setComparisonPair: (idA, idB) => set({ entryAId: idA, entryBId: idB }),
  swapPair: () => set((state) => ({ entryAId: state.entryBId, entryBId: state.entryAId })),
  clearPair: () => set({ entryAId: null, entryBId: null }),
  setActiveDiffTab: (tab) => set({ activeDiffTab: tab }),
  setOnlyDifferences: (only) => set({ onlyDifferences: only }),
  toggleOnlyDifferences: () => set((state) => ({ onlyDifferences: !state.onlyDifferences })),
}));
