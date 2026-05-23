interface SessionNode {
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

interface ElectronSSH {
  connect: (sessionId: string) => Promise<{ success: boolean; connectionId?: string; error?: string }>;
  write: (connectionId: string, data: string) => void;
  resize: (connectionId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
  disconnect: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
  onData: (connectionId: string, callback: (data: string) => void) => () => void;
  onError: (connectionId: string, callback: (error: string) => void) => () => void;
}

interface ElectronSFTP {
  list: (connectionId: string, remotePath: string) => Promise<{ success: boolean; list?: any[]; error?: string }>;
}

interface ElectronVault {
  unlock: (password: string, saltHex?: string) => Promise<{ success: boolean; saltHex?: string; error?: string }>;
  lock: () => Promise<void>;
  isUnlocked: () => Promise<boolean>;
  setCredential: (id: string, secret: string) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
}

interface ElectronSessions {
  getNodes: () => Promise<SessionNode[]>;
  addNode: (node: SessionNode) => Promise<void>;
  updateNode: (id: string, fields: Partial<SessionNode>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
}

interface Window {
  electron: {
    ssh: ElectronSSH;
    sftp: ElectronSFTP;
    vault: ElectronVault;
    sessions: ElectronSessions;
  };
}
