# OmniTerm Architecture Knowledge Base

This document maps out schemas, design details, and specifications for the OmniTerm terminal and file transfer workspace.

## 1. Session Tree & Inherited Config Schema

Every session or folder is a node in a flat list or tree layout. Folder nodes cascade configuration properties down to children unless overridden.

### Node Interface Definition
```typescript
export interface SessionNode {
  id: string;
  parentId: string | null; // Null indicates root level
  name: string;
  type: 'folder' | 'session';
  
  // Terminal/SSH specific parameters (optional for folders, default inherited)
  host?: string;
  port?: number;
  username?: string;
  authMethod?: 'password' | 'publicKey' | 'agent' | 'inherited';
  
  // Secure pointer to encrypted credentials store
  credentialId?: string; 
  privateKeyPath?: string;
  
  // Jump-Host/Firewall Proxy Chain Reference
  proxyChainId?: string | null; // Maps to another SessionNode of type 'session' or proxy definition
  
  // Terminal Behavior
  terminalTheme?: {
    background: string;
    foreground: string;
    cursor: string;
  };
  
  // Button Bar Mapping
  buttonBarId?: string | null;
}
```

### Inheritance Cascade Logic
To compute properties for a targeted session:
1. Walk up the parent links from the node to the root.
2. Accumulate configuration fields. The closest defined value in the path overrides parent values.
3. This allows setting a private key path on a folder (e.g., "Production Cluster") and automatically applying it to all children sessions.

---

## 2. Credentials Storage & Encryption (AES-256-GCM)

To securely save connection passphrases and key passwords without `better-sqlite3`, we utilize an encrypted JSON flatfile.

- **Storage Location:** `%APPDATA%/OmniTerm/secure_vault.enc`
- **Key Derivation:** PBKDF2 (using Node.js `crypto.pbkdf2Sync`) with a salt and a user master password (or machine-tied key).
- **Encryption Algorithm:** `aes-256-gcm`
- **Payload Structure:**
  ```json
  {
    "iv": "hex-encoded-initialization-vector",
    "tag": "hex-encoded-auth-tag",
    "salt": "hex-encoded-salt",
    "ciphertext": "hex-encoded-encrypted-json-payload"
  }
  ```
- **Decrypted Payload Map:**
  ```json
  {
    "credentials": {
      "cred-uuid-1": {
        "password": "my-secret-password",
        "passphrase": "my-key-passphrase"
      }
    }
  }
  ```

---

## 3. Jump Host & Firewall Multiplexing (`ssh -J` paradigm)

For remote systems placed behind bastion boxes or DMZs, we establish multiplexed proxy connections:

1. **Proxy Command abstraction:** Create `ssh2` Client instance for Host A (bastion).
2. **Channel creation:** Request a forward port channel (`ssh.forwardOut`) from Host A pointing to Host B (destination) port 22.
3. **Chain bootstrapping:** Spawn a secondary `ssh2` Client instance, using the forward socket stream from Host A as the connection `sock` parameter:
   ```typescript
   const clientA = new Client();
   clientA.on('ready', () => {
     clientA.forwardOut(srcIP, srcPort, hostB, portB, (err, stream) => {
       const clientB = new Client();
       clientB.connect({ sock: stream, username: userB, ... });
     });
   });
   ```
4. This can be repeated recursively to support arbitrary jumps (Host A -> Host B -> Host C).

---

## 4. Dual-Engine Sync (SSH Terminal to SFTP Transfer)

To allow the user to clone or switch active terminals instantly into file transfer panels:
- Keep a global reference map of authenticated `Client` instances in `SSHConnectionPool`.
- When an SFTP operation is initiated for Session X:
  - Check if `SSHConnectionPool` has an active, authenticated `Client` socket for Session X.
  - If yes, execute `client.sftp((err, sftp) => { ... })` directly.
  - This avoids duplicate authentication and leverages active TCP channels.
