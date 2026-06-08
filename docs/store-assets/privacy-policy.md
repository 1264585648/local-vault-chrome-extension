# 本地密码库隐私政策

生效日期：2026-06-08

## 概述

本地密码库是一款离线优先的 Chrome 扩展，用于在用户本机保存账号标题、网页、账号名、密码和 2FA 密钥。扩展不提供云同步账号，不运营后端服务，不上传密码库数据，不出售或共享用户数据。

## 处理的数据

扩展会在用户本机处理以下数据：

- 账号记录：标题、网页 / URL、账号名、密码、2FA Base32 密钥。
- 主密码：用于在本机派生加密密钥；主密码不会写入持久化存储。
- 短时会话数据：为了支持短时间免重复输入主密码，扩展会在 background service worker 的内存中临时保留解锁后的账号明文和主密码，直到到期、用户退出或扩展进程被浏览器回收。
- 导入 / 导出文件：用户主动选择导入或导出的 JSON、CSV、加密备份文件。
- 剪贴板内容：用户点击复制账号、密码或验证码时，扩展会把对应文本写入系统剪贴板。

## 存储方式

- 密码库使用主密码通过 PBKDF2-HMAC-SHA256 派生 AES-GCM 256 位密钥后加密。
- 加密后的密码库保存在 `chrome.storage.local`。
- 开发调试环境中，当 `chrome.storage.local` 不可用时，扩展会回退到浏览器 `localStorage`。
- 加密备份文件由用户主动导出，并由用户自行保存和管理。

## 数据传输与共享

扩展不会把账号、密码、2FA 密钥、主密码或备份文件发送到开发者服务器或第三方服务器。扩展当前不包含统计 SDK、广告 SDK、远程分析、远程日志或云同步功能。

扩展不会出售、出租、共享或转让用户数据。

## 权限用途

- `storage`：保存本机加密后的密码库。
- `clipboardWrite`：在用户点击复制按钮时，把账号、密码或验证码写入剪贴板。

## 用户控制

用户可以：

- 新增、编辑、删除账号记录。
- 手动退出登录并清除短时会话。
- 导出加密备份。
- 在确认风险后导出明文 JSON。
- 在浏览器扩展管理页面卸载扩展；卸载后 Chrome 会按浏览器规则清理扩展本地存储。

## 安全注意事项

主密码丢失后，开发者无法帮助恢复加密密码库。明文导出文件包含敏感信息，用户应只保存在可信设备，并在使用后妥善清理。

## Chrome Web Store Limited Use

The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## 联系方式

如需反馈隐私或安全问题，请通过 GitHub 仓库 Issues 联系：

`https://github.com/1264585648/local-vault-chrome-extension/issues`
