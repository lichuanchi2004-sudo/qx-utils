# Quantumult X 网页全文阅读辅助配置

两站打法一致：MitM 解密后用一条【同步】`script-response-body` 移除页面脚本 + 注入 CSS，**全程不发任何网络请求**，QX 必能稳定执行。

- **《纽约客》The New Yorker**（2026-10-14 重新定案）：`reader.js` 移除页面全部 `<script>` + 只隐藏付费墙外壳。
  **真实机制（已实测复现）**：服务端下发的 HTML **本来就是全文**（响应头 `payment: free`，正文段落带 `class="paywall"` 只是标记，页面里根本没有任何 `.paywall` 的 CSS 规则）；真正的隐藏是**客户端 JS 水合后**读取内嵌状态 `"paywall":{"paragraphLimit":1}`，把正文容器 `.body__inner-container` **整个清空**换成硬付费墙（offer 名里写着 `...MOBILE_PAYWALL_IN_CONTENT_BARRIER_FILLED_0_HARD_GATE_INTL_...`，即对海外 IP 的硬墙）。无头 Chrome 渲染线上真实页面可复现：水合后 `<p class="paywall">` 由 8 个变 0 个，容器变空。
  ⇒ 所以「只注入 CSS 掀遮罩」注定无效——内容是被 JS **删掉**了，不是被挡住。
  ⚠️ 上一版脚本自己还捅了一刀：CSS 里写了 `[class*="paywall"]{display:none!important}`，而正文段落本身就叫 `class="paywall"` ⇒ 把全文都藏了、只剩第一段。这就是「删脚本反而只剩一段」的真正原因，**现已彻底移除该条**。
- **The Atlantic**：`atl_reader.js` 移除页面**全部 `<script>`**——大西洋文章页是 hydration SPA，截断正文的是它自己的主 JS bundle（不是 Piano），删掉脚本后服务端下发的完整正文原样显示。再注入 CSS 隐藏付费墙浮层、把 SSR 里写死的懒加载图还原成真实 `src`。**已知限制**：正文插图由客户端 JS 动态注入，删脚本后这部分图只剩灰色占位块（首图/封面等 SSR 写死的图正常）。早期试过 `r.jina.ai` 代理、「只删 Piano 保留其它脚本」均失败。

## 文件
- `reader.js`：纽约客响应改写脚本（**当前版本**：删页面脚本 + 精准隐藏付费墙外壳；见文件顶部实测依据）
- `atl_reader.js`：The Atlantic 软墙解锁（移除全部脚本以保证文字完整 + 注入 CSS 隐藏付费墙 + 还原 SSR 图片；正文插图因客户端 JS 注入而呈灰块为已知限制）
- `theatlantic.conf`：大西洋独立配置，自带 `[MITM]` 段，可作「配置文件」订阅一条搞定
- `rewrite_newyorker.conf`：**纽约客重写规则（只需要这一条）**
- `ny_headers.js`：已废弃，现为**空操作**（若你 QX 里还挂着旧规则引用它，不会出错，但建议删掉那条规则）
- `profile.conf` / `newyorker.conf`：旧合并配置，已过时，建议删除避免与 `rewrite_newyorker.conf` 打架

## 纽约客安装（一条重写规则）

在 QX「重写 → 资源 → ＋」，资源类型选**「重写规则」**，粘贴 raw 链接：

```
https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/rewrite_newyorker.conf
```

然后在你主配置的 `[MITM]` → `hostname` 里填：

```
newyorker.com, www.newyorker.com
```

⚠️ 不要写 `*.newyorker.com`——会把 `media.newyorker.com`（图片 CDN）也拉进解密，配图会变慢。
⚠️ 如果你的 QX 里还有旧的「两条规则」版本（含 `ny_headers.js`），把第 ① 条删掉，只留这一条。

Safari 打开任意纽约客文章 → 全文直接显示，可正常「AA → 翻译成简体中文」。

### 本地验证方法（脚本自带诊断）
脚本跑起来会弹通知：「纽约客解锁 / 正文段落: N」。N 就是服务端下发的正文段落数（例如 121、51、9）。看到 N ≥ 10 基本就是全文；若只弹 1~2，说明页面当时没下发全文，换个时间再试。

## The Atlantic 安装（推荐：一条链接）

1. 在 iPhone 上点这个链接（或复制后用 QX 打开）：

   ```
   quantumult-x:///add-resource?remote-url=https%3A%2F%2Fraw.githubusercontent.com%2Flichuanchi2004-sudo%2Fqx-utils%2Fmain%2Ftheatlantic.conf
   ```

2. 弹出的「添加资源」里，**资源类型务必选「配置文件」**（不要选「重写规则」！选错就又回到 MITM 没加的老问题）。
3. 保存后，进 QX「MitM」确认 `hostname` 里出现了 `*.theatlantic.com`（已包含 `theatlantic.com` 与 `www.theatlantic.com` 及其图片 CDN 子域）。
4. 若你之前加过旧的 `theatlantic.conf`（带 r.jina.ai 302 的那版），请在 QX 里把那个旧资源删掉/更新，避免两条规则打架。
5. Safari 打开任意大西洋文章 → 不再有「先长后截断」，直接显示全文。

### 关于「插图灰色块」（已知限制）
大西洋的正文配图分为两类：
- **首图 / 封面图**：服务端直出、写死真实 `src`，本脚本能正常还原显示。
- **正文内插图**：由客户端 JS 在加载后动态注入 DOM，本脚本删掉全部 JS 后这些图无法注入，会显示为灰色占位块。

这是「删全部脚本保文字」方案的天然代价。若要插图也显示，两条路：
1. **临时**：Safari 地址栏左侧「AA → 显示阅读器视图」可看全文（含插图），只是没有翻译按钮。
2. **彻底**：若你能在 Mac 的 Safari「开发」菜单（或 iPhone 任意「查看网页源代码」方式）导出该文章的完整 HTML 源码发我，我可解析其中的内联文章 JSON，自己重建插图 `<img>`，做到文字+插图+翻译三全。

> 注：因大西洋被 Cloudflare 防护，我这边（沙箱）无法抓取真实 HTML，故插图自动重建需依赖你提供的源码样本。

### 不想用链接 / 链接方式不灵时的手动法
- 「重写 → 资源 → ＋ → 资源路径」粘贴 `theatlantic.conf` 的 raw 链接；**同时**在你主配置 `[MITM]` 的 `hostname` 手动补：`theatlantic.com, www.theatlantic.com`。
- 或者直接编辑主配置：把 `theatlantic.conf` 里 `[MITM]` 和 `[rewrite_local]` 两段内容合并进主配置对应段落。

## 通用要求
- 开启 MitM 总开关，并在 iOS「设置 → 通用 → 关于本机 → 证书信任设置」信任 QX 的 CA 证书（纽约客能正常用说明这步已完成）。
- 启用 QX，用 Safari 打开文章即可。

## 说明与局限
- 两站脚本只对软墙有效；若站点改版导致类名变化，按脚本注释里的选择器调整即可。
- 脚本/资源只作用于目标域名文章页，不影响其他站点。
- 这是个人阅读便利的技术辅助；如常读且认可其内容，建议订阅以支持创作者。
