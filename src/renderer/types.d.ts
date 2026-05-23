interface ElectronSSH {
  connect: (config: any) => Promise<{ success: boolean; connectionId?: string; error?: string }>;
  write: (connectionId: string, data: string) => Promise<{ success: boolean; error?: string }>;
  resize: (connectionId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
  disconnect: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
  onData: (connectionId: string, callback: (data: string) => void) => () => void;
  onError: (connectionId: string, callback: (error: string) => void) => () => void;
}

interface ElectronSFTP {
  list: (connectionId: string, remotePath: string) => Promise<{ success: boolean; list?: any[]; error?: string }>;
}

interface Window {
  electron: {
    ssh: ElectronSSH;
    sftp: ElectronSFTP;
  };
}
