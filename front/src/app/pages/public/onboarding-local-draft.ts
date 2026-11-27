import { CandidatureDraft } from '../../core/models/onboarding.models';

const DRAFT_KEY = 'flashops_onboarding_draft_v1';
const DB_NAME = 'flashops-onboarding';
const STORE = 'files';

export interface LocalOnboardingDraft {
  step: number;
  draft: CandidatureDraft;
  id?: number | string;
  jeton?: string;
  reference?: string;
  entProvinceId: number | null;
  entVilleId: number | null;
  entCommuneId: number | null;
  outlets: { provinceId: number | null; villeId: number | null }[];
  pendingDeletes: string[];
  serverFiles: string[];
}

export function readLocalDraft(): LocalOnboardingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalOnboardingDraft;
    if (!parsed?.draft) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalDraft(value: LocalOnboardingDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
}

export function clearLocalDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

export async function putLocalFile(typeCode: string, file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(
      { name: file.name, type: file.type, buffer },
      typeCode
    );
  });
  db.close();
}

export async function getLocalFile(typeCode: string): Promise<File | null> {
  const db = await openDb();
  const row = await new Promise<{ name: string; type: string; buffer: ArrayBuffer } | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(typeCode);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }
  );
  db.close();
  if (!row?.buffer) return null;
  return new File([row.buffer], row.name || typeCode, { type: row.type || 'application/octet-stream' });
}

export async function deleteLocalFile(typeCode: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(typeCode);
  });
  db.close();
}

export async function clearLocalFiles(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).clear();
  });
  db.close();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
