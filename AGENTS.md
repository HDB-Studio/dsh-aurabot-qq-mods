# AGENTS.md · 给下一个 agent 的交接说明

本文件只存在于 HDB 的 fork，用于交接「热敏打印」模块的维护工作，不随上游 PR 提交。

## 这个仓库是什么

- fork 自 [`aureth-labs/dsh-aurabot-qq-mods`](https://github.com/aureth-labs/dsh-aurabot-qq-mods)，是 Aurabot 的模块市场。
- 主要维护 `modules/receipt-print/`（热敏打印），其余模块跟随上游。
- 当前版本 **0.25.0**，当前 PR：[aureth-labs#362](https://github.com/aureth-labs/dsh-aurabot-qq-mods/pull/362)。
- 旧的 #354（0.10.x 的 PowerShell / 校准页 / CI 修复）已合并关闭。
- 维护分支：`feat/receipt-print-0.24`，从上游 `main` 拉出，只改 `modules/receipt-print/` 和 `modules/README.md` 里的 catalog 一行。

## 目录与架构

```text
modules/receipt-print/
  index.mjs          插件入口：命令、定时器、面板路由、VERSION
  panel.js           面板 UI
  module.json        模块元数据（version 必须与入口一致）
  package.json
  lib/
    escpos.mjs       ESC/POS 字节拼装（文字、行内图片、条码、二维码、走纸、切纸）
    selftest.mjs     自检页排版与自检二维码
    sysinfo.mjs      系统 / Windows 打印机 / 驱动 / 端口 / 存储信息
    calibrate.mjs    校准页与全黑测试条
    transport.mjs    windows / tcp / cups / preview 传输
    store.mjs        模板、打印记录、备份、预设补种
    templates.mjs    提示词、占位符、排版行
    qr.mjs           二维码来源与容量计算
    moments.mjs      说说解析与网址
    requests.mjs     消息打印意图、网页正文抽取
    image.mjs        图片缩放、调色、抖动、1bpp
  test/              node:test，共 193 项
```

## 版本纪律（最容易出错）

一次改动要同时改四处，否则 CI 打包会失败：

1. `modules/receipt-print/module.json` 的 `version`
2. `modules/receipt-print/package.json` 的 `version`
3. `modules/receipt-print/index.mjs` 的 `const VERSION`
4. `modules/README.md` 里「热敏打印」那一行的版本号

## 开发与验证

```bash
cd modules/receipt-print
npm ci                 # 首次或依赖变化时
node --test test/*.test.mjs

cd ../../..
node scripts/check.mjs # 仓库级检查
```

## 打包与发布

```bash
node scripts/pack.mjs --out /workspace/artifacts --only receipt-print
```

发布到 fork 的 GitHub Release：

- tag：`receipt-print-v<版本>`，例如 `receipt-print-v0.25.0`
- asset：`receipt-print-v<版本>.zip`
- 下载链接固定为：
  `https://github.com/HDB-Studio/dsh-aurabot-qq-mods/releases/download/receipt-print-v<版本>/receipt-print-v<版本>.zip`
- 上传后务必用 `curl -L -o /dev/null -w '%{http_code} %{size_download}'` 验证 200 和字节数。

## 分支与 PR 流程

1. 先 fetch 上游 `main`，从最新 `main` 拉干净分支，不要把旧分支直接 rebase（历史上 25 个提交会打架）。
2. 只把 `modules/receipt-print/` 的最终状态和 catalog 对应一行带到新分支。
3. 用 HDB 身份提交（作者和提交者都是 `HDB <chcctv2@outlook.com>`）。
4. 推到 fork，向上游 `main` 开 PR；上一个 PR 已合并就先确认状态，避免重复开。
5. 不要把 `node_modules`、临时脚本、token 提交进仓库。

## 注意事项

- 消息打印的意图先本地预筛（`looksLikePrintRequest`），再调用模型确认；模型不可用时退回 `parsePrintIntent` 的严格规则。不要为了省一次模型调用把「包含打印就出纸」改回来。
- 灵感便签提示词升级走 `replacePresetPrompt`，只替换仍是旧默认值的模板，用户改过的不动。
- Windows 传输用 PowerShell 调 `winspool.drv`，脚本正文必须保持纯 ASCII，中文只在 JS 侧映射；超时 30 秒；每次用唯一 PS1 文件名并在 `finally` 清理。
- 末尾统一：正文/图片/二维码之后空一行，再打一行按有效宽度铺满的 `=`，走纸 6 行再切纸。
- 自检页的打印头测试图必须用行内 `style: 'image'`，不要放进 `images` 数组，否则会跑到「自检完成」之后。
- 全黑测试条按纸宽打（58mm → 464 点），长度默认 100mm、封顶 120mm，避免打印头过热。
- 有效打印宽度以「设置」页为准；不要恢复成打印机配置优先。
- 二维码内容过长会自动缩模块或截断，自检二维码至少 4 点模块。
- 协议确认逻辑在 `lib/terms.mjs`；改条款前先读 README 的协议章节，版本升级应重新确认。
- 真机验证主要在 Windows 热敏打印机上做；Linux CI 只能覆盖命令构造和字节断言。

## 安全

- GitHub token 只放在本机临时凭据里，绝不写进仓库、日志或提交信息。
- 推送 fork 时用带 token 的临时 URL 或凭据助手，命令历史里不要留下明文 token。

## 下一步可以做

- 等 #362 审核合并；合并后把 fork `main` 同步到上游。
- 如果模型判断误杀明确命令，先看 `confirmPrintIntent` 的提示词和返回值解析。
- 如果用户反馈某台机器推纸仍偏短，把走纸行数做成设置项。
- 面板里可以补一个「黑条」按钮，目前只有命令入口。
- 黑条长度、打印浓度如果用户有更多需求，优先做成设置而不是硬编码。
