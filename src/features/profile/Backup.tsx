import { useRef, useState } from 'react';
import { exportToFile, parseBackup, restoreBackup, type Backup } from '../../db/backup';
import { Sheet } from '../../ui/kit';

export function ExportButton({ className = 'btn btn--brass btn--block' }: { className?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    try {
      const r = await exportToFile();
      setMsg(r === 'cancelled' ? null : 'Sauvegarde exportée. Range-la dans Fichiers ou iCloud Drive.');
    } catch {
      setMsg("L'export a échoué. Réessaie depuis Safari si le problème continue.");
    }
  };
  return (
    <div className="stack stack--tight">
      <button className={className} onClick={run}>
        Exporter une sauvegarde
      </button>
      {msg && <p className="small muted" role="status">{msg}</p>}
    </div>
  );
}

export function RestoreButton({ label = 'Importer une sauvegarde' }: { label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file?: File) => {
    setError(null);
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const confirm = async () => {
    if (!pending) return;
    await restoreBackup(pending);
    setPending(null);
  };

  return (
    <div className="stack stack--tight">
      <button className="btn btn--ghost btn--block" onClick={() => input.current?.click()}>
        {label}
      </button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <p className="small" style={{ color: 'var(--blood-bright)' }} role="alert">{error}</p>}
      {pending && (
        <Sheet title="Restaurer ?" onClose={() => setPending(null)}>
          <div className="stack">
            <p>
              Sauvegarde du {new Date(pending.exportedAt).toLocaleDateString('fr-FR')} : {pending.data.logs.length} séances consignées.
            </p>
            <p className="muted">Les données actuelles de ce téléphone seront remplacées.</p>
            <button className="btn btn--primary btn--block" onClick={confirm}>
              Remplacer par la sauvegarde
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => setPending(null)}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
