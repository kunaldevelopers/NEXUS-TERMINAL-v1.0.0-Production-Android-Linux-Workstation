import React, { useEffect, useState } from 'react';
import {
  ArrowUpCircle,
  Download,
  FileCode2,
  Info,
  Package,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { nexusBridge } from '../bridge/nexusBridge';
import { LogConsole } from '../components/common/MetricGauge';

export default function PackagesPage() {
  const { theme, environments, defaultEnvId } = useNexus();
  const [envId, setEnvId] = useState('');
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [pkgInfo, setPkgInfo] = useState(null);
  const [repoFile, setRepoFile] = useState({ path: '', content: '' });
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!envId && (defaultEnvId || environments[0])) {
      setEnvId(defaultEnvId || environments[0].envId);
    }
  }, [defaultEnvId, environments, envId]);

  useEffect(() => {
    let handle = null;
    nexusBridge.pkg
      .addLogListener((ev) => {
        if (ev?.line) {
          setLogs((prev) => [...prev.slice(-250), ev.line]);
        }
      })
      .then((h) => {
        handle = h;
      });
    return () => handle?.remove?.();
  }, []);

  const currentEnv = environments.find((e) => e.envId === envId);

  const appendLog = (msg) => setLogs((prev) => [...prev.slice(-250), msg]);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!envId || !query.trim()) return;
    setBusy(true);
    try {
      const res = await nexusBridge.pkg.search(envId, query.trim());
      setSearchResults(res.packages || []);
      if (res.rawLog) appendLog(res.rawLog);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadInstalled = async () => {
    if (!envId) return;
    setBusy(true);
    try {
      const res = await nexusBridge.pkg.listInstalled(envId);
      setInstalled(res.packages || []);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadRepos = async () => {
    if (!envId) return;
    setBusy(true);
    try {
      const res = await nexusBridge.pkg.getRepositories(envId);
      setRepoFile({ path: res.filePath || '', content: res.content || '' });
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async (pkgName) => {
    if (!envId) return;
    setBusy(true);
    appendLog(`$ [${currentEnv?.pkgManager}] installing ${pkgName}...`);
    try {
      const res = await nexusBridge.pkg.install(envId, pkgName);
      appendLog(res.output || `Finished with exit code ${res.exitCode}`);
      if (tab === 'installed') loadInstalled();
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (pkgName) => {
    if (!envId) return;
    setBusy(true);
    appendLog(`$ [${currentEnv?.pkgManager}] removing ${pkgName}...`);
    try {
      const res = await nexusBridge.pkg.remove(envId, pkgName);
      appendLog(res.output || `Finished with exit code ${res.exitCode}`);
      loadInstalled();
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleInspect = async (pkgName) => {
    if (!envId) return;
    setBusy(true);
    try {
      const res = await nexusBridge.pkg.getInfo(envId, pkgName);
      setPkgInfo({ name: pkgName, details: res.info || res.output || '' });
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateSystem = async (upgrade) => {
    if (!envId) return;
    setBusy(true);
    appendLog(`$ [${currentEnv?.pkgManager}] ${upgrade ? 'full upgrade' : 'updating index'}...`);
    try {
      const res = await nexusBridge.pkg.updateAll(envId, upgrade);
      appendLog(res.output || `Exit ${res.exitCode}`);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: theme.ui.success }} />
            Package Manager Dashboard
          </h1>
          <p className="text-xs opacity-70">
            Strictly isolated native package management per distribution (`apt`, `apk`, `pacman`).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={envId}
            onChange={(e) => setEnvId(e.target.value)}
            className="p-2 rounded-xl border bg-black/40 text-xs outline-none"
            style={{ borderColor: theme.ui.border }}
          >
            {environments.length === 0 && <option value="">No Linux Distros Installed</option>}
            {environments.map((e) => (
              <option key={e.envId} value={e.envId}>
                {e.name} [{e.pkgManager}]
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!envId || busy}
            onClick={() => handleUpdateSystem(false)}
            className="px-3 py-2 rounded-xl text-xs font-semibold border hover:bg-white/5 flex items-center gap-1.5 disabled:opacity-40"
            style={{ borderColor: theme.ui.border }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Update Index
          </button>

          <button
            type="button"
            disabled={!envId || busy}
            onClick={() => handleUpdateSystem(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-black flex items-center gap-1.5 disabled:opacity-40"
            style={{ backgroundColor: theme.ui.success }}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" /> Upgrade
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2" style={{ borderColor: theme.ui.border }}>
        {[
          { id: 'search', label: 'Search & Install' },
          { id: 'installed', label: 'Installed Packages' },
          { id: 'repos', label: 'Repositories' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === 'installed') loadInstalled();
              if (t.id === 'repos') loadRepos();
            }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition"
            style={{
              backgroundColor: tab === t.id ? `${theme.ui.accent}22` : 'transparent',
              color: tab === t.id ? theme.ui.accent : '#9CA3AF',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search packages (e.g. python3, nodejs, git, nmap, vim, htop)..."
              className="flex-1 p-2.5 rounded-xl border bg-black/40 text-xs font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <button
              type="submit"
              disabled={!envId || busy}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-black flex items-center gap-1.5 disabled:opacity-40"
              style={{ backgroundColor: theme.ui.accent }}
            >
              <Search className="w-3.5 h-3.5" /> Search
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {searchResults.map((pkg) => (
              <div
                key={pkg.name}
                className="p-3 rounded-xl border flex items-center justify-between gap-2"
                style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold truncate" style={{ color: theme.ui.accent }}>
                    {pkg.name}
                  </div>
                  <div className="text-[11px] opacity-70 truncate">{pkg.description || pkg.version}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleInspect(pkg.name)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15"
                    title="Package Info & Dependencies"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleInstall(pkg.name)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-black flex items-center gap-1"
                    style={{ backgroundColor: theme.ui.success }}
                  >
                    <Download className="w-3 h-3" /> Install
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'installed' && (
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="opacity-70">{installed.length} installed packages</span>
            <button
              type="button"
              onClick={loadInstalled}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15"
            >
              Reload
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
            {installed.map((pkg) => (
              <div
                key={pkg.name}
                className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                style={{ backgroundColor: theme.ui.bgSecondary, borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold truncate">{pkg.name}</div>
                  <div className="text-[10px] font-mono opacity-60 truncate">{pkg.version}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleInspect(pkg.name)}
                    className="p-1.5 rounded-lg bg-white/10"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(pkg.name)}
                    className="p-1.5 rounded-lg bg-red-500/15 text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'repos' && (
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono flex items-center gap-1.5" style={{ color: theme.ui.accent }}>
              <FileCode2 className="w-4 h-4" />
              {repoFile.path || 'Distribution Repository File'}
            </span>
            <button
              type="button"
              onClick={async () => {
                await nexusBridge.pkg.saveRepositories(envId, repoFile.path, repoFile.content);
                appendLog(`Saved ${repoFile.path}`);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-black"
              style={{ backgroundColor: theme.ui.accent }}
            >
              Save Repositories
            </button>
          </div>
          <textarea
            value={repoFile.content}
            onChange={(e) => setRepoFile((p) => ({ ...p, content: e.target.value }))}
            rows={10}
            className="w-full p-3 rounded-xl border bg-black/50 font-mono text-xs outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
        </div>
      )}

      {pkgInfo && (
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.accent }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold" style={{ color: theme.ui.accent }}>
              Package Metadata & Dependencies: {pkgInfo.name}
            </span>
            <button type="button" onClick={() => setPkgInfo(null)} className="text-xs opacity-70">
              Close
            </button>
          </div>
          <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto opacity-85">
            {pkgInfo.details}
          </pre>
        </div>
      )}

      <LogConsole
        title={`Package Manager Output (${currentEnv ? `${currentEnv.name} • ${currentEnv.pkgManager}` : 'No Distro'})`}
        lines={logs}
        onClear={() => setLogs([])}
      />
    </div>
  );
}

