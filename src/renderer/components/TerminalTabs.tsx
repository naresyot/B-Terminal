import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XtermTerminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { X, Play, RefreshCw, FolderClosed, AlertCircle } from 'lucide-react';
import 'xterm/css/xterm.css';

export interface TerminalTabItem {
  id: string;
  name: string;
  connectionId?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  sessionConfig?: any;
}

interface TerminalTabsProps {
  tabs: TerminalTabItem[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloneSFTP: (tab: TerminalTabItem) => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloneSFTP,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const xtermInstances = useRef<Record<string, { term: XtermTerminal; fit: FitAddon }>>({});

  useEffect(() => {
    // Destroy terminal instances that are no longer in tabs
    Object.keys(xtermInstances.current).forEach((tabId) => {
      if (!tabs.some((t) => t.id === tabId)) {
        xtermInstances.current[tabId].term.dispose();
        delete xtermInstances.current[tabId];
      }
    });
  }, [tabs]);

  useEffect(() => {
    if (!activeTabId) return;

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab || activeTab.status !== 'connected' || !activeTab.connectionId) return;

    const element = terminalRefs.current[activeTabId];
    if (!element) return;

    // Check if terminal is already initialized for this active tab
    if (!xtermInstances.current[activeTabId]) {
      const term = new XtermTerminal({
        cursorBlink: true,
        cursorStyle: 'block',
        theme: {
          background: '#020617', // Match slate-955
          foreground: '#cbd5e1', // Slate 300
          cursor: '#10b981',     // Emerald 500
          selectionBackground: 'rgba(30, 41, 59, 0.5)',
          black: '#0f172a',
          red: '#f43f5e',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#d946ef',
          cyan: '#06b6d4',
          white: '#f8fafc',
        },
        fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.2,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);

      term.open(element);
      
      // Try WebGL acceleration
      try {
        const webgl = new WebglAddon();
        term.loadAddon(webgl);
      } catch (e) {
        console.warn('WebGL addon loading failed, falling back to canvas', e);
      }

      fit.fit();
      term.focus();

      // Listen for data input from user
      term.onData((data) => {
        window.electron.ssh.write(activeTab.connectionId!, data);
      });

      // Bind incoming stream data from Main Process contextBridge
      const unsubscribeData = window.electron.ssh.onData(activeTab.connectionId, (incoming) => {
        term.write(incoming);
      });

      xtermInstances.current[activeTabId] = { term, fit };

      // Save listener cleanup function on the DOM element wrapper
      (element as any).cleanup = () => {
        unsubscribeData();
      };
    } else {
      // Re-fit and refocus existing terminal
      setTimeout(() => {
        const { term, fit } = xtermInstances.current[activeTabId];
        fit.fit();
        term.focus();
      }, 50);
    }
  }, [activeTabId, tabs]);

  // Handle auto-fit on window resize
  useEffect(() => {
    const handleResize = () => {
      if (!activeTabId) return;
      const instance = xtermInstances.current[activeTabId];
      if (instance) {
        instance.fit.fit();
        const activeTab = tabs.find((t) => t.id === activeTabId);
        if (activeTab && activeTab.connectionId) {
          window.electron.ssh.resize(
            activeTab.connectionId,
            instance.term.cols,
            instance.term.rows
          );
        }
      }
    };

    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [activeTabId, tabs]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Tabs Header */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800/80 px-2 select-none overflow-x-auto shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 border-r border-slate-800/50 cursor-pointer transition-all duration-150 relative text-xs min-w-[120px] max-w-[200px] truncate ${
                isActive
                  ? 'bg-slate-950 text-emerald-400 font-semibold border-t-2 border-t-emerald-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span className="truncate flex-1">{tab.name}</span>
              {isActive && tab.status === 'connected' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloneSFTP(tab);
                  }}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-amber-400 transition-colors"
                  title="Clone to SFTP Session"
                >
                  <FolderClosed size={12} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        {tabs.length === 0 && (
          <div className="text-slate-600 text-xs px-4 py-2 italic select-none">
            No active terminal sessions. Select a host from the tree panel to begin.
          </div>
        )}
      </div>

      {/* Terminal Viewports */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`absolute inset-0 flex flex-col bg-slate-950 ${
                isActive ? 'visible pointer-events-auto z-10' : 'invisible pointer-events-none z-0'
              }`}
            >
              {tab.status === 'connecting' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <RefreshCw size={24} className="animate-spin text-emerald-500" />
                  <span className="text-xs font-medium">Connecting to {tab.name}...</span>
                </div>
              )}

              {tab.status === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-500 p-6 text-center">
                  <AlertCircle size={32} className="text-rose-500" />
                  <span className="text-sm font-semibold">Connection Failed</span>
                  <p className="text-xs text-slate-500 max-w-md">{tab.error}</p>
                </div>
              )}

              {tab.status === 'disconnected' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Play size={24} className="text-slate-600" />
                  <span className="text-xs">Terminal session closed.</span>
                </div>
              )}

              {/* Terminal Mount Node */}
              <div
                ref={(el) => {
                  // Save DOM ref clean
                  terminalRefs.current[tab.id] = el;
                }}
                className="flex-1 min-h-0 w-full"
              />
            </div>
          );
        })}

        {tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-600 select-none">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-700">
              <Terminal size={32} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">OmniTerm Terminal Workspace</p>
              <p className="text-xs text-slate-600 mt-1">
                Double-click or click a session profile in the sidebar to start secure SSH sessions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
