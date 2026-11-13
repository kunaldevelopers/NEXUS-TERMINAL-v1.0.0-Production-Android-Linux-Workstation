import React, { useEffect, useState } from 'react';
import { Activity, Cpu, RefreshCw, Skull, Wifi } from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { MetricGauge } from '../components/common/MetricGauge';
import { nexusBridge } from '../bridge/nexusBridge';

export default function SystemMonitorPage() {
  const { theme, systemMetrics, refreshMetrics, sessions, environments } = useNexus();
  const [processes, setProcesses] = useState([]);

  const refreshAll = async () => {
    await refreshMetrics();
    try {
      const p = await nexusBridge.system.getProcesses();
      setProcesses(p.processes || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 3000);
    return () => clearInterval(id);
  }, []);

  const ramPct = systemMetrics?.ramTotalMb
    ? Math.round((systemMetrics.ramUsedMb / systemMetrics.ramTotalMb) * 100)
    : 0;
  const storagePct = systemMetrics?.storageTotalGb
    ? Math.round((systemMetrics.storageUsedGb / systemMetrics.storageTotalGb) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5" style={{ color: theme.ui.accent }} />
            System & Kernel Telemetry
          </h1>
          <p className="text-xs opacity-70">
            Real-time metrics read directly from Android APIs, `/proc/stat`, `/proc/meminfo`, and active PTY processes.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="px-3 py-2 rounded-xl text-xs border hover:bg-white/5 flex items-center gap-1.5"
          style={{ borderColor: theme.ui.border }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricGauge
          label="CPU Usage"
          value={systemMetrics?.cpuUsagePercent != null ? `${systemMetrics.cpuUsagePercent}%` : 'N/A'}
          sub={`${systemMetrics?.cpuCores ?? '--'} cores • ${systemMetrics?.abi || 'arm64'}`}
          percent={systemMetrics?.cpuUsagePercent || 0}
          color={theme.ui.accent}
        />
        <MetricGauge
          label="RAM Allocation"
          value={systemMetrics?.ramTotalMb ? `${systemMetrics.ramUsedMb}/${systemMetrics.ramTotalMb} MB` : 'N/A'}
          sub={`${ramPct}% used`}
          percent={ramPct}
          color={theme.ui.secondary}
        />
        <MetricGauge
          label="Storage (/data)"
          value={systemMetrics?.storageTotalGb ? `${systemMetrics.storageUsedGb.toFixed(1)}/${systemMetrics.storageTotalGb.toFixed(1)} GB` : 'N/A'}
          sub={`${systemMetrics?.storageFreeGb?.toFixed(1) ?? '--'} GB available`}
          percent={storagePct}
          color={theme.ui.info}
        />
        <MetricGauge
          label="Battery & Thermal"
          value={systemMetrics?.batteryPercent != null ? `${systemMetrics.batteryPercent}%` : 'N/A'}
          sub={systemMetrics?.batteryTempC != null ? `${systemMetrics.batteryTempC.toFixed(1)}°C • ${systemMetrics.batteryVoltageMv ?? '--'} mV` : 'N/A'}
          percent={systemMetrics?.batteryPercent || 0}
          color={theme.ui.success}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        <div className="rounded-2xl border p-4 space-y-2.5" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4" style={{ color: theme.ui.accent }} />
            Device & Kernel Details
          </h3>
          <div className="grid grid-cols-2 gap-y-2 font-mono text-[11px]">
            <span className="opacity-65">Device Model</span>
            <span>{systemMetrics?.deviceModel || 'Web Preview'}</span>
            <span className="opacity-65">Android Release</span>
            <span>{systemMetrics?.androidVersion ? `Android ${systemMetrics.androidVersion} (API ${systemMetrics.sdkInt})` : 'N/A'}</span>
            <span className="opacity-65">Primary ABI</span>
            <span>{systemMetrics?.supportedAbis || systemMetrics?.abi || 'arm64-v8a'}</span>
            <span className="opacity-65">Kernel</span>
            <span className="truncate">{systemMetrics?.kernelVersion || 'N/A'}</span>
            <span className="opacity-65">Root / PRoot</span>
            <span style={{ color: theme.ui.warning }}>
              {systemMetrics?.isRooted ? 'su binary detected' : 'Unrooted (PRoot user-space)'}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border p-4 space-y-2.5" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Wifi className="w-4 h-4" style={{ color: theme.ui.success }} />
            Network & Subsystems
          </h3>
          <div className="grid grid-cols-2 gap-y-2 font-mono text-[11px]">
            <span className="opacity-65">Network Transport</span>
            <span>{systemMetrics?.networkType || 'Unknown'}</span>
            <span className="opacity-65">Local IP(s)</span>
            <span className="truncate">{systemMetrics?.ipAddresses || 'None'}</span>
            <span className="opacity-65">Active PTY Sessions</span>
            <span>{sessions.filter((s) => s.alive).length} running / {sessions.length} total</span>
            <span className="opacity-65">Installed Distros</span>
            <span>{environments.length} environments</span>
          </div>
        </div>
      </div>

      {/* Live App & PRoot Processes */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
        <h3 className="font-bold text-sm">Active App & Linux Child Processes</h3>
        {processes.length === 0 ? (
          <div className="text-xs opacity-65 py-4 text-center">No active PTY or child Linux processes detected.</div>
        ) : (
          <div className="divide-y divide-white/10 font-mono text-xs">
            {processes.map((proc) => (
              <div key={proc.sessionId || proc.pid} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold truncate">
                    PID {proc.pid} • {proc.title || proc.envId}
                  </div>
                  <div className="text-[11px] opacity-65 truncate">
                    {proc.shell} • {proc.cwd} • {proc.alive ? 'RUNNING' : `EXITED (${proc.exitCode})`}
                  </div>
                </div>
                {proc.alive && proc.sessionId && (
                  <button
                    type="button"
                    onClick={() => nexusBridge.terminal.killSession(proc.sessionId).then(refreshAll)}
                    className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 flex items-center gap-1 shrink-0"
                  >
                    <Skull className="w-3 h-3" /> Kill
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

