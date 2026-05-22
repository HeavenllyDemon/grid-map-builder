import { useEffect, useState } from 'react';
import { Download, Power, RefreshCw, RotateCw } from 'lucide-react';

type UpdateStatus =
  | 'hidden'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'restarting'
  | 'error';

interface CheckResponse {
  ok: boolean;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  canDownload?: boolean;
  error?: string;
}

interface VersionResponse {
  ok: boolean;
  updateSupported: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });
  const data = (await res.json()) as T;
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export function UpdatePanel() {
  const [status, setStatus] = useState<UpdateStatus>('hidden');
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [shutDown, setShutDown] = useState(false);

  useEffect(() => {
    let alive = true;
    async function detectUpdater() {
      try {
        const version = await fetchJson<VersionResponse>('/api/version');
        if (!alive || !version.ok || !version.updateSupported) return;
        await checkForUpdates();
      } catch {
        if (alive) setStatus('hidden');
      }
    }
    detectUpdater();
    return () => {
      alive = false;
    };
  }, []);

  async function checkForUpdates() {
    setError(null);
    setStatus('checking');
    try {
      const data = await fetchJson<CheckResponse>('/api/update/check');
      setCurrentVersion(data.currentVersion);
      setLatestVersion(data.latestVersion);
      setStatus(data.updateAvailable && data.canDownload ? 'available' : 'current');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  async function downloadUpdate() {
    setError(null);
    setStatus('downloading');
    try {
      await fetchJson('/api/update/download', { method: 'POST' });
      setStatus('ready');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  async function restartToUpdate() {
    setError(null);
    setStatus('restarting');
    try {
      await fetchJson('/api/update/restart', { method: 'POST' });
      pollUntilBackOnline();
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  async function shutDownServer() {
    if (!window.confirm('Shut down Grid Map Builder?')) return;
    setError(null);
    setShuttingDown(true);
    try {
      await fetchJson('/api/shutdown', { method: 'POST' });
      setShutDown(true);
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
      setShuttingDown(false);
    }
  }

  function pollUntilBackOnline() {
    const startedAt = Date.now();
    const timer = window.setInterval(async () => {
      try {
        await fetchJson('/api/version');
        window.clearInterval(timer);
        window.location.reload();
      } catch {
        if (Date.now() - startedAt > 30000) {
          window.clearInterval(timer);
          setError('Restart is taking longer than expected. Reload the page after the server window comes back.');
          setStatus('error');
        }
      }
    }, 1200);
  }

  if (status === 'hidden') return null;

  const label =
    status === 'checking'
      ? 'Checking'
      : status === 'current'
        ? currentVersion
          ? `v${currentVersion}`
          : 'Up to date'
        : status === 'available'
          ? latestVersion
            ? `Update v${latestVersion}`
            : 'Update'
          : status === 'downloading'
            ? 'Downloading'
            : status === 'ready'
              ? 'Restart'
              : status === 'restarting'
                ? 'Restarting'
                : 'Update error';

  const icon =
    status === 'available' ? (
      <Download size={15} />
    ) : status === 'ready' || status === 'restarting' ? (
      <RotateCw size={15} />
    ) : (
      <RefreshCw size={15} className={status === 'checking' ? 'animate-spin' : ''} />
    );

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        className={status === 'available' || status === 'ready' ? 'btn-primary' : 'btn-secondary'}
        disabled={
          shutDown ||
          shuttingDown ||
          status === 'checking' ||
          status === 'downloading' ||
          status === 'restarting'
        }
        onClick={
          status === 'available'
            ? downloadUpdate
            : status === 'ready'
              ? restartToUpdate
              : checkForUpdates
        }
        title={error ?? 'Check for updates'}
      >
        {icon}
        {label}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={shutDown || shuttingDown || status === 'restarting'}
        onClick={shutDownServer}
        title="Shut down local server"
      >
        <Power size={15} />
        {shutDown ? 'Stopped' : shuttingDown ? 'Stopping' : 'Stop'}
      </button>
      {status === 'error' && error && (
        <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-red-500/30 bg-zinc-950 px-3 py-2 text-xs text-red-200 shadow-xl">
          {error}
        </div>
      )}
      {shutDown && (
        <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 shadow-xl">
          Server stopped. You can close this tab.
        </div>
      )}
    </div>
  );
}
