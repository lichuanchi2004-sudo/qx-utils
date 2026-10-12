# Quantumult X 网页全文阅读辅助配置

## 原理
部分站点（以《纽约客》The New Yorker 为例）采用「计量 + 遮罩」式限制：免费额度用尽后会在正文之上盖一层提示，
但**正文本身仍保留在网页 HTML 里**。本脚本在 Quantumult X 的 MitM 阶段拦截文章页的 HTML 响应，
注入少量样式把遮罩隐藏、解除正文高度截断，并清除本地计量计数，从而让你在 Safari 等浏览器里直接显示完整正文。

## 文件
- `reader.js`：Quantumult X 响应改写脚本（核心）
- `profile.conf`：可合并进 QX 的配置片段（含 `[MITM]` 与 `[rewrite_local]`）
- `rewrite.conf`：纯重写规则资源（用于「重写规则资源」入口）

## 安装方式

### 方式一：订阅远程配置（推荐，零编辑、不覆盖现有配置）
QX → **配置文件** → 右上角 **＋** → **添加远程配置** → 粘贴地址 → 下载 → 启用：
```
https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/profile.conf
```
该链接已同时包含 `[MITM]` 主机名与重写规则，一次性写入，无需手动改配置。

### 方式二：重写规则资源（仅加规则，需另确保已解密目标域名）
QX → **重写** → **资源** → 右上角 **＋** → 资源路径粘贴：
```
https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/rewrite.conf
```
> 注意：「重写规则资源」只加规则、不带 `[MITM]` 主机名。若目标域名不在你 `[MITM]` 的
> `hostname` 列表里（或没有 `*`），需在主配置 `[MITM]` 段补一行：
> `hostname = newyorker.com, www.newyorker.com`，否则规则不会生效。

### 方式三：手动合并（适合已有配置、想完全可控）
把 `profile.conf` 里的两段合并进你的 QX 主配置：
- `[MITM]` 段的 `hostname =` 末尾追加 `, newyorker.com, www.newyorker.com`
- `[rewrite_local]` 段末尾加一行：
  ```
  ^https?:\/\/(www\.)?newyorker\.com\/.* url script-response-body https://raw.githubusercontent.com/lichuanchi2004-sudo/qx-utils/main/reader.js
  ```
脚本由 QX 自动拉取缓存，无需单独添加脚本文件。

## 通用要求
- **开启 MitM**（HTTPS 解密）总开关，并**信任 QX 的 CA 证书**：
  iOS 设置 → 通用 → 关于本机 → 证书信任设置 → 开启 Quantumult X 证书。
- 启用 QX（连接 VPN），用 Safari 打开目标文章即可显示全文。

## 说明与局限
- 仅对「遮罩式 / 计量式」限制有效。若某篇文章正文被服务端整体截断（硬限制），
  客户端改写无法恢复，可用 archive.today 等镜像方案作为补充。
- 选择器基于《纽约客》当前常见结构；若站点改版导致失效，按 `reader.js` 注释调整 CSS 选择器即可。
- 脚本只改你本机流量、只作用于 `newyorker.com` 的 HTML 文档，不影响其他站点。
- 这是个人阅读便利的技术辅助；如常读且认可其内容，建议订阅以支持创作者。
