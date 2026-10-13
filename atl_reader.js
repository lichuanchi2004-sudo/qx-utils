// atl_reader.js —— The Atlantic 软墙解锁（同步，无网络请求）
//
// 关键结论：大西洋全文就在下发的 HTML 里，付费墙用 Piano/Tinypass 类脚本在加载后
// 把正文删除/遮挡（典型表现：刷新瞬间看到全文，随即变回截断页；Alook 阅读模式能读全文可证）。
// 既然全文是静态 HTML，本脚本直接【移除所有 <script>】（付费墙脚本无从运行），
// 再把懒加载图片（Lazysizes 的 data-src / data-srcset / data-lazy-src / <source> 等）还原成原生 src/srcset，并注入「强制显示全文」CSS。
// 全程不发任何网络请求，QX 的 script-response-body 必能稳定执行，且不会再闪烁。

var body = ($response && $response.body) ? $response.body : "";

// 0) ★ Cloudflare 挑战页放行（关键修复）
//    当返回的是 "Please hold a moment" / "Just a moment" 这类人机验证页时，【绝不能删除它的脚本】。
//    该页依赖自身 JS 完成验证并种下 cf_clearance cookie；若被本脚本一并删除，验证永远完不成，
//    页面会永久卡在 "Please hold a moment"（典型诱因：清过 Safari cookies 触发重新挑战）。
//    原样返回，让 Cloudflare 的 JS 在浏览器里自解，种下 cookie 后下一次请求即拿到真文章，届时再正常解锁。
if (/please hold a moment|just a moment|ray id\s*:|challenges?\.cloudflare|cf-mitigated|cf-chl|cf-challenge/i.test(body)) {
  $done({ body: body });
  return;
}

// 1) 移除全部 <script>：
//    大西洋文章页是 hydration SPA —— 正文文本在 SSR 里就已完整下发，靠客户端 JS（大西洋
//    主 bundle）在加载后把正文 DOM 截断/替换成付费墙。把脚本全删，SSR 正文原样显示，文字即完整。
//    ※ 早期曾试“只删 Piano 保留其它脚本”，结果主 bundle 仍会把正文替换掉 → 整页看不到文章，故回退到删全部。
//
//    ★ 关于正文插图（v4 已修复，不再是"已知限制"）：
//      服务端下发的 <img> 的 src/srcset/width/height 本来就是**正确的真实地址**（全页 0 个 data-src）。
//      删脚本后图仍看不见，纯属 CSS 的锅 —— 站点把"淡入"交给客户端 JS 做：
//        .Image_lazy__hYWHV { opacity:0 }                                  ← 初始透明
//        .Image_loaded__zmzJ7 { opacity:1 }                                ← 只有站点 JS 会挂这个类
//        .ArticleInlineImagePicture_picture__SVXJ7{ height:0; padding-bottom:79.96%;
//                                                   background-color:var(--article-image-loading-placeholder-color) }  ← 灰块本体
//        .ArticleInlineImagePicture_image__I79fR { height:100% }            ← 父高 0 ⇒ 图高也算成 0
//      删了 JS 就永远挂不上 loaded 类 ⇒ 图片永久 opacity:0，只剩外面那层 #c0ccda 灰框。
//      所以除了删脚本，**必须同时注入 CSS 把这些"等 JS 来改"的样式直接改成终态**（见下面第 3 段）。
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
  // 3b) ★★ 正文插图出图（本版核心修复）★★
  //     站点靠客户端 JS 在图片 onload 后才挂 Image_loaded__zmzJ7 把 opacity 从 0 改 1；
  //     本脚本删了 JS，没人挂 ⇒ 必须在此直接把终态写死（用 !important 压过站点 CSS 与行内 padding-bottom）。
  //     选择器一律用"类名前缀"匹配（[class*="Image_lazy__"]），哈希号变了也不影响，抗站点改版。
  //     (a) 所有懒加载图：直接可见（正文插图 / 作者头像 / 杂志封面 / QuickLinks 共 12 张）
  '[class*="Image_lazy__"]{opacity:1!important;transition:none!important}' +
  //     (b) 正文插图外层 <picture>：height:0 + padding-bottom 的"占位灰框"是灰块本体，取消之
  '[class*="ArticleInlineImagePicture_picture__"]{' +
  'height:auto!important;padding-bottom:0!important;padding-top:0!important;' +
  'background-color:transparent!important;background-image:none!important;overflow:visible!important' +
  '}' +
  //     (c) 正文插图本体 <img>：height:100%（相对父的 0 高）要把图压成 0，改回按 width/height 属性自然撑开
  '[class*="ArticleInlineImagePicture_image__"]{' +
  'position:static!important;height:auto!important;width:auto!important;max-width:100%!important;' +
  'opacity:1!important;display:block!important' +
  '}' +
  // 3c) 兜底：任何原生懒加载图，绝不因为 opacity 看不见
  'img[loading="lazy"]{opacity:1!important}' +
  '</style>';

if (/<head[^>]*>/i.test(body)) {
  body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
} else if (/<html[^>]*>/i.test(body)) {
  body = body.replace(/<html[^>]*>/i, function (h) { return h + css; });
} else {
  body = css + body;
}

$done({ body: body });
