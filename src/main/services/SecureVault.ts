import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Optional import: we fallback in tests if Electron app is not booted
let userDataPath = '';
try {
  const { app } = require('electron');
  userDataPath = app.getPath('userData');
} catch (e) {
  userDataPath = process.cwd();
}

export class SecureVault {
  private static instance: SecureVault;
  private vaultPath: string;
  private encryptionKey: Buffer | null = null;
  private memoryVault: Record<string, any> = {};

  private constructor() {
    this.vaultPath = path.join(userDataPath, 'secure_vault.enc');
  }

  public static getInstance(): SecureVault {
    if (!SecureVault.instance) {
      SecureVault.instance = new SecureVault();
    }
    return SecureVault.instance;
  }

  /**
   * Derives the encryption key using a master password and PBKDF2
   */
  public unlock(masterPassword: string, saltHex?: string): string {
    const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
    // Derive key: 256 bits (32 bytes)
    this.encryptionKey = crypto.pbkdf2Sync(masterPassword, salt, 10000, 32, 'sha256');
    
    // If the vault file exists, attempt to decrypt and load it
    if (fs.existsSync(this.vaultPath)) {
      try {
        this.loadVault();
      } catch (err: any) {
        this.encryptionKey = null;
        throw new Error(`Failed to decrypt vault with provided password: ${err.message}`);
      }
    } else {
      // Initialize an empty vault
      this.memoryVault = { credentials: {} };
      this.saveVault(salt);
    }

    return salt.toString('hex');
  }

  /**
   * Locks the vault, clearing keys from memory
   */
  public lock(): void {
    this.encryptionKey = null;
    this.memoryVault = {};
  }

  public isUnlocked(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Stores a credential value (password or key passphrase)
   */
  public setCredential(id: string, secret: string): void {
    this.ensureUnlocked();
    this.memoryVault.credentials[id] = secret;
    this.saveVault();
  }

  /**
   * Retrieves a decrypted credential
   */
  public getCredential(id: string): string | undefined {
    this.ensureUnlocked();
    return this.memoryVault.credentials[id];
  }

  /**
   * Deletes a credential
   */
  public deleteCredential(id: string): void {
    this.ensureUnlocked();
    if (this.memoryVault.credentials[id]) {
      delete this.memoryVault.credentials[id];
      this.saveVault();
    }
  }

  private ensureUnlocked(): void {
    if (!this.isUnlocked()) {
      throw new Error('Vault is locked. Unlock it first using your master password.');
    }
  }

  /**
   * Reads and decrypts file into memory
   */
  private loadVault(): void {
    if (!this.encryptionKey) throw new Error('No encryption key');

    const fileContent = fs.readFileSync(this.vaultPath, 'utf8');
    const envelope = JSON.parse(fileContent);

    const iv = Buffer.from(envelope.iv, 'hex');
    const tag = Buffer.from(envelope.tag, 'hex');
    const ciphertext = Buffer.from(envelope.ciphertext, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    this.memoryVault = JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Encrypts and writes memory state to file
   */
  private saveVault(providedSalt?: Buffer): void {
    if (!this.encryptionKey) throw new Error('No encryption key');

    // Create AppData sub-directories if they don't exist
    const dir = path.dirname(this.vaultPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let salt: Buffer;
    if (providedSalt) {
      salt = providedSalt;
    } else {
      // Parse salt from existing file if possible, or create new
      if (fs.existsSync(this.vaultPath)) {
        try {
          const fileContent = fs.readFileSync(this.vaultPath, 'utf8');
          salt = Buffer.from(JSON.parse(fileContent).salt, 'hex');
        } catch (e) {
          salt = crypto.randomBytes(16);
        }
      } else {
        salt = crypto.randomBytes(16);
      }
    }

    const iv = crypto.randomBytes(12); // 96-bit IV is standard for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const plaintext = Buffer.from(JSON.stringify(this.memoryVault), 'utf8');
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    const envelope = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext: ciphertext.toString('hex')
    };

    fs.writeFileSync(this.vaultPath, JSON.stringify(envelope, null, 2), 'utf8');
  }

  // Exposed for testing/debugging purposes
  public getVaultPath(): string {
    return this.vaultPath;
  }
}
