import React, { useState } from 'react';
import { Folder, Terminal, ChevronDown, ChevronRight, Plus, Key, Network } from 'lucide-react';

export interface SessionNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'session';
  host?: string;
  port?: number;
  username?: string;
  authMethod?: 'password' | 'publicKey' | 'agent' | 'inherited';
  privateKeyPath?: string;
  jumpHostId?: string;
}

interface SessionTreeProps {
  onConnect: (session: SessionNode) => void;
}

export const SessionTree: React.FC<SessionTreeProps> = ({ onConnect }) => {
  // Mock session structure exhibiting folder hierarchy, custom jump hosts, and inheritance properties
  const [nodes, setNodes] = useState<SessionNode[]>([
    { id: '1', parentId: null, name: 'Production Clusters', type: 'folder', authMethod: 'publicKey', privateKeyPath: '~/.ssh/prod_key' },
    { id: '2', parentId: '1', name: 'Web Server Alpha', type: 'session', host: 'web-a.prod.internal', username: 'ubuntu' },
    { id: '3', parentId: '1', name: 'DB Bastion Server', type: 'session', host: 'db-bastion.prod.internal', username: 'admin', authMethod: 'password' },
    { id: '4', parentId: null, name: 'Staging Labs', type: 'folder', username: 'developer' },
    { id: '5', parentId: '4', name: 'API Server', type: 'session', host: 'api.staging.internal', port: 2222 },
    { id: '6', parentId: '4', name: 'Secure Jump Box', type: 'session', host: 'jump.staging.internal', authMethod: 'password' },
    // Multi-Hop Nested Session: API Server behind Jump Box
    { id: '7', parentId: '4', name: 'Internal Redis (via Jump)', type: 'session', host: 'redis.staging.internal', jumpHostId: '6' }
  ]);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '1': true,
    '4': true
  });

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getInheritedProperty = (node: SessionNode, property: keyof SessionNode): any => {
    if (node[property] !== undefined && node[property] !== 'inherited') {
      return node[property];
    }
    if (node.parentId) {
      const parent = nodes.find(n => n.id === node.parentId);
      if (parent) {
        return getInheritedProperty(parent, property);
      }
    }
    return undefined;
  };

  const renderNode = (node: SessionNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders[node.id];
    const indentStyle = { paddingLeft: `${depth * 12 + 8}px` };

    if (isFolder) {
      const children = nodes.filter(n => n.parentId === node.id);
      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => toggleFolder(node.id)}
            style={indentStyle}
            className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/50 cursor-pointer rounded transition-colors duration-150 text-slate-300 hover:text-slate-100 group"
          >
            <div className="flex items-center gap-1.5">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={15} className="text-amber-500 fill-amber-500/10" />
              <span className="text-xs font-medium tracking-wide">{node.name}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1">
              <button title="Inherited Credential Indicator" className="p-0.5 hover:bg-slate-700 rounded text-slate-400">
                <Key size={11} />
              </button>
            </div>
          </div>
          {isExpanded && children.map(child => renderNode(child, depth + 1))}
        </div>
      );
    } else {
      // It's a session item
      const resolvedUser = getInheritedProperty(node, 'username') || 'root';
      const resolvedAuth = getInheritedProperty(node, 'authMethod') || 'password';
      
      return (
        <div
          key={node.id}
          onClick={() => onConnect(node)}
          style={indentStyle}
          className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/80 cursor-pointer rounded transition-colors duration-150 text-slate-400 hover:text-emerald-400 group"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Terminal size={14} className="text-slate-500 group-hover:text-emerald-500 shrink-0" />
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold leading-none">{node.name}</span>
              <span className="text-[10px] text-slate-500 truncate mt-0.5">
                {resolvedUser}@{node.host || 'localhost'} {node.jumpHostId && '• (Jump)'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {node.jumpHostId && (
              <Network size={12} className="text-amber-500" title="Uses multi-hop jump host" />
            )}
            <span className="text-[9px] px-1 py-0.2 bg-slate-800 rounded text-slate-500 font-mono">
              {resolvedAuth === 'publicKey' ? 'key' : 'pass'}
            </span>
          </div>
        </div>
      );
    }
  };

  const rootNodes = nodes.filter(n => n.parentId === null);

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border-r border-slate-800/50 backdrop-blur-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 bg-slate-950/20">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sessions</span>
        <button
          onClick={() => {
            const newName = prompt("Enter session name:");
            if (newName) {
              setNodes(prev => [
                ...prev,
                { id: Math.random().toString(), parentId: null, name: newName, type: 'session', host: 'localhost', username: 'root' }
              ]);
            }
          }}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
          title="New Session"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {rootNodes.map(node => renderNode(node, 0))}
      </div>
    </div>
  );
};
