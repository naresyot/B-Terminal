import React from 'react';
import { Terminal, Cpu, Database, Eye, Trash2 } from 'lucide-react';

interface Macro {
  id: string;
  label: string;
  command: string;
  icon: React.ReactNode;
}

interface ButtonBarProps {
  onRunMacro: (command: string) => void;
  activeTabConnected: boolean;
}

export const ButtonBar: React.FC<ButtonBarProps> = ({ onRunMacro, activeTabConnected }) => {
  const macros: Macro[] = [
    { id: '1', label: 'Clear Screen', command: 'clear\n', icon: <Trash2 size={12} /> },
    { id: '2', label: 'Disk Space', command: 'df -h\n', icon: <Database size={12} /> },
    { id: '3', label: 'System Stats', command: 'top -n 1 || htop\n', icon: <Cpu size={12} /> },
    { id: '4', label: 'Tail Logs', command: 'tail -f /var/log/syslog || tail -f /var/log/messages\n', icon: <Eye size={12} /> },
    { id: '5', label: 'Show Port Listening', command: 'ss -tulpn || netstat -tpl\n', icon: <Terminal size={12} /> },
  ];

  return (
    <div className="bg-slate-900 border-t border-slate-800/80 px-3 py-1.5 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider pr-2">Macros</span>
        {macros.map((macro) => (
          <button
            key={macro.id}
            disabled={!activeTabConnected}
            onClick={() => onRunMacro(macro.command)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all duration-150 ${
              activeTabConnected
                ? 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 border border-transparent'
                : 'bg-slate-950/20 text-slate-600 cursor-not-allowed border border-transparent'
            }`}
          >
            {macro.icon}
            <span>{macro.label}</span>
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-600 font-mono hidden md:block">
        {activeTabConnected ? 'Active Connection Stable' : 'Offline'}
      </div>
    </div>
  );
};
