# Quantumult X 解锁《纽约客》(The New Yorker) 全文

## 原理
《纽约客》用的是「计量 + 遮罩」式付费墙：免费额度用尽后，会在正文之上盖一层订阅遮罩，
但**正文本身仍保留在网页 HTML 里**。本脚本在 Quantumult X 的 MitM 阶段拦截文章页的 HTML 响应，
注入 CSS 把遮罩隐藏、解除正文高度截断，并清除本地计量计数，从而让你在 Safari 等浏览器里直接读全文。

## 文件
- `newyorker.js`：Quantumult X 响应改写脚本（核心）
- `quantumultx_newyorker.conf`：可直接合并进 QX 的配置片段

## 安装步骤（iOS）
1. **放入脚本**：打开 Quantumult X → 「脚本」→ 右上角「+」新建脚本，把 `newyorker.js` 内容
   完整粘贴进去并保存（记下你起的名字，默认 `newyorker.js`）。
   或放到 iCloud / 本地目录，后面用完整路径引用。
2. **合并配置**：把 `quantumultx_newyorker.conf` 里的 `[MITM]` 与 `[rewrite_local]` 两段
   合并进你的 QX 配置文件（长按配置文件 → 编辑）。注意 `newyorker.js` 要与第 1 步的名字一致。
3. **开启 HTTPS 解密（MitM）**：
   - QX → 设置 → 重写 / MitM 已按片段启用对应 hostname。
   - 安装并**信任** QX 的 CA 证书：iOS 设置 → 通用 → 关于本机 → 证书信任设置 → 开启 Quantumult X 证书。
4. **启用 QX（连接 VPN）**，用 Safari 打开任意一篇《纽约客》文章即可看到全文。

## 配置片段（合并进你的 QX .conf）
```
[MITM]
hostname = newyorker.com, www.newyorker.com

[rewrite_local]
^https?:\/\/(www\.)?newyorker\.com\/.* url script-response-body newyorker.js
```

## 一键写入（推荐做法）
Quantumult X 没有「把脚本塞进一个文件」的机制，规则(.conf) 和脚本(.js) 必须分开；
但只要把两个文件托管到 **HTTPS 可访问地址**，就能做到「一个链接、点一下」就全写进去。

1. **托管两个文件**（二选一即可，都要 https）：
   - 最省事：新建一个 GitHub 公开仓库（或 Gist），把 `newyorker.js` 和
     `quantumultx_newyorker.conf` 传上去，拿到 raw 直链
     （形如 `https://raw.githubusercontent.com/你的名/仓库/main/newyorker.js`）。
   - 已有公网 HTTPS 的 NAS（如飞牛 NAS 做了反代 + 证书）：把两个文件放进 Web 目录。
2. **改脚本地址**：打开 `quantumultx_newyorker.conf`，把最后一行
   `https://example.com/newyorker.js` 换成第 1 步拿到的 `newyorker.js` 真实地址，保存。
3. **拿到 conf 的直链**：即第 1 步里 `quantumultx_newyorker.conf` 的 raw 地址。
4. **拼一键链接**（在 iPhone 上点它即可写入）：
   ```
   quantumult-x:///setup-configuration?remote-url=<URL编码后的conf地址>
   ```
   - 把上面的 `<URL编码后的conf地址>` 替换为：把第 3 步的 conf 地址做 URL 编码后的结果
     （在线搜「URL encode」即可；只需编码 conf 地址本身，不要动前面的 `quantumult-x:///...`）。
   - 例：`https://raw.githubusercontent.com/foo/bar/main/ny.conf`
     → 编码后 `https%3A%2F%2Fraw.githubusercontent.com%2Ffoo%2Fbar%2Fmain%2Fny.conf`
     → 完整链接 `quantumult-x:///setup-configuration?remote-url=https%3A%2F%2Fraw.githubusercontent.com%2Ffoo%2Fbar%2Fmain%2Fny.conf`
5. 在 iPhone 的 Safari / 备忘录里点这个 `quantumult-x://` 链接 → QX 会弹出导入提示 →
   确认应用「重写 / MitM」→ 完成。之后 QX 会自动下载并缓存引用的 `newyorker.js`。

**保底手动法（不托管也能用）**：
- QX → 配置文件 → 远程配置 → + → 粘贴 conf 直链 → 下载 → 勾选「重写 / MitM」。
- 或：QX → 脚本 → + 手动粘贴 `newyorker.js`；再把上面「配置片段」里的 `[MITM]`+`[rewrite_local]`
  两段合并进你的 .conf（`newyorker.js` 要与脚本名一致）。

> 注：若 `quantumult-x:///setup-configuration?...` 在个别 QX 版本不自动唤起，直接用上面
> 「保底手动法」的「远程配置 → + → 粘贴 conf 直链」即可，效果相同。

## 说明与局限
- 仅对「遮罩式 / 计量式」付费墙有效。若某篇文章正文被服务端整体截断（硬墙），
  客户端改写无法恢复，可用 archive.today 等镜像方案作为补充。
- 选择器基于《纽约客》当前常见结构；若站点改版导致失效，按 `newyorker.js` 注释调整 CSS 选择器即可。
- 脚本只改你本机流量、只作用于 `newyorker.com` 的 HTML 文档，不影响其他站点。
- 这是个人阅读便利的技术 workaround；如常读且认可其内容，建议订阅以支持创作者。
