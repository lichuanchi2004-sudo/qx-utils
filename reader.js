// reader.js —— The New Yorker 软墙解锁（同步，无网络请求）
//
// 复用已验证可行的大西洋打法：
//   1) 移除全部 <script>（付费墙脚本无从运行，SSR 全文原样显示）
//   2) 还原懒加载图片（data-src / data-srcset / data-lazy-src / <source> 等 → 原生 src/srcset）
//   3) 注入「强制显示全文」CSS（隐藏一切付费墙浮层/遮罩，解除高度/渐变限制）
// 全程不发任何网络请求，QX 的 script-response-body 必能稳定执行。
//
// 验证说明：用户在 iPhone Safari + QX 下已确认同款打法对 The Atlantic 生效；
// 纽约客同为“全文在 SSR 里、客户端脚本做墙”的结构，故直接套用。

// [诊断] 脚本一旦真的执行，QX 会弹通知。用于区分两种失败：
//   - 看不到此通知  → 规则/MITM 没命中（订阅方式或域名问题）
//   - 看到通知仍带墙 → 脚本内容问题（把现象告知我即可微调选择器）
try {
  $notify("纽约客解锁脚本已运行", "", "若页面仍带墙，说明脚本已生效但需微调样式");
} catch (e) {}

var body = ($response && $response.body) ? $response.body : "";

// 1) 移除全部 <script>：付费墙脚本无法运行，SSR 里的完整正文原样显示。
body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

// 2) 懒加载图片：把 data-* 还原成浏览器原生 src/srcset。
//    关键坑：<img> 自带占位 src="data:image/..."，须整标签重建，绝不留重复属性（否则变灰块）。
body = body.replace(/<(img|source)\b([^>]*)>/gi, function (m, tag, attrs) {
  function get(name) {
    var r = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
    var mm = attrs.match(r);
    return mm ? (mm[2] !== undefined ? mm[2] : mm[3]) : null;
  }
  var realSrc    = get('data-src') || get('data-lazy-src') || get('data-original') || get('data-original-src') || get('src');
  var realSrcset = get('data-srcset') || get('data-lazy-srcset') || get('data-original-srcset') || get('srcset');
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

// 2b) 背景图懒加载：部分图用 <div data-src="..."> / data-bg 当背景图（不是 <img>）。
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
  '<style id="qx-ny-unlock">' +
  '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
  '.paywall,.article-paywall,.meter-gate,.subscription-gate,.reader-gate,' +
  '[data-testid="paywall"],[data-paywall],' +
  '[class*="metered"],[class*="Metered"],' +
  '[class*="piano"],[class*="Piano"],[class*="tinypass"]{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}' +
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
