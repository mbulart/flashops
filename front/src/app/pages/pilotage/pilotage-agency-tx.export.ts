import { PilotageAgenceTransaction } from '../../core/models/pilotage.models';

const YELLOW = 'FFFFD500';
const BLACK = 'FF111111';
const GRAY = 'FF6B7280';
const ZEBRAS = 'FFF8F5E6';
const TOTAL_BG = 'FFFFF4CC';

export interface PilotageAgencyTxExcelInput {
  filename: string;
  title: string;
  subtitle: string;
  devise: string;
  total: number;
  montantTotal: number;
  rows: PilotageAgenceTransaction[];
  truncated: boolean;
}

export async function downloadPilotageAgencyTxExcel(input: PilotageAgencyTxExcelInput): Promise<void> {
  const mod = await import('exceljs/dist/exceljs.min.js');
  const Workbook =
    (mod as { default?: { Workbook?: new () => ExcelBook }; Workbook?: new () => ExcelBook }).default
      ?.Workbook ?? (mod as { Workbook?: new () => ExcelBook }).Workbook;
  if (!Workbook) throw new Error('Excel indisponible');

  const workbook = new Workbook();
  workbook.creator = 'Flash OPS';
  workbook.created = new Date();
  const ws = workbook.addWorksheet('Transactions', { views: [{ showGridLines: false, state: 'frozen', ySplit: 7 }] });

  ws.mergeCells(1, 1, 1, 8);
  ws.getRow(1).height = 8;
  for (let c = 1; c <= 8; c++) ws.getRow(1).getCell(c).fill = solid(YELLOW);

  const title = ws.getRow(4);
  title.height = 24;
  title.getCell(1).value = input.title;
  title.getCell(1).font = { name: 'Calibri', bold: true, size: 15, color: { argb: BLACK } };
  ws.mergeCells(4, 1, 4, 8);

  const sub = ws.getRow(5);
  sub.height = 28;
  sub.getCell(1).value = input.subtitle;
  sub.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: GRAY } };
  sub.getCell(1).alignment = { wrapText: true };
  ws.mergeCells(5, 1, 5, 8);

  const headers = [
    'Date',
    'Heure',
    'Produit',
    'Opérateur',
    'Expéditeur',
    'Bénéficiaire',
    'Statut',
    `Montant (${input.devise})`,
  ];
  const headerRow = ws.getRow(7);
  headerRow.height = 22;
  headers.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.fill = solid(YELLOW);
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: BLACK } };
    cell.border = border();
  });

  input.rows.forEach((row, index) => {
    const excelRow = ws.getRow(8 + index);
    const values: (string | number)[] = [
      row.jour || '',
      row.heure || '',
      row.produit || '—',
      row.operateur || '—',
      row.expediteur || '—',
      row.beneficiaire || '—',
      row.statut || '—',
      Number(row.montant) || 0,
    ];
    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      cell.font = { name: 'Calibri', size: 10, color: { argb: BLACK } };
      cell.border = border();
      if (index % 2 === 1) cell.fill = solid(ZEBRAS);
      if (i === 7) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  const totalRow = ws.getRow(8 + input.rows.length);
  [
    `Total (${input.total} ligne${input.total > 1 ? 's' : ''}${input.truncated ? ', export tronqué' : ''})`,
    '',
    '',
    '',
    '',
    '',
    '',
    input.montantTotal,
  ].forEach((value, i) => {
    const cell = totalRow.getCell(i + 1);
    cell.value = value;
    cell.fill = solid(TOTAL_BG);
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: BLACK } };
    cell.border = border();
    if (i === 7) cell.numFmt = '#,##0.00';
  });

  [14, 10, 18, 18, 20, 20, 12, 16].forEach((width, i) => {
    ws.getColumn(i + 1).width = width;
  });

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
}

function solid(argb: string): { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } } {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function border(): {
  top: { style: 'thin'; color: { argb: string } };
  left: { style: 'thin'; color: { argb: string } };
  bottom: { style: 'thin'; color: { argb: string } };
  right: { style: 'thin'; color: { argb: string } };
} {
  const edge = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

interface ExcelBook {
  creator: string;
  created: Date;
  addWorksheet: (name: string, opts?: object) => ExcelSheet;
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
}

interface ExcelSheet {
  mergeCells: (...args: number[]) => void;
  getRow: (n: number) => { height: number; getCell: (n: number) => ExcelCell };
  getColumn: (n: number) => { width: number };
  addImage?: (id: number, opts: object) => void;
}

interface ExcelCell {
  value: unknown;
  font?: unknown;
  fill?: unknown;
  border?: unknown;
  alignment?: unknown;
  numFmt?: string;
}
