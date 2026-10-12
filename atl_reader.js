// atl_reader.js —— The Atlantic 软墙解锁（同步，无网络请求）
//
// 关键结论：大西洋全文就在下发的 HTML 里，付费墙用 Piano/Tinypass 类脚本在加载后
// 把正文删除/遮挡（典型表现：刷新瞬间看到全文，随即变回截断页；Alook 阅读模式能读全文可证）。
// 既然全文是静态 HTML，本脚本直接【移除所有 <script>】（付费墙脚本无从运行），
// 再把懒加载图片（Lazysizes 的 data-src / data-srcset / data-lazy-src / <source> 等）还原成原生 src/srcset，并注入「强制显示全文」CSS。
// 全程不发任何网络请求，QX 的 script-response-body 必能稳定执行，且不会再闪烁。

var body = ($response && $response.body) ? $response.body : "";

// 1) 移除全部 <script>：
//    大西洋文章页是 hydration SPA —— 正文文本在 SSR 里就已完整下发，靠客户端 JS（大西洋
//    主 bundle）在加载后把正文 DOM 截断/替换成付费墙。把脚本全删，SSR 正文原样显示，文字即完整。
//    代价：正文插图是客户端 JS 注入的，删脚本后插图只剩灰色占位块（已知限制，见 README；
//    后续版本若能从页面内联 JSON 重建插图，可取消该限制）。
//    ※ 早期曾试“只删 Piano 保留其它脚本”，结果主 bundle 仍会把正文替换掉 → 整页看不到文章，故回退到删全部。
body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

// 2) 懒加载图片：Lazysizes 那套 data-* 属性还原成浏览器原生 src/srcset。
//    关键坑：<img> 自带一个占位 src="data:image/svg+xml,..."，若只在后面“追加”
//    一个 src，标签里会出现两个 src，浏览器只认第一个（占位小图）→ 显示灰色块。
//    所以必须【整标签处理】：把占位的 src/srcset 清掉，再用真实地址重建，绝不留重复属性。
body = body.replace(/<(img|source)\b([^>]*)>/gi, function (m, tag, attrs) {
  function get(name) {
    var r = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
    var mm = attrs.match(r);
    return mm ? (mm[2] !== undefined ? mm[2] : mm[3]) : null;
  }
  // 真实地址优先用 data-*，否则沿用标签里已有的真实 src/srcset
  var realSrc    = get('data-src') || get('data-lazy-src') || get('data-original') || get('data-original-src') || get('src');
  var realSrcset = get('data-srcset') || get('data-lazy-srcset') || get('data-original-srcset') || get('srcset');
  // 清除所有相关属性（占位 src/srcset 与各类 data-*），避免重复
  var out = attrs
    .replace(/\bsrc\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bsrcset\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-src\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-lazy-src\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-original(?:-src)?\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-srcset\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-lazy-srcset\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-original-srcset\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-sizes\s*=\s*("[^"]*"|'[^']*')/gi, '');
  if (realSrc)    out += ' src="' + realSrc + '"';
  if (realSrcset) out += ' srcset="' + realSrcset + '"';
  return '<' + tag + out + '>';
});

// 2b) 背景图懒加载：部分图用 <div data-src="..."> / data-bg 当背景图（不是 <img>），
//     同样还原成 style="background-image:url(真实地址)"，否则只剩灰色占位块。
body = body.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, function (m, tag, attrs) {
  if (/^(img|source|script|style)$/i.test(tag)) return m;
  function get(n) {
    var r = new RegExp('\\b' + n + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
    var mm = attrs.match(r);
    return mm ? (mm[2] !== undefined ? mm[2] : mm[3]) : null;
  }
  var bg = get('data-src') || get('data-bg') || get('data-original') || get('data-lazy-src');
  if (!bg) return m;
  var out = attrs
    .replace(/\bdata-src\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-bg\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-original\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\bdata-lazy-src\s*=\s*("[^"]*"|'[^']*')/gi, '');
  // 去掉已有 background-image（占位），再写入真实地址
  out = out.replace(/\bstyle\s*=\s*("|')([^"']*)\1/gi, function (s, q, val) {
    return 'style=' + q + val.replace(/background-image\s*:\s*[^;]*/gi, '') + q;
  });
  if (/\bstyle\s*=/i.test(out)) {
    out = out.replace(/\bstyle\s*=\s*("|')([^"']*)\1/i, function (s, q, val) {
      return 'style=' + q + val + 'background-image:url(' + bg + ');' + q;
    });
  } else {
    out += ' style="background-image:url(' + bg + ');"';
  }
  return '<' + tag + out + '>';
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
