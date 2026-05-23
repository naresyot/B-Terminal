import * as fs from 'fs';
import * as path from 'path';
import { SecureVault } from './SecureVault';

let userDataPath = '';
try {
  const { app } = require('electron');
  userDataPath = app.getPath('userData');
} catch (e) {
  userDataPath = process.cwd();
}

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

export class SessionManager {
  private static instance: SessionManager;
  private configPath: string;
  private nodes: SessionNode[] = [];

  private constructor() {
    this.configPath = path.join(userDataPath, 'sessions.json');
    this.loadSessions();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public getNodes(): SessionNode[] {
    return this.nodes;
  }

  public addNode(node: SessionNode): void {
    this.nodes.push(node);
    this.saveSessions();
  }

  public updateNode(id: string, updatedFields: Partial<SessionNode>): void {
    this.nodes = this.nodes.map((node) =>
      node.id === id ? { ...node, ...updatedFields } : node
    );
    this.saveSessions();
  }

  public deleteNode(id: string): void {
    // Collect all sub-node IDs recursively to delete them as well (cascading delete)
    const idsToDelete = this.collectSubNodeIds(id);
    idsToDelete.add(id);

    this.nodes = this.nodes.filter((node) => !idsToDelete.has(node.id));
    this.saveSessions();
  }

  /**
   * Resolves connection credentials by walking up parents and unlocking vaults.
   */
  public resolveConnectionConfig(sessionId: string): any {
    const node = this.nodes.find((n) => n.id === sessionId);
    if (!node || node.type !== 'session') {
      throw new Error(`Session ${sessionId} not found or is a folder`);
    }

    const host = this.getInheritedProperty(node, 'host');
    const port = this.getInheritedProperty(node, 'port') || 22;
    const username = this.getInheritedProperty(node, 'username') || 'root';
    const authMethod = this.getInheritedProperty(node, 'authMethod') || 'password';
    const privateKey = this.getInheritedProperty(node, 'privateKeyPath');

    const config: any = {
      host,
      port,
      username,
      authMethod,
      privateKey,
    };

    // Pull encrypted password/passphrase secret if SecureVault is unlocked
    const vault = SecureVault.getInstance();
    if (vault.isUnlocked()) {
      const secret = vault.getCredential(node.id);
      if (secret) {
        if (authMethod === 'password') {
          config.password = secret;
        } else if (authMethod === 'publicKey') {
          config.passphrase = secret;
        }
      }
    }

    // Resolve Jump Host if defined
    if (node.jumpHostId) {
      config.jumpHost = this.resolveConnectionConfig(node.jumpHostId);
    }

    return config;
  }

  private getInheritedProperty(node: SessionNode, property: keyof SessionNode): any {
    if (node[property] !== undefined && node[property] !== 'inherited') {
      return node[property];
    }
    if (node.parentId) {
      const parent = this.nodes.find((n) => n.id === node.parentId);
      if (parent) {
        return this.getInheritedProperty(parent, property);
      }
    }
    return undefined;
  }

  private collectSubNodeIds(parentId: string, collected = new Set<string>()): Set<string> {
    const children = this.nodes.filter((n) => n.parentId === parentId);
    for (const child of children) {
      collected.add(child.id);
      this.collectSubNodeIds(child.id, collected);
    }
    return collected;
  }

  private loadSessions(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        this.nodes = JSON.parse(fileContent);
      } catch (e) {
        this.nodes = this.getDefaultSessions();
      }
    } else {
      this.nodes = this.getDefaultSessions();
      this.saveSessions();
    }
  }

  private saveSessions(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(this.nodes, null, 2), 'utf8');
  }

  private getDefaultSessions(): SessionNode[] {
    return [
      { id: '1', parentId: null, name: 'Production Clusters', type: 'folder', authMethod: 'publicKey', privateKeyPath: '~/.ssh/id_rsa' },
      { id: '2', parentId: '1', name: 'Web Server Alpha', type: 'session', host: 'web-a.prod.internal', username: 'ubuntu' },
      { id: '3', parentId: '1', name: 'DB Bastion Server', type: 'session', host: 'db-bastion.prod.internal', username: 'admin', authMethod: 'password' },
      { id: '4', parentId: null, name: 'Staging Labs', type: 'folder', username: 'developer' },
      { id: '5', parentId: '4', name: 'API Server', type: 'session', host: 'api.staging.internal', port: 2222 },
      { id: '6', parentId: '4', name: 'Secure Jump Box', type: 'session', host: 'jump.staging.internal', authMethod: 'password' }
    ];
  }
}
