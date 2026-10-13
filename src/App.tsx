import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from './db/schema';
import { RANKS } from './domain/ranks';
import type { PlannedSession } from './domain/types';
import { Onboarding } from './features/profile/Onboarding';
import { Today } from './features/today/Today';
import { Plan } from './features/plan/Plan';
import { Stats } from './features/stats/Stats';
import { Dossier } from './features/profile/Dossier';
import { LogSheet } from './features/log/LogSheet';
import { Insignia } from './ui/Insignia';
import { Icons } from './ui/kit';
import { UIContext, useData, type Data, type Tab, type UI } from './state';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: "Aujourd'hui", icon: Icons.today },
  { id: 'plan', label: 'Plan', icon: Icons.plan },
  { id: 'stats', label: 'Stats', icon: Icons.stats },
  { id: 'dossier', label: 'Dossier', icon: Icons.dossier },
];

const readTab = (): Tab => {
  const h = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === h) ? h : 'today';
};

export function App() {
  const data = useData();
  if (data.status === 'loading') return null;
  if (data.status === 'new') return <Onboarding />;
  return <Shell data={data} />;
}

function Shell({ data }: { data: Data }) {
  const [tab, setTab] = useState<Tab>(readTab);
  const [log, setLog] = useState<{ session?: PlannedSession } | null>(null);
  const [stampText, setStampText] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((t: Tab) => {
    history.replaceState(null, '', `#${t}`);
    setTab(t);
    window.scrollTo({ top: 0 });
  }, []);

  const ui = useMemo<UI>(
    () => ({
      openLog: (session) => setLog({ session }),
      stamp: (text = 'Consigné') => {
        setStampText(text);
        navigator.vibrate?.(30);
        setTimeout(() => setStampText(null), 1050);
      },
      go,
    }),
    [go],
  );

  return (
    <UIContext.Provider value={ui}>
      <main className="app">
        {tab === 'today' && <Today data={data} />}
        {tab === 'plan' && <Plan data={data} />}
        {tab === 'stats' && <Stats data={data} />}
        {tab === 'dossier' && <Dossier data={data} />}
      </main>

      <nav className="tabbar" aria-label="Navigation principale">
        <ul>
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
          ))}
          <li>
            <button className="tab tab--log" onClick={() => setLog({})} aria-label="Consigner une séance">
              <span className="tab-diamond">{Icons.plus}</span>
              <span>Consigner</span>
            </button>
          </li>
          {TABS.slice(2).map((t) => (
            <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
          ))}
        </ul>
      </nav>

      {log && <LogSheet data={data} session={log.session} onClose={() => setLog(null)} />}
      {stampText && (
        <div className="stamp-layer" aria-live="polite">
          <div className="stamp">{stampText}</div>
        </div>
      )}
      <Promotion data={data} />
    </UIContext.Provider>
  );
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button className="tab" aria-current={active ? 'page' : undefined} onClick={onClick}>
        {icon}
        <span>{label}</span>
      </button>
    </li>
  );
}

/** Affiche la montée en grade une seule fois, puis l'enregistre. */
function Promotion({ data }: { data: Data }) {
  const best = data.ranks.reduce((m, r) => Math.max(m, r.rank), -1);
  const promoted = best >= 0 && data.rank > best;

  useEffect(() => {
    if (best < 0) void db.ranks.put({ rank: data.rank, unlockedAt: Date.now() });
  }, [best, data.rank]);

  if (!promoted) return null;
  const confirm = () => {
    const now = Date.now();
    void db.ranks.bulkPut(
      Array.from({ length: data.rank - best }, (_, i) => ({ rank: best + 1 + i, unlockedAt: now })),
    );
  };
  return (
    <div className="promotion" role="alertdialog" aria-labelledby="promo-title">
      <p className="kicker">Promotion</p>
      <Insignia rank={data.rank} size={150} />
      <h1 id="promo-title">{RANKS[data.rank].name}</h1>
      <p className="muted">Grade obtenu par ton assiduité au plan.</p>
      <button className="btn btn--brass" onClick={confirm}>
        Prendre le grade
      </button>
    </div>
  );
}
