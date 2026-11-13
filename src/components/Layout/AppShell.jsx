import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  Bot,
  ChevronRight,
  Code2,
  FolderOpen,
  HardDrive,
  Home,
  KeyRound,
  Menu,
  Package,
  Settings,
  Shield,
  Terminal,
  X,
} from 'lucide-react';
import { useNexus } from '../../state/NexusContext';
import { nexusBridge } from '../../bridge/nexusBridge';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Home, shortLabel: 'Home' },
  { to: '/terminal', label: 'Terminal', icon: Terminal, shortLabel: 'Term' },
  { to: '/distros', label: 'Linux Distros', icon: HardDrive, shortLabel: 'Distros' },
  { to: '/packages', label: 'Packages', icon: Package, shortLabel: 'Pkg' },
  { to: '/devtools', label: 'Developer Tools', icon: Code2, shortLabel: 'Dev' },
  { to: '/cybersec', label: 'Cybersecurity', icon: Shield, shortLabel: 'Sec' },
  { to: '/ssh', label: 'SSH Manager', icon: KeyRound, shortLabel: 'SSH' },
  { to: '/files', label: 'File Manager', icon: FolderOpen, shortLabel: 'Files' },
  { to: '/monitor', label: 'System Monitor', icon: Activity, shortLabel: 'Sys' },
  { to: '/ai', label: 'AI Assistant', icon: Bot, shortLabel: 'AI' },
  { to: '/settings', label: 'Settings', icon: Settings, shortLabel: 'Config' },
];

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const { sessions, environments, defaultEnvId, theme } = useNexus();
  const activeSessions = sessions.filter((s) => s.alive).length;
  const defaultEnv = environments.find((e) => e.envId === defaultEnvId) || environments[0];
  const currentNav = NAV_ITEMS.find((n) => n.to === pathname) || NAV_ITEMS[0];

  const isTerminalPage = pathname === '/terminal';

  return (
    <div
      className="flex h-full w-full overflow-hidden nexus-grid-bg"
      style={{ backgroundColor: theme.ui.bgPrimary, color: theme.ui.text }}
    >
      {/* Desktop / Tablet Sidebar */}
      <aside
        className="hidden md:flex md:w-64 md:flex-col shrink-0 border-r"
        style={{
          backgroundColor: theme.ui.bgSecondary,
          borderColor: theme.ui.border,
        }}
      >
        <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: theme.ui.border }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-lg shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${theme.ui.accent}33, ${theme.ui.secondary}33)`,
              border: `1px solid ${theme.ui.accent}66`,
              color: theme.ui.accent,
            }}
          >
            NX
          </div>
          <div className="min-w-0">
            <div className="font-bold tracking-wider text-sm truncate">NEXUS TERMINAL</div>
            <div className="text-[11px] opacity-65 truncate">
              {nexusBridge.isNative() ? 'ARM64 PRoot Engine' : 'Web Preview (Bridge Inactive)'}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'shadow-md' : 'opacity-75 hover:opacity-100 hover:bg-white/5'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: `linear-gradient(90deg, ${theme.ui.accent}22, ${theme.ui.secondary}16)`,
                        border: `1px solid ${theme.ui.accent}55`,
                        color: theme.ui.accent,
                      }
                    : {}
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.to === '/terminal' && activeSessions > 0 && (
                  <span
                    className="ml-auto px-1.5 py-0.5 text-[10px] rounded-md font-mono"
                    style={{ backgroundColor: `${theme.ui.success}22`, color: theme.ui.success }}
                  >
                    {activeSessions}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t text-xs space-y-1.5" style={{ borderColor: theme.ui.border }}>
          <div className="flex items-center justify-between opacity-75">
            <span>Environment</span>
            <span className="font-mono" style={{ color: theme.ui.accent }}>
              {defaultEnv ? defaultEnv.name : 'None'}
            </span>
          </div>
          <div className="flex items-center justify-between opacity-75">
            <span>Isolation</span>
            <span className="font-mono" style={{ color: theme.ui.warning }}>
              PRoot (Non-Root)
            </span>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Mobile/Compact Header */}
        <header
          className="h-12 shrink-0 px-3 flex items-center justify-between border-b"
          style={{
            backgroundColor: theme.ui.bgSecondary,
            borderColor: theme.ui.border,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 active:scale-95 transition"
              aria-label="Open Navigation"
            >
              <Menu className="w-5 h-5" style={{ color: theme.ui.accent }} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm truncate">{currentNav.label}</span>
              {defaultEnv && (
                <span
                  className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border"
                  style={{
                    borderColor: `${theme.ui.accent}44`,
                    backgroundColor: `${theme.ui.accent}14`,
                    color: theme.ui.accent,
                  }}
                >
                  {defaultEnv.name} ({defaultEnv.distroId})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className="px-2 py-0.5 rounded-full font-mono text-[10px] border"
              style={{
                borderColor: nexusBridge.isNative() ? `${theme.ui.success}44` : `${theme.ui.warning}44`,
                backgroundColor: nexusBridge.isNative() ? `${theme.ui.success}16` : `${theme.ui.warning}16`,
                color: nexusBridge.isNative() ? theme.ui.success : theme.ui.warning,
              }}
            >
              {nexusBridge.isNative() ? `PTY:${activeSessions}` : 'WEB PREVIEW'}
            </span>
          </div>
        </header>

        {/* Page Viewport */}
        <main className={`flex-1 min-h-0 ${isTerminalPage ? 'overflow-hidden flex flex-col' : 'overflow-y-auto p-3 sm:p-5 pb-20 md:pb-6'}`}>
          {children}
        </main>

        {/* Mobile Bottom Quick Bar */}
        <nav
          className="md:hidden h-14 shrink-0 border-t grid grid-cols-5 items-center px-1"
          style={{
            backgroundColor: theme.ui.bgSecondary,
            borderColor: theme.ui.border,
          }}
        >
          {[NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3], NAV_ITEMS[7]].map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center py-1 rounded-lg text-[10px] gap-0.5 transition"
                style={({ isActive }) => ({
                  color: isActive ? theme.ui.accent : '#9CA3AF',
                })}
              >
                <Icon className="w-4 h-4" />
                <span>{item.shortLabel}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Mobile Full Slide-Over Drawer for all 11 sections */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="relative z-10 w-72 max-w-[82vw] h-full flex flex-col border-r shadow-2xl"
            style={{
              backgroundColor: theme.ui.bgSecondary,
              borderColor: theme.ui.border,
            }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: theme.ui.border }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm"
                  style={{
                    backgroundColor: `${theme.ui.accent}22`,
                    border: `1px solid ${theme.ui.accent}55`,
                    color: theme.ui.accent,
                  }}
                >
                  NX
                </div>
                <div>
                  <div className="font-bold text-sm">NEXUS TERMINAL</div>
                  <div className="text-[11px] opacity-65">Linux Workstation</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition"
                    style={({ isActive }) =>
                      isActive
                        ? {
                            backgroundColor: `${theme.ui.accent}20`,
                            border: `1px solid ${theme.ui.accent}50`,
                            color: theme.ui.accent,
                          }
                        : { color: '#D1D5DB' }
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

