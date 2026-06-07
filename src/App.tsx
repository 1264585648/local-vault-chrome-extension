import {
  AlertCircle,
  Clock,
  Copy,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileJson,
  KeyRound,
  Lock,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  Wand2
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createEncryptedBackup, decryptEncryptedBackup, isEncryptedBackup } from './encryptedBackup';
import { parseCredentialImport, rekeyImportedCredentials, toPlaintextExport } from './importExport';
import {
  EMPTY_MASTER_PASSWORD_WARNING,
  MASTER_PASSWORD_RECOVERY_WARNING,
  shouldWarnAboutEmptyMasterPassword
} from './masterPasswordPolicy';
import { generatePassword, isValidTotpSecret } from './passwordTools';
import { clearSession, restoreSession, saveSession } from './sessionClient';
import {
  getSessionDurationLabel,
  SESSION_DURATION_OPTIONS,
  type SessionDurationMinutes
} from './sessionPolicy';
import { getTotpTimeLeft, generateTotp } from './totp';
import type { Credential, EncryptedVault } from './types';
import { decryptVault, encryptVault } from './vaultCrypto';
import { resetVaultData, resetVaultDataForFreshStart } from './vaultReset';
import { loadVault, saveVault } from './vaultStorage';

type AppState = 'loading' | 'setup' | 'locked' | 'unlocked';

interface CredentialForm {
  website: string;
  username: string;
  password: string;
  twoFactorSecret: string;
}

const EMPTY_FORM: CredentialForm = {
  website: '',
  username: '',
  password: '',
  twoFactorSecret: ''
};

const COMMON_WEBSITES = [
  'google.com',
  'github.com',
  'apple.com',
  'microsoft.com',
  'amazon.com',
  'x.com',
  'linkedin.com',
  'netflix.com',
  'paypal.com',
  'dropbox.com',
  'reddit.com',
  'discord.com',
  'slack.com',
  'steamcommunity.com',
  'bilibili.com',
  'taobao.com',
  'jd.com',
  'baidu.com',
  'zhihu.com'
];

function sortCredentials(credentials: Credential[]): Credential[] {
  return [...credentials].sort((left, right) => left.website.localeCompare(right.website));
}

function normalizeDomain(value: string): string {
  return value.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0] || value;
}

function formatRemaining(seconds: number | null): string {
  if (seconds === null) {
    return '本次';
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

async function copyText(text: string): Promise<void> {
  if (!text) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<CredentialForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isChangeMasterOpen, setIsChangeMasterOpen] = useState(false);
  const [nextMasterPassword, setNextMasterPassword] = useState('');
  const [showNextMasterPassword, setShowNextMasterPassword] = useState(false);
  const [changeMasterError, setChangeMasterError] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [sessionDuration, setSessionDuration] = useState<SessionDurationMinutes>(15);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lockEpochRef = useRef(0);

  useEffect(() => {
    let alive = true;
    async function initialize() {
      try {
        const clearedStartupData = await resetVaultDataForFreshStart();
        const savedVault = await loadVault();
        if (!alive) {
          return;
        }

        setVault(savedVault);
        if (!savedVault) {
          await clearSession();
          setAppState('setup');
          if (clearedStartupData) {
            setStatusMessage('测试数据已清空，可留空主密码创建金库');
          }
          return;
        }

        const restoredSession = await restoreSession();
        if (restoredSession.payload) {
          lockEpochRef.current += 1;
          setMasterPassword(restoredSession.payload.masterPassword);
          setCredentials(sortCredentials(restoredSession.payload.credentials));
          setSessionExpiresAt(restoredSession.status.expiresAt);
          setSessionDuration(restoredSession.status.durationMinutes);
          setAppState('unlocked');
          setStatusMessage(
            shouldWarnAboutEmptyMasterPassword(restoredSession.payload.masterPassword)
              ? EMPTY_MASTER_PASSWORD_WARNING
              : '已恢复短时会话'
          );
          return;
        }

        setAppState('locked');
      } catch {
        if (alive) {
          setAuthError('读取本地金库失败');
          setAppState('setup');
        }
      }
    }

    initialize();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timer = window.setTimeout(
      () => setStatusMessage(''),
      statusMessage === EMPTY_MASTER_PASSWORD_WARNING ? 5200 : 2200
    );
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (appState !== 'unlocked' || !sessionExpiresAt) {
      setRemainingSeconds(null);
      return;
    }

    const updateRemaining = () => {
      const nextRemaining = Math.max(0, Math.ceil((sessionExpiresAt - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) {
        void lockVault(false, '会话已自动锁定');
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [appState, sessionExpiresAt]);

  const filteredCredentials = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return credentials;
    }

    return credentials.filter(credential => {
      return (
        credential.website.toLowerCase().includes(needle) ||
        credential.username.toLowerCase().includes(needle)
      );
    });
  }, [credentials, searchTerm]);

  async function saveSessionForDuration(
    duration: SessionDurationMinutes,
    nextCredentials: Credential[],
    password: string
  ) {
    const status = await saveSession(
      { credentials: sortCredentials(nextCredentials), masterPassword: password },
      duration
    );
    setSessionExpiresAt(status.expiresAt);
    setRemainingSeconds(status.expiresAt ? Math.max(0, Math.ceil((status.expiresAt - Date.now()) / 1000)) : null);
  }

  async function persistCredentials(nextCredentials: Credential[]) {
    if (!vault) {
      throw new Error('金库尚未初始化');
    }

    const operationEpoch = lockEpochRef.current;
    const sorted = sortCredentials(nextCredentials);
    const encryptedVault = await encryptVault(sorted, masterPassword, vault.salt);
    await saveVault(encryptedVault);
    if (operationEpoch !== lockEpochRef.current) {
      return;
    }

    await saveSessionForDuration(sessionDuration, sorted, masterPassword);
    setVault(encryptedVault);
    setCredentials(sorted);
  }

  async function handleCreateVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError('');

    window.alert(MASTER_PASSWORD_RECOVERY_WARNING);

    try {
      const encryptedVault = await encryptVault([], masterPassword);
      await saveVault(encryptedVault);
      await saveSessionForDuration(sessionDuration, [], masterPassword);
      lockEpochRef.current += 1;
      setVault(encryptedVault);
      setCredentials([]);
      setAppState('unlocked');
      setStatusMessage(shouldWarnAboutEmptyMasterPassword(masterPassword) ? EMPTY_MASTER_PASSWORD_WARNING : '金库已创建');
    } catch {
      setAuthError('创建金库失败，请确认浏览器支持 Web Crypto');
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError('');

    try {
      const savedVault = vault ?? (await loadVault());
      if (!savedVault) {
        setAppState('setup');
        return;
      }

      const decrypted = sortCredentials(await decryptVault(savedVault, masterPassword));
      await saveSessionForDuration(sessionDuration, decrypted, masterPassword);
      lockEpochRef.current += 1;
      setVault(savedVault);
      setCredentials(decrypted);
      setAppState('unlocked');
      setStatusMessage(shouldWarnAboutEmptyMasterPassword(masterPassword) ? EMPTY_MASTER_PASSWORD_WARNING : '金库已解锁');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '解锁失败');
    }
  }

  async function lockVault(shouldClearSession = true, message = '已锁定') {
    lockEpochRef.current += 1;
    if (shouldClearSession) {
      await clearSession();
    }
    setCredentials([]);
    setMasterPassword('');
    setShowMasterPassword(false);
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setIsFormOpen(false);
    setIsChangeMasterOpen(false);
    setNextMasterPassword('');
    setShowNextMasterPassword(false);
    setChangeMasterError('');
    setShowFormPassword(false);
    setSessionExpiresAt(null);
    setRemainingSeconds(null);
    setAppState(vault ? 'locked' : 'setup');
    setStatusMessage(message);
  }

  async function handleResetVaultData() {
    if (!window.confirm('确定清空当前设备上的所有金库数据和短时会话吗？此操作不可恢复。')) {
      return;
    }

    lockEpochRef.current += 1;

    try {
      await resetVaultData();
      setVault(null);
      setCredentials([]);
      setMasterPassword('');
      setShowMasterPassword(false);
      setAuthError('');
      setSearchTerm('');
      resetForm();
      resetMasterPasswordChange();
      setSessionExpiresAt(null);
      setRemainingSeconds(null);
      setAppState('setup');
      setStatusMessage('金库数据已清空');
    } catch {
      setStatusMessage('清空金库数据失败，请稍后重试');
    }
  }

  function resetMasterPasswordChange() {
    setIsChangeMasterOpen(false);
    setNextMasterPassword('');
    setShowNextMasterPassword(false);
    setChangeMasterError('');
  }

  function toggleMasterPasswordChange() {
    const shouldOpen = !isChangeMasterOpen;
    if (shouldOpen) {
      resetForm();
    }

    setIsChangeMasterOpen(shouldOpen);
    setNextMasterPassword('');
    setShowNextMasterPassword(false);
    setChangeMasterError('');
  }

  async function handleChangeMasterPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChangeMasterError('');

    if (!vault) {
      setChangeMasterError('金库尚未初始化');
      return;
    }

    try {
      const operationEpoch = lockEpochRef.current;
      const sorted = sortCredentials(credentials);
      const encryptedVault = await encryptVault(sorted, nextMasterPassword);
      await saveVault(encryptedVault);
      if (operationEpoch !== lockEpochRef.current) {
        return;
      }

      await saveSessionForDuration(sessionDuration, sorted, nextMasterPassword);
      setVault(encryptedVault);
      setMasterPassword(nextMasterPassword);
      setCredentials(sorted);
      resetMasterPasswordChange();
      setStatusMessage(
        shouldWarnAboutEmptyMasterPassword(nextMasterPassword) ? EMPTY_MASTER_PASSWORD_WARNING : '主密码已更改'
      );
    } catch {
      setChangeMasterError('更改主密码失败，请稍后重试');
    }
  }

  function resetForm() {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setIsFormOpen(false);
    setShowFormPassword(false);
  }

  function openAddForm() {
    resetMasterPasswordChange();
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setIsFormOpen(true);
    setShowFormPassword(false);
  }

  function openEditForm(credential: Credential) {
    resetMasterPasswordChange();
    setFormData({
      website: credential.website,
      username: credential.username,
      password: credential.password,
      twoFactorSecret: credential.twoFactorSecret
    });
    setEditingId(credential.id);
    setIsFormOpen(true);
    setShowFormPassword(false);
  }

  async function handleSubmitCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedWebsite = formData.website.trim();
    const trimmedSecret = formData.twoFactorSecret.trim();

    if (!trimmedWebsite) {
      setStatusMessage('请填写网站名称或 URL');
      return;
    }

    if (trimmedSecret && !isValidTotpSecret(trimmedSecret)) {
      setStatusMessage('2FA 密钥格式不正确');
      return;
    }

    const now = new Date().toISOString();
    const nextCredentials = editingId
      ? credentials.map(credential =>
          credential.id === editingId
            ? {
                ...credential,
                ...formData,
                website: trimmedWebsite,
                twoFactorSecret: trimmedSecret,
                updatedAt: now
              }
            : credential
        )
      : [
          ...credentials,
          {
            id: crypto.randomUUID(),
            website: trimmedWebsite,
            username: formData.username.trim(),
            password: formData.password,
            twoFactorSecret: trimmedSecret,
            createdAt: now
          }
        ];

    await persistCredentials(nextCredentials);
    resetForm();
    setStatusMessage(editingId ? '记录已更新' : '记录已保存');
  }

  async function handleDelete(id: string) {
    if (!window.confirm('确定删除这条记录吗？')) {
      return;
    }

    await persistCredentials(credentials.filter(credential => credential.id !== id));
    setStatusMessage('记录已删除');
  }

  function handleGeneratePassword() {
    setFormData(current => ({ ...current, password: generatePassword(18) }));
    setShowFormPassword(true);
  }

  async function handleSessionDurationChange(value: string) {
    const nextDuration = Number(value) as SessionDurationMinutes;
    setSessionDuration(nextDuration);

    if (appState === 'unlocked') {
      await saveSessionForDuration(nextDuration, credentials, masterPassword);
      setStatusMessage(nextDuration === 0 ? '短时会话已关闭' : `会话保持 ${getSessionDurationLabel(nextDuration)}`);
    }
  }

  async function handleEncryptedExport() {
    const operationEpoch = lockEpochRef.current;
    const backup = await createEncryptedBackup(credentials, masterPassword);
    if (operationEpoch !== lockEpochRef.current) {
      return;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `password_encrypted_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage('加密备份已导出');
  }

  function handlePlaintextExport() {
    if (!window.confirm('导出的 JSON 将包含明文密码。请只保存在可信设备，并在使用后妥善清理。')) {
      return;
    }

    const blob = new Blob([toPlaintextExport(credentials)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `password_plaintext_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage('明文备份已导出');
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const operationEpoch = lockEpochRef.current;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result ?? '');
        let imported: Credential[];

        if (file.name.toLowerCase().endsWith('.json')) {
          const parsedJson = JSON.parse(text) as unknown;
          if (isEncryptedBackup(parsedJson)) {
            imported = rekeyImportedCredentials(await decryptEncryptedBackup(parsedJson, masterPassword));
          } else {
            imported = parseCredentialImport(file.name, text);
          }
        } else {
          imported = parseCredentialImport(file.name, text);
        }

        if (operationEpoch !== lockEpochRef.current) {
          return;
        }

        await persistCredentials([...credentials, ...imported]);
        setStatusMessage(`已导入 ${imported.length} 条记录`);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : '导入失败');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function handleCopy(text: string, label: string) {
    await copyText(text);
    setStatusMessage(`${label}已复制`);
  }

  if (appState === 'loading') {
    return (
      <div className="popup-shell loading-view">
        <div className="spinner" aria-label="加载中" />
      </div>
    );
  }

  const authMode = appState === 'setup' ? 'setup' : 'unlock';

  return (
    <div className="popup-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Shield size={21} aria-hidden="true" />
          </div>
          <div>
            <h1>本地私密金库</h1>
            <p>{appState === 'unlocked' ? `${credentials.length} 条记录` : '离线加密保存'}</p>
          </div>
        </div>
        {appState === 'unlocked' && (
          <div className="header-actions">
            <SessionSelect
              compact
              value={sessionDuration}
              remainingSeconds={remainingSeconds}
              onChange={event => void handleSessionDurationChange(event.target.value)}
            />
            <button className="ghost-button header-lock" type="button" onClick={() => void lockVault()}>
              <Lock size={16} aria-hidden="true" />
              锁定
            </button>
          </div>
        )}
      </header>

      {appState === 'setup' || appState === 'locked' ? (
        <main className="auth-panel">
          <div className="auth-icon">
            <KeyRound size={34} aria-hidden="true" />
          </div>
          <h2>{authMode === 'setup' ? '设置主密码' : '解锁金库'}</h2>
          <p className="auth-copy">
            {authMode === 'setup'
              ? '数据只保存在本机插件存储中，使用主密码派生密钥后加密。请记住主密码，丢失后无法恢复。'
              : '输入主密码后，插件会在本地解密数据。可选择短时间保持解锁，到期后自动锁定。'}
          </p>
          <form className="auth-form" onSubmit={authMode === 'setup' ? handleCreateVault : handleUnlock}>
            <SessionSelect
              value={sessionDuration}
              remainingSeconds={null}
              onChange={event => void handleSessionDurationChange(event.target.value)}
            />
            <div className="inline-input auth-password-input">
              <input
                autoFocus
                type={showMasterPassword ? 'text' : 'password'}
                value={masterPassword}
                onChange={event => setMasterPassword(event.target.value)}
                placeholder="输入主密码，可留空"
              />
              <button
                className="icon-button inset"
                type="button"
                title={showMasterPassword ? '隐藏主密码' : '显示主密码'}
                onClick={() => setShowMasterPassword(value => !value)}
              >
                {showMasterPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {authError && (
              <p className="inline-error">
                <AlertCircle size={15} aria-hidden="true" />
                {authError}
              </p>
            )}
            <button className="primary-button" type="submit">
              {authMode === 'setup' ? '加密并创建金库' : '解锁并进入'}
            </button>
          </form>
        </main>
      ) : (
        <main className="vault-panel">
          <section className="toolbar" aria-label="金库工具栏">
            <div className="search-box">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                placeholder="搜索网站或账号"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
            </div>
            <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleImport} hidden />
            <button className="icon-button" type="button" title="导入 JSON / CSV / 加密备份" onClick={triggerImport}>
              <Upload size={18} aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" title="导出加密备份" onClick={() => void handleEncryptedExport()}>
              <Lock size={18} aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" title="导出明文 JSON" onClick={handlePlaintextExport}>
              <Download size={18} aria-hidden="true" />
            </button>
            <button
              className="icon-button danger"
              type="button"
              title="清空金库数据"
              onClick={() => void handleResetVaultData()}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              title="更改主密码"
              onClick={toggleMasterPasswordChange}
            >
              <KeyRound size={18} aria-hidden="true" />
            </button>
            <button className="primary-button compact" type="button" onClick={openAddForm}>
              <Plus size={17} aria-hidden="true" />
              新增
            </button>
          </section>

          {isChangeMasterOpen && (
            <section className="edit-panel security-panel" aria-label="更改主密码">
              <div className="section-title">
                <KeyRound size={16} aria-hidden="true" />
                <h2>更改主密码</h2>
              </div>
              <form className="master-password-form" onSubmit={handleChangeMasterPassword}>
                <label>
                  新主密码
                  <div className="inline-input">
                    <input
                      type={showNextMasterPassword ? 'text' : 'password'}
                      value={nextMasterPassword}
                      onChange={event => setNextMasterPassword(event.target.value)}
                      placeholder="可留空"
                    />
                    <button
                      className="icon-button inset"
                      type="button"
                      title={showNextMasterPassword ? '隐藏主密码' : '显示主密码'}
                      onClick={() => setShowNextMasterPassword(value => !value)}
                    >
                      {showNextMasterPassword ? (
                        <EyeOff size={17} aria-hidden="true" />
                      ) : (
                        <Eye size={17} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </label>
                <p className="field-hint">可留空；空主密码风险较高，建议尽快设置主密码。</p>
                {changeMasterError && (
                  <p className="inline-error">
                    <AlertCircle size={15} aria-hidden="true" />
                    {changeMasterError}
                  </p>
                )}
                <div className="form-actions">
                  <button className="secondary-button" type="button" onClick={resetMasterPasswordChange}>
                    取消
                  </button>
                  <button className="primary-button compact" type="submit">
                    保存
                  </button>
                </div>
              </form>
            </section>
          )}

          {isFormOpen && (
            <section className="edit-panel" aria-label={editingId ? '编辑记录' : '新增记录'}>
              <div className="section-title">
                {editingId ? <Edit2 size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                <h2>{editingId ? '编辑记录' : '新增记录'}</h2>
              </div>
              <form className="credential-form" onSubmit={handleSubmitCredential}>
                <label>
                  网站名称 / URL
                  <input
                    type="text"
                    list="common-websites"
                    value={formData.website}
                    onChange={event => setFormData(current => ({ ...current, website: event.target.value }))}
                    placeholder="例如 github.com"
                    required
                  />
                </label>
                <label>
                  账号
                  <input
                    type="text"
                    value={formData.username}
                    onChange={event => setFormData(current => ({ ...current, username: event.target.value }))}
                    placeholder="邮箱或用户名"
                  />
                </label>
                <datalist id="common-websites">
                  {COMMON_WEBSITES.map(site => (
                    <option key={site} value={site} />
                  ))}
                </datalist>
                <label>
                  密码
                  <div className="inline-input">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={event => setFormData(current => ({ ...current, password: event.target.value }))}
                      placeholder="可留空"
                    />
                    <button
                      className="icon-button inset"
                      type="button"
                      title={showFormPassword ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowFormPassword(value => !value)}
                    >
                      {showFormPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                    <button
                      className="icon-button inset"
                      type="button"
                      title="生成强密码"
                      onClick={handleGeneratePassword}
                    >
                      <Wand2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </label>
                <label>
                  2FA Base32 密钥
                  <input
                    className={
                      formData.twoFactorSecret && !isValidTotpSecret(formData.twoFactorSecret) ? 'input-error' : ''
                    }
                    type="text"
                    value={formData.twoFactorSecret}
                    onChange={event => setFormData(current => ({ ...current, twoFactorSecret: event.target.value }))}
                    placeholder="例如 JBSWY3DPEHPK3PXP"
                  />
                </label>
                <div className="form-actions">
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    取消
                  </button>
                  <button className="primary-button compact" type="submit">
                    保存
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="credential-list" aria-label="账号列表">
            {filteredCredentials.length === 0 ? (
              <div className="empty-state">
                <FileJson size={44} aria-hidden="true" />
                <h2>{searchTerm ? '没有匹配记录' : '暂无记录'}</h2>
                <p>{searchTerm ? '换个关键词试试。' : '新增账号，或导入 JSON / CSV / 加密备份。'}</p>
              </div>
            ) : (
              filteredCredentials.map(credential => (
                <CredentialRow
                  credential={credential}
                  key={credential.id}
                  onCopy={handleCopy}
                  onDelete={() => void handleDelete(credential.id)}
                  onEdit={() => openEditForm(credential)}
                />
              ))
            )}
          </section>
        </main>
      )}

      {statusMessage && <div className="toast">{statusMessage}</div>}
    </div>
  );
}

interface SessionSelectProps {
  compact?: boolean;
  value: SessionDurationMinutes;
  remainingSeconds: number | null;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function SessionSelect({ compact = false, value, remainingSeconds, onChange }: SessionSelectProps) {
  return (
    <label className={compact ? 'session-select compact-session' : 'session-select'}>
      <span>
        <Clock size={15} aria-hidden="true" />
        {compact ? formatRemaining(remainingSeconds) : '保持解锁'}
      </span>
      <select value={value} onChange={onChange} title="自动锁定时间">
        {SESSION_DURATION_OPTIONS.map(option => (
          <option key={option.minutes} value={option.minutes}>
            {option.label}
            {option.recommended ? '（推荐）' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

interface CredentialRowProps {
  credential: Credential;
  onCopy: (text: string, label: string) => Promise<void>;
  onDelete: () => void;
  onEdit: () => void;
}

function CredentialRow({ credential, onCopy, onDelete, onEdit }: CredentialRowProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const domain = normalizeDomain(credential.website);
  const initial = domain.slice(0, 1).toUpperCase() || '?';

  useEffect(() => {
    if (!credential.twoFactorSecret) {
      setTotpCode('');
      return;
    }

    let alive = true;
    async function updateTotp() {
      setTimeLeft(getTotpTimeLeft());
      try {
        const nextCode = await generateTotp(credential.twoFactorSecret);
        if (alive) {
          setTotpCode(nextCode);
        }
      } catch {
        if (alive) {
          setTotpCode('无效');
        }
      }
    }

    updateTotp();
    const interval = window.setInterval(updateTotp, 1000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [credential.twoFactorSecret]);

  return (
    <article className="credential-row">
      <div className="row-main">
        <div className="site-badge" aria-hidden="true">
          {initial}
        </div>
        <div className="site-copy">
          <h3 title={credential.website}>{credential.website}</h3>
          <button
            className="text-button"
            type="button"
            disabled={!credential.username}
            onClick={() => onCopy(credential.username, '账号')}
            title="复制账号"
          >
            {credential.username || '未填写账号'}
            {credential.username && <Copy size={12} aria-hidden="true" />}
          </button>
        </div>
        <div className="totp-pill">
          {credential.twoFactorSecret ? (
            <button type="button" onClick={() => onCopy(totpCode, '验证码')} title="复制 2FA 验证码">
              <span>{totpCode || '------'}</span>
              <small className={timeLeft <= 5 ? 'urgent' : ''}>{timeLeft}s</small>
            </button>
          ) : (
            <span className="muted-dashes">- - -</span>
          )}
        </div>
        <div className="row-actions">
          <button
            className="icon-button"
            type="button"
            title={showDetails ? '隐藏明文' : '查看明文'}
            onClick={() => setShowDetails(value => !value)}
          >
            {showDetails ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
          <button
            className="icon-button"
            type="button"
            title="复制密码"
            disabled={!credential.password}
            onClick={() => onCopy(credential.password, '密码')}
          >
            <Lock size={17} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" title="编辑" onClick={onEdit}>
            <Edit2 size={17} aria-hidden="true" />
          </button>
          <button className="icon-button danger" type="button" title="删除" onClick={onDelete}>
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="detail-panel">
          <div>
            <span>密码明文</span>
            <code>{credential.password || '未填写'}</code>
          </div>
          <button className="icon-button" type="button" title="复制密码" onClick={() => onCopy(credential.password, '密码')}>
            <Copy size={16} aria-hidden="true" />
          </button>
          {credential.twoFactorSecret && (
            <>
              <div>
                <span>2FA 密钥</span>
                <code>{credential.twoFactorSecret}</code>
              </div>
              <button
                className="icon-button"
                type="button"
                title="复制 2FA 密钥"
                onClick={() => onCopy(credential.twoFactorSecret, '2FA 密钥')}
              >
                <Copy size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
