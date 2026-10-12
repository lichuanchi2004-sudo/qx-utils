// atl_reader.js —— The Atlantic 软墙解锁（同步，无网络请求）
//
// 关键结论：大西洋全文就在下发的 HTML 里，付费墙用 Piano/Tinypass 类脚本在加载后
// 把正文删除/遮挡（典型表现：刷新瞬间看到全文，随即变回截断页；Alook 阅读模式能读全文可证）。
// 既然全文是静态 HTML，本脚本直接【移除所有 <script>】（付费墙脚本无从运行），
// 再把懒加载图片（Lazysizes 的 data-src / data-srcset / data-lazy-src / <source> 等）还原成原生 src/srcset，并注入「强制显示全文」CSS。
// 全程不发任何网络请求，QX 的 script-response-body 必能稳定执行，且不会再闪烁。

var body = ($response && $response.body) ? $response.body : "";

// 1) 移除全部 <script>（内联与外链都删）——付费墙脚本无法运行，正文得以保留
body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

// 2) 懒加载图片：Lazysizes 那套 data-* 属性全部还原成浏览器原生 src/srcset
//    否则无 JS 时浏览器只看到占位小图，正文配图全空。
//    覆盖范围：<img> 与 <picture> 内的 <source>；data-src / data-srcset /
//    data-lazy-src / data-lazy-srcset / data-original / data-original-srcset。
var LAZY_MAP = [
  ['data-src',          'src'],
  ['data-lazy-src',     'src'],
  ['data-original',     'src'],
  ['data-original-src', 'src'],
  ['data-srcset',          'srcset'],
  ['data-lazy-srcset',     'srcset'],
  ['data-original-srcset', 'srcset']
];
LAZY_MAP.forEach(function (pair) {
  var from = pair[0], to = pair[1];
  // 匹配 <img ...> 或 <source ...> 中出现的 from="..."（双/单引号）
  var re = new RegExp('(<(?:img|source)\\b[^>]*?)\\b' + from + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'gi');
  body = body.replace(re, function (m, pre, _q, a, b) {
    var val = (a !== undefined) ? a : b;
    return pre + ' ' + to + '="' + val + '"';
  });
});
// 顺手把 Lazysizes 的 data-sizes="auto"（非合法值）清掉，避免干扰 srcset 选择
body = body.replace(/(<(?:img|source)\b[^>]*?)\bdata-sizes\s*=\s*("auto"|'auto')/gi, '$1');

// 3) 兜底：把 <noscript> 里的图片解包出来（部分图只放在 noscript 回退里）
body = body.replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, function (m, inner) {
  // 仅当内部有 <img>/<source> 时才保留，否则原样丢弃，避免无谓的脚本残留
  return /<(?:img|source)\b/i.test(inner) ? inner : '';
});

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
