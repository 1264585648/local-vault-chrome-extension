# Chrome Web Store 发布素材清单

本目录用于存放 Chrome Web Store 上架前需要上传或填写的材料。

## 已补齐

- 发布包：`release/local-vault-chrome-extension-0.1.0.zip`
  - `manifest.json` 位于 ZIP 根目录。
  - `index.html`、`background.js`、`assets/`、`icons/` 同样位于 ZIP 根目录或一级资源目录。
- 图标：`public/icons/icon128.png`
  - 尺寸：`128x128`。
- 高清截图：`docs/store-assets/screenshots/`
  - `01-local-vault-overview-1280x800.png`
  - `02-grouped-accounts-1280x800.png`
  - `03-add-account-title-1280x800.png`
  - `04-copy-password-1280x800.png`
  - 尺寸均为 `1280x800`。
- 小型宣传图：`docs/store-assets/promo/small-promo-440x280.png`
  - 尺寸：`440x280`。
- 商店文案：`docs/store-assets/chrome-web-store-listing.md`
- 隐私政策：`docs/store-assets/privacy-policy.md`

## 商店后台建议填写

- 隐私政策链接：
  - 如果 GitHub 仓库公开，可填：
    `https://github.com/1264585648/local-vault-chrome-extension/blob/main/docs/store-assets/privacy-policy.md`
  - 如果仓库是私有的，需要把 `privacy-policy.md` 发布到一个公开可访问页面，再填写公开 URL。
- 详细描述、权限说明、审核说明：
  - 复制 `chrome-web-store-listing.md` 中对应段落。

## 官方尺寸口径

- Chrome Web Store 图片要求参考：
  `https://developer.chrome.com/docs/webstore/images`
- Chrome Web Store 隐私政策要求参考：
  `https://developer.chrome.com/docs/webstore/program-policies/privacy`
