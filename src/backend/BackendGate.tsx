import { useEffect, useState, type ReactNode } from 'react';
import type { BackendConfig } from './config';
import { createBackend } from './client';
import { loadPublicCatalog } from './catalog';
import { AccountPanel } from './AccountPanel';
import type { RealVenue } from '../domain/models';

export function BackendGate({ config, native, children }: { config: Extract<BackendConfig, { mode: 'backend' }>; native: boolean; children: (catalog: RealVenue[]) => ReactNode }) {
  const [client] = useState(() => createBackend(config, native));
  const [catalog, setCatalog] = useState<RealVenue[]>([]);
  const [status, setStatus] = useState('Loading backend discovery…');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      // Clear stale public eligibility on every refresh and failure, including backgrounding.
      setCatalog([]); setStatus('Loading backend discovery…');
      try {
        const result = await loadPublicCatalog(client);
        if (alive && current === generation) { setCatalog(result.venues); setStatus(result.venues.length ? 'Backend discovery. Promotions remain disabled.' : 'No published venues or offers. Publication is disabled.'); }
      } catch { if (alive && current === generation) { setCatalog([]); setStatus('Backend unavailable. No listings loaded.'); } }
    };
    void refresh();
    const visibility = () => { ++generation; setCatalog([]); if (document.visibilityState !== 'hidden') void refresh(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility);
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') void refresh(); }, 60000);
    return () => { alive = false; ++generation; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('focus', visibility); };
  }, [client, attempt]);
  return <>
    <section className="backend-status" aria-label="Local backend mode">
      <strong>LOCAL BACKEND TEST MODE · 21+ · No redemption</strong>
      {native && <p>DUSK_LOCAL_BACKEND_BUILD · Emulator testing only</p>}
      <p role="status">{status}</p><button onClick={() => retry(n => n + 1)}>Refresh backend</button>
      <AccountPanel client={client} />
    </section>
    {children(catalog)}
  </>;
}
