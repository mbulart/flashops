import { PilotageCriteria } from '../../core/models/pilotage.models';

export interface PilotageReportMeta {
  label: string;
  value: string;
}

export interface PilotageReportIdentity {
  code: string;
  title: string;
  subtitle: string;
  filename: string;
  meta: PilotageReportMeta[];
}

export function buildPilotageReportIdentity(opts: {
  kind: 'agences' | 'produits-mensuel';
  criteria: PilotageCriteria;
  domainesLabel: string;
  period: string;
  chips: string[];
  generatedAt?: Date;
}): PilotageReportIdentity {
  const at = opts.generatedAt ?? new Date();
  const stamp = formatStamp(at);
  const kindLabel = opts.kind === 'agences' ? 'Agences et opérations' : 'Produits par mois';
  const kindCode = opts.kind === 'agences' ? 'AGX' : 'PMX';
  const devise = (opts.criteria.devise || 'USD').trim().toUpperCase();
  const domainSlug = slugPart(opts.domainesLabel);
  const seq = Math.floor(Math.random() * 900 + 100);
  const code = `FLASH-${kindCode}-${stamp}-${devise}-${domainSlug}-${seq}`;
  const filterLine = opts.chips.length ? opts.chips.join(' · ') : 'Aucun filtre additionnel';
  const title = `${kindLabel} — ${opts.domainesLabel} — ${devise}`;
  const subtitle = `Période ${opts.period}${opts.chips.length ? ` · Filtres : ${filterLine}` : ''}`;
  const filename = `${code}_${opts.criteria.from}_${opts.criteria.to}.xlsx`;
  const meta: PilotageReportMeta[] = [
    { label: 'Référence', value: code },
    { label: 'Rapport', value: kindLabel },
    { label: 'Domaine', value: opts.domainesLabel },
    { label: 'Devise', value: devise },
    { label: 'Période', value: opts.period },
    { label: 'Du', value: opts.criteria.from },
    { label: 'Au', value: opts.criteria.to },
    { label: 'Généré le', value: formatDateTimeFr(at) },
  ];
  if (opts.chips.length) {
    meta.push({ label: 'Filtres appliqués', value: filterLine });
  } else {
    meta.push({ label: 'Filtres appliqués', value: 'Aucun' });
  }
  return { code, title, subtitle, filename, meta };
}

function formatStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function formatDateTimeFr(date: Date): string {
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

function slugPart(raw: string): string {
  const compact = (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 12)
    .toUpperCase();
  return compact || 'OPS';
}
