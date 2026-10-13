// reader.js —— The New Yorker 软墙解锁（同步，无网络请求）
//
// 纽约客是「软墙 + 客户端水合」页面：正文全文靠 JS 水合渲染，付费墙是【覆盖式浮层 + 高度限制】
// （不是删除 DOM）。因此本脚本【绝不删除任何脚本】——删脚本会把水合一起干掉，正文只剩 SSR 首段
// （典型表现：墙没了，但文章只加载了一段）。正确做法：保留全部脚本（水合照常跑），只注入 CSS
// 隐藏付费墙浮层、解除高度/渐变限制，让水合后的完整正文显示出来。
//
// 全程不发任何网络请求，QX 的 script-response-body 必能稳定执行。

// [诊断] 脚本一旦真的执行，QX 会弹通知。用于确认规则/MITM 命中（看不到通知 = 没命中）。
try {
  $notify("纽约客解锁脚本已运行", "", "若正文仍只显示一段，说明水合被其它脚本截断，告知我即可加 meter 绕过");
} catch (e) {}

var body = ($response && $response.body) ? $response.body : "";

// 注入「强制显示全文」CSS：隐藏一切付费墙浮层/遮罩，解除正文高度/渐变限制。
// （保留全部原生脚本，水合照常进行，正文完整渲染后才被这些样式显形。）
var css =
  '<style id="qx-ny-unlock">' +
  // 隐藏付费墙浮层 / 计量门 / 订阅门
  '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
  '.paywall,.article-paywall,.meter-gate,.metered-gate,.subscription-gate,.reader-gate,' +
  '[data-testid="paywall"],[data-paywall],' +
  '[class*="metered"],[class*="Metered"],' +
  '[class*="piano"],[class*="Piano"],[class*="tinypass"]{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}' +
  // 解除正文高度/渐变限制，使其完整显示
  '[class*="article-body"],[class*="articleBody"],[class*="article-content"],[class*="story-body"],[class*="post-content"],' +
  '[data-testid="articleBody"],.article__body{display:block!important;max-height:none!important;height:auto!important;overflow:visible!important;' +
  '-webkit-mask-image:none!important;mask-image:none!important;opacity:1!important;filter:none!important' +
  '}' +
  '[class*="fade"],[class*="Fade"],[class*="blur"],[class*="Blur"]{opacity:1!important;filter:none!important;-webkit-mask-image:none!important;mask-image:none!important}' +
  'html,body{overflow:auto!important;height:auto!important;position:static!important}' +
  '</style>';

if (/<head[^>]*>/i.test(body)) {
  body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
} else if (/<html[^>]*>/i.test(body)) {
  body = body.replace(/<html[^>]*>/i, function (h) { return h + css; });
} else {
  body = css + body;
}

$done({ body: body });
