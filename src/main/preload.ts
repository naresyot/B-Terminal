import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ssh: {
    connect: (sessionId: string) => ipcRenderer.invoke('ssh:connect', sessionId),
    write: (connectionId: string, data: string) => ipcRenderer.send('ssh:write', { connectionId, data }),
    resize: (connectionId: string, cols: number, rows: number) => ipcRenderer.invoke('ssh:resize', { connectionId, cols, rows }),
    disconnect: (connectionId: string) => ipcRenderer.invoke('ssh:disconnect', connectionId),
    onData: (connectionId: string, callback: (data: string) => void) => {
      const listener = (_event: any, data: string) => callback(data);
      ipcRenderer.on(`ssh:data:${connectionId}`, listener);
      return () => {
        ipcRenderer.removeListener(`ssh:data:${connectionId}`, listener);
      };
    },
    onError: (connectionId: string, callback: (error: string) => void) => {
      const listener = (_event: any, error: string) => callback(error);
      ipcRenderer.on(`ssh:error:${connectionId}`, listener);
      return () => {
        ipcRenderer.removeListener(`ssh:error:${connectionId}`, listener);
      };
    }
  },
  sftp: {
    list: (connectionId: string, remotePath: string) => ipcRenderer.invoke('sftp:list', { connectionId, remotePath }),
  },
  vault: {
    unlock: (password: string, saltHex?: string) => ipcRenderer.invoke('vault:unlock', { password, saltHex }),
    lock: () => ipcRenderer.invoke('vault:lock'),
    isUnlocked: () => ipcRenderer.invoke('vault:isUnlocked'),
    setCredential: (id: string, secret: string) => ipcRenderer.invoke('vault:setCredential', { id, secret }),
    deleteCredential: (id: string) => ipcRenderer.invoke('vault:deleteCredential', id),
  },
  sessions: {
    getNodes: () => ipcRenderer.invoke('sessions:getNodes'),
    addNode: (node: any) => ipcRenderer.invoke('sessions:addNode', node),
    updateNode: (id: string, fields: any) => ipcRenderer.invoke('sessions:updateNode', { id, fields }),
    deleteNode: (id: string) => ipcRenderer.invoke('sessions:deleteNode', id),
  }
});
