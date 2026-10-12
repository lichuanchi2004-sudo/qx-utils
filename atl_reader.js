// atl_reader.js —— The Atlantic 软墙解锁（同步，无网络请求）
//
// 原理：大西洋文章的全文其实就在下发的 HTML 里，付费墙脚本/遮罩在页面加载后才把
// 下半部分遮挡或截断（典型表现：刷新瞬间看到全文，随即变成截断页）。本脚本在 QX 响应
// 阶段做两件事：
//   1) 注入「强制显示全文」CSS（干掉遮罩渐变 / 最大高度限制 / 付费墙浮层）；
//   2) 移除含 paywall/metered 等关键词的付费墙脚本，避免它运行时再隐藏内容。
// 全程不发任何网络请求，QX 的 script-response-body 必能稳定执行。

var body = ($response && $response.body) ? $response.body : "";

// 1) 移除明显是付费墙逻辑的脚本（按关键词识别，只删这些，避免误伤页面其他脚本）
body = body.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, function (m, code) {
  if (/paywall|metered|truncat|articleBody|lede|gateway/i.test(code)) return '';
  return m;
});

// 2) 注入强制显示样式（用 * 子串选择器兜底大西洋可能的各类命名）
var css =
  '<style id="qx-atl-unlock">' +
  // 隐藏一切付费墙浮层/遮罩
  '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
  '.c-paywall,.article-paywall,[data-paywall]{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}' +
  // 正文容器：解除高度限制、遮罩、渐变
  '[class*="article-body"],[class*="articleBody"],[class*="article-content"]{' +
  'max-height:none!important;height:auto!important;overflow:visible!important;' +
  '-webkit-mask-image:none!important;mask-image:none!important;opacity:1!important;filter:none!important' +
  '}' +
  // 兜底：任何带 fade/blur 的遮挡层都强制显示
  '[class*="fade"],[class*="Fade"],[class*="blur"],[class*="Blur"]{opacity:1!important;filter:none!important;-webkit-mask-image:none!important;mask-image:none!important}' +
  '</style>';

if (/<head[^>]*>/i.test(body)) {
  body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
} else if (/<html[^>]*>/i.test(body)) {
  body = body.replace(/<html[^>]*>/i, function (h) { return h + css; });
} else {
  body = css + body;
}

$done({ body: body });
