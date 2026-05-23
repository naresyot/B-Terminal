import React, { useEffect, useState, useCallback } from 'react';
import { X, Folder, FileText, ArrowUp, RefreshCw, AlertCircle, Loader, FolderOpen } from 'lucide-react';

interface SftpEntry {
  name: string;
  type: 'directory' | 'file';
  size: number;
  mtime: number;
}

interface SftpPanelProps {
  connectionId: string;
  connectionName: string;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatMtime(mtime: number): string {
  if (!mtime) return '';
  const d = new Date(mtime * 1000);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export const SftpPanel: React.FC<SftpPanelProps> = ({ connectionId, connectionName, onClose }) => {
  const [currentPath, setCurrentPath] = useState('.');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await window.electron.sftp.list(connectionId, path);
      if (res.success && res.list) {
        const cleaned: SftpEntry[] = res.list
          .filter((e: SftpEntry) => e.name !== '.' && e.name !== '..')
          .sort((a: SftpEntry, b: SftpEntry) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        setEntries(cleaned);
      } else {
        setError(res.error || 'Failed to list directory');
        setEntries([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SFTP listing failed');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    load(currentPath);
  }, [currentPath, load]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goUp = () => {
    if (currentPath === '.') return;
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    setCurrentPath(segments.length === 0 ? '.' : segments.join('/'));
  };

  const enterDir = (name: string) => {
    setCurrentPath(currentPath === '.' ? name : `${currentPath}/${name}`);
  };

  const atRoot = currentPath === '.';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-[70vh] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FolderOpen size={15} className="text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-semibold text-slate-100 truncate">SFTP — {connectionName}</h2>
              <code className="text-[10px] text-slate-500 truncate font-mono">{currentPath}</code>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => load(currentPath)}
              disabled={loading}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-30"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800/60 bg-slate-950/40 shrink-0">
          <button
            onClick={goUp}
            disabled={atRoot || loading}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp size={11} />
            Up
          </button>
          <span className="text-[10px] text-slate-600">
            {loading ? '' : `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-600">
              <Loader size={18} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-rose-400 px-6 text-center">
              <AlertCircle size={20} />
              <p className="text-xs">{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-600 text-xs">
              Empty directory
            </div>
          ) : (
            <div className="py-1">
              {entries.map((entry) => (
                <div
                  key={entry.name}
                  onClick={() => entry.type === 'directory' && enterDir(entry.name)}
                  onDoubleClick={() => entry.type === 'directory' && enterDir(entry.name)}
                  className={`flex items-center gap-2.5 px-3 py-1 text-xs transition-colors ${
                    entry.type === 'directory'
                      ? 'cursor-pointer text-slate-200 hover:bg-slate-800/70'
                      : 'text-slate-400'
                  }`}
                >
                  {entry.type === 'directory' ? (
                    <Folder size={13} className="text-amber-500 shrink-0" />
                  ) : (
                    <FileText size={13} className="text-slate-500 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span className="text-[10px] text-slate-600 font-mono w-20 text-right">
                    {entry.type === 'directory' ? '—' : formatSize(entry.size)}
                  </span>
                  <span className="text-[10px] text-slate-600 w-24 text-right">
                    {formatMtime(entry.mtime)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-800/60 text-[10px] text-slate-600 shrink-0">
          Click directories to navigate · Esc to close
        </div>
      </div>
    </div>
  );
};
