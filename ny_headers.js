// ny_headers.js —— 纽约客请求头伪装（request-header 阶段，同步，无网络请求）
//
// 【原理】纽约客是"计量式 + 服务端差异化下发"的付费墙：
//   出版社为了被搜索引擎收录Ranking，会给 Googlebot / Bingbot 返回【全文】，
//   而对普通浏览器 UA 只下发前 1~2 段 + 付费墙。
//   所以在请求发出前把 UA 换成 Googlebot，服务器就会把全文吐出来。
//
//   这一步在 request-header 阶段做的好处：
//   - 拿到的是【原版页面】（原站排版、配图、作者、译文都能用），不是抓取重构页；
//   - Safari 的「AA → 翻译成简体中文」照常可用；
//   - 不改变任何 HTML，不用担心 CSP 拦截、也不用猜它的 class 名。
//
// 【注意】必须配一条 script-request-header 规则才会生效（见 conf 文件）。

var headers = ($request && $request.headers) ? $request.headers : {};

// 1) 核心：伪装成 Googlebot（桌面版），并声明 Referer 来自 Google 搜索
//    —— Referer 常见于"首次点击免费(First Click Free)"策略
headers['User-Agent'] = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
headers['Referer'] = 'https://www.google.com/';

// 2) 顺带补齐语言头，避免拿到别的语种版本
headers['Accept-Language'] = 'en-US,en;q=0.9';

// 3) 清掉可能暴露"我是脚本/脚本内嵌浏览器"的头
try {
  delete headers['X-Requested-With'];
  delete headers['x-requested-with'];
  delete headers['X-Forwarded-For'];
  delete headers['x-forwarded-for'];
} catch (e) {}

// 说明：这里【故意不动 Cookie】。
//   - 你之前实测「清掉 Safari cookies 反而不能看」，说明当前可读状态依赖现有 cookie；
//   - 若某天真被计量墙拦住，可在下面两行前面去掉注释主动重置身份：
//   // delete headers['Cookie']; delete headers['cookie'];

$done({ headers: headers });
