// atl_reader.js —— The Atlantic 软墙解锁（同步，无网络请求）
//
// 关键结论：大西洋全文就在下发的 HTML 里，付费墙用 Piano/Tinypass 类脚本在加载后
// 把正文删除/遮挡（典型表现：刷新瞬间看到全文，随即变回截断页；Alook 阅读模式能读全文可证）。
// 既然全文是静态 HTML，本脚本直接【移除所有 <script>】（付费墙脚本无从运行），
// 再把懒加载图片 data-src/data-lazy-src 转成 src，并注入「强制显示全文」CSS。
// 全程不发任何网络请求，QX 的 script-response-body 必能稳定执行，且不会再闪烁。

var body = ($response && $response.body) ? $response.body : "";

// 1) 移除全部 <script>（内联与外链都删）——付费墙脚本无法运行，正文得以保留
body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

// 2) 懒加载图片：data-src / data-lazy-src -> src（无 JS 时图才能显示）
body = body.replace(/(<img\b[^>]*?)\bdata-lazy-src\s*=\s*("([^"]*)"|'([^']*)')/gi,
  function (m, pre, _q, a, b) { return pre + ' src="' + (a || b) + '"'; });
body = body.replace(/(<img\b[^>]*?)\bdata-src\s*=\s*("([^"]*)"|'([^']*)')/gi,
  function (m, pre, _q, a, b) { return pre + ' src="' + (a || b) + '"'; });

// 3) 注入强制显示样式（隐藏一切付费墙浮层/遮罩，解除高度/渐变限制）
var css =
  '<style id="qx-atl-unlock">' +
  '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
  '.c-paywall,.article-paywall,[data-paywall],' +
  '[class*="piano"],[class*="Piano"],[class*="tinypass"]{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}' +
  '[class*="article-body"],[class*="articleBody"],[class*="article-content"]{' +
  'max-height:none!important;height:auto!important;overflow:visible!important;' +
  '-webkit-mask-image:none!important;mask-image:none!important;opacity:1!important;filter:none!important' +
  '}' +
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
