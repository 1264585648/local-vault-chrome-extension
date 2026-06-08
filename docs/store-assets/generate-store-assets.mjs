import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '../..');
const screenshotsDir = path.join(scriptDir, 'screenshots');
const promoDir = path.join(scriptDir, 'promo');
const tempDir = path.join(os.tmpdir(), `local-vault-store-assets-${Date.now()}`);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function fileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, '/').replace(/ /g, '%20')}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char];
  });
}

function screenshotHtml({ title, body, points, image, badge }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        width: 1280px;
        height: 800px;
        margin: 0;
        overflow: hidden;
        color: #172033;
        font-family: "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
        background: #eef3f8;
      }
      .stage {
        position: relative;
        width: 1280px;
        height: 800px;
        padding: 70px 82px;
        background: linear-gradient(135deg, #f7faff 0%, #edf3fa 52%, #e8f5f2 100%);
      }
      .stage::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 18% 20%, rgba(49, 84, 200, 0.12), transparent 26%),
          radial-gradient(circle at 86% 82%, rgba(15, 118, 110, 0.16), transparent 26%);
      }
      .content {
        position: relative;
        display: grid;
        grid-template-columns: 560px 430px;
        gap: 84px;
        align-items: center;
        height: 100%;
      }
      .kicker {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 22px;
        padding: 8px 12px;
        color: #233a7a;
        border: 1px solid #cbd8f5;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.72);
        font-size: 18px;
        font-weight: 900;
      }
      h1 {
        margin: 0 0 24px;
        color: #102044;
        font-size: 58px;
        line-height: 1.08;
      }
      .body {
        width: 515px;
        margin: 0 0 32px;
        color: #526071;
        font-size: 24px;
        font-weight: 600;
        line-height: 1.55;
      }
      .points {
        display: grid;
        gap: 16px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .points li {
        display: flex;
        align-items: center;
        gap: 14px;
        color: #263346;
        font-size: 21px;
        font-weight: 800;
      }
      .points li::before {
        content: "";
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #0f766e;
        box-shadow: 0 0 0 6px rgba(15, 118, 110, 0.12);
      }
      .phone {
        width: 430px;
        height: 640px;
        overflow: hidden;
        border-radius: 28px;
        background: #ffffff;
        box-shadow:
          0 34px 90px rgba(29, 45, 98, 0.24),
          0 0 0 1px rgba(35, 58, 122, 0.08);
      }
      .phone img {
        display: block;
        width: 430px;
        height: 640px;
        object-fit: cover;
      }
      .brand {
        position: absolute;
        left: 82px;
        bottom: 46px;
        color: #6b7688;
        font-size: 18px;
        font-weight: 900;
      }
      .brand b { color: #233a7a; }
    </style>
  </head>
  <body>
    <main class="stage">
      <div class="content">
        <section>
          <div class="kicker">${escapeHtml(badge)}</div>
          <h1>${escapeHtml(title)}</h1>
          <p class="body">${escapeHtml(body)}</p>
          <ul class="points">${points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
        </section>
        <section class="phone">
          <img src="${fileUrl(image)}" alt="${escapeHtml(title)}" />
        </section>
      </div>
      <div class="brand"><b>本地密码库</b> · 不上传、不同步、不建账号</div>
    </main>
  </body>
</html>`;
}

function promoHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        width: 440px;
        height: 280px;
        margin: 0;
        overflow: hidden;
        color: #ffffff;
        font-family: "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
        background: #233a7a;
      }
      .promo {
        position: relative;
        width: 440px;
        height: 280px;
        padding: 32px;
        background: linear-gradient(135deg, #1d2d62, #3154c8);
      }
      .promo::before {
        content: "";
        position: absolute;
        right: -45px;
        bottom: -75px;
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background: rgba(15, 118, 110, 0.32);
      }
      .icon {
        display: grid;
        width: 58px;
        height: 58px;
        place-items: center;
        border: 1px solid rgba(255, 255, 255, 0.32);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.14);
      }
      .title {
        position: relative;
        margin: 22px 0 10px;
        font-size: 34px;
        font-weight: 900;
        line-height: 1.1;
      }
      .body {
        position: relative;
        width: 295px;
        margin: 0;
        color: rgba(255, 255, 255, 0.82);
        font-size: 17px;
        font-weight: 800;
        line-height: 1.5;
      }
      .pill {
        position: absolute;
        right: 28px;
        top: 34px;
        padding: 8px 12px;
        color: #233a7a;
        border-radius: 999px;
        background: #ffffff;
        font-size: 14px;
        font-weight: 900;
      }
      .lines {
        position: absolute;
        right: 30px;
        bottom: 34px;
        display: grid;
        gap: 8px;
      }
      .lines span {
        display: block;
        width: 112px;
        height: 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.32);
      }
      .lines span:nth-child(2) { width: 84px; }
      .lines span:nth-child(3) {
        width: 126px;
        background: rgba(255, 255, 255, 0.46);
      }
    </style>
  </head>
  <body>
    <div class="promo">
      <div class="icon" aria-hidden="true">
        <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.1">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
      </div>
      <div class="pill">MV3</div>
      <h1 class="title">本地密码库</h1>
      <p class="body">离线优先、本机加密、网页分组</p>
      <div class="lines"><span></span><span></span><span></span></div>
    </div>
  </body>
</html>`;
}

async function render({ html, output, width, height }) {
  const htmlPath = path.join(tempDir, `${path.basename(output, '.png')}.html`);
  await writeFile(htmlPath, html, 'utf8');
  execFileSync(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      `--screenshot=${output}`,
      fileUrl(htmlPath)
    ],
    { stdio: 'ignore' }
  );
}

const screenshotItems = [
  {
    file: '01-local-vault-overview-1280x800.png',
    source: 'docs/images/01-create-or-unlock-password-library.png',
    title: '一分钟创建本地密码库',
    body: '用主密码派生加密密钥，数据只保存在本机 Chrome 扩展存储中。',
    points: ['主密码不写入持久化存储', '支持本次弹窗或短时会话', '丢失主密码后无法恢复，风险前置提示']
  },
  {
    file: '02-grouped-accounts-1280x800.png',
    source: 'docs/images/02-password-library-list.png',
    title: '网页分组，多账号更好找',
    body: '网页 / URL 只在分组头展示，账号行聚焦标题、账号和 2FA。',
    points: ['账号标题限制 20 字以内', '支持搜索标题、账号或网页', '同一网站可管理工作和个人账号']
  },
  {
    file: '03-add-account-title-1280x800.png',
    source: 'docs/images/03-add-credential.png',
    title: '新增账号时先写标题',
    body: '标题用来区分账号用途，例如工作 GitHub、个人 GitHub、家庭扣款。',
    points: ['网页自动成为分组', '密码和 2FA 密钥默认隐藏', '可一键生成强密码']
  },
  {
    file: '04-copy-password-1280x800.png',
    source: 'docs/images/04-copy-password-toast.png',
    title: '一键复制密码或 2FA',
    body: '常用操作都在紧凑行内，复制完会出现明确提示。',
    points: ['复制账号、密码和验证码', 'TOTP 倒计时就在账号行', '明文和密钥需主动查看']
  }
];

await mkdir(screenshotsDir, { recursive: true });
await mkdir(promoDir, { recursive: true });
await mkdir(tempDir, { recursive: true });

try {
  for (const item of screenshotItems) {
    await render({
      width: 1280,
      height: 800,
      output: path.join(screenshotsDir, item.file),
      html: screenshotHtml({
        title: item.title,
        body: item.body,
        points: item.points,
        image: path.join(projectRoot, item.source),
        badge: '离线优先的 Chrome 密码库'
      })
    });
  }

  await render({
    width: 440,
    height: 280,
    output: path.join(promoDir, 'small-promo-440x280.png'),
    html: promoHtml()
  });
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
