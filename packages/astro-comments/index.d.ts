export interface ExportComment {
  id: number;
  author: string | null;
  body: string;
  created_at: string;
  published_at: string | null;
  reply: { body: string; created_at: string } | null;
}

export interface ExportData {
  site: string;
  name: string;
  cutoff: string;
  generated_at: string;
  reactions: { id: string; icon: string; label: Record<'en' | 'fr' | 'de', string> }[];
  pages: Record<string, { comments: ExportComment[]; reactions: Record<string, number> }>;
}

export function fetchExport(
  api: string,
  site: string,
  opts?: { timeout?: number; fetch?: typeof fetch; logger?: Pick<Console, 'warn'> },
): Promise<ExportData | null>;

export function clearExportCache(): void;

export function renderSection(p: { site: string; api: string; path: string; lang?: string; data: ExportData | null }): string;

export function normalizePath(path: string): string;

export const labels: Record<'en' | 'fr' | 'de', { heading: string; formerReader: string; replyFrom: string }>;
