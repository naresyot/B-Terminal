import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ssh: {
    connect: (config: any) => ipcRenderer.invoke('ssh:connect', config),
    write: (connectionId: string, data: string) => ipcRenderer.invoke('ssh:write', { connectionId, data }),
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
  }
});
