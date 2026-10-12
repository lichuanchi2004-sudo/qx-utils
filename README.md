# Quantumult X 网页全文阅读辅助配置

两站都是「软墙」（正文其实就在下发的 HTML 里，付费墙脚本/遮罩在加载后才遮挡或截断），打法一致：MitM 解密后用一条【同步】`script-response-body` 注入样式/移除脚本，**全程不发任何网络请求**，QX 必能稳定执行。

- **《纽约客》The New Yorker**：`reader.js` 注入样式隐藏遮罩、解除截断（一直稳定）。
- **The Atlantic**：`atl_reader.js` 注入「强制显示全文」CSS 并移除付费墙脚本/遮罩。早期曾试过 `r.jina.ai` 代理，但实测该公共服务不稳定（时而只回 200+ 词），已弃用；且你手机上「刷新先长后截断」的现象本身就证明大西洋是软墙（全文在 HTML 里），直接用脚本解锁最稳。

## 文件
- `reader.js`：纽约客响应改写脚本（已稳定）
- `atl_reader.js`：The Atlantic 软墙解锁（注入 CSS + 移除付费墙脚本，无网络请求）
- `theatlantic.conf`：大西洋独立配置，自带 `[MITM]` 段，可作「配置文件」订阅一条搞定
- `newyorker.conf`：纽约客独立重写资源
- `profile.conf`：合并版（含两站 MITM + 重写），不方便拆开时用

## The Atlantic 安装（推荐：一条链接）

1. 在 iPhone 上点这个链接（或复制后用 QX 打开）：

   ```
   quantumult-x:///add-resource?remote-url=https%3A%2F%2Fraw.githubusercontent.com%2Flichuanchi2004-sudo%2Fqx-utils%2Fmain%2Ftheatlantic.conf
   ```

2. 弹出的「添加资源」里，**资源类型务必选「配置文件」**（不要选「重写规则」！选错就又回到 MITM 没加的老问题）。
3. 保存后，进 QX「MitM」确认 `hostname` 里出现了 `theatlantic.com, www.theatlantic.com`。
4. 若你之前加过旧的 `theatlantic.conf`（带 r.jina.ai 302 的那版），请在 QX 里把那个旧资源删掉/更新，避免两条规则打架。
5. Safari 打开任意大西洋文章 → 不再有「先长后截断」，直接显示全文。

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
