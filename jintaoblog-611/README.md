# 别再做 AI Slop 了 · 竖版讲解视频

把博客文章 [《别再做 AI Slop 了》](https://jintaoblog.com/posts/611.html)（~/jintaoblog/朝夕见闻志，2026-09-02）做成 9:16 竖版讲解视频：旁白 + 字幕 + 动态图文，约 7 分 42 秒，覆盖原文全部章节。

## 成片

| 文件 | 说明 |
|---|---|
| `output/jintaoblog-611-ai-slop-9x16.mp4` | 1080 × 1920 · 30 fps · 7:42 · H.264 High + AAC，82 MB；中文旁白 + 字幕 + 背景音乐，-14 LUFS |
| `output/jintaoblog-611-ai-slop-9x16-novoice.mp4` | 同一画面，只有字幕和音乐（不想用 AI 配音时用） |
| `output/jintaoblog-611-ai-slop.srt` | 字幕文件，可导入剪映等工具重新配音或调整 |
| `output/jintaoblog-611-ai-slop-cover.png` | 封面帧（文章卡片） |

## 结构（与原文一致）

| 时间 | 章节 | 内容 |
|---|---|---|
| 0:00 | 引子 | AI 能生成代码，但生成不了品味；现场“拼”出一个 AI Slop 页面并盖章；AI 只能输出“平均值”（画面是 9 个首页逐像素求平均） |
| 1:01 | 什么是设计系统 | 原则 → 视觉规范 → 组件与代码；盖房子的比喻；统计平均 vs 经过验证的最优解；Paul Rand 引言 |
| 2:07 | 9 个设计系统 | Apple HIG、Material Design 3、Fluent 2、Spectrum、Atlassian、Carbon、IBM Design Language、Mozilla Protocol、Google Design：每个配原文截图 + 一个说明其特点的“标本” |
| 5:37 | 九系统速览 | 原文对照表 |
| 5:51 | 行动指南 | 四步：选 1–2 个系统 / 把原则写进 Prompt（原文 M3 提示词）/ 用组件库约束 / 审美反馈循环 |
| 7:14 | 结语 | 画笔与老师；从今天开始读一个设计原则页面 |

## 设计规范

文章讲的是“先有设计标准，再让工具去做”，所以视频直接使用博客自己的 **Scrapboard 主题设计令牌**（`wp-content/themes/scrapboard/style.css`，软木板剪贴本风格）：

- 颜色：软木板 `#d6cbbd`、纸张 `#f9f6f0`、墨色 `#1a1a1a` / `#524f46`、印章红 `#cc3333`、Dymo 标签 `#222`、终端 `#0d1117` / `#39ff14`、青色 `#397c78`
- 组件：纸片卡（`--shadow-paper`、交替旋转）、和纸胶带、Dymo 标签、橡皮章、主题的 fractalNoise 纸张 / 软木纹理
- 字体：Inter + Noto Sans SC（主题正文）、Courier Prime（主题等宽体）、霞鹜文楷（对应主题的楷体批注）、Noto Serif SC（引言）、Fira Code（终端）；中文弯引号单独走 Noto Sans SC，避免被 Inter 渲染成半角
- 动效：纸片“钉上”有轻微过冲，印章落下一次回弹，缓动取主题的 `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- 刻意避开文中列举的 AI Slop 特征：画面里唯一的渐变、圆角堆叠、紫蓝配色和 emoji 都出现在那个被盖章的反面示例里

## 旁白与声音

- 旁白：开源模型 [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)（Apache-2.0），音色 `zm_010`，语速 1.15，CPU 合成。
- 质检：每句用 faster-whisper 回测；据此修正了“2026 年”的读法（带空格会读成“两千零二十六年”）、“两到六十四列”、产品版本号的英文读法，并把“墙厚薄不均”改为“墙厚薄不一”以免被听成歧义词。
- 画面时间轴由旁白驱动：`timeline.json` 记录每一句的起止，画面元素在对应词语念出时出现。
- 字幕：`scripts/check_subs.mjs` 在渲染前逐条量字幕宽度，超出字幕条就中止构建；在 `content.json` 的句子里加 `|` 可以强制断开字幕（不念出来，也不影响已缓存的配音）。
- 配乐：`scripts/music.py` 合成的原创 lo-fi（84 BPM，C 大调），按章节编配、讲话时自动闪避；印章、换页、终端打字配有轻量音效。没有第三方音乐或采样。

## 重新构建

```bash
npm install                                   # 仓库根目录：字体、emoji 图片、Playwright
pip install -r requirements.txt               # 仓库根目录：Pillow / NumPy / SciPy / imageio-ffmpeg
bash jintaoblog-611/scripts/build.sh          # 复用已有旁白，4 核 CPU 约 45 分钟
```

逐帧 PNG 每张约 2.4 MB（纸张颗粒几乎压不动），整片存下来要约 33 GB。所以构建按一分钟一段「渲染 → 编码 → 删帧」循环，磁盘上同时只有一段帧（约 4.3 GB），最后把各段直接拼接、不再重编码；两个版本共用同一条视频流，只换音轨。

重新配音需要单独的 Python 环境（见 `requirements-tts.txt`），然后 `bash jintaoblog-611/scripts/build.sh --tts`。修改旁白文字：编辑 `content.json`；修改画面：`src/main.js`（每个场景一个构建函数 + 一个渲染函数）。

## 素材与许可

- 9 张官网截图、文章内容：来自原文（作者 ShyNloc）；截图为各设计系统官网首页，按原文用于评论与介绍。
- 字体：全部为 OFL（经 npm `@fontsource` 获取）；emoji 图片：Google Noto Emoji（Apache-2.0，经 npm `emoji-datasource-google` 获取）。
- 旁白模型 Kokoro-82M-v1.1-zh：Apache-2.0。
