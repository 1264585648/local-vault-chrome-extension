export interface Credential {
  id: string;
  title: string;
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

export const MAX_CREDENTIAL_TITLE_LENGTH = 20;

type CredentialLike = Partial<Credential> & Record<string, unknown>;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeCredentialTitle(value: string): string {
  return value.trim().slice(0, MAX_CREDENTIAL_TITLE_LENGTH);
}

export function getCredentialTitleFallback(credential: Pick<Credential, 'title' | 'username' | 'website'>): string {
  return normalizeCredentialTitle(credential.title || credential.username || credential.website || '未命名账号');
}

export function normalizeCredential(credential: CredentialLike): Credential {
  const website = stringValue(credential.website) || '未命名网站';
  const username = stringValue(credential.username);
  const fallbackTitle = stringValue(credential.title) || username || website || '未命名账号';

  return {
    id: stringValue(credential.id) || crypto.randomUUID(),
    title: normalizeCredentialTitle(fallbackTitle),
    website,
    username,
    password: typeof credential.password === 'string' ? credential.password : '',
    twoFactorSecret: stringValue(credential.twoFactorSecret),
    createdAt: stringValue(credential.createdAt) || new Date().toISOString(),
    updatedAt: stringValue(credential.updatedAt) || undefined
  };
}

export function normalizeCredentials(credentials: unknown): Credential[] {
  if (!Array.isArray(credentials)) {
    return [];
  }

  return credentials
    .filter((credential): credential is CredentialLike => Boolean(credential) && typeof credential === 'object')
    .map(credential => normalizeCredential(credential));
}
