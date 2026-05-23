import { Client, ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';

interface ActiveSession {
  client: Client;
  shellChannel?: ClientChannel;
  config: any;
}

export class SSHConnectionPool extends EventEmitter {
  private static instance: SSHConnectionPool;
  private connections: Map<string, ActiveSession> = new Map();

  private constructor() {
    super();
  }

  public static getInstance(): SSHConnectionPool {
    if (!SSHConnectionPool.instance) {
      SSHConnectionPool.instance = new SSHConnectionPool();
    }
    return SSHConnectionPool.instance;
  }

  /**
   * Creates an active connection, supporting Jump Host (multi-hop proxy) nesting.
   */
  public async createConnection(
    sessionConfig: any,
    onData: (data: string) => void,
    onError: (err: Error) => void
  ): Promise<string> {
    const connectionId = Math.random().toString(36).substring(2, 11);
    
    try {
      const client = await this.connectNode(sessionConfig);
      
      // Request an interactive pseudo-terminal (pty) shell channel
      client.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, channel) => {
        if (err) {
          client.end();
          onError(err);
          return;
        }

        channel.on('data', (data: Buffer) => {
          onData(data.toString('utf-8'));
        });

        channel.on('close', () => {
          this.connections.delete(connectionId);
          client.end();
        });

        channel.on('error', (channelErr) => {
          onError(channelErr);
        });

        this.connections.set(connectionId, {
          client,
          shellChannel: channel,
          config: sessionConfig,
        });
      });

      return connectionId;
    } catch (err: any) {
      throw new Error(`SSH Connection failed: ${err.message}`);
    }
  }

  /**
   * Connect node handles recursive proxy/jump host chains using forwardOut.
   */
  private async connectNode(config: any): Promise<Client> {
    // If a jump host configuration is attached, we build a proxy tunnel
    if (config.jumpHost) {
      const parentClient = await this.connectNode(config.jumpHost);
      return new Promise<Client>((resolve, reject) => {
        // Forward TCP connection from proxy machine to target destination
        parentClient.forwardOut(
          '127.0.0.1', 0, // Source IP/Port
          config.host, config.port || 22, // Destination Host/Port
          (err, stream) => {
            if (err) {
              parentClient.end();
              return reject(new Error(`Failed to forward socket through jump host: ${err.message}`));
            }

            const targetClient = new Client();
            targetClient.on('ready', () => resolve(targetClient));
            targetClient.on('error', (targetErr) => reject(targetErr));
            
            // Connect to target utilizing the forwarded stream as socket
            targetClient.connect({
              sock: stream,
              username: config.username,
              password: config.password,
              privateKey: config.privateKey,
              passphrase: config.passphrase,
            });
          }
        );
      });
    }

    // Single-hop or root connection
    return new Promise<Client>((resolve, reject) => {
      const client = new Client();
      client.on('ready', () => resolve(client));
      client.on('error', (err) => reject(err));
      
      client.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
      });
    });
  }

  /**
   * Write data into active ssh stream
   */
  public write(connectionId: string, data: string): void {
    const session = this.connections.get(connectionId);
    if (!session || !session.shellChannel) {
      throw new Error(`Connection ${connectionId} is not active or lacks a shell channel`);
    }
    session.shellChannel.write(data);
  }

  /**
   * Resize remote pty window size
   */
  public resize(connectionId: string, cols: number, rows: number): void {
    const session = this.connections.get(connectionId);
    if (!session || !session.shellChannel) {
      throw new Error(`Connection ${connectionId} is not active or lacks a shell channel`);
    }
    session.shellChannel.setWindow(rows, cols, 0, 0);
  }

  /**
   * Disconnect single session
   */
  public disconnect(connectionId: string): void {
    const session = this.connections.get(connectionId);
    if (session) {
      if (session.shellChannel) {
        session.shellChannel.end();
      }
      session.client.end();
      this.connections.delete(connectionId);
    }
  }

  /**
   * Disconnect all active sessions
   */
  public disconnectAll(): void {
    for (const [id] of this.connections) {
      this.disconnect(id);
    }
  }

  /**
   * Instantly open an SFTP channel on top of the existing client connection
   * to satisfy Dual-Engine Sync (terminal <-> file transfers)
   */
  public async listSFTP(connectionId: string, remotePath: string): Promise<any[]> {
    const session = this.connections.get(connectionId);
    if (!session) {
      throw new Error(`No active SSH connection found for id: ${connectionId}`);
    }

    return new Promise((resolve, reject) => {
      session.client.sftp((err, sftp) => {
        if (err) return reject(err);
        
        sftp.readdir(remotePath, (readErr, list) => {
          if (readErr) return reject(readErr);
          
          // Map file listing structure cleanly
          const results = list.map((item) => ({
            name: item.filename,
            type: item.longname.startsWith('d') ? 'directory' : 'file',
            size: item.attrs.size,
            mtime: item.attrs.mtime,
            owner: item.attrs.uid,
            group: item.attrs.gid,
          }));
          
          resolve(results);
        });
      });
    });
  }
}
