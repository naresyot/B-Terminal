import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionTree, SessionNode } from './components/SessionTree';
import { TerminalTabs, TerminalTabItem } from './components/TerminalTabs';
import { ButtonBar } from './components/ButtonBar';
import { Terminal, Shield, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';
import './index.css';

const App: React.FC = () => {
  const [tabs, setTabs] = useState<TerminalTabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Spawns a new SSH connection tab
  const handleConnect = async (session: SessionNode) => {
    const tabId = Math.random().toString(36).substring(2, 11);
    const newTab: TerminalTabItem = {
      id: tabId,
      name: session.name,
      status: 'connecting',
      sessionConfig: session,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    try {
      // Simulate/Trigger main-process secure SSH connection over IPC
      const result = await window.electron.ssh.connect({
        host: session.host,
        port: session.port || 22,
        username: session.username || 'root',
        // In real setup, we decrypt keys/passwords securely. Here, mock connection config:
        password: 'password_placeholder', 
        privateKeyPath: session.privateKeyPath,
        // Include nested Jump Host config if present
        jumpHost: session.jumpHostId ? {
          host: 'jump.staging.internal',
          username: 'developer',
          password: 'password_placeholder'
        } : undefined
      });

      if (result.success && result.connectionId) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, status: 'connected', connectionId: result.connectionId }
              : t
          )
        );
      } else {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? { ...t, status: 'error', error: result.error || 'Unknown connection error' }
              : t
          )
        );
      }
    } catch (err: any) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, status: 'error', error: err.message || 'System crash' }
            : t
        )
      );
    }
  };

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
  };

  const handleCloseTab = async (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab && tab.connectionId) {
      // Disconnect backend SSH connection
      await window.electron.ssh.disconnect(tab.connectionId);
    }
    
    const remainingTabs = tabs.filter((t) => t.id !== id);
    setTabs(remainingTabs);

    if (activeTabId === id) {
      setActiveTabId(remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null);
    }
  };

  // Quick command macro execution injection
  const handleRunMacro = (command: string) => {
    if (!activeTabId) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && activeTab.connectionId && activeTab.status === 'connected') {
      window.electron.ssh.write(activeTab.connectionId, command);
    }
  };

  // Dual-Engine Sync Demonstration
  const handleCloneSFTP = async (tab: TerminalTabItem) => {
    if (!tab.connectionId) return;
    alert(`Dual-Engine Sync Activated:\nInstantly cloning session "${tab.name}" into SFTP sub-channel without credential prompts.`);
    try {
      const response = await window.electron.sftp.list(tab.connectionId, '.');
      if (response.success && response.list) {
        console.log('SFTP Directory Sync listing:', response.list);
        alert(`SFTP sync successful! Retrieved ${response.list.length} items from remote directory.`);
      } else {
        alert(`SFTP error: ${response.error}`);
      }
    } catch (e: any) {
      alert(`SFTP sync command exception: ${e.message}`);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTabConnected = activeTab?.status === 'connected';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Application Header */}
      <header className="h-11 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 drag">
        <div className="flex items-center gap-2">
          <Terminal className="text-emerald-400" size={18} />
          <span className="text-xs font-black tracking-wider text-slate-100 uppercase">
            Omni<span className="text-emerald-400">Term</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <Shield size={12} className="text-emerald-500" />
            <span>Vault Encrypted</span>
          </div>
          <div className="flex items-center gap-1">
            <Cpu size={12} className="text-blue-500" />
            <span>Hardware Accelerated (WebGL)</span>
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-slate-100 text-slate-400 p-0.5 rounded-r z-20 transition-all duration-150"
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          style={{ left: isSidebarOpen ? '220px' : '0px' }}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Collapsible Session Sidebar */}
        <div
          className="transition-all duration-300 ease-in-out shrink-0 overflow-hidden"
          style={{ width: isSidebarOpen ? '220px' : '0px' }}
        >
          <div className="w-[220px] h-full">
            <SessionTree onConnect={handleConnect} />
          </div>
        </div>

        {/* Terminal Grid Tabs Viewport */}
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <TerminalTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onCloneSFTP={handleCloneSFTP}
          />
        </div>
      </div>

      {/* Macro Command Button Bar */}
      <ButtonBar onRunMacro={handleRunMacro} activeTabConnected={activeTabConnected} />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
