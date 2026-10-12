# Quantumult X 网页全文阅读辅助配置

两站限制方式不同，打法也不同：

- **《纽约客》The New Yorker**：「计量 + 遮罩」式软墙，正文仍在 HTML 里。`reader.js` 在 MitM 阶段注入样式隐藏遮罩、解除截断。**纽约客一直稳定可用**，无需改动。
- **The Atlantic**：「服务端截断」硬墙，正文后半段不在 HTML 里，客户端改写无解。采用「全文代理」打法：QX 用原生 `url 302` 把文章页请求重定向到 `r.jina.ai` 抓全文，再叠加一条【纯同步】脚本 `atl_md2html.js` 把 jina 返回的 markdown 转成排版 HTML。**全程不依赖脚本内异步网络**（部分 QX 版本在 `script-response-body` 里不等异步回调，故刻意规避）。已实测 r.jina.ai 对大西洋文章返回 1300+ 词全文，解析脚本对得上。

## 文件
- `reader.js`：纽约客响应改写脚本（已稳定，不用动）
- `atl_md2html.js`：The Atlantic 专用——把 r.jina.ai 返回的 markdown 同步转成阅读用 HTML（无网络请求）
- `theatlantic.conf`：大西洋独立配置，**自带 `[MITM]` 段**，可作「配置文件」订阅一条搞定
- `newyorker.conf`：纽约客独立重写资源
- `profile.conf`：合并版（含两站 MITM + 重写），不方便拆开时用

## The Atlantic 为什么一直不生效（重点）

> **根因：之前是用「重写规则资源」入口加的 `theatlantic.conf`。那个入口只读 `[rewrite_local]`，不读 `[MITM]`。** 于是 `theatlantic.com` 和 `r.jina.ai` 从没进 MITM 列表。
> HTTPS 下 QX 不解密就看不到 URL 路径，302 重定向规则永不触发，浏览器直接打到真实大西洋服务器 → 仍是那几百词的截断页。

**解决办法：把 `theatlantic.conf` 当作「配置文件」类型订阅**（文件已自带 `[MITM]` 段），MITM 主机名会自动并入，一条链接搞定，不用手动改主配置。

## The Atlantic 安装（推荐：一条链接）

1. 在 iPhone 上点这个链接（或复制后用 QX 打开）：

   ```
   quantumult-x:///add-resource?remote-url=https%3A%2F%2Fraw.githubusercontent.com%2Flichuanchi2004-sudo%2Fqx-utils%2Fmain%2Ftheatlantic.conf
   ```

2. 弹出的「添加资源」里，**资源类型务必选「配置文件」**（不要选「重写规则」！选错就又回到 MITM 没加的老问题）。
3. 保存后，进 QX「MitM」确认 `hostname` 里出现了 `theatlantic.com, www.theatlantic.com, r.jina.ai`。
4. Safari 打开任意大西洋文章 → 地址栏会短暂显示 `r.jina.ai/...`（302 重定向正常），随后呈现 jina 全文经排版后的页面。

### 不想用链接 / 链接方式不灵时的手动法
- 「重写 → 资源 → ＋ → 资源路径」粘贴 `theatlantic.conf` 的 raw 链接；**同时**在你主配置 `[MITM]` 的 `hostname` 手动补：`theatlantic.com, www.theatlantic.com, r.jina.ai`。
- 或者直接编辑主配置：把 `theatlantic.conf` 里 `[MITM]` 和 `[rewrite_local]` 两段内容合并进主配置对应段落。

## 通用要求
- 开启 MitM 总开关，并在 iOS「设置 → 通用 → 关于本机 → 证书信任设置」信任 QX 的 CA 证书（纽约客能正常用说明这步已完成）。
- 启用 QX，用 Safari 打开文章即可。

## 说明与局限
- The Atlantic 依赖第三方 r.jina.ai 公共服务：偶发抽风时可能显示 jina 错误页，刷新或稍后再试；jina 长期不可用时方案失效。
- 大西洋文章地址栏会显示 `r.jina.ai/...` 前缀（重定向所致），内容仍是原文全文，属正常现象。
- 脚本/资源只作用于目标域名文章页，不影响其他站点。
- 这是个人阅读便利的技术辅助；如常读且认可其内容，建议订阅以支持创作者。
