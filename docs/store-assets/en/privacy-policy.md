# Local Vault Privacy Policy

Effective date: 2026-06-08

## Overview

Local Vault is an offline-first Chrome extension for storing account titles, websites, usernames, passwords, and 2FA secrets on the user's own device. The extension does not provide a cloud sync account, does not operate a backend service, does not upload vault data, and does not sell or share user data.

## Data Processed

The extension processes the following data locally on the user's device:

- Account records: title, website / URL, username, password, and 2FA Base32 secret.
- Master password: used locally to derive an encryption key; the master password is not written to persistent storage.
- Short session data: to reduce repeated master password entry, the extension may temporarily keep unlocked account plaintext and the master password in background service worker memory until the session expires, the user exits, or the browser reclaims the extension process.
- Import / export files: JSON, CSV, and encrypted backup files that the user explicitly selects or exports.
- Clipboard writes: when the user clicks a copy button, the extension writes the selected account, password, or verification code to the system clipboard.

## Storage

- The vault is encrypted with AES-GCM 256 using a key derived from the master password through PBKDF2-HMAC-SHA256.
- The encrypted vault is stored in `chrome.storage.local`.
- In the development/debug environment, when `chrome.storage.local` is unavailable, the extension falls back to browser `localStorage`.
- Encrypted backup files are exported only when the user chooses to export them, and the user is responsible for storing and managing those files.

## Data Transfer and Sharing

The extension does not send accounts, passwords, 2FA secrets, master passwords, or backup files to developer servers or third-party servers. The current extension does not include analytics SDKs, advertising SDKs, remote analytics, remote logging, or cloud sync.

The extension does not sell, rent, share, or transfer user data.

## Permission Usage

- `storage`: Saves the locally encrypted password vault.
- `clipboardWrite`: Writes an account, password, or verification code to the clipboard only when the user clicks a copy button.

## User Control

Users can:

- Add, edit, and delete account records.
- Sign out manually and clear the short session.
- Export encrypted backups.
- Export plaintext JSON after confirming the risk.
- Uninstall the extension from the browser extensions page; Chrome will clean up extension local storage according to browser rules.

## Security Notes

If the master password is lost, the developer cannot recover the encrypted vault. Plaintext export files contain sensitive information and should be saved only on trusted devices, then cleaned up after use.

## Chrome Web Store Limited Use

The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy or security feedback, use GitHub Issues:

`https://github.com/1264585648/local-vault-chrome-extension/issues`
