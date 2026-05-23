import React, { useState, useEffect } from 'react';
import { Folder, Terminal, ChevronDown, ChevronRight, Plus, Network, Loader, X, Pencil, Play, Trash2 } from 'lucide-react';
import { SessionFormModal } from './SessionFormModal';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

export type { SessionNode };

interface SessionTreeProps {
  onConnect: (session: SessionNode) => void;
}

export const SessionTree: React.FC<SessionTreeProps> = ({ onConnect }) => {
  const [nodes, setNodes] = useState<SessionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNode, setEditingNode] = useState<SessionNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: SessionNode } | null>(null);

  useEffect(() => {
    window.electron.sessions.getNodes().then((fetched) => {
      setNodes(fetched);
      // Auto-expand all root-level folders on first load
      const rootFolderIds = fetched
        .filter((n) => n.type === 'folder' && n.parentId === null)
        .reduce<Record<string, boolean>>((acc, n) => ({ ...acc, [n.id]: true }), {});
      setExpandedFolders(rootFolderIds);
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    const fetched = await window.electron.sessions.getNodes();
    setNodes(fetched);
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditNode = (node: SessionNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(node);
  };

  const handleDeleteNode = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingDeleteId === id) {
      // Second click — confirmed
      await window.electron.sessions.deleteNode(id);
      setPendingDeleteId(null);
      await refresh();
    } else {
      // First click — arm the confirmation
      setPendingDeleteId(id);
      // Auto-cancel after 3 seconds
      setTimeout(() => setPendingDeleteId((cur) => (cur === id ? null : cur)), 3000);
    }
  };

  const handleContextMenu = (node: SessionNode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const buildMenuItems = (node: SessionNode): ContextMenuItem[] => {
    if (node.type === 'folder') {
      return [
        {
          label: 'Rename / Edit',
          icon: <Pencil size={12} />,
          onClick: () => setEditingNode(node),
        },
        { label: '', onClick: () => {}, divider: true },
        {
          label: 'Delete folder',
          icon: <Trash2 size={12} />,
          onClick: async () => {
            await window.electron.sessions.deleteNode(node.id);
            await refresh();
          },
          danger: true,
        },
      ];
    }
    return [
      {
        label: 'Connect',
        icon: <Play size={12} />,
        onClick: () => onConnect(node),
      },
      {
        label: 'Edit session',
        icon: <Pencil size={12} />,
        onClick: () => setEditingNode(node),
      },
      { label: '', onClick: () => {}, divider: true },
      {
        label: 'Delete session',
        icon: <Trash2 size={12} />,
        onClick: async () => {
          await window.electron.sessions.deleteNode(node.id);
          await refresh();
        },
        danger: true,
      },
    ];
  };

  const getInheritedProperty = (node: SessionNode, property: keyof SessionNode): any => {
    if (node[property] !== undefined && node[property] !== 'inherited') {
      return node[property];
    }
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (parent) return getInheritedProperty(parent, property);
    }
    return undefined;
  };

  const renderNode = (node: SessionNode, depth = 0) => {
    const indent = { paddingLeft: `${depth * 12 + 8}px` };
    const isConfirmingDelete = pendingDeleteId === node.id;

    if (node.type === 'folder') {
      const isExpanded = expandedFolders[node.id];
      const children = nodes.filter((n) => n.parentId === node.id);
      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => toggleFolder(node.id)}
            onContextMenu={(e) => handleContextMenu(node, e)}
            style={indent}
            className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/50 cursor-pointer rounded transition-colors duration-150 text-slate-300 hover:text-slate-100 group"
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={15} className="text-amber-500 fill-amber-500/10 shrink-0" />
              <span className="text-xs font-medium tracking-wide truncate">{node.name}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => handleDeleteNode(node.id, e)}
                className={`p-0.5 rounded text-xs transition-colors ${
                  isConfirmingDelete
                    ? 'text-rose-400 bg-rose-500/10'
                    : 'text-slate-600 hover:text-rose-400 hover:bg-slate-700'
                }`}
                title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete folder'}
              >
                <X size={11} />
              </button>
            </div>
          </div>
          {isExpanded && children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    // Session row
    const resolvedUser = getInheritedProperty(node, 'username') || 'root';
    const resolvedAuth = getInheritedProperty(node, 'authMethod') || 'password';

    return (
      <div
        key={node.id}
        onClick={() => onConnect(node)}
        onContextMenu={(e) => handleContextMenu(node, e)}
        style={indent}
        className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/80 cursor-pointer rounded transition-colors duration-150 text-slate-400 hover:text-emerald-400 group"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Terminal size={14} className="text-slate-500 group-hover:text-emerald-500 shrink-0" />
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold leading-none">{node.name}</span>
            <span className="text-[10px] text-slate-500 truncate mt-0.5">
              {resolvedUser}@{node.host || 'localhost'}
              {node.jumpHostId && ' • (Jump)'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {node.jumpHostId && (
            <Network size={12} className="text-amber-500" title="Multi-hop jump host" />
          )}
          <span className="text-[9px] px-1 bg-slate-800 rounded text-slate-500 font-mono">
            {resolvedAuth === 'publicKey' ? 'key' : 'pass'}
          </span>
          <button
            onClick={(e) => handleEditNode(node, e)}
            className="p-0.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
            title="Edit session"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={(e) => handleDeleteNode(node.id, e)}
            className={`p-0.5 rounded transition-colors ${
              isConfirmingDelete
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-slate-600 hover:text-rose-400 hover:bg-slate-700'
            }`}
            title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete session'}
          >
            <X size={11} />
          </button>
        </div>
      </div>
    );
  };

  const rootNodes = nodes.filter((n) => n.parentId === null);

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border-r border-slate-800/50 backdrop-blur-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 bg-slate-950/20">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sessions</span>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
          title="New Session"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-600">
            <Loader size={16} className="animate-spin" />
          </div>
        ) : rootNodes.length === 0 ? (
          <p className="text-[11px] text-slate-600 text-center py-6 px-3">
            No sessions. Click + to add one.
          </p>
        ) : (
          rootNodes.map((n) => renderNode(n, 0))
        )}
      </div>

      {showAddModal && (
        <SessionFormModal
          mode="add"
          existingNodes={nodes}
          onSaved={refresh}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingNode && (
        <SessionFormModal
          mode="edit"
          initialNode={editingNode}
          existingNodes={nodes}
          onSaved={refresh}
          onClose={() => setEditingNode(null)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
