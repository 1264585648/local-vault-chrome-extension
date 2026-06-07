export interface Credential {
  id: string;
  website: string;
  username: string;
  password: string;
  twoFactorSecret: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EncryptedVault {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}
