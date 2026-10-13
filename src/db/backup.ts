// Sauvegarde JSON : iOS peut effacer les données d'une PWA peu utilisée.
import { db, TABLES, type MatriculeDB, type TableName } from './schema';

export const BACKUP_FORMAT = 'matricule-backup';
export const BACKUP_VERSION = 2;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<TableName, unknown[]>;
}

export async function buildBackup(database: MatriculeDB = db): Promise<Backup> {
  const data = {} as Backup['data'];
  for (const name of TABLES) data[name] = await database.table(name).toArray();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON lisible.");
  }
  const b = json as Partial<Backup>;
  if (b?.format !== BACKUP_FORMAT || typeof b.version !== 'number' || !b.data) {
    throw new Error("Ce fichier n'est pas une sauvegarde Matricule.");
  }
  if (b.version < BACKUP_VERSION) {
    throw new Error("Sauvegarde de l'ancien programme (4 phases) : elle ne correspond pas au programme 58 semaines.");
  }
  if (b.version > BACKUP_VERSION) {
    throw new Error("Sauvegarde créée par une version plus récente de l'app. Mets l'app à jour puis réessaie.");
  }
  for (const name of TABLES) {
    if (!Array.isArray(b.data[name])) throw new Error(`Sauvegarde incomplète : table « ${name} » absente.`);
  }
  if (!b.data.profile.length) throw new Error('Sauvegarde sans profil : rien à restaurer.');
  return b as Backup;
}

/** Remplace toutes les données locales par celles de la sauvegarde. */
export async function restoreBackup(backup: Backup, database: MatriculeDB = db): Promise<void> {
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const name of TABLES) {
      const table = database.table(name);
      await table.clear();
      await table.bulkAdd(backup.data[name]);
    }
  });
}

/** Partage le fichier (feuille iOS « Enregistrer dans Fichiers ») ou le télécharge. */
export async function exportToFile(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const backup = await buildBackup();
  const name = `matricule-${backup.exportedAt.slice(0, 10)}.json`;
  const file = new File([JSON.stringify(backup, null, 1)], name, { type: 'application/json' });
  let result: 'shared' | 'downloaded' | 'cancelled' = 'downloaded';

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde Matricule' });
      result = 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      download(file);
    }
  } else {
    download(file);
  }
  await db.profile.update('me', { lastExportAt: Date.now() });
  return result;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
