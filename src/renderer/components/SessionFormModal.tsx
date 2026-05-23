import React, { useState } from 'react';
import { X, Terminal, Key, Server, User, Link, Lock } from 'lucide-react';

interface SessionFormModalProps {
  mode: 'add' | 'edit';
  initialNode?: SessionNode;
  existingNodes: SessionNode[];
  onSaved: () => void;
  onClose: () => void;
}

interface FormState {
  name: string;
  host: string;
  port: string;
  username: string;
  authMethod: 'password' | 'publicKey' | 'agent' | 'inherited';
  privateKeyPath: string;
  jumpHostId: string;
  secret: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  host: '',
  port: '22',
  username: '',
  authMethod: 'password',
  privateKeyPath: '',
  jumpHostId: '',
  secret: '',
};

function nodeToForm(node: SessionNode): FormState {
  return {
    name: node.name,
    host: node.host ?? '',
    port: String(node.port ?? 22),
    username: node.username ?? '',
    authMethod: (node.authMethod as FormState['authMethod']) ?? 'password',
    privateKeyPath: node.privateKeyPath ?? '',
    jumpHostId: node.jumpHostId ?? '',
    secret: '',
  };
}

export const SessionFormModal: React.FC<SessionFormModalProps> = ({
  mode,
  initialNode,
  existingNodes,
  onSaved,
  onClose,
}) => {
  const [form, setForm] = useState<FormState>(
    mode === 'edit' && initialNode ? nodeToForm(initialNode) : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.host.trim()) { setError('Host is required'); return; }
    if (!form.username.trim()) { setError('Username is required'); return; }

    const portNum = parseInt(form.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('Port must be 1–65535');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const node: SessionNode = {
        id: mode === 'edit' && initialNode ? initialNode.id : `s-${Date.now()}`,
        parentId: mode === 'edit' && initialNode ? initialNode.parentId : null,
        name: form.name.trim(),
        type: 'session',
        host: form.host.trim(),
        port: portNum,
        username: form.username.trim(),
        authMethod: form.authMethod,
        ...(form.authMethod === 'publicKey' && form.privateKeyPath.trim()
          ? { privateKeyPath: form.privateKeyPath.trim() }
          : {}),
        ...(form.jumpHostId ? { jumpHostId: form.jumpHostId } : {}),
      };

      if (mode === 'add') {
        await window.electron.sessions.addNode(node);
      } else {
        await window.electron.sessions.updateNode(node.id, node);
      }

      // Store credential if relevant auth method and non-empty secret
      const secretApplies = form.authMethod === 'password' || form.authMethod === 'publicKey';
      if (secretApplies && form.secret) {
        await window.electron.vault.setCredential(node.id, form.secret);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  // Jump host options: sessions only, excluding the node being edited
  const jumpHostOptions = existingNodes.filter(
    (n) => n.type === 'session' && n.id !== initialNode?.id
  );

  const secretLabel = form.authMethod === 'publicKey' ? 'Key Passphrase' : 'Password';
  const showSecret = form.authMethod === 'password' || form.authMethod === 'publicKey';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Terminal size={15} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              {mode === 'add' ? 'Add Session' : `Edit — ${initialNode?.name}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3.5">
          {/* Name */}
          <Field label="Name" icon={<Terminal size={11} />}>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="My Server"
              className={inputCls}
              autoFocus
            />
          </Field>

          {/* Host + Port */}
          <div className="grid grid-cols-[1fr_90px] gap-2.5">
            <Field label="Host" icon={<Server size={11} />}>
              <input value={form.host} onChange={set('host')} placeholder="192.168.1.1" className={inputCls} />
            </Field>
            <Field label="Port">
              <input
                value={form.port}
                onChange={set('port')}
                placeholder="22"
                className={inputCls}
                inputMode="numeric"
              />
            </Field>
          </div>

          {/* Username + Auth Method */}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Username" icon={<User size={11} />}>
              <input value={form.username} onChange={set('username')} placeholder="root" className={inputCls} />
            </Field>
            <Field label="Auth Method">
              <select value={form.authMethod} onChange={set('authMethod')} className={inputCls}>
                <option value="password">Password</option>
                <option value="publicKey">Public Key</option>
                <option value="agent">SSH Agent</option>
                <option value="inherited">Inherit from folder</option>
              </select>
            </Field>
          </div>

          {/* Private Key Path — only for publicKey */}
          {form.authMethod === 'publicKey' && (
            <Field label="Private Key Path" icon={<Key size={11} />}>
              <input
                value={form.privateKeyPath}
                onChange={set('privateKeyPath')}
                placeholder="~/.ssh/id_rsa"
                className={inputCls}
              />
            </Field>
          )}

          {/* Jump Host */}
          <Field label="Jump Host" icon={<Link size={11} />}>
            <select value={form.jumpHostId} onChange={set('jumpHostId')} className={inputCls}>
              <option value="">None (direct connection)</option>
              {jumpHostOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.username ?? 'user'}@{n.host ?? '?'})
                </option>
              ))}
            </select>
          </Field>

          {/* Secret — password or key passphrase */}
          {showSecret && (
            <Field label={secretLabel} icon={<Lock size={11} />}>
              <input
                type="password"
                value={form.secret}
                onChange={set('secret')}
                placeholder={
                  mode === 'edit'
                    ? 'Leave blank to keep existing credential'
                    : form.authMethod === 'publicKey'
                    ? 'Passphrase (leave blank if none)'
                    : 'SSH password'
                }
                className={inputCls}
              />
            </Field>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-1.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-xs font-semibold transition-colors"
            >
              {saving ? 'Saving…' : mode === 'add' ? 'Add Session' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Shared input class
const inputCls =
  'w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors';

// Small label + optional icon wrapper
const Field: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  icon,
  children,
}) => (
  <div className="flex flex-col gap-1">
    <label className="flex items-center gap-1 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
      {icon}
      {label}
    </label>
    {children}
  </div>
);
