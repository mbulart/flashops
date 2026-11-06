import { Chart, ChartConfiguration } from 'chart.js';
import { PilotageProductMonthlyRow } from '../../core/models/pilotage.models';
import { PilotageReportIdentity, PilotageReportMeta } from './pilotage-report-identity';

const YELLOW = 'FFFFD500';
const BLACK = 'FF111111';
const GRAY = 'FF6B7280';
const WHITE = 'FFFFFFFF';
const ZEBRAS = 'FFF8F5E6';
const TOTAL_BG = 'FFFFF4CC';
const MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export interface PilotageProduitsMensuelExcelInput {
  identity: PilotageReportIdentity;
  from: string;
  to: string;
  devise: string;
  rows: PilotageProductMonthlyRow[];
  logoUrl: string;
  appName: string;
  faviconUrl: string;
}

interface ProductAgg {
  key: string;
  label: string;
  module: string;
  produit: string;
  ecran: string;
  partenaire: string;
  byMonth: Map<string, { volume: number; montant: number }>;
  volume: number;
  montant: number;
}

export async function downloadPilotageProduitsMensuelExcel(
  input: PilotageProduitsMensuelExcelInput,
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

  const months = monthsBetween(input.from, input.to);
  const products = aggregateProducts(input.rows);
  const monthTotals = months.map((mois) => {
    let volume = 0;
    let montant = 0;
    for (const product of products) {
      const cell = product.byMonth.get(mois);
      volume += cell?.volume ?? 0;
      montant += cell?.montant ?? 0;
    }
    return { mois, volume, montant };
  });

  await writeSyntheseSheet(
    workbook,
    input,
    products,
    months,
    monthTotals,
    logoId,
    logo,
    signatureId,
    signature
  );
  onProgress?.(91);
  writeMatrixSheet(
    workbook,
    'Volume',
    input,
    products,
    months,
    'volume',
    '#,##0',
    logoId,
    logo,
    signatureId,
    signature
  );
  onProgress?.(95);
  writeMatrixSheet(
    workbook,
    'Valeur',
    input,
    products,
    months,
    'montant',
    '#,##0.00',
    logoId,
    logo,
    signatureId,
    signature
  );
  onProgress?.(97);
  writeDetailSheet(workbook, input, products, months, logoId, logo, signatureId, signature);
  onProgress?.(99);

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

async function writeSyntheseSheet(
  workbook: ExcelBook,
  input: PilotageProduitsMensuelExcelInput,
  products: ProductAgg[],
  months: string[],
  monthTotals: Array<{ mois: string; volume: number; montant: number }>,
  logoId: number | undefined,
  logo: Logo | null,
  signatureId: number | undefined,
  signature: Logo | null
): Promise<void> {
  const ws = workbook.addWorksheet('Synthèse', { views: [{ showGridLines: false }] });
  paintBanner(ws, 8, logoId, logo, input.identity.title, input.identity.subtitle);
  let row = 7;
  ws.getRow(row).getCell(1).value = 'Périmètre';
  ws.getRow(row).getCell(1).font = { name: 'Calibri', bold: true, size: 13, color: { argb: BLACK } };
  row += 1;
  for (const item of input.identity.meta) {
    writeMetaLine(ws, row, item);
    row += 1;
  }

  const totalVolume = products.reduce((sum, p) => sum + p.volume, 0);
  const totalMontant = products.reduce((sum, p) => sum + p.montant, 0);
  row += 1;
  ws.getRow(row).getCell(1).value = 'Totaux';
  ws.getRow(row).getCell(1).font = { name: 'Calibri', bold: true, size: 13 };
  row += 1;
  writeHeader(ws, row, ['Indicateur', 'Valeur']);
  const kpis: Array<[string, number | string, string | undefined]> = [
    ['Produits', products.length, '#,##0'],
    ['Mois', months.length, '#,##0'],
    ['Volume', totalVolume, '#,##0'],
    [`Valeur (${input.devise})`, totalMontant, '#,##0.00'],
  ];
  kpis.forEach((kpi, index) => {
    const excelRow = ws.getRow(row + 1 + index);
    excelRow.getCell(1).value = kpi[0];
    excelRow.getCell(2).value = kpi[1];
    styleBody(excelRow.getCell(1), index);
    styleBody(excelRow.getCell(2), index);
    if (kpi[2]) excelRow.getCell(2).numFmt = kpi[2];
    excelRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
  });
  row += kpis.length + 3;

  const chartPng = await chartToPng({
    type: 'bar',
    data: {
      labels: monthTotals.map((m) => monthLabel(m.mois)),
      datasets: [
        {
          type: 'bar',
          label: `Valeur ${input.devise}`,
          data: monthTotals.map((m) => m.montant),
          backgroundColor: '#FFD500',
          borderColor: '#111111',
          borderWidth: 1,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'Volume',
          data: monthTotals.map((m) => m.volume),
          borderColor: '#111111',
          backgroundColor: 'rgba(17,17,17,0.08)',
          tension: 0.25,
          pointRadius: 3,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#111111' } },
        title: {
          display: true,
          text: 'Volume et valeur par mois',
          color: '#111111',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        x: { ticks: { color: '#111111' }, grid: { display: false } },
        y: {
          position: 'left',
          ticks: { color: '#111111' },
          grid: { color: 'rgba(17,17,17,0.08)' },
        },
        y1: {
          position: 'right',
          ticks: { color: '#6B7280' },
          grid: { display: false },
        },
      },
    },
  });
  ws.getRow(row).getCell(1).value = 'Évolution Flash';
  ws.getRow(row).getCell(1).font = { name: 'Calibri', bold: true, size: 13 };
  row += 1;
  const chartId = workbook.addImage({ base64: chartPng, extension: 'png' });
  ws.addImage(chartId, { tl: { col: 0, row: row - 1 }, ext: { width: 760, height: 300 } });
  row += 17;

  const foot = row + 1;
  footer(
    ws,
    foot,
    8,
    `${input.identity.code} · ${products.length} produit(s) · ${months.length} mois · confidentiel`
  );
  placeSignature(ws, foot + 2, signatureId, signature, input.appName);
  setWidths(ws, [28, 22, 16, 16, 16, 16, 16, 16]);
}

function writeMatrixSheet(
  workbook: ExcelBook,
  sheetName: string,
  input: PilotageProduitsMensuelExcelInput,
  products: ProductAgg[],
  months: string[],
  metric: 'volume' | 'montant',
  numFmt: string,
  logoId: number | undefined,
  logo: Logo | null,
  signatureId: number | undefined,
  signature: Logo | null
): void {
  const columns = 2 + months.length + 1;
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 7, xSplit: 2 }],
  });
  paintBanner(
    ws,
    Math.max(columns, 6),
    logoId,
    logo,
    `${input.identity.title} — ${sheetName}`,
    input.identity.subtitle
  );
  const headers = ['Produit', 'Module', ...months.map(monthLabel), 'Total'];
  const headerRow = 7;
  writeHeader(ws, headerRow, headers);

  const colTotals = months.map(() => 0);
  products.forEach((product, index) => {
    const excelRow = ws.getRow(headerRow + 1 + index);
    const values: (string | number)[] = [productDisplayName(product), product.module];
    let total = 0;
    months.forEach((mois, monthIndex) => {
      const value = product.byMonth.get(mois)?.[metric] ?? 0;
      values.push(value);
      total += value;
      colTotals[monthIndex] += value;
    });
    values.push(total);
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      styleBody(cell, index);
      if (i >= 2) {
        cell.numFmt = numFmt;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
    excelRow.height = 18;
  });

  const totalRowIndex = headerRow + 1 + products.length;
  const totalRow = ws.getRow(totalRowIndex);
  const grand = colTotals.reduce((sum, n) => sum + n, 0);
  const totalValues: (string | number)[] = ['Total', '', ...colTotals, grand];
  totalValues.forEach((value, i) => {
    const cell = totalRow.getCell(i + 1);
    cell.value = value;
    cell.fill = solid(TOTAL_BG);
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: BLACK } };
    cell.border = border();
    if (i >= 2) {
      cell.numFmt = numFmt;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });
  totalRow.height = 20;

  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: headers.length },
  };
  const widths = [28, 18, ...months.map(() => 12), 14];
  setWidths(ws, widths);
  const foot = totalRowIndex + 2;
  footer(ws, foot, headers.length, `${input.identity.code} · ${sheetName.toLowerCase()} · ${input.devise}`);
  placeSignature(ws, foot + 2, signatureId, signature, input.appName);
}

function writeDetailSheet(
  workbook: ExcelBook,
  input: PilotageProduitsMensuelExcelInput,
  products: ProductAgg[],
  months: string[],
  logoId: number | undefined,
  logo: Logo | null,
  signatureId: number | undefined,
  signature: Logo | null
): void {
  const headers = [
    'Produit',
    'Module',
    'Écran',
    'Partenaire',
    'Mois',
    'Volume',
    `Valeur (${input.devise})`,
    'Volume Envoi+Retrait',
    `Valeur Envoi+Retrait (${input.devise})`,
  ];
  const ws = workbook.addWorksheet('Détail', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 7 }],
  });
  paintBanner(ws, headers.length, logoId, logo, input.identity.title, input.identity.subtitle);
  const headerRow = 7;
  writeHeader(ws, headerRow, headers);
  let cursor = headerRow + 1;
  let index = 0;

  const families = groupProductFamilies(products);
  for (const family of families) {
    const monthTotals = familyMonthTotals(family.members, months);
    for (const product of family.members) {
      let productRows = 0;
      for (const mois of months) {
        const cell = product.byMonth.get(mois);
        const volume = cell?.volume ?? 0;
        const montant = cell?.montant ?? 0;
        if (!volume && !montant) continue;
        const combined = monthTotals.get(mois) ?? { volume: 0, montant: 0 };
        writeDetailDataRow(
          ws,
          cursor,
          index,
          [
            productDisplayName(product),
            product.module,
            ecranDisplay(product.ecran) || '—',
            product.partenaire || '—',
            monthLabel(mois),
            volume,
            montant,
            combined.volume,
            combined.montant,
          ]
        );
        cursor += 1;
        index += 1;
        productRows += 1;
      }
      if (!productRows) continue;
      writeDetailTotalRow(ws, cursor, [
        `Total ${productDisplayName(product)}`,
        '',
        '',
        '',
        '',
        product.volume,
        product.montant,
        family.volume,
        family.montant,
      ]);
      cursor += 1;
    }

    if (family.members.length > 1) {
      let combinedRows = 0;
      for (const mois of months) {
        const combined = monthTotals.get(mois);
        if (!combined || (!combined.volume && !combined.montant)) continue;
        writeDetailDataRow(
          ws,
          cursor,
          index,
          [
            `${family.produit} — Envoi+Retrait`,
            family.module,
            'Envoi+Retrait',
            '—',
            monthLabel(mois),
            combined.volume,
            combined.montant,
            combined.volume,
            combined.montant,
          ],
          true
        );
        cursor += 1;
        index += 1;
        combinedRows += 1;
      }
      if (combinedRows) {
        writeDetailTotalRow(ws, cursor, [
          `Total ${family.produit} — Envoi+Retrait`,
          '',
          '',
          '',
          '',
          family.volume,
          family.montant,
          family.volume,
          family.montant,
        ]);
        cursor += 1;
      }
    }
  }

  const totalVolume = products.reduce((sum, p) => sum + p.volume, 0);
  const totalMontant = products.reduce((sum, p) => sum + p.montant, 0);
  writeDetailTotalRow(
    ws,
    cursor,
    ['Total général', '', '', '', '', totalVolume, totalMontant, totalVolume, totalMontant],
    TOTAL_BG
  );
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: headers.length },
  };
  setWidths(ws, [34, 14, 14, 16, 14, 12, 16, 18, 22]);
  const foot = cursor + 2;
  footer(ws, foot, headers.length, `${input.identity.code} · détail mensuel`);
  placeSignature(ws, foot + 2, signatureId, signature, input.appName);
}

interface ProductFamily {
  key: string;
  module: string;
  produit: string;
  members: ProductAgg[];
  volume: number;
  montant: number;
}

function groupProductFamilies(products: ProductAgg[]): ProductFamily[] {
  const map = new Map<string, ProductFamily>();
  const order: string[] = [];
  for (const product of products) {
    const key = productFamilyKey(product);
    let family = map.get(key);
    if (!family) {
      family = {
        key,
        module: product.module,
        produit: product.produit,
        members: [],
        volume: 0,
        montant: 0,
      };
      map.set(key, family);
      order.push(key);
    }
    family.members.push(product);
    family.volume += product.volume;
    family.montant += product.montant;
  }
  return order.map((key) => map.get(key)!);
}

function productFamilyKey(product: Pick<ProductAgg, 'module' | 'produit'>): string {
  return `${product.module}|${product.produit}`;
}

function familyMonthTotals(
  members: ProductAgg[],
  months: string[]
): Map<string, { volume: number; montant: number }> {
  const map = new Map<string, { volume: number; montant: number }>();
  for (const mois of months) {
    let volume = 0;
    let montant = 0;
    for (const product of members) {
      const cell = product.byMonth.get(mois);
      volume += cell?.volume ?? 0;
      montant += cell?.montant ?? 0;
    }
    if (volume || montant) map.set(mois, { volume, montant });
  }
  return map;
}

function writeDetailDataRow(
  ws: ExcelSheet,
  rowNumber: number,
  index: number,
  values: (string | number)[],
  emphasize = false
): void {
  const excelRow = ws.getRow(rowNumber);
  values.forEach((value, i) => {
    const c = excelRow.getCell(i + 1);
    c.value = value;
    styleBody(c, index);
    if (emphasize) {
      c.fill = solid('FFFFF8E1');
      c.font = { name: 'Calibri', bold: true, size: 10, color: { argb: BLACK } };
    }
    if (i === 5 || i === 7) {
      c.numFmt = '#,##0';
      c.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (i === 6 || i === 8) {
      c.numFmt = '#,##0.00';
      c.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });
  excelRow.height = 18;
}

function writeDetailTotalRow(
  ws: ExcelSheet,
  rowNumber: number,
  values: (string | number)[],
  bg = 'FFFFF8E1'
): void {
  const row = ws.getRow(rowNumber);
  values.forEach((value, i) => {
    const c = row.getCell(i + 1);
    c.value = value;
    c.fill = solid(bg);
    c.font = { name: 'Calibri', bold: true, size: 10, color: { argb: BLACK } };
    c.border = border();
    if (i === 5 || i === 7) {
      c.numFmt = '#,##0';
      c.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (i === 6 || i === 8) {
      c.numFmt = '#,##0.00';
      c.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });
  row.height = 18;
}

function productDisplayName(product: Pick<ProductAgg, 'produit' | 'ecran'>): string {
  const name = (product.produit || 'Non renseigné').trim();
  const sens = ecranDisplay(product.ecran);
  return sens ? `${name} — ${sens}` : name;
}

function ecranDisplay(ecran: string | undefined): string {
  const key = (ecran || '').trim();
  if (!key) return '';
  const map: Record<string, string> = {
    Envois: 'Envoi',
    Retraits: 'Retrait',
    Cashin: 'Cashin',
    Cashout: 'Cashout',
    TransfertFond: 'Transfert de fonds',
    MobileMoney: 'Mobile Money',
  };
  return map[key] ?? key;
}

function aggregateProducts(rows: PilotageProductMonthlyRow[]): ProductAgg[] {
  const map = new Map<string, ProductAgg>();
  for (const row of rows) {
    const key = `${row.produitId}|${row.module}|${row.produit}|${row.ecran}|${row.partenaire ?? ''}`;
    let item = map.get(key);
    if (!item) {
      item = {
        key,
        label: productDisplayName({
          produit: row.produit || 'Non renseigné',
          ecran: row.ecran || '',
        }),
        module: row.module || '—',
        produit: row.produit || 'Non renseigné',
        ecran: row.ecran || '',
        partenaire: row.partenaire || '',
        byMonth: new Map(),
        volume: 0,
        montant: 0,
      };
      map.set(key, item);
    }
    const prev = item.byMonth.get(row.mois) ?? { volume: 0, montant: 0 };
    prev.volume += Number(row.volume) || 0;
    prev.montant += Number(row.montant) || 0;
    item.byMonth.set(row.mois, prev);
    item.volume += Number(row.volume) || 0;
    item.montant += Number(row.montant) || 0;
  }
  return [...map.values()].sort((a, b) => b.montant - a.montant || b.volume - a.volume);
}

function monthsBetween(from: string, to: string): string[] {
  const start = (from || '').slice(0, 7);
  const end = (to || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) return [];
  const out: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endYear = Number(end.slice(0, 4));
  const endMonth = Number(end.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function monthLabel(yyyyMm: string): string {
  const month = Number(yyyyMm.slice(5, 7));
  const year = yyyyMm.slice(0, 4);
  return `${MONTHS_FR[month - 1] ?? yyyyMm} ${year}`;
}

function writeMetaLine(ws: ExcelSheet, rowNumber: number, item: PilotageReportMeta): void {
  const line = ws.getRow(rowNumber);
  line.getCell(1).value = item.label;
  line.getCell(1).font = { name: 'Calibri', bold: true, color: { argb: GRAY } };
  line.getCell(1).fill = solid('FFF3F4F6');
  line.getCell(2).value = item.value;
  line.getCell(2).font = { name: 'Calibri', size: 11 };
  ws.mergeCells(rowNumber, 2, rowNumber, 6);
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
  titleRow.height = 26;
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { name: 'Calibri', bold: true, size: 16, color: { argb: BLACK } };
  titleRow.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
  ws.mergeCells(4, 1, 4, columns);
  const sub = ws.getRow(5);
  sub.height = 32;
  sub.getCell(1).value = subtitle;
  sub.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: GRAY } };
  sub.getCell(1).alignment = { wrapText: true, vertical: 'top' };
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
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
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

async function chartToPng(config: ChartConfiguration): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 480;
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
