# Quantumult X 网页全文阅读辅助配置

## 原理
两站采用的限制方式不同，脚本打法也不同：

- **《纽约客》The New Yorker**：「计量 + 遮罩」式。免费额度用尽后只盖一层提示，但**正文仍保留在网页 HTML 里**。脚本在 MitM 阶段拦截 HTML，注入样式隐藏遮罩、解除高度截断，并清除本地计量计数。
- **The Atlantic**：「服务端截断」硬墙。免费读者只能拿到前几段，正文后半部分**根本不在网页 HTML 里**，客户端改写无法恢复。因此脚本在 QX 侧用 `$httpClient` 调用 r.jina.ai 全文代理抓取完整正文，再替换进页面返回——属于「全文代理」打法，依赖第三方公共服务。

## 文件
- `reader.js`：纽约客（The New Yorker）响应改写脚本（核心）
- `reader-atl.js`：The Atlantic 响应改写脚本（核心）
- `newyorker.conf`：纽约客纯重写规则资源（用于「重写规则资源」入口，独立）
- `theatlantic.conf`：The Atlantic 纯重写规则资源（用于「重写规则资源」入口，独立）
- `profile.conf`：合并版远程配置（含两站 `[MITM]` 与 `[rewrite_local]`，一次性订阅）
- `rewrite.conf`：旧版合并重写资源（两站合一，保留兼容；新用户建议改用上面两个分站文件）

## 安装方式

### 方式一：分站订阅「重写规则资源」（推荐，可独立开关）
每个站点一个独立资源，互不干扰，可单独关闭某一站。
- 纽约客：QX → **重写** → **资源** → 右上角 **＋** → 资源路径粘贴：
  ```
  https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/newyorker.conf
  ```
- The Atlantic：同理粘贴：
  ```
  https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/theatlantic.conf
  ```
> 注意：「重写规则资源」只加规则、不带 `[MITM]` 主机名。需确保目标域名已加入你主配置 `[MITM]` 的 `hostname`：
> 纽约客 `newyorker.com, www.newyorker.com`；大西洋 `theatlantic.com, www.theatlantic.com`。否则规则不会生效。

### 方式二：一次性订阅远程配置（图省事）
QX → **配置文件** → 右上角 **＋** → **添加远程配置** → 粘贴地址 → 下载 → 启用：
```
https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/profile.conf
```
该链接已同时包含两站 `[MITM]` 主机名与重写规则，一次性写入，不覆盖现有配置。

### 方式三：手动合并（适合已有配置、想完全可控）
把对应站的规则行加入主配置 `[rewrite_local]`，并在 `[MITM]` 段的 `hostname` 补上域名：
- 纽约客：
  ```
  ^https?:\/\/(www\.)?newyorker\.com\/.* url script-response-body https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/reader.js
  ```
- The Atlantic：
  ```
  ^https?:\/\/(www\.)?theatlantic\.com\/.* url script-response-body https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/reader-atl.js
  ```
脚本由 QX 自动拉取缓存，无需单独添加脚本文件。

## 通用要求
- **开启 MitM**（HTTPS 解密）总开关，并**信任 QX 的 CA 证书**：
  iOS 设置 → 通用 → 关于本机 → 证书信任设置 → 开启 Quantumult X 证书。
- 启用 QX（连接 VPN），用 Safari 打开目标文章即可显示全文。

## 说明与局限
- 《纽约客》仅对「遮罩式 / 计量式」限制有效（站点改版时按 `reader.js` 注释调整 CSS 选择器）。
- The Atlantic 因是服务端截断硬墙，本方案通过 r.jina.ai 全文代理恢复正文，**依赖第三方公共服务**：偶发抽风或不支持某篇文章时，脚本会原样返回前几段（不会白屏）。如 jina 长期不可用，可替换脚本里的代理地址。
- 脚本只改你本机流量、只作用于目标域名文章页的 HTML 文档，不影响其他站点。
- 脚本只改你本机流量、只作用于目标域名的 HTML 文档，不影响其他站点。
- 这是个人阅读便利的技术辅助；如常读且认可其内容，建议订阅以支持创作者。
