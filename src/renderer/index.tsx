import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionTree, SessionNode } from './components/SessionTree';
import { TerminalTabs, TerminalTabItem } from './components/TerminalTabs';
import { ButtonBar } from './components/ButtonBar';
import { VaultUnlockModal } from './components/VaultUnlockModal';
import { SftpPanel } from './components/SftpPanel';
import { Terminal, Shield, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';
import './index.css';

const App: React.FC = () => {
  const [tabs, setTabs] = useState<TerminalTabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [sftpTab, setSftpTab] = useState<TerminalTabItem | null>(null);

  useEffect(() => {
    window.electron.vault.isUnlocked().then((unlocked) => {
      setVaultUnlocked(unlocked);
      if (!unlocked) setShowVaultModal(true);
    });
  }, []);

  // Spawns a new SSH connection tab — credentials resolved by SessionManager + SecureVault in main process
  const handleConnect = async (session: SessionNode) => {
    const tabId = Math.random().toString(36).substring(2, 11);
    setTabs((prev) => [...prev, { id: tabId, name: session.name, status: 'connecting', sessionConfig: session }]);
    setActiveTabId(tabId);

    try {
      const result = await window.electron.ssh.connect(session.id);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? result.success && result.connectionId
              ? { ...t, status: 'connected', connectionId: result.connectionId }
              : { ...t, status: 'error', error: result.error || 'Connection failed' }
            : t
        )
      );
    } catch (err: any) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId ? { ...t, status: 'error', error: err.message || 'Unexpected error' } : t
        )
      );
    }
  };

  // Called by TerminalTabs when an active SSH connection emits an error after connect
  const handleConnectionError = (tabId: string, error: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, status: 'error', error } : t))
    );
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

  // Open the SFTP browser panel on the same SSH client (no extra auth)
  const handleCloneSFTP = (tab: TerminalTabItem) => {
    if (!tab.connectionId) return;
    setSftpTab(tab);
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
          <button
            onClick={() => !vaultUnlocked && setShowVaultModal(true)}
            className={`flex items-center gap-1 transition-colors ${vaultUnlocked ? 'cursor-default' : 'hover:text-amber-300 cursor-pointer'}`}
            title={vaultUnlocked ? 'Vault unlocked' : 'Click to unlock vault'}
          >
            <Shield size={12} className={vaultUnlocked ? 'text-emerald-500' : 'text-amber-500'} />
            <span className={vaultUnlocked ? 'text-emerald-400' : 'text-amber-400'}>
              {vaultUnlocked ? 'Vault Unlocked' : 'Vault Locked'}
            </span>
          </button>
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
            onConnectionError={handleConnectionError}
          />
        </div>
      </div>

      {/* Macro Command Button Bar */}
      <ButtonBar onRunMacro={handleRunMacro} activeTabConnected={activeTabConnected} />

      {showVaultModal && (
        <VaultUnlockModal
          onUnlocked={() => {
            setVaultUnlocked(true);
            setShowVaultModal(false);
          }}
          onSkip={() => setShowVaultModal(false)}
        />
      )}

      {sftpTab && sftpTab.connectionId && (
        <SftpPanel
          connectionId={sftpTab.connectionId}
          connectionName={sftpTab.name}
          onClose={() => setSftpTab(null)}
        />
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
