import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2,
  Cpu,
  FolderGit2,
  Globe,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Terminal,
} from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { nexusBridge } from '../bridge/nexusBridge';
import { LogConsole } from '../components/common/MetricGauge';

const RUNTIMES = [
  { id: 'node', label: 'Node.js & npm', cmd: 'node -v && npm -v', apt: 'nodejs npm', apk: 'nodejs npm', pacman: 'nodejs npm' },
  { id: 'python', label: 'Python 3 & pip', cmd: 'python3 --version && pip3 --version', apt: 'python3 python3-pip python3-venv', apk: 'python3 py3-pip', pacman: 'python python-pip' },
  { id: 'git', label: 'Git', cmd: 'git --version', apt: 'git', apk: 'git', pacman: 'git' },
  { id: 'gcc', label: 'C / C++ (GCC)', cmd: 'gcc --version | head -n1', apt: 'build-essential', apk: 'build-base', pacman: 'base-devel' },
  { id: 'go', label: 'Go', cmd: 'go version', apt: 'golang', apk: 'go', pacman: 'go' },
  { id: 'rust', label: 'Rust (rustc/cargo)', cmd: 'rustc --version', apt: 'rustc cargo', apk: 'rust cargo', pacman: 'rust' },
  { id: 'java', label: 'Java (OpenJDK)', cmd: 'java -version 2>&1 | head -n1', apt: 'default-jdk', apk: 'openjdk17', pacman: 'jdk-openjdk' },
  { id: 'php', label: 'PHP', cmd: 'php -v | head -n1', apt: 'php-cli', apk: 'php', pacman: 'php' },
];

const PROJECT_TEMPLATES = [
  {
    id: 'node-express',
    label: 'Express.js API (Node)',
    files: {
      'package.json': JSON.stringify({ name: 'nexus-express', version: '1.0.0', type: 'module', scripts: { start: 'node index.js' }, dependencies: { express: '^4.21.0' } }, null, 2),
      'index.js': "import http from 'http';\nconst port = process.env.PORT || 3000;\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({ app: 'NEXUS TERMINAL', runtime: process.version, arch: process.arch, url: req.url }));\n});\nserver.listen(port, '127.0.0.1', () => console.log(`Server listening on http://127.0.0.1:${port}`));\n",
    },
    runCmd: 'node index.js',
  },
  {
    id: 'python-flask',
    label: 'Python HTTP / Flask App',
    files: {
      'app.py': "from http.server import HTTPServer, BaseHTTPRequestHandler\nimport json, platform\n\nclass Handler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200)\n        self.send_header('Content-Type', 'application/json')\n        self.end_headers()\n        self.wfile.write(json.dumps({'nexus': True, 'python': platform.python_version(), 'arch': platform.machine()}).encode())\n\nprint('Serving on http://127.0.0.1:8000', flush=True)\nHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()\n",
    },
    runCmd: 'python3 app.py',
  },
  {
    id: 'c-hello',
    label: 'C Native Binary',
    files: {
      'main.c': '#include <stdio.h>\n#include <sys/utsname.h>\nint main() {\n  struct utsname u;\n  uname(&u);\n  printf("NEXUS C11 Binary running on %s (%s)\\n", u.sysname, u.machine);\n  return 0;\n}\n',
    },
    runCmd: 'gcc -O2 main.c -o app && ./app',
  },
  {
    id: 'go-cli',
    label: 'Go Microservice',
    files: {
      'main.go': 'package main\nimport ("fmt"; "runtime")\nfunc main() {\n\tfmt.Printf("NEXUS Go %s on %s/%s\\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)\n}\n',
    },
    runCmd: 'go run main.go',
  },
];

export default function DevToolsPage() {
  const navigate = useNavigate();
  const { theme, environments, defaultEnvId, createTerminalTab } = useNexus();
  const [envId, setEnvId] = useState('');
  const [tab, setTab] = useState('runtimes');
  const [runtimeStatus, setRuntimeStatus] = useState({});
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  // Project / Editor state
  const [projectName, setProjectName] = useState('nexus-app');
  const [selectedTemplate, setSelectedTemplate] = useState('node-express');
  const [editorPath, setEditorPath] = useState('/root/projects/nexus-app/index.js');
  const [editorContent, setEditorContent] = useState('');
  const [envVarsText, setEnvVarsText] = useState('PORT=3000\nNODE_ENV=development');
  const [ports, setPorts] = useState([]);
  const [previewPort, setPreviewPort] = useState('3000');
  const [previewUrl, setPreviewUrl] = useState('');
  const [gitDir, setGitDir] = useState('/root/projects/nexus-app');
  const [gitRemoteUrl, setGitRemoteUrl] = useState('');

  useEffect(() => {
    if (!envId && (defaultEnvId || environments[0])) {
      setEnvId(defaultEnvId || environments[0].envId);
    }
  }, [defaultEnvId, environments, envId]);

  const currentEnv = environments.find((e) => e.envId === envId);
  const appendLog = (msg) => setLogs((prev) => [...prev.slice(-200), msg]);

  const runInDistro = async (cmd) => {
    if (!envId) throw new Error('Install and select a Linux distribution first.');
    const res = await nexusBridge.terminal.runCommandCapture({
      envId,
      command: cmd,
      cwd: '/root',
    });
    return res;
  };

  const probeRuntimes = async () => {
    if (!envId) return;
    setBusy(true);
    try {
      const checks = RUNTIMES.map((r) => `printf "${r.id}="; (${r.cmd}) 2>/dev/null || echo "NOT_INSTALLED"`).join('; ');
      const res = await runInDistro(checks);
      const map = {};
      (res.stdout || '').split('\n').forEach((line) => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });
      setRuntimeStatus(map);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const installRuntime = async (rt) => {
    if (!currentEnv) return;
    setBusy(true);
    const pkgList = rt[currentEnv.pkgManager] || rt.apt;
    appendLog(`Installing ${rt.label} (${pkgList})...`);
    try {
      const res = await nexusBridge.pkg.install(envId, pkgList);
      appendLog(res.output || `Exit ${res.exitCode}`);
      await probeRuntimes();
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const scaffoldProject = async () => {
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!tpl || !envId) return;
    setBusy(true);
    const dir = `/root/projects/${projectName.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    try {
      await runInDistro(`mkdir -p "${dir}"`);
      const entries = Object.entries(tpl.files);
      for (const [fname, content] of entries) {
        const b64 = btoa(unescape(encodeURIComponent(content)));
        await runInDistro(`printf '%s' '${b64}' | base64 -d > "${dir}/${fname}"`);
      }
      const firstFile = entries[0][0];
      setEditorPath(`${dir}/${firstFile}`);
      setEditorContent(entries[0][1]);
      setGitDir(dir);
      appendLog(`Created project at ${dir} (${entries.map((e) => e[0]).join(', ')})`);
      setTab('editor');
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadEditorFile = async () => {
    try {
      const res = await runInDistro(`cat "${editorPath}"`);
      if (res.exitCode !== 0) throw new Error(res.stderr || 'Cannot read file');
      setEditorContent(res.stdout || '');
      appendLog(`Loaded ${editorPath}`);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    }
  };

  const saveEditorFile = async () => {
    try {
      const b64 = btoa(unescape(encodeURIComponent(editorContent)));
      const res = await runInDistro(`mkdir -p "$(dirname "${editorPath}")" && printf '%s' '${b64}' | base64 -d > "${editorPath}"`);
      if (res.exitCode !== 0) throw new Error(res.stderr || 'Save failed');
      appendLog(`Saved ${editorPath}`);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    }
  };

  const executeActiveFile = async () => {
    const ext = editorPath.split('.').pop()?.toLowerCase();
    const envExport = envVarsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => `export ${l}`)
      .join('; ');
    const dir = editorPath.substring(0, editorPath.lastIndexOf('/')) || '/root';
    let runCmd = `sh "${editorPath}"`;
    if (ext === 'js' || ext === 'mjs') runCmd = `node "${editorPath}"`;
    else if (ext === 'py') runCmd = `python3 "${editorPath}"`;
    else if (ext === 'c') runCmd = `gcc -O2 "${editorPath}" -o /tmp/nexus_bin && /tmp/nexus_bin`;
    else if (ext === 'cpp') runCmd = `g++ -O2 "${editorPath}" -o /tmp/nexus_bin && /tmp/nexus_bin`;
    else if (ext === 'go') runCmd = `go run "${editorPath}"`;
    else if (ext === 'rs') runCmd = `rustc "${editorPath}" -o /tmp/nexus_rs && /tmp/nexus_rs`;
    else if (ext === 'php') runCmd = `php "${editorPath}"`;

    await createTerminalTab({
      envId,
      cwd: dir,
      initialCommand: `${envExport ? envExport + '; ' : ''}cd "${dir}" && ${runCmd}`,
      title: `Run: ${editorPath.split('/').pop()}`,
    });
    navigate('/terminal');
  };

  const scanPorts = async () => {
    try {
      const res = await runInDistro(
        `ss -tuln 2>/dev/null || netstat -tuln 2>/dev/null || cat /proc/net/tcp /proc/net/tcp6`
      );
      const lines = (res.stdout || '').split('\n').filter(Boolean);
      setPorts(lines);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Code2 className="w-5 h-5" style={{ color: theme.ui.info }} />
            Developer Workstation
          </h1>
          <p className="text-xs opacity-70">
            Real Node.js, Python, C/C++, Go, Rust, Java, PHP, Git workflows, local servers, and live port inspection.
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

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2" style={{ borderColor: theme.ui.border }}>
        {[
          { id: 'runtimes', label: 'Runtimes & Compilers' },
          { id: 'scaffold', label: 'Projects & Templates' },
          { id: 'editor', label: 'Code Editor & Runner' },
          { id: 'git', label: 'Git Workflows' },
          { id: 'ports', label: 'Ports & Localhost Preview' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            style={{
              backgroundColor: tab === t.id ? `${theme.ui.accent}22` : 'transparent',
              color: tab === t.id ? theme.ui.accent : '#9CA3AF',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'runtimes' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs opacity-70">Probe installed compilers & runtimes inside {currentEnv?.name || 'distro'}</span>
            <button
              type="button"
              disabled={!envId || busy}
              onClick={probeRuntimes}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-black flex items-center gap-1.5"
              style={{ backgroundColor: theme.ui.accent }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Probe Runtimes
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {RUNTIMES.map((rt) => {
              const val = runtimeStatus[rt.id];
              const installed = val && val !== 'NOT_INSTALLED';
              return (
                <div
                  key={rt.id}
                  className="p-3.5 rounded-2xl border space-y-2.5"
                  style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{rt.label}</span>
                    <Cpu className="w-3.5 h-3.5 opacity-60" />
                  </div>
                  <div
                    className="text-[11px] font-mono truncate"
                    style={{ color: installed ? theme.ui.success : '#9CA3AF' }}
                  >
                    {val || 'Not probed yet'}
                  </div>
                  <button
                    type="button"
                    disabled={!envId || busy}
                    onClick={() => installRuntime(rt)}
                    className="w-full py-1.5 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/15"
                  >
                    {installed ? 'Reinstall / Update' : `Install (${currentEnv?.pkgManager || 'pkg'})`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'scaffold' && (
        <div
          className="rounded-2xl border p-4 space-y-4"
          style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
        >
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" style={{ color: theme.ui.accent }} />
            Scaffold Real Linux Project
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block opacity-70 mb-1">Project Folder Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
                style={{ borderColor: theme.ui.border }}
              />
            </div>
            <div>
              <label className="block opacity-70 mb-1">Template Stack</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
                style={{ borderColor: theme.ui.border }}
              >
                {PROJECT_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!envId || busy}
              onClick={scaffoldProject}
              className="px-4 py-2 rounded-xl text-xs font-bold text-black"
              style={{ backgroundColor: theme.ui.accent }}
            >
              Generate Project in /root/projects
            </button>
            <button
              type="button"
              disabled={!envId}
              onClick={async () => {
                await createTerminalTab({
                  envId,
                  initialCommand: 'mkdir -p /root/projects && cd /root/projects && ls -la',
                  title: 'Dev Shell',
                });
                navigate('/terminal');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-white/5 flex items-center gap-1.5"
              style={{ borderColor: theme.ui.border }}
            >
              <Terminal className="w-3.5 h-3.5" /> Open /root/projects in Terminal
            </button>
          </div>
        </div>
      )}

      {tab === 'editor' && (
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={editorPath}
              onChange={(e) => setEditorPath(e.target.value)}
              className="flex-1 p-2 rounded-xl border bg-black/40 font-mono text-xs outline-none"
              style={{ borderColor: theme.ui.border }}
              placeholder="/root/projects/app/main.py"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={loadEditorFile}
                className="px-3 py-2 rounded-xl text-xs bg-white/10 hover:bg-white/15"
              >
                Load
              </button>
              <button
                type="button"
                onClick={saveEditorFile}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/15 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button
                type="button"
                onClick={executeActiveFile}
                className="px-3 py-2 rounded-xl text-xs font-bold text-black flex items-center gap-1"
                style={{ backgroundColor: theme.ui.success }}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Run in Terminal
              </button>
            </div>
          </div>

          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            rows={14}
            spellCheck={false}
            placeholder="// Load or write real source code (.js, .py, .c, .cpp, .go, .rs, .php, .sh)"
            className="w-full p-3 rounded-xl border bg-[#05080F] font-mono text-xs leading-relaxed outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />

          <div>
            <label className="block text-[11px] opacity-70 mb-1">Environment Variables (KEY=VALUE per line)</label>
            <textarea
              value={envVarsText}
              onChange={(e) => setEnvVarsText(e.target.value)}
              rows={2}
              className="w-full p-2 rounded-xl border bg-black/40 font-mono text-xs outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>
      )}

      {tab === 'git' && (
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
        >
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FolderGit2 className="w-4 h-4" style={{ color: theme.ui.warning }} />
            Git & GitHub Operations
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <input
              type="text"
              value={gitDir}
              onChange={(e) => setGitDir(e.target.value)}
              placeholder="Repository directory in Linux rootfs"
              className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <input
              type="text"
              value={gitRemoteUrl}
              onChange={(e) => setGitRemoteUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'git init', cmd: `mkdir -p "${gitDir}" && cd "${gitDir}" && git init` },
              { label: 'git status', cmd: `cd "${gitDir}" && git status` },
              { label: 'git log -n 5', cmd: `cd "${gitDir}" && git log --oneline -n 5` },
              { label: 'git branch -a', cmd: `cd "${gitDir}" && git branch -a` },
              { label: 'git clone URL', cmd: `cd /root/projects && git clone "${gitRemoteUrl}"` },
            ].map((act) => (
              <button
                key={act.label}
                type="button"
                disabled={!envId}
                onClick={async () => {
                  try {
                    const res = await runInDistro(act.cmd);
                    appendLog(`$ ${act.cmd}\n${res.stdout || ''}${res.stderr || ''}`);
                  } catch (err) {
                    appendLog(`[ERROR] ${err.message}`);
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-mono bg-white/10 hover:bg-white/15"
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'ports' && (
        <div className="space-y-4">
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Server className="w-4 h-4" style={{ color: theme.ui.accent }} />
                Active Listening Sockets & Ports
              </h3>
              <button
                type="button"
                onClick={scanPorts}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-black"
                style={{ backgroundColor: theme.ui.accent }}
              >
                Scan Sockets
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-black/50 font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap">
              {ports.length > 0 ? ports.join('\n') : 'Click "Scan Sockets" to inspect real listening TCP/UDP ports.'}
            </pre>
          </div>

          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="w-4 h-4" style={{ color: theme.ui.success }} />
              <span className="text-sm font-bold">Localhost Dev Server Preview</span>
              <input
                type="number"
                value={previewPort}
                onChange={(e) => setPreviewPort(e.target.value)}
                className="w-24 p-1.5 rounded-lg border bg-black/40 font-mono text-xs outline-none"
                style={{ borderColor: theme.ui.border }}
              />
              <button
                type="button"
                onClick={() => setPreviewUrl(`http://127.0.0.1:${previewPort}`)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-black"
                style={{ backgroundColor: theme.ui.success }}
              >
                Load Preview
              </button>
            </div>
            {previewUrl && (
              <iframe
                title="Localhost Preview"
                src={previewUrl}
                className="w-full h-72 rounded-xl border border-white/15 bg-white"
              />
            )}
          </div>
        </div>
      )}

      <LogConsole title="Workstation Output" lines={logs} onClear={() => setLogs([])} />
    </div>
  );
}

