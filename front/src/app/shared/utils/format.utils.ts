export function defaultReportRange(): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  return { from: toLocalIsoDate(start), to: toLocalIsoDate(end) };
}

export function quarterRange(ref: Date = new Date()): { from: string; to: string } {
  const quarter = Math.floor(ref.getMonth() / 3);
  const from = new Date(ref.getFullYear(), quarter * 3, 1);
  const to = new Date(ref.getFullYear(), quarter * 3 + 3, 0);
  return { from: toLocalIsoDate(from), to: toLocalIsoDate(to) };
}

/** Presets période pour filtres Dashboard / Rapports (B5). */
export type PeriodPresetId =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'month'
  | 'prev_month'
  | 'quarter'
  | 'semestre'
  | 'year';

export interface PeriodPreset {
  id: PeriodPresetId;
  label: string;
}

export const PERIOD_PRESETS: PeriodPreset[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: '7d', label: '7 j' },
  { id: '30d', label: '30 j' },
  { id: '90d', label: '90 j' },
  { id: 'month', label: 'Mois' },
  { id: 'prev_month', label: 'Mois préc.' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'semestre', label: 'Semestre' },
  { id: 'year', label: 'Année' },
];

/** Semestre civil (S1 : jan–juin, S2 : juil–déc), borné à la date de référence. */
export function semestreRange(ref: Date = new Date()): { from: string; to: string } {
  const month = ref.getMonth();
  const from = new Date(ref.getFullYear(), month < 6 ? 0 : 6, 1);
  const semesterEnd = new Date(ref.getFullYear(), month < 6 ? 6 : 12, 0);
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const to = semesterEnd < today ? semesterEnd : today;
  return { from: toLocalIsoDate(from), to: toLocalIsoDate(to) };
}

export function periodPresetRange(id: PeriodPresetId, ref: Date = new Date()): { from: string; to: string } {
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  switch (id) {
    case 'today':
      return { from: toLocalIsoDate(today), to: toLocalIsoDate(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: toLocalIsoDate(y), to: toLocalIsoDate(y) };
    }
    case '7d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: toLocalIsoDate(from), to: toLocalIsoDate(today) };
    }
    case '30d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: toLocalIsoDate(from), to: toLocalIsoDate(today) };
    }
    case '90d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 89);
      return { from: toLocalIsoDate(from), to: toLocalIsoDate(today) };
    }
    case 'month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toLocalIsoDate(from), to: toLocalIsoDate(today) };
    }
    case 'prev_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toLocalIsoDate(from), to: toLocalIsoDate(to) };
    }
    case 'quarter':
      return quarterRange(today);
    case 'semestre':
      return semestreRange(today);
    case 'year': {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: toLocalIsoDate(from), to: toLocalIsoDate(today) };
    }
    default:
      return defaultReportRange();
  }
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toIsoDate(d: Date): string {
  return toLocalIsoDate(d);
}

/** Date locale YYYY-MM-DD (évite le décalage UTC de toISOString). */
export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Séparateur de milliers lisible (espace insécable large, jamais le fine space fr-FR). */
const THOUSANDS_SEP = '\u00A0';

export function formatNumberFr(n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('fr-FR', options)
    .format(n)
    .replace(/[\u202F\u00A0\u2009]/g, THOUSANDS_SEP);
}

/** Montant espacé (milliers) + devise. Les ID ne passent pas par ici. */
export function formatValeurFr(amount: number, currency?: string | null): string {
  const cur = String(currency || 'USD').trim().toUpperCase() || 'USD';
  const abs = Math.abs(amount);
  const opts: Intl.NumberFormatOptions =
    Number.isInteger(amount) || abs >= 100_000
      ? { maximumFractionDigits: abs >= 100_000 ? 0 : 2 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `${formatNumberFr(amount, opts)}${THOUSANDS_SEP}${cur}`;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: { key: string; label: string }[]): void {
  const header = columns.map((c) => c.label).join(';');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          const str = val == null ? '' : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(';')
    )
    .join('\n');
  const blob = new Blob(['\ufeff' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ExcelSheet {
  name: string;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string }[];
}

export interface ExcelBrandOptions {
  appName?: string;
  appShortName?: string;
  logoDataUrl?: string;
}

/** Logo Flash par défaut (SVG) si aucun logo configuré en admin. */
export const DEFAULT_FLASH_LOGO_DATA_URL = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" viewBox="0 0 320 96">
    <rect width="320" height="96" rx="10" fill="#FFD500"/>
    <text x="28" y="58" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="700" fill="#111111">FLASH</text>
    <text x="28" y="80" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="600" fill="#374151">OPERATION</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
})();

export function exportBrandFromSettings(settings: {
  app_name?: string;
  app_short_name?: string;
  logo_light?: string;
  logo_dark?: string;
}): ExcelBrandOptions {
  return resolveExportBrand({
    appName: settings.app_name,
    appShortName: settings.app_short_name,
    logoDataUrl: settings.logo_light || settings.logo_dark || '',
  });
}

function resolveExportBrand(partial?: ExcelBrandOptions): Required<ExcelBrandOptions> {
  return {
    appName: partial?.appName?.trim() || 'Flash Operation',
    appShortName: partial?.appShortName?.trim() || 'FLASH',
    logoDataUrl: resolveLogoSource(partial?.logoDataUrl),
  };
}

function resolveLogoSource(src?: string): string {
  const trimmed = src?.trim();
  if (trimmed) {
    if (trimmed.startsWith('data:') || /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (trimmed.startsWith('/') && typeof window !== 'undefined') {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }
  return DEFAULT_FLASH_LOGO_DATA_URL;
}

export interface ExcelExportOptions {
  filename: string;
  title?: string;
  subtitle?: string;
  brand?: ExcelBrandOptions;
  /** Filtres / contexte de recherche affichés sur la feuille Synthèse. */
  meta?: { label: string; value: string }[];
  kpis?: { label: string; value: string | number; note?: string }[];
  sheets: ExcelSheet[];
}

const EXCEL_BRAND = {
  yellow: 'FFFFD500',
  black: 'FF111111',
  gray: 'FF6B7280',
  grayLight: 'FFF3F4F6',
  white: 'FFFFFFFF',
};

/** Export multi-feuilles .xlsx (ExcelJS) — charte Flash, logo dynamique, feuilles selon résultats. */
export async function buildExcelBuffer(options: ExcelExportOptions): Promise<ArrayBuffer> {
  return writeBrandedExcel(options, false);
}

export interface ExcelPreviewSheet {
  name: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
  truncated: boolean;
}

/** Parse un .xlsx généré pour aperçu modal (limité aux N premières lignes de données). */
export async function parseExcelBufferPreview(
  buffer: ArrayBuffer,
  maxDataRows = 150
): Promise<ExcelPreviewSheet[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array' });
  const out: ExcelPreviewSheet[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (!grid.length) {
      out.push({ name, headers: [], rows: [], totalRows: 0, truncated: false });
      continue;
    }

    const normalized = grid.map((row) =>
      (Array.isArray(row) ? row : [row]).map((cell) => (cell == null ? '' : String(cell)))
    );
    const hasHeader = normalized.length > 1 && normalized[0].some((c) => c.trim() !== '');
    const headers = hasHeader ? normalized[0] : normalized[0].map((_, i) => `Col ${i + 1}`);
    const bodyStart = hasHeader ? 1 : 0;
    const body = normalized.slice(bodyStart);
    const totalRows = body.length;
    const previewBody = body.slice(0, maxDataRows);

    out.push({
      name,
      headers: headers.length ? headers : ['Contenu'],
      rows: previewBody,
      totalRows,
      truncated: totalRows > maxDataRows,
    });
  }

  return out;
}

export function downloadExcelBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  triggerBrowserDownload(url, name);
}

export async function exportExcel(filename: string, sheets: ExcelSheet[]): Promise<void>;
export async function exportExcel(options: ExcelExportOptions): Promise<void>;
export async function exportExcel(
  filenameOrOptions: string | ExcelExportOptions,
  sheets?: ExcelSheet[]
): Promise<void> {
  const options: ExcelExportOptions =
    typeof filenameOrOptions === 'string'
      ? { filename: filenameOrOptions, sheets: sheets ?? [] }
      : filenameOrOptions;
  await writeBrandedExcel(options, true);
}

async function loadExcelJSWorkbook(): Promise<InstanceType<ExcelJSWorkbookCtor>> {
  // Bundle navigateur — le package principal tire fs/stream (Node) et casse en prod Angular.
  const mod = await import('exceljs/dist/exceljs.min.js');
  const Workbook = (mod as ExcelJSBrowserModule).default?.Workbook ?? (mod as ExcelJSBrowserModule).Workbook;
  if (!Workbook) {
    throw new Error('ExcelJS Workbook indisponible dans le navigateur');
  }
  return new Workbook();
}

type ExcelJSWorkbookCtor = new () => {
  addWorksheet: (name: string, opts?: object) => ExcelJSWorksheet;
  addImage: (img: { base64: string; extension: string }) => number;
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
  creator: string;
  created: Date;
  modified: Date;
};

type ExcelJSWorksheet = {
  columns: unknown;
  mergeCells: (...args: unknown[]) => void;
  getRow: (n: number) => ExcelJSRow;
  addRow: (values: unknown[]) => ExcelJSRow;
  getCell: (addr: string) => { value: unknown };
  addImage: (id: number, opts: object) => void;
  getColumn: (n: number) => { width: number };
};

type ExcelJSRow = {
  height: number;
  getCell: (n: number) => ExcelJSCell;
  eachCell: (fn: (cell: ExcelJSCell) => void) => void;
};

type ExcelJSCell = {
  value: unknown;
  fill?: unknown;
  font?: unknown;
  border?: unknown;
  alignment?: unknown;
};

type ExcelJSBrowserModule = {
  default?: { Workbook?: ExcelJSWorkbookCtor };
  Workbook?: ExcelJSWorkbookCtor;
};

async function writeBrandedExcel(options: ExcelExportOptions, download: boolean): Promise<ArrayBuffer> {
  const workbook = await loadExcelJSWorkbook();
  const brand = resolveExportBrand(options.brand);
  workbook.creator = brand.appName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const brandName = brand.appName;
  const shortName = brand.appShortName;
  const logo = await resolveExcelLogo(brand.logoDataUrl);
  let logoId: number | undefined;
  if (logo) {
    logoId = workbook.addImage({ base64: logo.base64, extension: logo.extension });
  }

  const dataSheets = (options.sheets || []).filter((s) => s.rows?.length && s.columns?.length);
  const hasCover = !!(options.title || options.meta?.length || options.kpis?.length || options.brand);

  if (hasCover) {
    const cover = workbook.addWorksheet('Synthese', {
      properties: { defaultRowHeight: 18 },
      views: [{ showGridLines: false }],
    });
    cover.columns = [{ width: 28 }, { width: 48 }, { width: 18 }, { width: 18 }];

    // Charte Flash — bandeau jaune
    cover.mergeCells('A1:D1');
    const banner = cover.getRow(1);
    banner.height = 10;
    for (let c = 1; c <= 4; c++) {
      banner.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_BRAND.yellow } };
    }

    cover.getRow(2).height = 8;
    if (logoId != null) {
      cover.addImage(logoId, {
        tl: { col: 0.15, row: 1.35 },
        ext: { width: logo!.widthPx, height: logo!.heightPx },
      });
      cover.getRow(3).height = Math.max(36, logo!.heightPx * 0.75);
    }

    const titleRow = cover.getRow(4);
    titleRow.getCell(1).value = options.title || 'Export dashboard';
    titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: EXCEL_BRAND.black }, name: 'Calibri' };
    cover.mergeCells('A4:D4');

    const brandRow = cover.getRow(5);
    brandRow.getCell(1).value = `${brandName} · ${shortName}`;
    brandRow.getCell(1).font = { size: 11, color: { argb: EXCEL_BRAND.gray }, name: 'Calibri' };
    cover.mergeCells('A5:D5');

    if (options.subtitle) {
      const sub = cover.getRow(6);
      sub.getCell(1).value = options.subtitle;
      sub.getCell(1).font = { size: 11, color: { argb: EXCEL_BRAND.black }, name: 'Calibri' };
      cover.mergeCells('A6:D6');
    }

    let rowIdx = 8;
    cover.getRow(rowIdx).getCell(1).value = 'Contexte de recherche';
    cover.getRow(rowIdx).getCell(1).font = { bold: true, size: 12, color: { argb: EXCEL_BRAND.black } };
    rowIdx += 1;

    const metaRows = [
      ...(options.meta || []),
      { label: 'Généré le', value: new Date().toLocaleString('fr-FR') },
      { label: 'Feuilles données', value: String(dataSheets.length) },
    ];
    for (const m of metaRows) {
      const r = cover.getRow(rowIdx);
      r.getCell(1).value = m.label;
      r.getCell(1).font = { bold: true, color: { argb: EXCEL_BRAND.gray } };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_BRAND.grayLight } };
      r.getCell(2).value = m.value || '—';
      cover.mergeCells(rowIdx, 2, rowIdx, 4);
      rowIdx += 1;
    }

    if (options.kpis?.length) {
      rowIdx += 1;
      cover.getRow(rowIdx).getCell(1).value = 'Indicateurs clés';
      cover.getRow(rowIdx).getCell(1).font = { bold: true, size: 12 };
      rowIdx += 1;

      const header = cover.getRow(rowIdx);
      ['Indicateur', 'Valeur', 'Note'].forEach((label, i) => {
        const cell = header.getCell(i + 1);
        cell.value = label;
        styleExcelHeaderCell(cell);
      });
      rowIdx += 1;

      for (const kpi of options.kpis) {
        const r = cover.getRow(rowIdx);
        r.getCell(1).value = kpi.label;
        r.getCell(2).value = typeof kpi.value === 'number' ? kpi.value : String(kpi.value ?? '');
        r.getCell(3).value = kpi.note || '';
        for (let c = 1; c <= 3; c++) {
          r.getCell(c).border = thinExcelBorder();
        }
        rowIdx += 1;
      }
    }

    rowIdx += 1;
    cover.getRow(rowIdx).getCell(1).value = 'Feuilles incluses (résultats non vides)';
    cover.getRow(rowIdx).getCell(1).font = { bold: true, size: 12 };
    rowIdx += 1;
    for (const s of dataSheets) {
      cover.getRow(rowIdx).getCell(1).value = `• ${s.name}`;
      cover.getRow(rowIdx).getCell(2).value = `${s.rows.length} ligne(s)`;
      rowIdx += 1;
    }

    // Pied charte
    rowIdx += 2;
    const foot = cover.getRow(rowIdx);
    foot.getCell(1).value = `${brandName} — export confidentiel`;
    foot.getCell(1).font = { italic: true, size: 9, color: { argb: EXCEL_BRAND.gray } };
    cover.mergeCells(rowIdx, 1, rowIdx, 4);
  }

  const usedNames = new Set<string>(hasCover ? ['Synthese'] : []);
  for (const sheet of dataSheets) {
    const name = uniqueExcelSheetName(sheet.name, usedNames);
    usedNames.add(name);
    const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = sheet.columns.map((col) => ({
      header: col.label,
      key: col.key,
      width: Math.min(42, Math.max(12, col.label.length + 4)),
    }));

    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    sheet.columns.forEach((_, i) => styleExcelHeaderCell(headerRow.getCell(i + 1)));

    for (const row of sheet.rows) {
      const values = sheet.columns.map((c) => excelCellValue(row[c.key]));
      const excelRow = ws.addRow(values);
      excelRow.eachCell((cell) => {
        cell.border = thinExcelBorder();
        cell.font = { name: 'Calibri', size: 10 };
      });
    }

    // Auto-width light pass
    sheet.columns.forEach((col, i) => {
      let max = col.label.length;
      for (const row of sheet.rows.slice(0, 80)) {
        const v = row[col.key];
        const len = v == null ? 0 : String(v).length;
        if (len > max) max = len;
      }
      ws.getColumn(i + 1).width = Math.min(48, Math.max(12, max + 2));
    });
  }

  if (!hasCover && !dataSheets.length) {
    const empty = workbook.addWorksheet('Vide');
    empty.getCell('A1').value = 'Aucun résultat à exporter pour ces filtres.';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  if (download) {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const filename = options.filename.endsWith('.xlsx') ? options.filename : `${options.filename}.xlsx`;
    const url = URL.createObjectURL(blob);
    triggerBrowserDownload(url, filename);
  }
  return buffer as ArrayBuffer;
}

function triggerBrowserDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function styleExcelHeaderCell(cell: { value?: unknown; fill?: unknown; font?: unknown; border?: unknown; alignment?: unknown }): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_BRAND.yellow } };
  cell.font = { bold: true, color: { argb: EXCEL_BRAND.black }, name: 'Calibri', size: 11 };
  cell.border = thinExcelBorder();
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

function thinExcelBorder(): {
  top: { style: 'thin'; color: { argb: string } };
  left: { style: 'thin'; color: { argb: string } };
  bottom: { style: 'thin'; color: { argb: string } };
  right: { style: 'thin'; color: { argb: string } };
} {
  const edge = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function excelCellValue(val: unknown): string | number | boolean {
  if (val == null) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return val.join(', ');
  const s = String(val);
  return s.length > 32000 ? `${s.slice(0, 32000)}…` : s;
}

function uniqueExcelSheetName(raw: string, used: Set<string>): string {
  let base = raw.replace(/[:\\/?*\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Feuille';
  if (!used.has(base)) return base;
  let i = 2;
  while (i < 100) {
    const suffix = ` (${i})`;
    const name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!used.has(name)) return name;
    i += 1;
  }
  return `Feuille ${used.size + 1}`.slice(0, 31);
}

async function resolveExcelLogo(
  src?: string
): Promise<{ base64: string; extension: 'png' | 'jpeg'; widthPx: number; heightPx: number } | null> {
  const logoSrc = resolveLogoSource(src);
  try {
    let dataUrl = logoSrc;
    if (!dataUrl.startsWith('data:')) {
      const res = await fetch(dataUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
    const img = await loadImage(dataUrl);
    const srcW = Math.max(1, img.naturalWidth || 240);
    const srcH = Math.max(1, img.naturalHeight || 80);
    const scale = Math.min(1, 320 / srcW, 96 / srcH);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    const base64 = png.replace(/^data:image\/png;base64,/, '');
    return { base64, extension: 'png', widthPx: canvas.width, heightPx: canvas.height };
  } catch {
    return null;
  }
}

export interface PdfTableColumnStyle {
  cellWidth?: number;
  halign?: 'left' | 'center' | 'right';
  overflow?: 'linebreak' | 'ellipsize' | 'visible' | 'hidden';
}

export interface PdfSection {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  /** Overrides document table font size for this section. */
  tableFontSize?: number;
  /** Per-column layout (jspdf-autotable columnStyles). */
  columnStyles?: Record<number, PdfTableColumnStyle>;
}

export interface PdfBrandOptions {
  appName?: string;
  appShortName?: string;
  /** Prefer light logo (PDF on white). Data URL or http(s) URL. */
  logoDataUrl?: string;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  sections: PdfSection[];
  brand?: PdfBrandOptions;
  orientation?: 'portrait' | 'landscape';
  /** Default table body font size (pt). */
  tableFontSize?: number;
}

/** Flash OPS brand palette for PDF (matches styles.scss). */
const PDF_BRAND = {
  yellow: [255, 213, 0] as [number, number, number],
  black: [17, 17, 17] as [number, number, number],
  gray600: [107, 114, 128] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray50: [248, 249, 251] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

/** jsPDF Helvetica lacks many Unicode glyphs (NBSP→"/", arrow→"!"). */
function pdfSafeText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') return formatNumberPdf(value);
  return String(value)
    .replace(/[\u00a0\u202f\u2007\u2009\u200a\u2008]/g, ' ')
    .replace(/[\u2192\u2794\u27a1\u21d2\u00bb]/g, '->') // → ➔ ➡ ⇒ »
    .replace(/[\u2013\u2014]/g, '-') // en/em dash
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

/** French number formatting safe for embedded PDF fonts (space thousands, comma decimals). */
function formatNumberPdf(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  const decimals = Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9 ? 0 : 2;
  const fixed = abs.toFixed(decimals);
  const [intRaw, frac] = fixed.split('.');
  const withSpaces = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const signed = n < 0 ? `-${withSpaces}` : withSpaces;
  return frac != null ? `${signed},${frac}` : signed;
}

async function resolvePdfLogo(
  src?: string
): Promise<{ dataUrl: string; format: 'PNG'; widthMm: number; heightMm: number } | null> {
  const logoSrc = resolveLogoSource(src);
  try {
    let dataUrl = logoSrc;
    if (!dataUrl.startsWith('data:')) {
      const res = await fetch(dataUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }

    // Always rasterize to PNG so transparency / WEBP / SVG render cleanly on white.
    const img = await loadImage(dataUrl);
    const srcW = Math.max(1, img.naturalWidth || 240);
    const srcH = Math.max(1, img.naturalHeight || 80);
    const scale = Math.min(1, 480 / srcW, 160 / srcH);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const maxWmm = 38;
    const maxHmm = 14;
    const ratio = canvas.width / canvas.height;
    let widthMm = maxWmm;
    let heightMm = widthMm / ratio;
    if (heightMm > maxHmm) {
      heightMm = maxHmm;
      widthMm = heightMm * ratio;
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      format: 'PNG',
      widthMm,
      heightMm,
    };
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('logo load failed'));
    img.src = src;
  });
}

/** Synthèse PDF direction (jsPDF) — charte Flash + logo dynamique. */
export async function buildPdfBuffer(options: PdfExportOptions): Promise<ArrayBuffer> {
  const doc = await createPdfDocument(options);
  const bytes = doc.output('arraybuffer') as ArrayBuffer;
  return bytes;
}

export async function exportPdf(options: PdfExportOptions): Promise<void> {
  const doc = await createPdfDocument(options);
  const name = options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`;
  doc.save(name);
}

async function createPdfDocument(options: PdfExportOptions) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const orientation = options.orientation ?? 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = orientation === 'landscape' ? 297 : 210;
  const pageH = orientation === 'landscape' ? 210 : 297;
  const margin = 14;
  const contentBottom = pageH - 18;
  const footerTextY = pageH - 10;
  const footerBarY = pageH - 5;
  const defaultTableFontSize = options.tableFontSize ?? 8;
  const brand = resolveExportBrand(options.brand);
  const brandName = brand.appName;
  const shortName = brand.appShortName;
  const logo = await resolvePdfLogo(brand.logoDataUrl);

  const drawHeader = (pageIndex: number): number => {
    // Yellow brand bar
    doc.setFillColor(...PDF_BRAND.yellow);
    doc.rect(0, 0, pageW, 3.2, 'F');

    let y = 11;
    let textX = margin;

    const drawFallbackMark = () => {
      doc.setFillColor(...PDF_BRAND.black);
      doc.roundedRect(margin, y, 18, 11, 1.5, 1.5, 'F');
      doc.setTextColor(...PDF_BRAND.yellow);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(shortName.slice(0, 6).toUpperCase(), margin + 9, y + 7, { align: 'center' });
      textX = margin + 22;
    };

    if (logo) {
      try {
        doc.addImage(logo.dataUrl, logo.format, margin, y, logo.widthMm, logo.heightMm, undefined, 'FAST');
        textX = margin + logo.widthMm + 5;
      } catch {
        drawFallbackMark();
      }
    } else {
      drawFallbackMark();
    }

    const logoBlockH = logo?.heightMm ?? 11;
    const titleY = y + logoBlockH / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...PDF_BRAND.black);
    doc.text(options.title, textX, titleY - 1.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.gray600);
    doc.text(brandName, textX, titleY + 4);

    y = Math.max(y + logoBlockH, titleY + 6) + 5;
    if (options.subtitle && pageIndex === 1) {
      doc.setFontSize(9);
      doc.setTextColor(...PDF_BRAND.gray600);
      doc.text(pdfSafeText(options.subtitle), margin, y);
      y += 5;
    }

    doc.setDrawColor(...PDF_BRAND.gray200);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    // Yellow accent under the rule
    doc.setDrawColor(...PDF_BRAND.yellow);
    doc.setLineWidth(1.1);
    doc.line(margin, y + 0.8, margin + 28, y + 0.8);
    return y + 8;
  };

  let y = drawHeader(1);

  for (const section of options.sections) {
    if (y > contentBottom) {
      doc.addPage();
      y = drawHeader(doc.getNumberOfPages());
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PDF_BRAND.black);
    doc.text(section.title, margin, y);
    // Small yellow tick before section title area
    doc.setFillColor(...PDF_BRAND.yellow);
    doc.rect(margin - 3.5, y - 3.2, 1.6, 4.2, 'F');
    y += 3;

    const head = [section.columns.map((c) => c.label)];
    const body = section.rows.map((row) =>
      section.columns.map((c) => pdfSafeText(row[c.key]))
    );

    const tableFontSize = section.tableFontSize ?? defaultTableFontSize;
    autoTable(doc, {
      startY: y,
      head,
      body: body.length ? body : [['—', ...section.columns.slice(1).map(() => '')]],
      margin: { left: margin, right: margin },
      styles: {
        fontSize: tableFontSize,
        cellPadding: 1.8,
        textColor: PDF_BRAND.black,
        lineColor: PDF_BRAND.gray200,
        lineWidth: 0.1,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: PDF_BRAND.black,
        textColor: PDF_BRAND.yellow,
        fontStyle: 'bold',
        fontSize: tableFontSize,
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: PDF_BRAND.gray50 },
      columnStyles: section.columnStyles,
      tableWidth: section.columnStyles ? pageW - margin * 2 : 'auto',
      showHead: 'everyPage',
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y = finalY + 10;
  }

  const stamp = new Date().toLocaleString('fr-FR');
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...PDF_BRAND.yellow);
    doc.rect(0, footerBarY, pageW, 5, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_BRAND.gray600);
    doc.text(`${brandName} · ${stamp}`, margin, footerTextY);
    doc.setTextColor(...PDF_BRAND.black);
    doc.text(`${i} / ${pageCount}`, pageW - margin, footerTextY, { align: 'right' });
  }

  return doc;
}

/** Encode ArrayBuffer as base64 for API upload. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Libellé direction métier à partir du code opération (pas de nouvelle dimension DB). */
export function operationDirectionLabel(code: string, label: string): string {
  switch ((code || '').toUpperCase()) {
    case 'ENVOIE':
    case 'ENVOI':
      return `Outbound — ${label}`;
    case 'RETRAIT':
      return `Inbound — ${label}`;
    default:
      return label;
  }
}

/** Affiche le nom court en premier lorsqu'il est renseigné. */
export function formatAgencyLabel(agency: {
  name?: string | null;
  short_name?: string | null;
  code_agence?: string | null;
}, opts?: { includeCode?: boolean }): string {
  const name = String(agency.name || '').trim();
  const short = String(agency.short_name || '').trim();
  const label = short ? `${short} — ${name}` : name;
  const code = String(agency.code_agence || '').trim();
  if (opts?.includeCode && code) {
    return `${code} — ${label}`;
  }
  return label;
}
