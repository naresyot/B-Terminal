import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface VaultUnlockModalProps {
  onUnlocked: () => void;
  onSkip: () => void;
}

export const VaultUnlockModal: React.FC<VaultUnlockModalProps> = ({ onUnlocked, onSkip }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');

    const savedSaltHex = localStorage.getItem('vault_salt') ?? undefined;

    try {
      const result = await window.electron.vault.unlock(password, savedSaltHex);
      if (result.success && result.saltHex) {
        localStorage.setItem('vault_salt', result.saltHex);
        onUnlocked();
      } else {
        setError('Incorrect password — try again');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Unlock failed — vault may be corrupted');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
            <Lock size={16} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Unlock Credential Vault</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Enter master password to decrypt SSH credentials</p>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Master Password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter master password…"
                disabled={loading}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 pr-9 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-rose-400 text-xs mt-0.5">
                <AlertCircle size={12} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {localStorage.getItem('vault_salt') === null && (
            <p className="text-[10px] text-slate-500 bg-slate-800/60 border border-slate-700/50 rounded px-3 py-2">
              First run — a new vault will be initialised with this password. Store it safely; it cannot be recovered.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              Skip (SSH auth will fail for credential sessions)
            </button>
            <button
              type="submit"
              disabled={!password || loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white disabled:cursor-not-allowed rounded text-xs font-semibold transition-colors"
            >
              <Shield size={12} />
              {loading ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
