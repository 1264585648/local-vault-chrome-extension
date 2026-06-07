import React, { useState, useEffect, useRef } from 'react';
import { Shield, Plus, Trash2, Copy, LogOut, Unlock, Search, Clock, Download, Upload, AlertCircle, FileJson, Globe, KeyRound, Edit2, Wand2, Eye, EyeOff } from 'lucide-react';

// ==========================================
// 1. 本地加密与解密工具 (Web Crypto API)
// ==========================================

// 将字符串转为 ArrayBuffer
const enc = new TextEncoder();
const dec = new TextDecoder();

// 辅助函数：ArrayBuffer 与 Base64 互转
function buf2b64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function b642buf(b64) {
  const str = atob(b64);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf.buffer;
}

// 派生密钥：使用 PBKDF2 从主密码生成 AES 密钥
async function deriveKey(password, saltBuffer) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// 加密数据
async function encryptData(data, password, saltStr) {
  const saltBuffer = saltStr ? b642buf(saltStr) : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, saltBuffer);
  
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(data))
  );

  return {
    salt: buf2b64(saltBuffer),
    iv: buf2b64(iv),
    data: buf2b64(encryptedContent)
  };
}

// 解密数据
async function decryptData(encryptedObj, password) {
  const saltBuffer = b642buf(encryptedObj.salt);
  const ivBuffer = b642buf(encryptedObj.iv);
  const dataBuffer = b642buf(encryptedObj.data);
  const key = await deriveKey(password, saltBuffer);

  const decryptedContent = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer }, key, dataBuffer
  );
  return JSON.parse(dec.decode(decryptedContent));
}

// ==========================================
// 2. TOTP 生成工具
// ==========================================
const generateTOTP = async (secret) => {
  try {
    if (!secret) return "";
    const cleanSecret = secret.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    
    for (let i = 0; i < cleanSecret.length; i++) {
      let val = base32chars.indexOf(cleanSecret.charAt(i));
      if (val === -1) throw new Error("包含无效字符");
      bits += val.toString(2).padStart(5, '0');
    }
    
    let hex = '';
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      hex += parseInt(bits.substr(i, 8), 2).toString(16).padStart(2, '0');
    }
    
    const keyBytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      keyBytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }

    let epoch = Math.floor(Date.now() / 1000);
    let time = Math.floor(epoch / 30);
    const timeBytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      timeBytes[i] = time % 256;
      time = Math.floor(time / 256);
    }

    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBytes);
    const hmac = new Uint8Array(signature);
    
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);

    return (binary % 1000000).toString().padStart(6, '0');
  } catch (err) {
    return "无效密钥";
  }
};

// ==========================================
// 常见网站列表 (用于输入自动补全)
// ==========================================
const COMMON_WEBSITES = [
  "google.com", "github.com", "apple.com", "microsoft.com",
  "amazon.com", "facebook.com", "x.com", "linkedin.com",
  "netflix.com", "paypal.com", "dropbox.com", "reddit.com",
  "discord.com", "slack.com", "steamcommunity.com", "epicgames.com",
  "bilibili.com", "taobao.com", "jd.com", "baidu.com", "weibo.com", "zhihu.com"
];

// ==========================================
// 3. 主应用组件
// ==========================================
export default function PasswordManagerApp() {
  // 状态：0: 检查中, 1: 需初始化, 2: 需解锁, 3: 已解锁 (进入主库)
  const [appState, setAppState] = useState(0); 
  const [masterPassword, setMasterPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // 核心数据
  const [credentials, setCredentials] = useState([]);
  
  // 界面交互状态
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null); // 新增：用于跟踪正在编辑的账号ID
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ website: '', username: '', password: '', twoFactorSecret: '' });
  const [totpError, setTotpError] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false); // 新增：控制表单密码可见性

  // 隐藏的上传 input 引用
  const fileInputRef = useRef(null);

  // 初始化检查
  useEffect(() => {
    const savedVault = localStorage.getItem('local_secure_vault');
    if (savedVault) {
      setAppState(2); // 存在库，需解锁
    } else {
      setAppState(1); // 无库，需创建
    }
  }, []);

  // --- 认证与加解密方法 ---
  const handleCreateVault = async (e) => {
    e.preventDefault();
    if (masterPassword.length < 6) {
      setAuthError('主密码至少需要 6 个字符');
      return;
    }
    try {
      const encryptedObj = await encryptData([], masterPassword, null);
      localStorage.setItem('local_secure_vault', JSON.stringify(encryptedObj));
      setCredentials([]);
      setAppState(3);
    } catch (err) {
      setAuthError('创建密码库失败');
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const savedVault = JSON.parse(localStorage.getItem('local_secure_vault'));
      const data = await decryptData(savedVault, masterPassword);
      // 简单排序
      data.sort((a, b) => a.website.localeCompare(b.website));
      setCredentials(data);
      setAppState(3);
    } catch (err) {
      setAuthError('密码错误或数据已损坏');
    }
  };

  const lockVault = () => {
    setCredentials([]);
    setMasterPassword('');
    setAppState(2);
  };

  // 保存数据到 LocalStorage（触发加密）
  const saveToStorage = async (dataList) => {
    try {
      const savedVault = JSON.parse(localStorage.getItem('local_secure_vault'));
      const encryptedObj = await encryptData(dataList, masterPassword, savedVault.salt);
      localStorage.setItem('local_secure_vault', JSON.stringify(encryptedObj));
      
      const sorted = [...dataList].sort((a, b) => a.website.localeCompare(b.website));
      setCredentials(sorted);
    } catch (err) {
      console.error('保存失败', err);
      alert('保存数据失败！');
    }
  };

  // --- 业务操作 ---
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.website || totpError) return;

    let newData;
    if (editingId) {
      // 编辑模式
      newData = credentials.map(c => c.id === editingId ? {
        ...c,
        website: formData.website,
        username: formData.username,
        password: formData.password,
        twoFactorSecret: formData.twoFactorSecret || ''
      } : c);
    } else {
      // 新增模式
      const newCred = {
        id: crypto.randomUUID(),
        website: formData.website,
        username: formData.username,
        password: formData.password,
        twoFactorSecret: formData.twoFactorSecret || '',
        createdAt: new Date().toISOString()
      };
      newData = [...credentials, newCred];
    }

    await saveToStorage(newData);
    resetForm();
  };

  // 重置并关闭表单
  const resetForm = () => {
    setFormData({ website: '', username: '', password: '', twoFactorSecret: '' });
    setTotpError('');
    setEditingId(null);
    setIsAdding(false);
    setShowFormPassword(false);
  };

  // 打开编辑模式
  const openEdit = (cred) => {
    setFormData({
      website: cred.website,
      username: cred.username,
      password: cred.password,
      twoFactorSecret: cred.twoFactorSecret
    });
    setEditingId(cred.id);
    setTotpError('');
    setIsAdding(true);
    setShowFormPassword(false);
  };

  // 强密码生成器
  const handleGeneratePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let password = "";
    // 使用 Web Crypto API 生成高强度的随机数序列
    const array = new Uint32Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      password += chars[array[i] % chars.length];
    }
    setFormData(prev => ({ ...prev, password }));
    setShowFormPassword(true); // 生成后自动显示明文供用户确认
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除该账号吗？')) {
      const newData = credentials.filter(c => c.id !== id);
      await saveToStorage(newData);
    }
  };

  // 校验 TOTP 格式
  const handleTotpChange = (e) => {
    const val = e.target.value;
    setFormData({ ...formData, twoFactorSecret: val });
    if (val) {
      const cleanSecret = val.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
      if (!/^[A-Z2-7]+$/.test(cleanSecret)) {
        setTotpError('包含无效字符 (Base32 不能有 0, 1, 8, 9 等)');
      } else {
        setTotpError('');
      }
    } else {
      setTotpError('');
    }
  };

  // --- 导入与导出 ---
  const handleExport = () => {
    // 按照固定格式导出 JSON
    const exportData = credentials.map(c => ({
      website: c.website,
      username: c.username,
      password: c.password,
      twoFactorSecret: c.twoFactorSecret
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        let importedList = [];

        // 尝试解析为 JSON
        if (file.name.endsWith('.json')) {
          importedList = JSON.parse(text);
        } 
        // 尝试解析为简单的 CSV (Website, Username, Password, 2FA)
        else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n');
          for (let i = 1; i < lines.length; i++) { // 跳过表头
            if (!lines[i].trim()) continue;
            const cols = lines[i].split(',').map(s => s.trim());
            importedList.push({
              website: cols[0] || 'Unknown',
              username: cols[1] || '',
              password: cols[2] || '',
              twoFactorSecret: cols[3] || ''
            });
          }
        } else {
          alert("不支持的文件格式，仅支持 .json 或 .csv");
          return;
        }

        // 数据清洗与合并
        const validatedList = importedList.map(item => ({
          id: crypto.randomUUID(),
          website: item.website || item.url || item.name || 'Unnamed',
          username: item.username || item.login || item.email || '',
          password: item.password || item.pass || '',
          twoFactorSecret: item.twoFactorSecret || item.totp || item.secret || '',
          createdAt: new Date().toISOString()
        }));

        const mergedData = [...credentials, ...validatedList];
        await saveToStorage(mergedData);
        alert(`成功导入 ${validatedList.length} 条记录！`);
      } catch (err) {
        alert("导入失败：文件格式解析错误");
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // 重置 input
  };

  // --- 视图渲染 ---
  if (appState === 0) return <div className="min-h-screen bg-slate-50 flex justify-center items-center"><div className="animate-pulse text-indigo-600 font-medium">加载中...</div></div>;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col" style={{ height: '700px' }}>
        
        {/* Header */}
        <header className="bg-indigo-600 px-5 py-4 flex items-center justify-between shrink-0 shadow-sm relative z-20">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg text-white">本地密码库</h1>
          </div>
          {appState === 3 && (
            <button onClick={lockVault} className="flex items-center gap-1.5 text-sm text-indigo-100 hover:text-white transition-colors bg-indigo-700/50 hover:bg-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-500/30">
              <LogOut className="w-4 h-4" /> 退出登陆
            </button>
          )}
        </header>

        {/* Auth Screens */}
        {(appState === 1 || appState === 2) && (
          <div className="flex-1 flex flex-col justify-center px-10 bg-slate-50">
            <div className="text-center mb-8 max-w-sm mx-auto">
              <div className="inline-flex bg-indigo-100 p-4 rounded-full mb-4 shadow-sm border border-indigo-50">
                <KeyRound className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {appState === 1 ? '设置主密码' : '解锁密码库'}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                {appState === 1 
                  ? '您的数据将完全在本地进行军工级加密，不会上传云端。请务必牢记此密码，遗失将无法找回数据。' 
                  : '请输入您的主密码以解密并查看本地数据。'}
              </p>
            </div>
            <form onSubmit={appState === 1 ? handleCreateVault : handleUnlock} className="space-y-4 max-w-sm mx-auto w-full">
              <input
                type="password"
                placeholder="请输入主密码"
                required
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-sm"
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
              />
              {authError && <p className="text-red-500 text-sm text-center font-medium">{authError}</p>}
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                <Unlock className="w-5 h-5" />
                {appState === 1 ? '加密并创建本地密码库' : '解密并进入'}
              </button>
            </form>
          </div>
        )}

        {/* Vault Screen (紧凑且美观的列表模式) */}
        {appState === 3 && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            
            {/* 工具栏 */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm relative z-10">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="搜索网站或账号..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 transition-shadow"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 ml-4">
                <input type="file" ref={fileInputRef} className="hidden" accept=".json,.csv" onChange={handleImport} />
                <button onClick={triggerImport} className="text-slate-500 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors" title="导入 (.json, .csv)">
                  <Upload className="w-5 h-5" />
                </button>
                <button onClick={handleExport} className="text-slate-500 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors" title="导出备份 (.json)">
                  <Download className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <button onClick={() => { resetForm(); setIsAdding(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors">
                  <Plus className="w-4 h-4" /> 添加账号
                </button>
              </div>
            </div>

            {/* 添加/编辑账号弹窗/面板 */}
            {isAdding && (
              <div className="bg-slate-50 border-b border-slate-200 p-5 shrink-0 shadow-inner relative z-0">
                <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
                  {editingId ? <Edit2 className="w-4 h-4 text-indigo-600"/> : <Plus className="w-4 h-4 text-indigo-600"/>}
                  {editingId ? '编辑本地记录' : '新增本地记录'}
                </h3>
                <form onSubmit={handleAddSubmit} className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">网站名称 / URL *</label>
                    <input type="text" required list="common-websites" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-800 shadow-sm" placeholder="例如: github.com" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
                    <datalist id="common-websites">
                      {COMMON_WEBSITES.map(site => (
                        <option key={site} value={site} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">账号 (可选)</label>
                    <input type="text" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-800 shadow-sm" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">密码 (隐藏存储)</label>
                    <div className="flex items-center gap-2">
                      <input type={showFormPassword ? "text" : "password"} className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-800 shadow-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                      <button type="button" onClick={() => setShowFormPassword(!showFormPassword)} className="p-2 bg-white border border-slate-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-md transition-colors shadow-sm" title={showFormPassword ? "隐藏密码" : "显示密码"}>
                        {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button type="button" onClick={handleGeneratePassword} className="p-2 bg-white border border-slate-300 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 hover:border-indigo-200 rounded-md transition-colors shadow-sm" title="生成随机强密码">
                        <Wand2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">2FA Base32 密钥 (可选)</label>
                    <input type="text" className={`w-full px-3 py-2 bg-white border rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 ${totpError ? 'border-red-300 focus:ring-red-500/50 focus:border-red-500' : 'border-slate-300 focus:ring-indigo-500/50 focus:border-indigo-500'} text-slate-800`} placeholder="无空格纯字母数字" value={formData.twoFactorSecret} onChange={handleTotpChange} />
                    {totpError && <p className="text-red-500 text-xs mt-1 font-medium">{totpError}</p>}
                  </div>
                  <div className="col-span-2 flex gap-2 justify-end mt-3">
                    <button type="button" onClick={resetForm} className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium transition-colors shadow-sm">取消</button>
                    <button type="submit" disabled={!!totpError} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white font-medium disabled:opacity-50 transition-colors shadow-sm">保存记录</button>
                  </div>
                </form>
              </div>
            )}

            {/* 列表区域 */}
            <main className="flex-1 overflow-y-auto bg-slate-50/50 p-3">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {credentials.filter(c => c.website.toLowerCase().includes(searchTerm.toLowerCase()) || c.username.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                   <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                     <FileJson className="w-12 h-12 mb-3 text-slate-300" />
                     <p className="font-medium text-slate-500">未找到任何记录</p>
                     <p className="text-sm mt-1">您可以手动添加，或点击右上角导入备份文件。</p>
                   </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {credentials
                      .filter(c => c.website.toLowerCase().includes(searchTerm.toLowerCase()) || c.username.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(cred => (
                        <CompactRow key={cred.id} data={cred} onEdit={() => openEdit(cred)} onDelete={() => handleDelete(cred.id)} />
                      ))}
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. 紧凑型列表行组件 (隐藏密码文本)
// ==========================================
function CompactRow({ data, onEdit, onDelete }) {
  const [totpCode, setTotpCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [showDetails, setShowDetails] = useState(false); // 新增：控制是否展开显示明文明细
  const [imgError, setImgError] = useState(false); // 新增：控制图标加载失败时的回退状态

  // 提取域名用于获取 favicon
  const getDomain = (url) => {
    if (!url) return '';
    // 移除 http://, https:// 以及可能的 www. 前缀，并截取到第一个 /
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
  };

  const domain = getDomain(data.website);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // 实时 2FA
  useEffect(() => {
    if (!data.twoFactorSecret) return;
    let lastTimeSlot = 0;
    
    const updateTotp = async () => {
      const epoch = Math.floor(Date.now() / 1000);
      setTimeLeft(30 - (epoch % 30));
      const currentSlot = Math.floor(epoch / 30);
      if (currentSlot !== lastTimeSlot) {
        lastTimeSlot = currentSlot;
        const code = await generateTOTP(data.twoFactorSecret);
        setTotpCode(code);
      }
    };
    updateTotp();
    const interval = setInterval(updateTotp, 1000);
    return () => clearInterval(interval);
  }, [data.twoFactorSecret]);

  const copyText = (text, type) => {
    if(!text) return;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  return (
    <div className="group flex flex-col border-b border-slate-50 last:border-0 hover:bg-indigo-50/30 transition-colors">
      <div className="flex items-center justify-between p-4 w-full">
        
        {/* 左侧：网站图标与账号信息 */}
        <div className="flex-1 flex items-center gap-3 min-w-0 pr-4">
          <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center shrink-0 bg-white">
            {imgError ? (
              <Globe className="w-5 h-5 text-indigo-400" />
            ) : (
              <img 
                src={faviconUrl} 
                alt={`${domain} icon`} 
                className="w-6 h-6 object-contain"
                onError={() => setImgError(true)}
              />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-800 truncate">{data.website}</span>
            <div className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
              {data.username ? data.username : <span className="italic opacity-60">未填写账号</span>}
              {data.username && (
                <button onClick={() => copyText(data.username, '账号')} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity" title="复制账号">
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 中间：2FA 验证码 (胶囊样式) */}
        <div className="w-40 shrink-0 flex items-center justify-end px-4">
          {data.twoFactorSecret ? (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
              <span 
                onClick={() => copyText(totpCode, '验证码')} 
                className="font-mono text-sm font-bold tracking-widest text-indigo-700 cursor-pointer hover:text-indigo-900 select-none"
                title="点击复制验证码"
              >
                {totpCode || '------'}
              </span>
              <div className={`w-4 text-right text-[10px] font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-indigo-400'}`}>
                {timeLeft}s
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-300 font-medium px-3">- - -</span>
          )}
        </div>

        {/* 右侧：操作按钮 (密码始终隐藏，直接复制) */}
        <div className="flex items-center justify-end gap-1 w-auto shrink-0 pl-2">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className={`p-2 rounded-lg transition-all ${showDetails ? 'text-indigo-600 bg-indigo-50 opacity-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100'}`}
            title={showDetails ? "隐藏明文" : "查看明文"}
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => copyText(data.password, '密码')}
            disabled={!data.password}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title={data.password ? "点击复制密码" : "未填写密码"}
          >
            <Copy className="w-4 h-4" />
          </button>
          <button 
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            title="编辑该记录"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={onDelete}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            title="删除该记录"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 展开的明文详情面板 */}
      {showDetails && (
        <div className="px-14 pb-4 pt-0">
          <div className="bg-white border border-indigo-100 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">密码明文</span>
                <p className="font-mono text-sm text-slate-800 mt-1 select-all">{data.password || <span className="italic text-slate-400">未填写</span>}</p>
              </div>
              <button onClick={() => copyText(data.password, '密码')} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors" title="复制密码"><Copy className="w-4 h-4"/></button>
            </div>
            {data.twoFactorSecret && (
              <>
                <div className="h-px w-full bg-slate-100 my-0"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">2FA 密钥 (Base32)</span>
                    <p className="font-mono text-sm text-slate-800 mt-1 select-all">{data.twoFactorSecret}</p>
                  </div>
                  <button onClick={() => copyText(data.twoFactorSecret, '密钥')} className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors" title="复制密钥"><Copy className="w-4 h-4"/></button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
}
