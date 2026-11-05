import { PublicAgenceGeo } from '../../core/models/public-agences.models';

const YELLOW = 'FFFFD500';
const BLACK = 'FF111111';
const GRAY = 'FF6B7280';
const ZEBRAS = 'FFF8F5E6';

const HEADERS = ['Nom', 'Code', 'Adresse', 'Latitude', 'Longitude'] as const;

export interface AgencesGeoExcelInput {
  filename: string;
  title: string;
  subtitle: string;
  agencies: PublicAgenceGeo[];
  logoUrl: string;
  appName: string;
  faviconUrl: string;
}

export async function buildAgencesGeoExcel(input: AgencesGeoExcelInput): Promise<ArrayBuffer> {
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

  const logo = await loadLogo(input.logoUrl);
  const logoId = logo ? workbook.addImage({ base64: logo.base64, extension: 'png' }) : undefined;
  const signature = await buildSignature(input.appName, input.faviconUrl);
  const signatureId = signature
    ? workbook.addImage({ base64: signature.base64, extension: 'png' })
    : undefined;

  const ws = workbook.addWorksheet('Agences', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 7 }],
  });
  paintBanner(ws, HEADERS.length, logoId, logo, input.title, input.subtitle);
  writeHeader(ws, 7, [...HEADERS]);

  input.agencies.forEach((row, index) => {
    const excelRow = ws.getRow(8 + index);
    const values: (string | number)[] = [
      row.nom || '—',
      row.code || '—',
      row.adresse || '—',
      Number(row.latitude),
      Number(row.longitude),
    ];
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      styleBody(cell, index);
      if (i >= 3) {
        cell.numFmt = '0.000000';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
    excelRow.height = 18;
  });

  setWidths(ws, [36, 16, 44, 14, 14]);
  ws.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7, column: HEADERS.length },
  };

  const generated = new Date().toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const foot = 8 + input.agencies.length + 1;
  footer(
    ws,
    foot,
    HEADERS.length,
    `${input.agencies.length} agence${input.agencies.length > 1 ? 's' : ''} · ${generated}`
  );
  placeSignature(ws, foot + 2, signatureId, signature, input.appName);

  return workbook.xlsx.writeBuffer();
}

function paintBanner(
  ws: ExcelSheet,
  columns: number,
  logoId: number | undefined,
  logo: Logo | null,
  title: string,
  subtitle: string
): void {
  ws.mergeCells(1, 1, 1, columns);
  const band = ws.getRow(1);
  band.height = 8;
  for (let c = 1; c <= columns; c++) band.getCell(c).fill = solid(YELLOW);
  if (logoId != null && logo) {
    ws.addImage(logoId, {
      tl: { col: 0.15, row: 1.2 },
      ext: { width: logo.width, height: logo.height },
    });
  }
  ws.getRow(2).height = 18;
  ws.getRow(3).height = logo ? 28 : 18;
  const titleRow = ws.getRow(4);
  titleRow.height = 24;
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { name: 'Calibri', bold: true, size: 16, color: { argb: BLACK } };
  ws.mergeCells(4, 1, 4, columns);
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
  row.getCell(1).value = `Fiche générée par le logiciel : ${(appName || 'Flash OPS').trim()}`;
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
  if (!url) return null;
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
  autoFilter?: object;
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
