import type { Credential } from './types';

type ImportedRecord = Record<string, unknown>;

const JSON_EXTENSIONS = ['.json'];
const CSV_EXTENSIONS = ['.csv'];

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readAlias(record: ImportedRecord, aliases: string[]): string {
  for (const alias of aliases) {
    const value = stringValue(record[alias]);
    if (value) {
      return value;
    }
  }

  return '';
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): ImportedRecord[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return headers.reduce<ImportedRecord>((record, header, index) => {
      record[header] = values[index] ?? '';
      return record;
    }, {});
  });
}

function parseJson(text: string): ImportedRecord[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is ImportedRecord => Boolean(item) && typeof item === 'object');
  }
  if (parsed && typeof parsed === 'object') {
    const wrapped = parsed as Record<string, unknown>;
    const list = wrapped.credentials ?? wrapped.items ?? wrapped.entries;
    if (Array.isArray(list)) {
      return list.filter((item): item is ImportedRecord => Boolean(item) && typeof item === 'object');
    }
  }

  throw new Error('JSON 文件必须包含账号数组');
}

function normalizeRecord(
  record: ImportedRecord,
  idFactory: () => string,
  nowFactory: () => string
): Credential {
  return {
    id: idFactory(),
    website:
      readAlias(record, ['website', 'Website', 'url', 'URL', 'name', 'Name', 'domain', 'Domain']) ||
      '未命名网站',
    username:
      readAlias(record, ['username', 'Username', 'login', 'Login', 'email', 'Email', 'account', 'Account']) ||
      '',
    password: readAlias(record, ['password', 'Password', 'pass', 'Pass']) || '',
    twoFactorSecret:
      readAlias(record, ['twoFactorSecret', 'totp', 'TOTP', 'secret', 'Secret', '2FA', 'otp']) || '',
    createdAt: nowFactory()
  };
}

export function parseCredentialImport(
  fileName: string,
  text: string,
  idFactory: () => string = () => crypto.randomUUID(),
  nowFactory = () => new Date().toISOString()
): Credential[] {
  const lowerName = fileName.toLowerCase();
  let records: ImportedRecord[];

  if (JSON_EXTENSIONS.some(extension => lowerName.endsWith(extension))) {
    records = parseJson(text);
  } else if (CSV_EXTENSIONS.some(extension => lowerName.endsWith(extension))) {
    records = parseCsv(text);
  } else {
    throw new Error('仅支持 JSON 或 CSV 文件');
  }

  return records.map(record => normalizeRecord(record, idFactory, nowFactory));
}

export function toPlaintextExport(credentials: Credential[]): string {
  return JSON.stringify(
    credentials.map(({ website, username, password, twoFactorSecret }) => ({
      website,
      username,
      password,
      twoFactorSecret
    })),
    null,
    2
  );
}

export function rekeyImportedCredentials(
  credentials: Credential[],
  idFactory: () => string = () => crypto.randomUUID(),
  nowFactory = () => new Date().toISOString()
): Credential[] {
  return credentials.map(credential => ({
    ...credential,
    id: idFactory(),
    createdAt: nowFactory(),
    updatedAt: undefined
  }));
}
