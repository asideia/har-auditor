export type InvestigationTag = 'Bug' | 'Auth' | 'Segurança' | 'Performance';

export interface InvestigationEntryNote {
  entryId: string;
  note: string;
  tags: InvestigationTag[];
  pinnedAt: string;
  updatedAt: string;
}
