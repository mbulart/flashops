import { PilotageDomaine } from '../../core/models/pilotage.models';

/** Raccourcis UI → valeurs brutes dim_produit.ecran (ex. Sens du transfert = Envois / Retraits). */
export interface PilotageEcranOption {
  id: string;
  label: string;
  rawEcrans: string[];
}

export const PILOTAGE_STATUT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'Succès', label: 'Succès' },
  { value: 'Echouée', label: 'Echouée' },
  { value: 'En attente', label: 'En attente' },
  { value: 'Annulée', label: 'Annulée' },
  { value: 'Non renseigné', label: 'Non renseigné' },
];

export const PILOTAGE_JOUR_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Tous les jours' },
  { value: 'par_mois', label: 'Par mois' },
  { value: 'hors_weekend', label: 'Hors week-end' },
  { value: 'feries', label: 'Fériés seulement' },
];

/** Id stable pour multi-select catégories (libellé → entier). */
export function pilotageCategoryOptionId(label: string): number {
  let h = 5381;
  for (let i = 0; i < label.length; i++) {
    h = ((h << 5) + h) ^ label.charCodeAt(i);
  }
  return (h >>> 0) || 1;
}

export function pilotageStatutOptionId(value: string): number {
  return pilotageCategoryOptionId(`statut:${value}`);
}

export function pilotageCouloirOptionId(code: string): number {
  return pilotageCategoryOptionId(`couloir:${code}`);
}

export function pilotageDomaineOptionId(code: string): number {
  return pilotageCategoryOptionId(`domaine:${code}`);
}

export interface PilotageProduitVue extends PilotageProduitLite {
  domaine: PilotageDomaine;
}

export interface PilotageProduitChoice {
  id: number;
  label: string;
  module: string;
  domaine: PilotageDomaine;
  rows: PilotageProduitVue[];
}

interface PilotageProduitLite {
  produitId: number;
  module: string;
  produit: string;
  ecran: string;
  partenaire?: string;
}

const ECRANS_TRANSFERT: PilotageEcranOption[] = [
  { id: 'envois', label: 'Envois', rawEcrans: ['Envois'] },
  { id: 'retraits', label: 'Retraits', rawEcrans: ['Retraits'] },
];

const ECRANS_MONNAIE: PilotageEcranOption[] = [
  { id: 'cashin', label: 'Cashin', rawEcrans: ['Cashin'] },
  { id: 'cashout', label: 'Cashout', rawEcrans: ['Cashout'] },
  { id: 'transfert_fonds', label: 'Transfert de fonds', rawEcrans: ['TransfertFond'] },
  { id: 'mobile_money', label: 'Mobile Money', rawEcrans: ['MobileMoney'] },
];

const ECRANS_SERVICE: PilotageEcranOption[] = [
  { id: 'recharges', label: 'Recharges', rawEcrans: ['RechargesUnites', 'RechargesMega'] },
  { id: 'canal', label: 'Canal+', rawEcrans: ['ReportingCanal'] },
  { id: 'easytv', label: 'EasyTV', rawEcrans: ['ReportingEasyTV'] },
  { id: 'startimes', label: 'StarTimes', rawEcrans: ['Transactions'] },
];

export function pilotageEcransForDomain(domaine: PilotageDomaine): PilotageEcranOption[] {
  switch (domaine) {
    case 'transfert':
      return ECRANS_TRANSFERT;
    case 'monnaie':
      return ECRANS_MONNAIE;
    case 'service':
      return ECRANS_SERVICE;
    default:
      return [];
  }
}

const MODULE_LABELS: Record<string, string> = {
  MPESA: 'MPESA',
  WU: 'Western Union',
  MONEYGRAM: 'MoneyGram',
  FLASH_TRANSFER: 'Flash Transfer',
  RIA: 'RIA',
  MUKURU: 'Mukuru',
  FLASHPAYMENT: 'Flash Payment',
  FLASH_APP: 'Flash App',
  TELCO: 'TELCO',
  CANAL_PLUS: 'Canal+',
  STARTIMES: 'StarTimes',
};

const ECRAN_LABELS: Record<string, string> = {
  Envois: 'Envois',
  Retraits: 'Retraits',
  Cashin: 'Cashin',
  Cashout: 'Cashout',
  TransfertFond: 'Transfert de fonds',
  MobileMoney: 'Mobile Money',
  RechargesUnites: 'Recharges unités',
  RechargesMega: 'Recharges mega',
  ReportingCanal: 'Canal+',
  ReportingEasyTV: 'EasyTV',
  Transactions: 'Transactions',
};

export function pilotageModuleLabel(module: string): string {
  const key = (module || '').trim();
  return MODULE_LABELS[key] ?? key;
}

export function pilotageEcranLabel(ecran: string): string {
  const key = (ecran || '').trim();
  return ECRAN_LABELS[key] ?? key;
}

const DISPLAY_NAMES: Record<string, string> = {
  TAPTAPSEND: 'Taptap Send',
  TERRAPAY: 'TerraPay',
  MPESA: 'M-Pesa',
  ORANGEMONEY: 'Orange Money',
  AIRTELMONEY: 'Airtel Money',
  FLASHPAYMENT: 'Flash Payment',
  AFRIMONEY: 'Afri Money',
};

/** Clé stable pour partenaire / sous-produit (TAPTAPSEND, ORANGEMONEY, …). */
export function pilotageCompactKey(raw: string): string {
  return (raw || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
}

export function pilotagePartenaireLabel(raw: string): string {
  const compact = pilotageCompactKey(raw);
  if (DISPLAY_NAMES[compact]) return DISPLAY_NAMES[compact];
  return pilotageDisplayToken(raw);
}

/** Cash = le produit partenaire tel quel. Mobile money = sous-produit portefeuille (M-Pesa, etc.). */
export function pilotageIsMobileMoneyProduit(produit: string, ecran?: string): boolean {
  if ((ecran || '').trim() === 'MobileMoney') return true;
  const prod = pilotageCompactKey(produit);
  if (!prod || prod === '-') return false;
  return (
    prod.includes('MPESA') ||
    prod.includes('ORANGEMONEY') ||
    prod.includes('AIRTELMONEY') ||
    prod.includes('AFRIMONEY') ||
    prod === 'MOMO' ||
    prod.includes('MOBILEMONEY')
  );
}

export function buildPilotageProduitChoices(
  rows: PilotageProduitVue[],
  sensId: string
): PilotageProduitChoice[] {
  const transfertBucket = ECRANS_TRANSFERT.find((e) => e.id === sensId);
  const groups = new Map<string, PilotageProduitVue[]>();
  const singles: PilotageProduitChoice[] = [];

  for (const row of rows) {
    if (row.domaine === 'transfert') {
      if (pilotageIsMonnaieElectronique(row.module, row.produit, row.ecran)) continue;
      if (transfertBucket) {
        if (!transfertBucket.rawEcrans.includes((row.ecran || '').trim())) continue;
        if (transfertBucket.id === 'envois' && pilotageModuleRetraitsOnly(row.module)) continue;
        if (transfertBucket.id === 'retraits' && (row.ecran || '').trim() !== 'Retraits') continue;
      }
      const key = (row.module || '').trim().toUpperCase() || `id:${row.produitId}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
      continue;
    }
    singles.push({
      id: pilotageCategoryOptionId(`produit:${row.domaine}:${row.produitId}`),
      label: pilotageProduitLabel(row.module, row.produit, row.ecran, row.partenaire),
      module: row.module,
      domaine: row.domaine,
      rows: [row],
    });
  }

  const grouped: PilotageProduitChoice[] = [...groups.entries()].map(([module, list]) => ({
    id: pilotageCategoryOptionId(`module:${module}`),
    label: pilotageModuleLabel(module),
    module,
    domaine: 'transfert',
    rows: list,
  }));

  return [...grouped, ...singles].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

export function resolvePilotageProduitIds(
  choices: PilotageProduitChoice[],
  selectedIds: number[],
  partenaire: string,
  mode: '' | 'cash' | 'momo',
  sousProduit = ''
): number[] {
  const selected = new Set(selectedIds);
  const narrowed = selected.size > 0;
  const partner = pilotageCompactKey(partenaire);
  const sous = pilotageCompactKey(sousProduit);
  const ids: number[] = [];
  for (const choice of choices) {
    if (narrowed && !selected.has(choice.id)) continue;
    let rows = choice.rows;
    if ((choice.module || '').trim().toUpperCase() === 'FLASHPAYMENT') {
      if (partner) {
        rows = rows.filter((row) => pilotageCompactKey(row.partenaire || '') === partner);
      }
      if (mode === 'cash') {
        rows = rows.filter((row) => !pilotageIsMobileMoneyProduit(row.produit, row.ecran));
      } else if (mode === 'momo') {
        rows = rows.filter((row) => pilotageIsMobileMoneyProduit(row.produit, row.ecran));
        if (sous) {
          rows = rows.filter((row) => pilotageCompactKey(row.produit) === sous);
        }
      } else if (sous) {
        // Sous-produit seul (sans mode) : correspondance sur dim_produit.produit.
        rows = rows.filter((row) => pilotageCompactKey(row.produit) === sous);
      }
    }
    for (const row of rows) {
      const id = Number(row.produitId);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

function pilotageDisplayToken(raw: string): string {
  const key = (raw || '').trim();
  if (!key || key === '-') return '';
  const compact = pilotageCompactKey(key);
  return DISPLAY_NAMES[compact] ?? DISPLAY_NAMES[key.toUpperCase()] ?? pilotageModuleLabel(key);
}

/**
 * Marque, partenaire s'il existe, produit s'il diffère de la marque, puis écran.
 * Ex. Flash Payment · Taptap Send · M-Pesa · Retraits.
 */
export function pilotageProduitLabel(
  module: string,
  produit: string,
  ecran: string,
  partenaire = ''
): string {
  const brand = pilotageModuleLabel(module);
  const parts: string[] = [];
  if (brand) parts.push(brand);
  const partner = (partenaire || '').trim();
  const moduleKey = (module || '').trim().toUpperCase();
  if (partner && partner.toUpperCase() !== moduleKey) {
    parts.push(pilotageDisplayToken(partner));
  }
  const prod = (produit || '').trim();
  const prodKey = prod.toUpperCase();
  if (prod && prod !== '-' && prodKey !== moduleKey && prod.toLowerCase() !== brand.toLowerCase()) {
    parts.push(pilotageDisplayToken(prod));
  }
  const screen = pilotageEcranLabel(ecran);
  if (screen) parts.push(screen);
  return parts.join(' · ');
}

/** Modules sans envois (retraits seulement). */
export function pilotageModuleRetraitsOnly(module: string): boolean {
  const m = (module || '').trim().toUpperCase();
  return m === 'RIA' || m === 'MUKURU' || m === 'FLASHPAYMENT';
}

/** MPESA / mobile money → domaine Monnaie (pas Transferts). */
export function pilotageIsMonnaieElectronique(module: string, produit: string, ecran?: string): boolean {
  const mod = (module || '').trim().toUpperCase();
  const prod = (produit || '').trim().toUpperCase();
  if (mod === 'FLASHPAYMENT') return false;
  if (
    mod === 'MPESA' ||
    prod === 'MPESA' ||
    prod.includes('MPESA') ||
    prod === 'M-PESA' ||
    prod === 'M PESA'
  ) {
    return true;
  }
  if ((ecran || '').trim() === 'MobileMoney') {
    return true;
  }
  return false;
}

export function pilotageFilterProduitsByUiDomain<T extends { module: string; produit: string; ecran: string }>(
  domaine: PilotageDomaine,
  rows: T[]
): T[] {
  if (domaine === 'transfert') {
    return rows.filter((p) => !pilotageIsMonnaieElectronique(p.module, p.produit, p.ecran));
  }
  return rows;
}
