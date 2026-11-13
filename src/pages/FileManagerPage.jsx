import React, { useEffect, useState } from 'react';
import {
  Archive,
  ArrowUp,
  Edit3,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Lock,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { nexusBridge } from '../bridge/nexusBridge';

export default function FileManagerPage() {
  const { theme } = useNexus();
  const [roots, setRoots] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [showHidden, setShowHidden] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFile, setEditingFile] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [clipboard, setClipboard] = useState(null);

  const loadDirectory = async (path) => {
    setErrorMsg('');
    try {
      const res = await nexusBridge.files.list(path, showHidden);
      setCurrentPath(res.path || path);
      setEntries(res.entries || []);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    nexusBridge.files
      .getRoots()
      .then((res) => {
        const list = res.roots || [];
        setRoots(list);
        if (list[0]?.path) {
          loadDirectory(list[0].path);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentPath) loadDirectory(currentPath);
  }, [showHidden]);

  const handleOpenEntry = async (entry) => {
    if (entry.isDirectory) {
      loadDirectory(entry.path);
      return;
    }
    try {
      const res = await nexusBridge.files.read(entry.path);
      setEditingFile({ path: entry.path, name: entry.name, content: res.content || '' });
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSearch = async () => {
    if (!currentPath || !searchQuery.trim()) return;
    try {
      const res = await nexusBridge.files.search(currentPath, searchQuery.trim());
      setEntries(res.entries || []);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const goParent = () => {
    if (!currentPath || currentPath === '/') return;
    const idx = currentPath.lastIndexOf('/');
    const parent = idx <= 0 ? '/' : currentPath.slice(0, idx);
    loadDirectory(parent);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Folder className="w-5 h-5" style={{ color: theme.ui.secondary }} />
            Integrated File Manager
          </h1>
          <p className="text-xs opacity-70">
            Browse Android shared storage, SAF imports/exports, and Linux distribution root filesystems.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="px-3 py-1.5 rounded-xl text-xs bg-white/10 flex items-center gap-1"
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Hidden
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const picked = await nexusBridge.files.pickSafFile();
                if (picked?.uri) {
                  await nexusBridge.files.importSafToPath(picked.uri, currentPath, picked.name || 'imported');
                  loadDirectory(currentPath);
                }
              } catch (err) {
                setErrorMsg(err.message);
              }
            }}
            className="px-3 py-1.5 rounded-xl text-xs bg-white/10 flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" /> SAF Import
          </button>
          <button
            type="button"
            onClick={async () => {
              const name = prompt('New file name:');
              if (!name) return;
              await nexusBridge.files.write(`${currentPath}/${name}`, '');
              loadDirectory(currentPath);
            }}
            className="px-3 py-1.5 rounded-xl text-xs bg-white/10 flex items-center gap-1"
          >
            <FilePlus className="w-3.5 h-3.5" /> File
          </button>
          <button
            type="button"
            onClick={async () => {
              const name = prompt('New folder name:');
              if (!name) return;
              await nexusBridge.files.mkdir(`${currentPath}/${name}`);
              loadDirectory(currentPath);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-black flex items-center gap-1"
            style={{ backgroundColor: theme.ui.accent }}
          >
            <FolderPlus className="w-3.5 h-3.5" /> Folder
          </button>
        </div>
      </div>

      {/* Quick Storage Roots */}
      <div className="flex flex-wrap gap-2">
        {roots.map((r) => (
          <button
            key={r.path}
            type="button"
            onClick={() => loadDirectory(r.path)}
            className="px-3 py-1.5 rounded-xl text-xs border hover:bg-white/5"
            style={{
              borderColor: currentPath.startsWith(r.path) ? theme.ui.accent : theme.ui.border,
              color: currentPath.startsWith(r.path) ? theme.ui.accent : theme.ui.text,
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {statusMsg && <div className="text-xs font-mono" style={{ color: theme.ui.success }}>{statusMsg}</div>}
      {errorMsg && <div className="text-xs font-mono" style={{ color: theme.ui.error }}>{errorMsg}</div>}

      {/* Path + Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-1.5">
          <button type="button" onClick={goParent} className="p-2 rounded-xl border hover:bg-white/5" style={{ borderColor: theme.ui.border }}>
            <ArrowUp className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadDirectory(currentPath)}
            className="flex-1 p-2 rounded-xl border bg-black/40 font-mono text-xs outline-none"
            style={{ borderColor: theme.ui.border }}
          />
          <button type="button" onClick={() => loadDirectory(currentPath)} className="p-2 rounded-xl border hover:bg-white/5" style={{ borderColor: theme.ui.border }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="p-2 rounded-xl border bg-black/40 text-xs outline-none"
            style={{ borderColor: theme.ui.border }}
          />
          <button type="button" onClick={handleSearch} className="p-2 rounded-xl bg-white/10">
            <Search className="w-4 h-4" />
          </button>
          {clipboard && (
            <button
              type="button"
              onClick={async () => {
                if (clipboard.op === 'copy') await nexusBridge.files.copy(clipboard.path, currentPath);
                else await nexusBridge.files.move(clipboard.path, currentPath);
                setClipboard(null);
                loadDirectory(currentPath);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-black"
              style={{ backgroundColor: theme.ui.success }}
            >
              Paste ({clipboard.name})
            </button>
          )}
        </div>
      </div>

      {/* File Table */}
      <div
        className="rounded-2xl border overflow-hidden divide-y divide-white/10"
        style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
      >
        {entries.length === 0 ? (
          <div className="p-8 text-center text-xs opacity-65">Directory empty or permission required.</div>
        ) : (
          entries.map((entry) => {
            const isArchive = /\.(zip|tar|gz|tgz|xz|txz)$/i.test(entry.name);
            return (
              <div key={entry.path} className="p-3 flex items-center justify-between gap-2 hover:bg-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => handleOpenEntry(entry)}
                  className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                >
                  {entry.isDirectory ? (
                    <Folder className="w-4 h-4 shrink-0" style={{ color: theme.ui.accent }} />
                  ) : (
                    <FileText className="w-4 h-4 shrink-0 opacity-70" />
                  )}
                  <div className="min-w-0">
                    <div className="font-mono font-semibold truncate">{entry.name}</div>
                    <div className="text-[10px] font-mono opacity-55">
                      {entry.permissions || '---'} • {entry.isDirectory ? 'DIR' : `${entry.size} B`}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {isArchive && (
                    <button
                      type="button"
                      onClick={async () => {
                        await nexusBridge.files.extract(entry.path, currentPath);
                        setStatusMsg(`Extracted ${entry.name}`);
                        loadDirectory(currentPath);
                      }}
                      className="px-2 py-1 rounded bg-white/10 text-[10px]"
                      title="Extract Archive"
                    >
                      Extract
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const out = `${entry.path}.tar.gz`;
                      await nexusBridge.files.createArchive([entry.path], out, 'tar.gz');
                      setStatusMsg(`Created ${out}`);
                      loadDirectory(currentPath);
                    }}
                    className="p-1.5 rounded bg-white/10"
                    title="Compress .tar.gz"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const mode = prompt(`chmod octal mode for ${entry.name} (e.g. 755):`, '755');
                      if (!mode) return;
                      await nexusBridge.files.chmod(entry.path, mode);
                      loadDirectory(currentPath);
                    }}
                    className="p-1.5 rounded bg-white/10"
                    title="Permissions (chmod)"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setClipboard({ op: 'copy', path: entry.path, name: entry.name })}
                    className="px-2 py-1 rounded bg-white/10 text-[10px]"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = prompt('Rename to:', entry.name);
                      if (!next) return;
                      await nexusBridge.files.rename(entry.path, next);
                      loadDirectory(currentPath);
                    }}
                    className="p-1.5 rounded bg-white/10"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Delete ${entry.name}?`)) return;
                      await nexusBridge.files.remove(entry.path);
                      loadDirectory(currentPath);
                    }}
                    className="p-1.5 rounded bg-red-500/15 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-3xl rounded-2xl border p-4 space-y-3" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-bold truncate">{editingFile.path}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await nexusBridge.files.write(editingFile.path, editingFile.content);
                    setEditingFile(null);
                    loadDirectory(currentPath);
                  }}
                  className="px-3 py-1 rounded-lg font-bold text-black"
                  style={{ backgroundColor: theme.ui.success }}
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditingFile(null)} className="px-3 py-1 rounded-lg bg-white/10">
                  Close
                </button>
              </div>
            </div>
            <textarea
              value={editingFile.content}
              onChange={(e) => setEditingFile((p) => ({ ...p, content: e.target.value }))}
              rows={18}
              spellCheck={false}
              className="w-full p-3 rounded-xl border bg-[#05080F] font-mono text-xs outline-none"
              style={{ borderColor: theme.ui.border }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

