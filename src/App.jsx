import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NexusProvider } from './state/NexusContext';
import AppShell from './components/Layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import TerminalPage from './pages/TerminalPage';
import DistrosPage from './pages/DistrosPage';
import PackagesPage from './pages/PackagesPage';
import DevToolsPage from './pages/DevToolsPage';
import CybersecPage from './pages/CybersecPage';
import SshManagerPage from './pages/SshManagerPage';
import FileManagerPage from './pages/FileManagerPage';
import SystemMonitorPage from './pages/SystemMonitorPage';
import AiAssistantPage from './pages/AiAssistantPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <NexusProvider>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/distros" element={<DistrosPage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/devtools" element={<DevToolsPage />} />
            <Route path="/cybersec" element={<CybersecPage />} />
            <Route path="/ssh" element={<SshManagerPage />} />
            <Route path="/files" element={<FileManagerPage />} />
            <Route path="/monitor" element={<SystemMonitorPage />} />
            <Route path="/ai" element={<AiAssistantPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </NexusProvider>
  );
}

