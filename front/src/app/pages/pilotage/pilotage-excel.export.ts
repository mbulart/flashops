import { Chart, ChartConfiguration } from 'chart.js';
import {
  PilotageAgenceRank,
  PilotageBundle,
  PilotageLigneExport,
} from '../../core/models/pilotage.models';
import { aggregatePilotageTimeseries } from './pilotage-charts.util';

const YELLOW = 'FFFFD500';
const BLACK = 'FF111111';
const GRAY = 'FF6B7280';
const WHITE = 'FFFFFFFF';
const ZEBRAS = 'FFF8F5E6';
const GROUP = 'FFFFF4CC';

export interface PilotageExcelInput {
  filename: string;
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  bundle: PilotageBundle;
  agencies: PilotageAgenceRank[];
  lignes: PilotageLigneExport[];
  lignesTronquees: boolean;
  lignesLimite: number;
  logoUrl: string;
  appName: string;
  faviconUrl: string;
}

export async function downloadPilotageExcel(
  input: PilotageExcelInput,
  onProgress?: (percent: number) => void
): Promise<void> {
  const mod = await import('exceljs/dist/exceljs.min.js');
  const Workbook = (mod as { default?: { Workbook?: new () => ExcelBook }; Workbook?: new () => ExcelBook })
    .default?.Workbook ?? (mod as { Workbook?: new () => ExcelBook }).Workbook;
  if (!Workbook) {
    throw new Error('Excel indisponible');
  }
  const workbook = new Workbook();
  workbook.creator = 'Flash OPS';
  workbook.created = new Date();
  onProgress?.(86);
  const logo = await loadLogo(input.logoUrl);
  const logoId = logo ? workbook.addImage({ base64: logo.base64, extension: 'png' }) : undefined;
  const signature = await buildSignature(input.appName, input.faviconUrl);
  const signatureId = signature
    ? workbook.addImage({ base64: signature.base64, extension: 'png' })
    : undefined;

  writeAgencesSheet(workbook, input, logoId, logo, signatureId, signature);
  onProgress?.(91);
  writeTransactionsSheet(workbook, input, logoId, logo, signatureId, signature);
  onProgress?.(94);
  await writeAnalysesSheet(workbook, input, logoId, logo, signatureId, signature);
  onProgress?.(98);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = input.filename.endsWith('.xlsx') ? input.filename : `${input.filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  onProgress?.(100);
}

function writeAgencesSheet(
  workbook: ExcelBook,
  input: PilotageExcelInput,
  logoId: number | undefined,
  logo: Logo | null,
  signatureId: number | undefined,
  signature: Logo | null
): void {
  const ws = workbook.addWorksheet('Agences', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 7 }],
  });
  const total = input.agencies.reduce((sum, row) => sum + (Number(row.montant) || 0), 0);
  paintBanner(ws, 14, logoId, logo, input.title, input.subtitle);
  const headerRow = 7;
  const headers = [
    '#',
    'Agence',
    'Code',
    'POS',
    'Catégorie',
    'Région',
    'Zone',
    'Volume',
    'Montant',
    'Commission',
    'Commission FCN',
    'Commission agent',
    'Commission FCN agent',
    'Part',
  ];
  writeHeader(ws, headerRow, headers);
  input.agencies.forEach((row, index) => {
    const excelRow = ws.getRow(headerRow + 1 + index);
    const part = total > 0 ? (Number(row.montant) || 0) / total : 0;
    const values = [
      index + 1,
      row.nom || row.codeAgence || '—',
      row.codeAgence,
      row.posId || '—',
      row.categorie || '—',
      row.region || '—',
      row.zone || '—',
      Number(row.volume) || 0,
      Number(row.montant) || 0,
      Number(row.commission) || 0,
      Number(row.commissionFcn) || 0,
      Number(row.commissionAgent) || 0,
      Number(row.commissionFcnAgent) || 0,
      part,
    ];
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      styleBody(cell, index);
      if (i === 7) cell.numFmt = '#,##0';
      if (i >= 8 && i <= 12) cell.numFmt = '#,##0.00';
      if (i === 13) cell.numFmt = '0.0%';
      if (i === 0 || i >= 7) cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    excelRow.height = 18;
  });
  setWidths(ws, [8, 34, 16, 16, 16, 18, 18, 14, 18, 16, 16, 18, 20, 12]);
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: headers.length } };
  const foot = headerRow + input.agencies.length + 2;
  footer(ws, foot, headers.length, `${input.agencies.length} agence(s) · ${input.bundle.devise}`);
  placeSignature(ws, foot + 2, signatureId, signature, input.appName);
}

function writeTransactionsSheet(
  workbook: ExcelBook,
  input: PilotageExcelInput,
  logoId: number | undefined,
  logo: Logo | null,
  signatureId: number | undefined,
  signature: Logo | null
): void {
  const ws = workbook.addWorksheet('Transactions', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 7 }],
  });
  const note = input.lignesTronquees
    ? `${input.subtitle} · extrait des ${input.lignesLimite.toLocaleString('fr-FR')} premières lignes`
    : input.subtitle;
  paintBanner(ws, 10, logoId, logo, input.title, note);
  const headers = [
    'Agence',
    'Code',
    'POS',
    'N° opération',
    'Nom',
    'Téléphone',
    'Téléphone expéditeur',
    'Date',
    'Montant',
    'Statut',
  ];
  const headerRow = 7;
  writeHeader(ws, headerRow, headers);
  const counts = new Map<string, number>();
  for (const line of input.lignes) {
    const key = `${line.codeAgence}|${line.agence}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let cursor = headerRow + 1;
  let current = '';
  for (const line of input.lignes) {
    const key = `${line.codeAgence}|${line.agence}`;
    if (key !== current) {
      current = key;
      const group = ws.getRow(cursor);
      const count = counts.get(key) ?? 0;
      const pos = (line.posId || '').trim();
      const identity = [line.agence || 'Agence', line.codeAgence, pos].filter(Boolean).join(' · ');
      group.getCell(1).value = `${identity} · ${count} opération(s)`;
      ws.mergeCells(cursor, 1, cursor, headers.length);
      for (let c = 1; c <= headers.length; c++) {
        const cell = group.getCell(c);
        cell.fill = solid(GROUP);
        cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: BLACK } };
        cell.alignment = { vertical: 'middle' };
      }
      group.height = 20;
      cursor += 1;
    }
    const nom = displayName(line);
    const values = [
      line.agence,
      line.codeAgence,
      line.posId,
      line.numero,
      nom,
      line.telephone,
      line.telephoneExpediteur,
      line.jour,
      Number(line.montant) || 0,
      line.statut,
    ];
    const excelRow = ws.getRow(cursor);
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      styleBody(cell, cursor);
      if (i === 8) cell.numFmt = '#,##0.00';
    });
    excelRow.height = 18;
    cursor += 1;
  }
  setWidths(ws, [28, 14, 16, 22, 32, 18, 22, 14, 16, 14]);
  footer(ws, cursor + 1, headers.length, 'Lignes regroupées par agence');
  placeSignature(ws, cursor + 3, signatureId, signature, input.appName);
}

async function writeAnalysesSheet(
  workbook: ExcelBook,
  input: PilotageExcelInput,
  logoId: number | undefined,
  logo: Logo | null,
  signatureId: number | undefined,
  signature: Logo | null
): Promise<void> {
  const ws = workbook.addWorksheet('Analyses', {
    views: [{ showGridLines: false }],
  });
  paintBanner(ws, 6, logoId, logo, input.title, 'Analyses du périmètre filtré');
  let row = 7;
  ws.getRow(row).getCell(1).value = 'Périmètre';
  ws.getRow(row).getCell(1).font = { name: 'Calibri', bold: true, size: 13, color: { argb: BLACK } };
  row += 1;
  for (const item of input.meta) {
    const line = ws.getRow(row);
    line.getCell(1).value = item.label;
    line.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: GRAY } };
    line.getCell(1).fill = solid('FFF3F4F6');
    line.getCell(2).value = item.value;
    line.getCell(2).font = { name: 'Calibri', size: 11 };
    ws.mergeCells(row, 2, row, 4);
    row += 1;
  }

  row += 1;
  ws.getRow(row).getCell(1).value = 'Indicateurs';
  ws.getRow(row).getCell(1).font = { name: 'Calibri', bold: true, size: 13 };
  row += 1;
  writeHeader(ws, row, ['Indicateur', 'Valeur']);
  const k = input.bundle.kpis;
  const kpis: Array<[string, string | number]> = [
    ['Volume', k.volume],
    ['Montant', k.montant],
    ['Commission', k.commission ?? 0],
    ['Commission FCN', k.commissionFcn ?? 0],
    ['Commission agent', k.commissionAgent ?? 0],
    ['Commission FCN agent', k.commissionFcnAgent ?? 0],
    ['Ticket moyen', k.ticketMoyen],
    ['Succès', k.volumeSucces],
    ['MoM montant', k.momMontantPct == null ? '—' : k.momMontantPct / 100],
    ['YoY montant', k.yoyMontantPct == null ? '—' : k.yoyMontantPct / 100],
  ];
  kpis.forEach((kpi, index) => {
    const excelRow = ws.getRow(row + 1 + index);
    excelRow.getCell(1).value = kpi[0];
    excelRow.getCell(2).value = kpi[1];
    styleBody(excelRow.getCell(1), index);
    styleBody(excelRow.getCell(2), index);
    if (
      kpi[0] === 'Montant' ||
      kpi[0] === 'Ticket moyen' ||
      kpi[0].startsWith('Commission')
    ) {
      excelRow.getCell(2).numFmt = '#,##0.00';
    }
    if (kpi[0] === 'Volume' || kpi[0] === 'Succès') excelRow.getCell(2).numFmt = '#,##0';
    if (kpi[0].startsWith('MoM') || kpi[0].startsWith('YoY')) {
      if (typeof kpi[1] === 'number') excelRow.getCell(2).numFmt = '+0.0%;-0.0%;0%';
    }
  });
  row += kpis.length + 2;

  const series = aggregatePilotageTimeseries(
    input.bundle.timeseries ?? [],
    (input.bundle.timeseries?.length ?? 0) > 45 ? 'week' : 'day'
  );
  const seriesPng = await chartToPng({
    type: 'line',
    data: {
      labels: series.map((point) => point.jour),
      datasets: [
        {
          label: `Montant ${input.bundle.devise}`,
          data: series.map((point) => Number(point.montant) || 0),
          borderColor: '#111111',
          backgroundColor: 'rgba(255, 213, 0, 0.35)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
        },
      ],
    },
    options: { animation: false, responsive: false, plugins: { legend: { display: false } } },
  });
  ws.getRow(row).getCell(1).value = 'Évolution du montant';
  ws.getRow(row).getCell(1).font = { name: 'Calibri', bold: true, size: 13 };
  row += 1;
  const seriesImage = workbook.addImage({ base64: seriesPng, extension: 'png' });
  ws.addImage(seriesImage, { tl: { col: 0, row: row - 1 }, ext: { width: 720, height: 280 } });
  row += 16;

  const products = (input.bundle.products ?? []).slice(0, 8);
  const productPng = await chartToPng({
    type: 'bar',
    data: {
      labels: products.map((product) => product.produit || product.module),
      datasets: [
        {
          label: 'Montant',
          data: products.map((product) => Number(product.montant) || 0),
          backgroundColor: '#FFD500',
          borderColor: '#111111',
          borderWidth: 1,
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
    },
  });
  ws.getRow(row).getCell(1).value = 'Répartition produits';
  ws.getRow(row).getCell(1).font = { name: 'Calibri', bold: true, size: 13 };
  row += 1;
  const productImage = workbook.addImage({ base64: productPng, extension: 'png' });
  ws.addImage(productImage, { tl: { col: 0, row: row - 1 }, ext: { width: 720, height: 300 } });
  row += 17;

  writeHeader(ws, row, ['Produit', 'Volume', 'Montant']);
  products.forEach((product, index) => {
    const excelRow = ws.getRow(row + 1 + index);
    const values = [
      [product.module, product.produit, product.ecran].filter(Boolean).join(' · '),
      Number(product.volume) || 0,
      Number(product.montant) || 0,
    ];
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      styleBody(cell, index);
      if (i === 1) cell.numFmt = '#,##0';
      if (i === 2) cell.numFmt = '#,##0.00';
    });
  });
  setWidths(ws, [42, 28, 18, 18, 18, 18]);
  const foot = row + products.length + 3;
  footer(ws, foot, 6, 'export confidentiel');
  placeSignature(ws, foot + 2, signatureId, signature, input.appName);
}

function displayName(line: PilotageLigneExport): string {
  const parts = [line.expediteur, line.beneficiaire].map((value) => (value || '').trim()).filter(Boolean);
  if (parts.length) return parts.join(' / ');
  return line.nom || '';
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

async function chartToPng(config: ChartConfiguration): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 460;
  const chart = new Chart(canvas, config);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const png = canvas.toDataURL('image/png');
  chart.destroy();
  return png.replace(/^data:image\/png;base64,/, '');
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
