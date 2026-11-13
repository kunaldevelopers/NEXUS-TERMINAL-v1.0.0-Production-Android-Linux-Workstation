import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Globe, Lock, Radar, Shield, Terminal } from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { nexusBridge } from '../bridge/nexusBridge';
import { LogConsole } from '../components/common/MetricGauge';

const SECURITY_TOOLS = [
  { id: 'nmap', label: 'Nmap', apt: 'nmap', apk: 'nmap', pacman: 'nmap', rootNote: 'TCP connect scan works unprivileged; SYN/OS scan needs CAP_NET_RAW (root)' },
  { id: 'openssl', label: 'OpenSSL', apt: 'openssl', apk: 'openssl', pacman: 'openssl', rootNote: 'Unprivileged' },
  { id: 'nc', label: 'Netcat', apt: 'netcat-openbsd', apk: 'netcat-openbsd', pacman: 'openbsd-netcat', rootNote: 'Unprivileged (ports > 1024)' },
  { id: 'whois', label: 'Whois', apt: 'whois', apk: 'whois', pacman: 'whois', rootNote: 'Unprivileged' },
  { id: 'dig', label: 'Dig / DNSUtils', apt: 'dnsutils', apk: 'bind-tools', pacman: 'bind', rootNote: 'Unprivileged' },
  { id: 'traceroute', label: 'Traceroute', apt: 'traceroute', apk: 'traceroute', pacman: 'traceroute', rootNote: 'UDP/ICMP may require privileges on some kernels' },
  { id: 'curl', label: 'cURL', apt: 'curl', apk: 'curl', pacman: 'curl', rootNote: 'Unprivileged' },
  { id: 'wget', label: 'Wget', apt: 'wget', apk: 'wget', pacman: 'wget', rootNote: 'Unprivileged' },
  { id: 'ssh', label: 'OpenSSH Client', apt: 'openssh-client', apk: 'openssh-client', pacman: 'openssh', rootNote: 'Unprivileged' },
  { id: 'tcpdump', label: 'tcpdump', apt: 'tcpdump', apk: 'tcpdump', pacman: 'tcpdump', rootNote: 'Requires root / AF_PACKET; blocked on unrooted Android' },
];

export default function CybersecPage() {
  const { theme, environments, defaultEnvId } = useNexus();
  const [envId, setEnvId] = useState('');
  const [target, setTarget] = useState('example.com');
  const [port, setPort] = useState('443');
  const [toolStatus, setToolStatus] = useState({});
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!envId && (defaultEnvId || environments[0])) {
      setEnvId(defaultEnvId || environments[0].envId);
    }
  }, [defaultEnvId, environments, envId]);

  const currentEnv = environments.find((e) => e.envId === envId);
  const appendLog = (line) => setLogs((prev) => [...prev.slice(-250), line]);

  const checkTools = async () => {
    if (!envId) return;
    setBusy(true);
    try {
      const checks = SECURITY_TOOLS.map((t) => `printf "${t.id}="; which ${t.id} 2>/dev/null || echo "MISSING"`).join('; ');
      const res = await nexusBridge.terminal.runCommandCapture({ envId, command: checks, cwd: '/root' });
      const map = {};
      (res.stdout || '').split('\n').forEach((l) => {
        const i = l.indexOf('=');
        if (i > 0) map[l.slice(0, i).trim()] = l.slice(i + 1).trim();
      });
      setToolStatus(map);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const runTool = async (label, command) => {
    if (!envId) {
      appendLog('[ERROR] Select an installed Linux distribution first.');
      return;
    }
    setBusy(true);
    appendLog(`\n$ [${label}] ${command}`);
    try {
      const res = await nexusBridge.terminal.runCommandCapture({
        envId,
        command,
        cwd: '/root',
      });
      if (res.stdout) appendLog(res.stdout.trimEnd());
      if (res.stderr) appendLog(`[stderr] ${res.stderr.trimEnd()}`);
      appendLog(`[exit code: ${res.exitCode}]`);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const installTool = async (tool) => {
    if (!currentEnv) return;
    setBusy(true);
    const pkg = tool[currentEnv.pkgManager] || tool.apt;
    appendLog(`Installing ${tool.label} (${pkg})...`);
    try {
      const res = await nexusBridge.pkg.install(envId, pkg);
      appendLog(res.output || `Exit ${res.exitCode}`);
      await checkTools();
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const safeTarget = target.replace(/[^a-zA-Z0-9.:/_-]/g, '');
  const safePort = String(port).replace(/[^0-9-]/g, '') || '443';

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: theme.ui.warning }} />
            Cybersecurity & Network Audit Lab
          </h1>
          <p className="text-xs opacity-70">
            Authorized diagnostics, DNS lookup, TLS inspection, HTTP probing, and TCP connect scanning via real Linux utilities.
          </p>
        </div>
        <select
          value={envId}
          onChange={(e) => setEnvId(e.target.value)}
          className="p-2 rounded-xl border bg-black/40 text-xs outline-none"
          style={{ borderColor: theme.ui.border }}
        >
          {environments.length === 0 && <option value="">Install a Distro First</option>}
          {environments.map((e) => (
            <option key={e.envId} value={e.envId}>
              {e.name} ({e.distroId})
            </option>
          ))}
        </select>
      </div>

      {/* Privilege & Capability Honest Notice */}
      <div
        className="rounded-2xl border p-3.5 flex items-start gap-3 text-xs"
        style={{ backgroundColor: `${theme.ui.warning}10`, borderColor: `${theme.ui.warning}38` }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.ui.warning }} />
        <div className="space-y-1 opacity-90">
          <div className="font-bold" style={{ color: theme.ui.warning }}>
            Android Unrooted Network & Privilege Boundaries
          </div>
          <p>
            On unrooted Android devices inside PRoot, TCP connect scans (`nmap -sT`), DNS queries (`dig`, `whois`), HTTP/TLS inspection (`curl`, `openssl`), and SSH work natively. Raw packet capture (`tcpdump`), SYN stealth scans (`nmap -sS`), Wi-Fi monitor mode, and packet injection require kernel root (`CAP_NET_RAW` / `CAP_NET_ADMIN`) or external USB OTG adapters with kernel driver support, and are NOT available on standard unrooted Android. Use only on authorized targets.
          </p>
        </div>
      </div>

      {/* Target Bar & Quick Audits */}
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target host / IP (e.g. scanme.nmap.org)"
            className="sm:col-span-2 p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
            style={{ borderColor: theme.ui.border }}
          />
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="Port / range (e.g. 443 or 22,80,443)"
            className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
            style={{ borderColor: theme.ui.border }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => runTool('Nmap TCP Connect', `nmap -sT -Pn -p "${safePort}" "${safeTarget}"`)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-black flex items-center gap-1"
            style={{ backgroundColor: theme.ui.accent }}
          >
            <Radar className="w-3.5 h-3.5" /> Port Scan (-sT)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runTool('OpenSSL Cert', `echo | openssl s_client -servername "${safeTarget}" -connect "${safeTarget}:${safePort.split(',')[0]}" 2>/dev/null | openssl x509 -noout -subject -issuer -dates -fingerprint -sha256`)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" /> SSL Cert Info
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runTool('DNS Dig', `dig +noall +answer "${safeTarget}" ANY`)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 flex items-center gap-1"
          >
            <Globe className="w-3.5 h-3.5" /> DNS Dig
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runTool('Whois', `whois "${safeTarget}" | head -n 45`)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15"
          >
            Whois
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runTool('HTTP Headers', `curl -ILs --max-time 8 "https://${safeTarget}"`)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15"
          >
            HTTP Headers
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runTool('Netcat Probe', `nc -zv -w 4 "${safeTarget}" ${safePort.split(',')[0]}`)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15"
          >
            Netcat Probe
          </button>
        </div>
      </div>

      {/* Tool Availability Matrix */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider opacity-70">Installed Tool Status</h2>
          <button
            type="button"
            disabled={!envId || busy}
            onClick={checkTools}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15"
          >
            Verify Tools
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {SECURITY_TOOLS.map((tool) => {
            const path = toolStatus[tool.id];
            const ok = path && path !== 'MISSING';
            return (
              <div
                key={tool.id}
                className="p-3 rounded-xl border flex items-center justify-between gap-2"
                style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>{tool.label}</span>
                    {ok && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: theme.ui.success }} />}
                  </div>
                  <div className="text-[10px] opacity-65 truncate">{tool.rootNote}</div>
                </div>
                <button
                  type="button"
                  disabled={!envId || busy}
                  onClick={() => installTool(tool)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/15 shrink-0"
                >
                  {ok ? 'Installed' : 'Install'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <LogConsole title="Security Utility Output" lines={logs} onClear={() => setLogs([])} />
    </div>
  );
}

