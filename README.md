# Quantumult X 网页全文阅读辅助配置

## 原理
两站限制方式不同，打法也不同：

- **《纽约客》The New Yorker**：「计量 + 遮罩」式软墙，正文仍在 HTML 里。脚本在 MitM 阶段注入样式隐藏遮罩、解除截断。
- **The Atlantic**：「服务端截断」硬墙，正文后半段不在 HTML 里，客户端改写无解。故采用「全文代理」打法：在 QX 把文章请求**重定向到 r.jina.ai**（它会抓取并返回全文），再由一段同步脚本把返回的 markdown 全文转成可阅读 HTML。

> ⚠️ 早期曾用「重写脚本内 `$httpClient` 调 jina」方案，但因 QX 响应改写脚本是同步返回模型、不保证等待异步网络回调，在多数情况下失效，已弃用。现方案改用原生 URL 重定向，稳定。

## 文件
- `reader.js`：纽约客响应改写脚本
- `atl_md2html.js`：The Atlantic 专用——把 r.jina.ai 返回的全文转成阅读用 HTML（同步、无网络）
- `newyorker.conf` / `theatlantic.conf`：两站独立的「重写规则资源」文件
- `profile.conf`：合并版远程配置（含两站 MITM 与重写，一次性订阅）
- （`reader-atl.js` 已弃用）

## 安装

### 方式一：分站订阅「重写规则资源」（推荐，可独立开关）
- 纽约客：`重写 → 资源 → ＋ → 资源路径` 粘贴 `.../newyorker.conf`
- The Atlantic：`重写 → 资源 → ＋ → 资源路径` 粘贴 `.../theatlantic.conf`
> 「重写规则资源」只加规则、不带 `[MITM]` 主机名。**必须**在你主配置 `[MITM]` 段 `hostname` 加入：
> - 纽约客：`newyorker.com, www.newyorker.com`
> - **The Atlantic 关键：加 `r.jina.ai`**（大西洋请求被重定向到它，QX 需解密其 HTTPS）。`theatlantic.com` 加不加都行。

### 方式二：一次性订阅远程配置
`配置文件 → ＋ → 添加远程配置` 粘贴 `.../profile.conf` 并下载启用。该配置已内置 `r.jina.ai` 的 MITM 与两站规则，不覆盖现有配置。

### 方式三：手动合并
主配置 `[rewrite_local]` 加入对应规则，`[MITM]` 的 `hostname` 按上面补充。脚本由 QX 自动拉取缓存。

## 通用要求
- 开启 MitM 总开关，并在 iOS「设置 → 通用 → 关于本机 → 证书信任设置」信任 QX 的 CA 证书。
- 启用 QX，用 Safari 打开文章即可。

## 说明与局限
- 纽约客仅对软墙有效；站点改版时按 `reader.js` 注释调整选择器。
- The Atlantic 依赖第三方 r.jina.ai 公共服务：偶发抽风时，重定向仍会返回 jina 内容（可能以纯文本 markdown 显示，未转 HTML），刷新或稍后再试即可；jina 长期不可用时方案失效。
- 脚本/资源只作用于目标域名文章页，不影响其他站点。
- 这是个人阅读便利的技术辅助；如常读且认可其内容，建议订阅以支持创作者。
