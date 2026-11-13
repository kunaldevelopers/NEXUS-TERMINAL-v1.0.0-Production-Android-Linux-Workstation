import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  Download,
  Edit3,
  HardDrive,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Square,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { DISTRO_CATALOG } from '../constants/distros';
import { useNexus } from '../state/NexusContext';
import { nexusBridge } from '../bridge/nexusBridge';
import { ConfirmModal } from '../components/common/MetricGauge';

export default function DistrosPage() {
  const navigate = useNavigate();
  const {
    theme,
    environments,
    defaultEnvId,
    refreshEnvironments,
    createTerminalTab,
    distroProgress,
  } = useNexus();

  const [selectedVariants, setSelectedVariants] = useState(() => {
    const map = {};
    DISTRO_CATALOG.forEach((d) => {
      map[d.id] = d.variants[0]?.id || 'default';
    });
    return map;
  });
  const [customNames, setCustomNames] = useState({});
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreForm, setRestoreForm] = useState({ name: '', distroId: 'debian', archivePath: '' });

  useEffect(() => {
    refreshEnvironments();
  }, [refreshEnvironments]);

  const handleInstall = async (distro) => {
    setErrorMsg('');
    setStatusMsg('');
    const variant = selectedVariants[distro.id];
    const customName = customNames[distro.id]?.trim();
    const envName = customName || `${distro.name} (${variant})`;
    const envId = `${distro.id}-${Date.now().toString(36)}`;
    try {
      await nexusBridge.distro.installDistro({
        envId,
        distroId: distro.id,
        variant,
        name: envName,
      });
      setStatusMsg(`Started installation for ${envName}`);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleLaunch = async (env) => {
    try {
      await createTerminalTab({ envId: env.envId, shell: env.defaultShell || '/bin/bash' });
      navigate('/terminal');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleBackup = async (env) => {
    setErrorMsg('');
    try {
      const res = await nexusBridge.distro.backupEnvironment(env.envId, '');
      setStatusMsg(`Backup created: ${res.backupPath} (${res.sizeMb?.toFixed(2)} MB)`);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRestore = async () => {
    setErrorMsg('');
    try {
      let archivePath = restoreForm.archivePath.trim();
      if (!archivePath) {
        const picked = await nexusBridge.files.pickSafFile();
        if (picked?.uri) {
          const imported = await nexusBridge.files.importSafToPath(
            picked.uri,
            'backups',
            picked.name || 'restore.tar.gz'
          );
          archivePath = imported.path;
        }
      }
      if (!archivePath) return;
      await nexusBridge.distro.restoreEnvironment({
        envId: `${restoreForm.distroId}-${Date.now().toString(36)}`,
        distroId: restoreForm.distroId,
        name: restoreForm.name || `Restored ${restoreForm.distroId}`,
        archivePath,
      });
      setRestoreOpen(false);
      setStatusMsg('Environment restored successfully.');
      refreshEnvironments();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const activeInstalls = Object.entries(distroProgress).filter(
    ([, p]) => p && p.phase !== 'completed' && p.phase !== 'error' && p.phase !== 'cancelled'
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="w-5 h-5" style={{ color: theme.ui.accent }} />
            Linux Distribution Manager
          </h1>
          <p className="text-xs opacity-70">
            Download, verify (SHA-256), launch, switch, backup, and manage independent ARM64 Linux root filesystems.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRestoreOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 hover:bg-white/5"
            style={{ borderColor: theme.ui.border }}
          >
            <Upload className="w-3.5 h-3.5" style={{ color: theme.ui.secondary }} />
            Restore Backup
          </button>
          <button
            type="button"
            onClick={refreshEnvironments}
            className="px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 hover:bg-white/5"
            style={{ borderColor: theme.ui.border }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className="p-3 rounded-xl border text-xs font-mono"
          style={{
            backgroundColor: `${theme.ui.success}15`,
            borderColor: `${theme.ui.success}40`,
            color: theme.ui.success,
          }}
        >
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div
          className="p-3 rounded-xl border text-xs font-mono"
          style={{
            backgroundColor: `${theme.ui.error}15`,
            borderColor: `${theme.ui.error}40`,
            color: theme.ui.error,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Active Downloads / Extractions */}
      {activeInstalls.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider opacity-70">Active Installations</h2>
          {activeInstalls.map(([envId, prog]) => (
            <div
              key={envId}
              className="p-4 rounded-2xl border space-y-2"
              style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.accent }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">
                  {prog.name || envId} — <span className="font-mono uppercase">{prog.phase}</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono" style={{ color: theme.ui.accent }}>
                    {prog.percent ?? 0}%
                  </span>
                  <button
                    type="button"
                    onClick={() => nexusBridge.distro.cancelInstall(envId).catch(() => {})}
                    className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${prog.percent ?? 0}%`, backgroundColor: theme.ui.accent }}
                />
              </div>
              <div className="text-[11px] font-mono opacity-70">{prog.message}</div>
            </div>
          ))}
        </section>
      )}

      {/* Installed Environments */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider opacity-70">
          Installed Environments ({environments.length})
        </h2>
        {environments.length === 0 ? (
          <div
            className="p-6 rounded-2xl border border-dashed text-center text-xs opacity-70"
            style={{ borderColor: theme.ui.border }}
          >
            No installed distributions yet. Choose a distribution below to download and install its verified ARM64 rootfs.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {environments.map((env) => (
              <div
                key={env.envId}
                className="p-4 rounded-2xl border space-y-3"
                style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{env.name}</span>
                      {env.envId === defaultEnvId && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1"
                          style={{ backgroundColor: `${theme.ui.accent}22`, color: theme.ui.accent }}
                        >
                          <Star className="w-2.5 h-2.5 fill-current" /> DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono opacity-65 mt-0.5">
                      {env.distroId.toUpperCase()} • {env.version} • {env.arch || 'aarch64'} • {env.pkgManager}
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono"
                    style={{
                      backgroundColor: env.runningCount > 0 ? `${theme.ui.success}22` : 'rgba(255,255,255,0.08)',
                      color: env.runningCount > 0 ? theme.ui.success : '#9CA3AF',
                    }}
                  >
                    {env.runningCount > 0 ? `ACTIVE (${env.runningCount})` : 'STOPPED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono p-2.5 rounded-xl bg-black/30">
                  <div>Storage: {env.sizeMb?.toFixed(1) ?? '0.0'} MB</div>
                  <div className="truncate">SHA256: {env.sha256 ? `${env.sha256.slice(0, 12)}...` : 'Verified'}</div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLaunch(env)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-black flex items-center gap-1"
                    style={{ backgroundColor: theme.ui.accent }}
                  >
                    <Play className="w-3 h-3 fill-current" /> Launch
                  </button>
                  <button
                    type="button"
                    onClick={() => nexusBridge.distro.stopEnvironment(env.envId).then(refreshEnvironments)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 flex items-center gap-1"
                  >
                    <Square className="w-3 h-3" /> Stop
                  </button>
                  {env.envId !== defaultEnvId && (
                    <button
                      type="button"
                      onClick={() => nexusBridge.distro.setDefaultEnvironment(env.envId).then(refreshEnvironments)}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRenameTarget(env);
                      setRenameValue(env.name);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBackup(env)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 flex items-center gap-1"
                  >
                    <Archive className="w-3 h-3" /> Backup
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(env)}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Downloadable ARM64 Distributions */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider opacity-70">
          Available ARM64 Distributions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DISTRO_CATALOG.map((distro) => (
            <div
              key={distro.id}
              className="rounded-2xl border p-4 flex flex-col justify-between gap-4"
              style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">{distro.name}</h3>
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold"
                        style={{ backgroundColor: `${distro.accent}24`, color: distro.accent }}
                      >
                        {distro.badge}
                      </span>
                    </div>
                    <div className="text-xs opacity-65">{distro.release} • {distro.arch}</div>
                  </div>
                  <span className="text-[11px] font-mono opacity-65">{distro.pkgManager}</span>
                </div>

                <p className="text-xs opacity-80 leading-relaxed">{distro.description}</p>

                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: theme.ui.success }}>
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{distro.sourceNote}</span>
                </div>

                <div className="space-y-2 pt-1">
                  <select
                    value={selectedVariants[distro.id]}
                    onChange={(e) =>
                      setSelectedVariants((prev) => ({ ...prev, [distro.id]: e.target.value }))
                    }
                    className="w-full p-2 rounded-xl border bg-black/40 text-xs outline-none"
                    style={{ borderColor: theme.ui.border }}
                  >
                    {distro.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={customNames[distro.id] || ''}
                    onChange={(e) =>
                      setCustomNames((prev) => ({ ...prev, [distro.id]: e.target.value }))
                    }
                    placeholder={`Environment label (optional, e.g. ${distro.id}-dev)`}
                    className="w-full p-2 rounded-xl border bg-black/40 text-xs outline-none font-mono"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="text-[11px] font-mono opacity-65">
                  ~{distro.estimatedDownloadMb} MB dl • ~{distro.estimatedDiskMb} MB disk
                </div>
                <button
                  type="button"
                  onClick={() => handleInstall(distro)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-black flex items-center gap-1.5 active:scale-95 transition"
                  style={{ backgroundColor: distro.accent }}
                >
                  <Download className="w-3.5 h-3.5" /> Install
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        danger
        title="Delete Linux Environment?"
        message={`This permanently removes "${confirmDelete?.name}" and its entire rootfs directory (${confirmDelete?.sizeMb?.toFixed(1) ?? 0} MB).`}
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const target = confirmDelete;
          setConfirmDelete(null);
          try {
            await nexusBridge.distro.deleteEnvironment(target.envId);
            refreshEnvironments();
          } catch (err) {
            setErrorMsg(err.message);
          }
        }}
      />

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
          >
            <h3 className="text-sm font-bold">Rename Environment</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full p-2.5 rounded-xl border bg-black/40 text-xs outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await nexusBridge.distro.renameEnvironment(renameTarget.envId, renameValue);
                  setRenameTarget(null);
                  refreshEnvironments();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-black"
                style={{ backgroundColor: theme.ui.accent }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div
            className="w-full max-w-md rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
          >
            <h3 className="text-sm font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4" style={{ color: theme.ui.accent }} />
              Restore Distribution Backup
            </h3>
            <div className="space-y-2.5 text-xs">
              <input
                type="text"
                placeholder="New environment name"
                value={restoreForm.name}
                onChange={(e) => setRestoreForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
                style={{ borderColor: theme.ui.border }}
              />
              <select
                value={restoreForm.distroId}
                onChange={(e) => setRestoreForm((p) => ({ ...p, distroId: e.target.value }))}
                className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
                style={{ borderColor: theme.ui.border }}
              >
                {DISTRO_CATALOG.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.pkgManager})
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Path to .tar.gz / .tar.xz (leave blank to pick via Android SAF)"
                value={restoreForm.archivePath}
                onChange={(e) => setRestoreForm((p) => ({ ...p, archivePath: e.target.value }))}
                className="w-full p-2.5 rounded-xl border bg-black/40 outline-none font-mono"
                style={{ borderColor: theme.ui.border }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreOpen(false)}
                className="px-3 py-2 rounded-xl text-xs bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestore}
                className="px-3 py-2 rounded-xl text-xs font-bold text-black"
                style={{ backgroundColor: theme.ui.accent }}
              >
                Restore Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

