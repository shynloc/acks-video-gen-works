# ACKS 官网宣传片 · 45 秒 · 9:16

为 [acks.com.cn](https://acks.com.cn/)（ACKS 爱驰科驶）制作的竖屏宣传片，以及可以完整复现它的渲染工程。

## 成片

| 文件 | 说明 |
|---|---|
| [`output/ACKS-promo-45s-9x16.mp4`](output/ACKS-promo-45s-9x16.mp4) | 1080 × 1920 · 30 fps · 45.00 秒 · H.264 High + AAC；原创配乐，-14 LUFS |
| [`output/ACKS-promo-45s-9x16-silent.mp4`](output/ACKS-promo-45s-9x16-silent.mp4) | 同一画面的无声版，用于在抖音 / 视频号 / 小红书里选用平台音乐 |
| [`output/ACKS-promo-cover.png`](output/ACKS-promo-cover.png) | 封面图（开场标题帧） |

分镜、文案出处、配音稿与发布建议见 [`docs/storyboard.md`](docs/storyboard.md)。

**七个场景**：驾驭 AI 的开场 → 从一个具体问题长成可用的系统 → 概念视觉 · 工作系统 → ACKS 能力索引（AI Agent / Creative / Knowledge / Service）→ 红银斜切翻转到汽车科技（Automotive / Custom / Kinetic / Sport）→ 工作方法 → 行动号召与官方组合标落版。

## 内容与品牌合规

- 文案全部来自官网源码 `acks-website-platform` 的页面默认文案，不新增数字、客户、案例或资质表述。
- 配色、字体角色、Logo 用法、动效缓动遵循 `ACKS-Design-System-Official` 与官网 VI 指南：Logo 只做整体显现，不拆模块、不做逐字动画；落版使用已批准的横向组合标。
- 两张图片是官网媒体登记中的概念视觉（SHA-256 与登记一致），画面上按要求标注“概念视觉 · 工作系统 / 概念视觉 · 项目方法”。登记里的当前用途为自有网站和社交分享预览，用于宣传片属于新增用途，建议在 `docs/02-content/MEDIA-ASSET-REGISTER.md` 中补登。
- 配乐和音效由 `scripts/music.py` 从零合成，没有第三方音乐或采样。

## 重新渲染

需要 Node.js 22+、Python 3.11+ 和 Chromium（Playwright）。

```bash
npm install                      # 字体（@fontsource，OFL）与 Playwright
npx playwright install chromium  # 本机没有 Playwright 浏览器时
pip install -r requirements.txt  # Pillow / NumPy / SciPy / imageio-ffmpeg（自带 ffmpeg）
bash scripts/build.sh            # 约 4 分钟：素材 → 音效提示点 → 配乐 → 1350 帧 → MP4
```

预览单帧（输出到 `output/preview/`）：

```bash
node scripts/render.mjs --stills 3.2,12,24,44
```

## 工程结构

```text
src/index.html        舞台结构（1080 × 1920，七个场景）
src/style.css         品牌色主题、版式与安全区
src/main.js           时间轴：所有画面属性都是时间 t 的纯函数；文案与时间常量集中在文件顶部
src/assets/source/    官网概念视觉原图（未修改）
scripts/prepare_assets.py  放大概念图、生成纸张颗粒纹理
scripts/render.mjs    本地静态服务 + Playwright 并行逐帧截图；--cues 导出音效提示点
scripts/music.py      96 BPM 原创配乐与音效合成
scripts/build.sh      一键构建与两遍响度标准化、H.264 编码
docs/storyboard.md    分镜脚本
```

改文案或时间：编辑 `src/main.js` 顶部的常量，重新运行 `bash scripts/build.sh`，音效会跟随新的时间轴自动对位。
