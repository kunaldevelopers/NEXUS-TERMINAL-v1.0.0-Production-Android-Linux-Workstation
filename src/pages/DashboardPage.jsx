import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  Code2,
  Cpu,
  FolderOpen,
  HardDrive,
  Info,
  KeyRound,
  Package,
  Play,
  RefreshCw,
  Shield,
  Terminal,
} from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { MetricGauge } from '../components/common/MetricGauge';
import { nexusBridge } from '../bridge/nexusBridge';

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    theme,
    environments,
    defaultEnvId,
    sessions,
    systemMetrics,
    refreshMetrics,
    createTerminalTab,
    setActiveSessionId,
  } = useNexus();

  useEffect(() => {
    refreshMetrics();
    const id = setInterval(refreshMetrics, 5000);
    return () => clearInterval(id);
  }, [refreshMetrics]);

  const defaultEnv = environments.find((e) => e.envId === defaultEnvId) || environments[0];
  const aliveCount = sessions.filter((s) => s.alive).length;

  const handleQuickLaunch = async (envId) => {
    try {
      await createTerminalTab({ envId });
      navigate('/terminal');
    } catch (err) {
      alert(err.message);
    }
  };

  const quickNav = [
    { to: '/terminal', label: 'Terminal', desc: 'PTY + PRoot Shell', icon: Terminal, color: theme.ui.accent },
    { to: '/distros', label: 'Linux Distros', desc: `${environments.length} installed`, icon: HardDrive, color: theme.ui.secondary },
    { to: '/packages', label: 'Packages', desc: 'apt / apk / pacman', icon: Package, color: theme.ui.success },
    { to: '/devtools', label: 'Dev Workstation', desc: 'Node, Py, Git, Build', icon: Code2, color: theme.ui.info },
    { to: '/cybersec', label: 'Cybersecurity', desc: 'Net & SSL Audit', icon: Shield, color: theme.ui.warning },
    { to: '/ssh', label: 'SSH & SFTP', desc: 'Encrypted Vault', icon: KeyRound, color: theme.ui.accent },
    { to: '/files', label: 'File Manager', desc: 'SAF + Linux Rootfs', icon: FolderOpen, color: theme.ui.secondary },
    { to: '/ai', label: 'AI Assistant', desc: 'Local / Cloud LLM', icon: Bot, color: theme.ui.success },
  ];

  const ramUsedMb = systemMetrics?.ramUsedMb || 0;
  const ramTotalMb = systemMetrics?.ramTotalMb || 1;
  const ramPct = Math.round((ramUsedMb / ramTotalMb) * 100);

  const storageUsedGb = systemMetrics?.storageUsedGb || 0;
  const storageTotalGb = systemMetrics?.storageTotalGb || 1;
  const storagePct = Math.round((storageUsedGb / storageTotalGb) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Hero Banner */}
      <section
        className="rounded-2xl border p-5 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.ui.bgSecondary}, ${theme.ui.bgElevated})`,
          borderColor: theme.ui.border,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border"
                style={{
                  borderColor: `${theme.ui.accent}55`,
                  backgroundColor: `${theme.ui.accent}18`,
                  color: theme.ui.accent,
                }}
              >
                NEXUS TERMINAL v1.0 • ARM64
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                style={{
                  backgroundColor: nexusBridge.isNative() ? `${theme.ui.success}20` : `${theme.ui.warning}20`,
                  color: nexusBridge.isNative() ? theme.ui.success : theme.ui.warning,
                }}
              >
                {nexusBridge.isNative() ? 'NATIVE PTY + PROOT READY' : 'WEB PREVIEW MODE'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Android Linux Workstation
            </h1>
            <p className="text-xs sm:text-sm opacity-75 max-w-2xl">
              Real ARM64 Linux distributions powered by POSIX PTY and unprivileged PRoot user-space isolation.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleQuickLaunch(defaultEnv?.envId)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-black flex items-center gap-2 shadow-lg active:scale-95 transition"
              style={{ backgroundColor: theme.ui.accent }}
            >
              <Play className="w-4 h-4 fill-current" />
              {defaultEnv ? `Launch ${defaultEnv.name}` : 'Open Shell'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/distros')}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border hover:bg-white/5 transition flex items-center gap-2"
              style={{ borderColor: theme.ui.border }}
            >
              <HardDrive className="w-4 h-4" style={{ color: theme.ui.secondary }} />
              Install Distro
            </button>
          </div>
        </div>
      </section>

      {/* Live Telemetry Row */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider opacity-70 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
            Live Device & Engine Telemetry
          </h2>
          <button
            type="button"
            onClick={refreshMetrics}
            className="text-xs flex items-center gap-1 opacity-75 hover:opacity-100"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricGauge
            label="CPU Usage"
            value={systemMetrics?.cpuUsagePercent != null ? `${systemMetrics.cpuUsagePercent}%` : 'N/A'}
            sub={systemMetrics?.cpuHardware || systemMetrics?.abi || 'ARM64'}
            percent={systemMetrics?.cpuUsagePercent || 0}
            color={theme.ui.accent}
          />
          <MetricGauge
            label="RAM Usage"
            value={systemMetrics?.ramTotalMb ? `${ramUsedMb} / ${ramTotalMb} MB` : 'N/A'}
            sub={`${ramPct}% allocated`}
            percent={ramPct}
            color={theme.ui.secondary}
          />
          <MetricGauge
            label="Internal Storage"
            value={systemMetrics?.storageTotalGb ? `${storageUsedGb.toFixed(1)} / ${storageTotalGb.toFixed(1)} GB` : 'N/A'}
            sub={`${systemMetrics?.storageFreeGb?.toFixed(1) ?? '--'} GB free`}
            percent={storagePct}
            color={theme.ui.info}
          />
          <MetricGauge
            label="Battery & Temp"
            value={systemMetrics?.batteryPercent != null ? `${systemMetrics.batteryPercent}%` : 'N/A'}
            sub={
              systemMetrics?.batteryTempC != null
                ? `${systemMetrics.batteryTempC.toFixed(1)}°C • ${systemMetrics.batteryStatus || 'Ready'}`
                : 'Android sensor'
            }
            percent={systemMetrics?.batteryPercent || 0}
            color={theme.ui.success}
          />
        </div>
      </section>

      {/* Active PTY Sessions + Installed Environments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4" style={{ color: theme.ui.accent }} />
              Active Terminal Sessions ({aliveCount})
            </h3>
            <button
              type="button"
              onClick={() => navigate('/terminal')}
              className="text-xs font-mono hover:underline"
              style={{ color: theme.ui.accent }}
            >
              Open Workspace
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-xs opacity-65 py-6 text-center border border-dashed rounded-xl border-white/10">
              No active PTY sessions. Launch a Linux distribution or Android shell to begin.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => {
                    setActiveSessionId(s.sessionId);
                    navigate('/terminal');
                  }}
                  className="w-full text-left p-3 rounded-xl border flex items-center justify-between hover:bg-white/5 transition"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: theme.ui.bgElevated }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{s.title || s.envId}</div>
                    <div className="text-[11px] font-mono opacity-65 truncate">
                      PID {s.pid} • {s.shell} • {s.cwd}
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono shrink-0"
                    style={{
                      backgroundColor: s.alive ? `${theme.ui.success}22` : `${theme.ui.error}22`,
                      color: s.alive ? theme.ui.success : theme.ui.error,
                    }}
                  >
                    {s.alive ? 'RUNNING' : `EXIT ${s.exitCode ?? '?'}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <HardDrive className="w-4 h-4" style={{ color: theme.ui.secondary }} />
              Installed Linux Environments ({environments.length})
            </h3>
            <button
              type="button"
              onClick={() => navigate('/distros')}
              className="text-xs font-mono hover:underline"
              style={{ color: theme.ui.secondary }}
            >
              Manage
            </button>
          </div>
          {environments.length === 0 ? (
            <div className="text-xs opacity-65 py-6 text-center border border-dashed rounded-xl border-white/10">
              No Linux distributions installed yet. Download Kali, Ubuntu, Debian, Alpine, Arch, or Parrot from Linux Distros.
            </div>
          ) : (
            <div className="space-y-2">
              {environments.map((env) => (
                <div
                  key={env.envId}
                  className="p-3 rounded-xl border flex items-center justify-between gap-2"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: theme.ui.bgElevated }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{env.name}</span>
                      {env.envId === defaultEnvId && (
                        <span
                          className="text-[10px] px-1.5 py-0.2 rounded font-mono"
                          style={{ backgroundColor: `${theme.ui.accent}22`, color: theme.ui.accent }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono opacity-65 truncate">
                      {env.distroId} • {env.version} • {env.sizeMb?.toFixed(1) ?? '0'} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickLaunch(env.envId)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black shrink-0"
                    style={{ backgroundColor: theme.ui.accent }}
                  >
                    Shell
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Module Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickNav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className="p-3.5 rounded-2xl border text-left hover:bg-white/5 active:scale-[0.98] transition space-y-2"
              style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${item.color}1E`, color: item.color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold">{item.label}</div>
                <div className="text-[11px] opacity-65 truncate">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Honest PRoot Disclosure */}
      <section
        className="rounded-2xl border p-4 flex items-start gap-3 text-xs"
        style={{
          backgroundColor: `${theme.ui.warning}10`,
          borderColor: `${theme.ui.warning}35`,
        }}
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.ui.warning }} />
        <div className="space-y-1 opacity-90">
          <div className="font-semibold" style={{ color: theme.ui.warning }}>
            Unprivileged PRoot Execution Notice
          </div>
          <p className="leading-relaxed">
            NEXUS TERMINAL uses PRoot ptrace syscall translation to provide isolated ARM64 Linux root filesystems and simulated UID 0 (`-0`) for package management (`apt`, `apk`, `pacman`) without rooting your phone. It does not replace the Android Linux kernel or grant raw hardware capabilities such as Wi-Fi monitor mode, packet injection, kernel modules, or unprivileged raw sockets.
          </p>
        </div>
      </section>
    </div>
  );
}

