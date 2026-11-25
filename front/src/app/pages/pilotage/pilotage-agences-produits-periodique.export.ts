import {
  PilotageAgenceProduitPeriodeBucket,
  PilotageAgenceProduitRank,
} from '../../core/models/pilotage.models';
import { PilotageReportIdentity } from './pilotage-report-identity';

const YELLOW = 'FFFFD500';
const BLACK = 'FF111111';
const GRAY = 'FF6B7280';
const WHITE = 'FFFFFFFF';
const ZEBRAS = 'FFF8F5E6';
const TOTAL_BG = 'FFFFE08A';

export interface PilotageAgencesProduitsPeriodiqueExcelInput {
  identity: PilotageReportIdentity;
  from: string;
  to: string;
  devise: string;
  periods: PilotageAgenceProduitPeriodeBucket[];
  logoUrl: string;
  appName: string;
  faviconUrl: string;
}

export async function downloadPilotageAgencesProduitsPeriodiqueExcel(
  input: PilotageAgencesProduitsPeriodiqueExcelInput,
  onProgress?: (percent: number) => void
): Promise<void> {
  const mod = await import('exceljs/dist/exceljs.min.js');
  const Workbook =
    (mod as { default?: { Workbook?: new () => ExcelBook }; Workbook?: new () => ExcelBook }).default
      ?.Workbook ?? (mod as { Workbook?: new () => ExcelBook }).Workbook;
  if (!Workbook) {
    throw new Error('Excel indisponible');
  }
  const workbook = new Workbook();
  workbook.creator = input.appName || 'Flash OPS';
  workbook.created = new Date();
  onProgress?.(86);

  const logo = await loadLogo(input.logoUrl);
  const logoId = logo ? workbook.addImage({ base64: logo.base64, extension: 'png' }) : undefined;
  const signature = await buildSignature(input.appName, input.faviconUrl);
  const signatureId = signature
    ? workbook.addImage({ base64: signature.base64, extension: 'png' })
    : undefined;

  const usedNames = new Set<string>();
  const periods = [...input.periods].sort((a, b) =>
    (a.periodeDebut || a.periode).localeCompare(b.periodeDebut || b.periode)
  );
  if (!periods.length) {
    writeMonthSheet(
      workbook,
      input,
      {
        periode: '',
        label: 'Sans données',
        periodeDebut: input.from,
        periodeFin: input.to,
        volume: 0,
        montant: 0,
        commission: 0,
        commissionFcn: 0,
        commissionAgent: 0,
        commissionFcnAgent: 0,
        rows: [],
      },
      'Sans données',
      logoId,
      logo,
      signatureId,
      signature
    );
  } else {
    const total = periods.length;
    periods.forEach((period, index) => {
      const sheetName = uniqueSheetName(sheetNameForPeriod(period), usedNames);
      writeMonthSheet(workbook, input, period, sheetName, logoId, logo, signatureId, signature);
      onProgress?.(86 + Math.round(((index + 1) / total) * 12));
    });
  }
  onProgress?.(98);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = input.identity.filename.endsWith('.xlsx')
    ? input.identity.filename
    : `${input.identity.filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  onProgress?.(100);
}

function writeMonthSheet(
  workbook: ExcelBook,
  input: PilotageAgencesProduitsPeriodiqueExcelInput,
  period: PilotageAgenceProduitPeriodeBucket,
  sheetName: string,
  logoId: number | undefined,
  logo: Logo | null,
  signatureId: number | undefined,
  signature: Logo | null
): void {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 7 }],
  });
  const headers = [
    '#',
    'Agence',
    'Code',
    'POS',
    'Catégorie',
    'Région',
    'Zone',
    'Produit',
    'Volume',
    'Montant',
    'Commission',
    'Commission FCN',
    'Commission agent',
    'Commission FCN agent',
  ];
  paintBanner(ws, headers.length, logoId, logo, input.identity.title, input.identity.subtitle);
  const headerRow = 7;
  writeHeader(ws, headerRow, headers);

  let cursor = headerRow + 1;
  period.rows.forEach((row, index) => {
    cursor = writeDataRow(ws, cursor, row, index + 1, index);
  });
  cursor = writePeriodTotal(ws, cursor, period);

  setWidths(ws, [8, 34, 16, 16, 16, 18, 18, 22, 14, 18, 16, 16, 18, 20]);
  footer(
    ws,
    cursor + 2,
    headers.length,
    `${period.rows.length} ligne(s) · ${input.devise}`
  );
  placeSignature(ws, cursor + 4, signatureId, signature, input.appName);
}

function sheetNameForPeriod(period: PilotageAgenceProduitPeriodeBucket): string {
  const label = (period.label || period.periode || 'Mois').trim();
  return sanitizeSheetName(label || period.periode || 'Mois');
}

function sanitizeSheetName(raw: string): string {
  const cleaned = raw.replace(/[\\/*?:\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || 'Mois').slice(0, 31);
}

function uniqueSheetName(base: string, used: Set<string>): string {
  let name = base.slice(0, 31);
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  for (let i = 2; i < 1000; i++) {
    const suffix = ` (${i})`;
    name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase());
      return name;
    }
  }
  const fallback = `Mois ${used.size + 1}`.slice(0, 31);
  used.add(fallback.toLowerCase());
  return fallback;
}

function writeDataRow(
  ws: ExcelSheet,
  rowNumber: number,
  row: PilotageAgenceProduitRank,
  rank: number,
  zebra: number
): number {
  const excelRow = ws.getRow(rowNumber);
  const values: unknown[] = [
    rank,
    row.nom || row.codeAgence || '—',
    row.codeAgence,
    row.posId || '—',
    row.categorie || '—',
    row.region || '—',
    row.zone || '—',
    row.produit || '—',
    Number(row.volume) || 0,
    Number(row.montant) || 0,
    Number(row.commission) || 0,
    Number(row.commissionFcn) || 0,
    Number(row.commissionAgent) || 0,
    Number(row.commissionFcnAgent) || 0,
  ];
  values.forEach((value, i) => {
    const cell = excelRow.getCell(i + 1);
    cell.value = value;
    styleBody(cell, zebra);
    if (i === 8) cell.numFmt = '#,##0';
    if (i >= 9 && i <= 13) cell.numFmt = '#,##0.00';
    if (i === 0 || i >= 8) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  excelRow.height = 18;
  return rowNumber + 1;
}

function writePeriodTotal(
  ws: ExcelSheet,
  rowNumber: number,
  period: PilotageAgenceProduitPeriodeBucket
): number {
  const row = ws.getRow(rowNumber);
  const values: unknown[] = [
    '',
    `Total ${period.label}`,
    '',
    '',
    '',
    '',
    '',
    '',
    Number(period.volume) || 0,
    Number(period.montant) || 0,
    Number(period.commission) || 0,
    Number(period.commissionFcn) || 0,
    Number(period.commissionAgent) || 0,
    Number(period.commissionFcnAgent) || 0,
  ];
  values.forEach((value, i) => {
    const cell = row.getCell(i + 1);
    cell.value = value;
    cell.fill = solid(TOTAL_BG);
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: BLACK } };
    cell.border = border();
    cell.alignment = { vertical: 'middle' };
    if (i === 8) cell.numFmt = '#,##0';
    if (i >= 9 && i <= 13) cell.numFmt = '#,##0.00';
    if (i === 0 || i >= 8) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  row.height = 18;
  return rowNumber + 1;
}

function paintBanner(
  ws: ExcelSheet,
  columns: number,
  logoId: number | undefined,
  logo: Logo | null,
  title: string,
  subtitle: string
): void {
  ws.getRow(1).height = 10;
  ws.getRow(2).height = 28;
  ws.getRow(3).height = 18;
  ws.getRow(4).height = 8;
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= columns; c++) {
      ws.getRow(r).getCell(c).fill = solid(WHITE);
    }
  }
  if (logoId != null && logo) {
    ws.addImage(logoId, {
      tl: { col: 0.1, row: 0.35 },
      ext: { width: logo.width, height: logo.height },
    });
  }
  const titleRow = ws.getRow(3);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { name: 'Calibri', bold: true, size: 16, color: { argb: BLACK } };
  ws.mergeCells(3, 1, 3, columns);
  const sub = ws.getRow(5);
  sub.getCell(1).value = subtitle;
  sub.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: GRAY } };
  ws.mergeCells(5, 1, 5, columns);
  ws.getRow(6).height = 8;
}

function writeHeader(ws: ExcelSheet, rowNumber: number, headers: string[]): void {
  const row = ws.getRow(rowNumber);
  row.height = 22;
  headers.forEach((label, index) => {
    const cell = row.getCell(index + 1);
    cell.value = label;
    cell.fill = solid(YELLOW);
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: BLACK } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = border();
  });
}

function styleBody(cell: ExcelCell, index: number): void {
  cell.font = { name: 'Calibri', size: 10, color: { argb: BLACK } };
  cell.border = border();
  cell.alignment = { vertical: 'middle' };
  if (index % 2 === 1) cell.fill = solid(ZEBRAS);
}

function footer(ws: ExcelSheet, rowNumber: number, columns: number, text: string): void {
  const row = ws.getRow(rowNumber);
  row.getCell(1).value = text;
  row.getCell(1).font = { name: 'Calibri', italic: true, size: 9, color: { argb: GRAY } };
  ws.mergeCells(rowNumber, 1, rowNumber, columns);
}

function placeSignature(
  ws: ExcelSheet,
  rowNumber: number,
  signatureId: number | undefined,
  signature: Logo | null,
  appName: string
): void {
  const row = ws.getRow(rowNumber);
  row.height = 24;
  if (signatureId != null && signature) {
    ws.addImage(signatureId, {
      tl: { col: 0.05, row: rowNumber - 1 + 0.08 },
      ext: { width: signature.width, height: signature.height },
    });
    return;
  }
  const name = (appName || 'Flash OPS').trim();
  row.getCell(1).value = `Fiche générée par le logiciel : ${name}`;
  row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: GRAY } };
}

async function buildSignature(appName: string, faviconUrl: string): Promise<Logo | null> {
  const name = (appName || 'Flash OPS').trim();
  const prefix = 'Fiche générée par le logiciel : ';
  const iconSize = 18;
  const gap = 6;
  const font = '14px Calibri, Segoe UI, sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = font;
  const prefixW = Math.ceil(measure.measureText(prefix).width);
  const nameW = Math.ceil(measure.measureText(name).width);
  const width = prefixW + gap + iconSize + gap + nameW + 2;
  const height = 22;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = '#6b7280';
  ctx.textBaseline = 'middle';
  ctx.fillText(prefix, 0, height / 2 + 0.5);
  const icon = faviconUrl ? await loadImage(faviconUrl) : null;
  if (icon) {
    ctx.drawImage(icon, prefixW + gap, (height - iconSize) / 2, iconSize, iconSize);
  }
  ctx.fillStyle = '#6b7280';
  ctx.fillText(name, prefixW + gap + iconSize + gap, height / 2 + 0.5);
  try {
    return {
      base64: canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
      width,
      height,
    };
  } catch {
    return null;
  }
}

function setWidths(ws: ExcelSheet, widths: number[]): void {
  widths.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
}

function solid(argb: string): { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } } {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function border(): ExcelCell['border'] {
  const edge = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadLogo(url: string): Promise<Logo | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('logo'));
      img.src = dataUrl;
    });
    const scale = Math.min(1, 168 / image.width, 56 / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      base64: canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

interface Logo {
  base64: string;
  width: number;
  height: number;
}

interface ExcelBook {
  creator: string;
  created: Date;
  addWorksheet: (name: string, opts?: object) => ExcelSheet;
  addImage: (img: { base64: string; extension: 'png' }) => number;
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
}

interface ExcelSheet {
  mergeCells: (...args: number[]) => void;
  getRow: (n: number) => ExcelRow;
  getColumn: (n: number) => { width: number };
  addImage: (id: number, opts: object) => void;
}

interface ExcelRow {
  height: number;
  getCell: (n: number) => ExcelCell;
}

interface ExcelCell {
  value: unknown;
  font?: unknown;
  fill?: unknown;
  border?: unknown;
  alignment?: unknown;
  numFmt?: string;
}
