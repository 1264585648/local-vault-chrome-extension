import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '..');
const legacyVaultWord = '\u91d1\u5e93';

function readProjectFile(path: string): string {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('app copy and dangerous toolbar controls', () => {
  it('uses the password library product name in app metadata', () => {
    const app = readProjectFile('src/App.tsx');
    const index = readProjectFile('index.html');
    const manifest = JSON.parse(readProjectFile('public/manifest.json')) as {
      name: string;
      action: { default_title: string };
    };

    expect(app).toContain('<h1>本地密码库</h1>');
    expect(index).toContain('<title>本地密码库</title>');
    expect(manifest.name).toBe('本地密码库');
    expect(manifest.action.default_title).toBe('本地密码库');
  });

  it('does not leave the old Chinese vault copy in user-facing files', () => {
    const userFacingFiles = [
      'src/App.tsx',
      'src/masterPasswordPolicy.ts',
      'src/vaultCrypto.ts',
      'src/vaultCrypto.test.ts',
      'index.html',
      'public/manifest.json',
      'README.md',
      'docs/competitive-analysis-and-promotion-guide.md',
      'docs/trust-building-playbook.md',
      'code_artifact (1).tsx'
    ];

    const offenders = userFacingFiles.filter(path => readProjectFile(path).includes(legacyVaultWord));

    expect(offenders).toEqual([]);
  });

  it('uses explicit logout wording instead of a lock label in the unlocked header', () => {
    const app = readProjectFile('src/App.tsx');

    expect(app).toContain('LogOut');
    expect(app).toContain('退出登陆');
    expect(app).not.toMatch(/>\s*锁定\s*</);
  });

  it('removes the bulk clear entry point from the app toolbar', () => {
    const app = readProjectFile('src/App.tsx');

    expect(app).not.toMatch(/\bhandleResetVaultData\b/);
    expect(app).not.toMatch(/\bresetVaultData\b/);
    expect(app).not.toMatch(/\bresetVaultDataForFreshStart\b/);
    expect(app).not.toContain('清空密码库数据');
  });

  it('uses a copy icon for the compact row password copy action', () => {
    const app = readProjectFile('src/App.tsx');
    const compactCopyButton = app.match(
      /title="复制密码"[\s\S]*?onClick=\{\(\) => onCopy\(credential\.password, '密码'\)\}[\s\S]*?<([A-Za-z0-9]+) size=\{17\}/
    );

    expect(compactCopyButton?.[1]).toBe('Copy');
  });
});
