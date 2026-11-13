import React, { useEffect, useState } from 'react';
import {
  FolderUp,
  KeyRound,
  Network,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { nexusBridge } from '../bridge/nexusBridge';
import XtermViewport from '../components/Terminal/XtermViewport';

export default function SshManagerPage() {
  const { theme } = useNexus();
  const [tab, setTab] = useState('profiles');
  const [profiles, setProfiles] = useState([]);
  const [keys, setKeys] = useState([]);
  const [tunnels, setTunnels] = useState([]);
  const [activeSshId, setActiveSshId] = useState('');
  const [sftpPath, setSftpPath] = useState('.');
  const [sftpEntries, setSftpEntries] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    host: '',
    port: 22,
    username: 'root',
    authType: 'password',
    password: '',
    keyId: '',
  });
  const [keyForm, setKeyForm] = useState({ name: '', privateKeyPem: '', passphrase: '' });
  const [tunnelForm, setTunnelForm] = useState({ localPort: 8080, remoteHost: '127.0.0.1', remotePort: 80 });

  const loadAll = async () => {
    try {
      const [pRes, kRes, tRes] = await Promise.all([
        nexusBridge.ssh.listProfiles(),
        nexusBridge.ssh.listKeys(),
        nexusBridge.ssh.listTunnels(),
      ]);
      setProfiles(pRes.profiles || []);
      setKeys(kRes.keys || []);
      setTunnels(tRes.tunnels || []);
    } catch {
      // Ignore outside native
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await nexusBridge.ssh.saveProfile({ ...form, port: Number(form.port) || 22 });
      setForm({ name: '', host: '', port: 22, username: 'root', authType: 'password', password: '', keyId: '' });
      setStatusMsg('Profile saved securely in Android EncryptedSharedPreferences.');
      loadAll();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleConnect = async (profile) => {
    setErrorMsg('');
    setStatusMsg(`Connecting to ${profile.username}@${profile.host}:${profile.port}...`);
    try {
      const res = await nexusBridge.ssh.connect({ profileId: profile.profileId });
      setActiveSshId(res.sshSessionId);
      setTab('terminal');
      setStatusMsg(`Connected: ${profile.name}`);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSftpRefresh = async (path = sftpPath) => {
    if (!activeSshId) return;
    setErrorMsg('');
    try {
      const res = await nexusBridge.ssh.sftpList(activeSshId, path);
      setSftpPath(res.currentPath || path);
      setSftpEntries(res.entries || []);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <KeyRound className="w-5 h-5" style={{ color: theme.ui.accent }} />
            SSH, SFTP & Tunnel Manager
          </h1>
          <p className="text-xs opacity-70">
            Encrypted credential storage via Android Keystore, real JSch SSH shell, SFTP file browser, and port forwarding.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: theme.ui.success }}>
          <ShieldCheck className="w-4 h-4" />
          Encrypted Vault Active
        </div>
      </div>

      {statusMsg && (
        <div className="p-2.5 rounded-xl border text-xs font-mono" style={{ borderColor: `${theme.ui.success}44`, color: theme.ui.success }}>
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-2.5 rounded-xl border text-xs font-mono" style={{ borderColor: `${theme.ui.error}44`, color: theme.ui.error }}>
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2" style={{ borderColor: theme.ui.border }}>
        {[
          { id: 'profiles', label: `Profiles (${profiles.length})` },
          { id: 'terminal', label: 'SSH Terminal' },
          { id: 'sftp', label: 'SFTP Browser' },
          { id: 'tunnels', label: 'SSH Tunnels' },
          { id: 'keys', label: `SSH Keys (${keys.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === 'sftp' && activeSshId) handleSftpRefresh(sftpPath);
            }}
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

      {tab === 'profiles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border p-4 space-y-3 text-xs"
            style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
          >
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" style={{ color: theme.ui.accent }} />
              Add SSH Server Profile
            </h3>
            <input
              type="text"
              required
              placeholder="Profile Name (e.g. Prod VPS)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                placeholder="Host / IP"
                value={form.host}
                onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                className="col-span-2 p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
                style={{ borderColor: theme.ui.border }}
              />
              <input
                type="number"
                required
                placeholder="Port"
                value={form.port}
                onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))}
                className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
                style={{ borderColor: theme.ui.border }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
                style={{ borderColor: theme.ui.border }}
              />
              <select
                value={form.authType}
                onChange={(e) => setForm((p) => ({ ...p, authType: e.target.value }))}
                className="p-2.5 rounded-xl border bg-black/40 outline-none"
                style={{ borderColor: theme.ui.border }}
              >
                <option value="password">Password Auth</option>
                <option value="key">SSH Key Auth</option>
              </select>
            </div>
            {form.authType === 'password' ? (
              <input
                type="password"
                placeholder="Password (stored AES-256 encrypted)"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
                style={{ borderColor: theme.ui.border }}
              />
            ) : (
              <select
                value={form.keyId}
                onChange={(e) => setForm((p) => ({ ...p, keyId: e.target.value }))}
                className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
                style={{ borderColor: theme.ui.border }}
              >
                <option value="">Select Imported Key</option>
                {keys.map((k) => (
                  <option key={k.keyId} value={k.keyId}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-bold text-black"
              style={{ backgroundColor: theme.ui.accent }}
            >
              Save Encrypted Profile
            </button>
          </form>

          <div className="space-y-2.5">
            {profiles.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed text-center text-xs opacity-65" style={{ borderColor: theme.ui.border }}>
                No saved SSH servers yet.
              </div>
            ) : (
              profiles.map((p) => (
                <div
                  key={p.profileId}
                  className="p-4 rounded-2xl border flex items-center justify-between gap-2"
                  style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <Server className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="text-[11px] font-mono opacity-65 truncate">
                      {p.username}@{p.host}:{p.port} • {p.authType}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleConnect(p)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-black"
                      style={{ backgroundColor: theme.ui.success }}
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={() => nexusBridge.ssh.deleteProfile(p.profileId).then(loadAll)}
                      className="p-1.5 rounded-xl bg-red-500/15 text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'terminal' && (
        <div className="h-[62vh] rounded-2xl border overflow-hidden flex flex-col" style={{ borderColor: theme.ui.border }}>
          <div className="px-3 py-2 border-b flex items-center justify-between text-xs" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
            <span className="font-mono flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" style={{ color: theme.ui.accent }} />
              {activeSshId ? `SSH Session: ${activeSshId}` : 'Not Connected'}
            </span>
            {activeSshId && (
              <button
                type="button"
                onClick={() => nexusBridge.ssh.disconnect(activeSshId).then(() => setActiveSshId(''))}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400"
              >
                Disconnect
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {activeSshId ? (
              <XtermViewport sessionId={activeSshId} mode="ssh" />
            ) : (
              <div className="h-full flex items-center justify-center text-xs opacity-65">
                Connect to an SSH profile to start an interactive remote shell.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'sftp' && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={sftpPath}
              onChange={(e) => setSftpPath(e.target.value)}
              className="flex-1 p-2 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <button
              type="button"
              disabled={!activeSshId}
              onClick={() => handleSftpRefresh(sftpPath)}
              className="px-3 py-2 rounded-xl font-bold text-black flex items-center gap-1"
              style={{ backgroundColor: theme.ui.accent }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Browse
            </button>
            <button
              type="button"
              disabled={!activeSshId}
              onClick={async () => {
                const picked = await nexusBridge.files.pickSafFile();
                if (!picked?.uri) return;
                const imp = await nexusBridge.files.importSafToPath(picked.uri, 'sftp_staging', picked.name || 'upload.bin');
                await nexusBridge.ssh.sftpUpload(activeSshId, imp.path, `${sftpPath}/${picked.name || 'upload.bin'}`);
                handleSftpRefresh(sftpPath);
              }}
              className="px-3 py-2 rounded-xl font-semibold bg-white/10 flex items-center gap-1"
            >
              <FolderUp className="w-3.5 h-3.5" /> Upload
            </button>
          </div>

          <div className="divide-y divide-white/10 max-h-96 overflow-y-auto text-xs font-mono">
            {sftpEntries.map((ent) => (
              <div key={ent.name} className="py-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (ent.isDir) {
                      const next = sftpPath === '/' ? `/${ent.name}` : `${sftpPath}/${ent.name}`;
                      handleSftpRefresh(next);
                    }
                  }}
                  className="text-left truncate hover:underline"
                  style={{ color: ent.isDir ? theme.ui.accent : theme.ui.text }}
                >
                  {ent.isDir ? `[DIR] ${ent.name}/` : ent.name}
                </button>
                <div className="flex items-center gap-2 shrink-0 text-[11px] opacity-75">
                  <span>{ent.size} B</span>
                  {!ent.isDir && (
                    <button
                      type="button"
                      onClick={async () => {
                        const remote = sftpPath === '/' ? `/${ent.name}` : `${sftpPath}/${ent.name}`;
                        const res = await nexusBridge.ssh.sftpDownload(activeSshId, remote, '');
                        setStatusMsg(`Downloaded to ${res.localPath}`);
                      }}
                      className="px-2 py-0.5 rounded bg-white/10"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tunnels' && (
        <div className="rounded-2xl border p-4 space-y-4 text-xs" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="number"
              placeholder="Local Port"
              value={tunnelForm.localPort}
              onChange={(e) => setTunnelForm((p) => ({ ...p, localPort: Number(e.target.value) }))}
              className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <input
              type="text"
              placeholder="Remote Host"
              value={tunnelForm.remoteHost}
              onChange={(e) => setTunnelForm((p) => ({ ...p, remoteHost: e.target.value }))}
              className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <input
              type="number"
              placeholder="Remote Port"
              value={tunnelForm.remotePort}
              onChange={(e) => setTunnelForm((p) => ({ ...p, remotePort: Number(e.target.value) }))}
              className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <button
              type="button"
              disabled={!activeSshId}
              onClick={async () => {
                await nexusBridge.ssh.startTunnel({ sshSessionId: activeSshId, ...tunnelForm });
                loadAll();
              }}
              className="py-2.5 rounded-xl font-bold text-black flex items-center justify-center gap-1"
              style={{ backgroundColor: theme.ui.accent }}
            >
              <Network className="w-3.5 h-3.5" /> Start Forward (-L)
            </button>
          </div>
          <div className="space-y-2">
            {tunnels.map((t) => (
              <div key={t.tunnelId} className="p-2.5 rounded-xl bg-black/30 flex items-center justify-between font-mono">
                <span>127.0.0.1:{t.localPort} → {t.remoteHost}:{t.remotePort}</span>
                <button
                  type="button"
                  onClick={() => nexusBridge.ssh.stopTunnel(t.tunnelId).then(loadAll)}
                  className="px-2 py-0.5 rounded bg-red-500/20 text-red-400"
                >
                  Stop
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
            <h3 className="font-bold text-sm">Import Private Key (Encrypted Vault)</h3>
            <input
              type="text"
              placeholder="Key Label (e.g. id_ed25519_work)"
              value={keyForm.name}
              onChange={(e) => setKeyForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <textarea
              rows={6}
              placeholder="Paste PEM / OpenSSH private key..."
              value={keyForm.privateKeyPem}
              onChange={(e) => setKeyForm((p) => ({ ...p, privateKeyPem: e.target.value }))}
              className="w-full p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <input
              type="password"
              placeholder="Key Passphrase (optional)"
              value={keyForm.passphrase}
              onChange={(e) => setKeyForm((p) => ({ ...p, passphrase: e.target.value }))}
              className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
              style={{ borderColor: theme.ui.border }}
            />
            <button
              type="button"
              onClick={async () => {
                await nexusBridge.ssh.importKey(keyForm);
                setKeyForm({ name: '', privateKeyPem: '', passphrase: '' });
                loadAll();
              }}
              className="w-full py-2.5 rounded-xl font-bold text-black"
              style={{ backgroundColor: theme.ui.accent }}
            >
              Import Key Securely
            </button>
          </div>
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.keyId} className="p-3 rounded-xl border flex items-center justify-between" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
                <span className="font-mono font-semibold">{k.name}</span>
                <button
                  type="button"
                  onClick={() => nexusBridge.ssh.deleteKey(k.keyId).then(loadAll)}
                  className="p-1.5 rounded bg-red-500/15 text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

