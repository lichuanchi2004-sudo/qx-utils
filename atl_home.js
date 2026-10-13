// atl_home.js —— The Atlantic 首页/栏目页「图片提前加载」修复（同步，无网络请求）
//
// 用途：只处理首页 / 栏目页（不含文章页），把懒加载图片的真实地址提前还原出来，
//       使图片不必依赖滚动到视口才触发加载，从而解决「首页图片加载不全」。
//
// 设计要点：
//   - 【保留全部脚本】——首页本身依赖自己的 JS（导航/渲染/懒加载），删脚本会把页面搞坏。
//     所以这里绝不做「删脚本」那套（那是只用于文章页 atl_reader.js 的做法）。
//   - 只做图片还原：<img>/<source> 的 data-src / data-srcset / data-lazy-src 等 → 原生 src/srcset；
//     以及 <div data-src="..."> 当作背景图的情况 → background-image:url(真实地址)。
//   - 整标签重建：必须先清掉占位 src/srcset，再写入真实地址，否则一个标签出现两个 src，
//     浏览器只认第一个（占位小图）→ 显示成灰色块。

var body = ($response && $response.body) ? $response.body : "";

if (!/<html|<!doctype/i.test(body)) {
  // 非 HTML（接口/JSON/静态资源）原样返回，绝不误伤
  $done({ body: body });
} else {

  // ---- 1) <img> / <source>：把懒加载属性还原成浏览器原生 src / srcset ----
  body = body.replace(/<(img|source)\b([^>]*)>/gi, function (m, tag, attrs) {
    function get(name) {
      var r = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
      var mm = attrs.match(r);
      return mm ? (mm[2] !== undefined ? mm[2] : mm[3]) : null;
    }
    // 真实地址优先取 data-*，取不到就沿用标签里已有的 src/srcset（保持原样）
    var realSrc    = get('data-src') || get('data-lazy-src') || get('data-original') || get('data-original-src') || get('src');
    var realSrcset = get('data-srcset') || get('data-lazy-srcset') || get('data-original-srcset') || get('srcset');
    // 关键坑：测若标签已有 data-src 但取到的 realSrc 仍是占位 data: URI，则直接跳过，避免把占位写进 src
    if (realSrc && /^\s*data:/i.test(realSrc) && get('src') && !/^\s*data:/i.test(get('src'))) {
      return m; // 已是真实 src 的图，原样保留
    }
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
    if (realSrc && !/^\s*data:/i.test(realSrc))    out += ' src="' + realSrc + '"';
    if (realSrcset) out += ' srcset="' + realSrcset + '"';
    return '<' + tag + out + '>';
  });

  // ---- 2) 背景图：<div data-src="..."> / data-bg 当背景图的还原 ----
  body = body.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, function (m, tag, attrs) {
    if (/^(img|source|script|style)$/i.test(tag)) return m;
    function get(n) {
      var r = new RegExp('\\b' + n + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
      var mm = attrs.match(r);
      return mm ? (mm[2] !== undefined ? mm[2] : mm[3]) : null;
    }
    var bg = get('data-src') || get('data-bg') || get('data-original') || get('data-lazy-src');
    if (!bg || !/^https?:/i.test(bg)) return m; // 只处理真实 http(s) 图片地址
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

  $done({ body: body });
}
