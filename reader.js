// reader.js —— The New Yorker 解锁（Quantumult X / script-response-body，同步）
//
// ================== 根因（2026-10-14 实测，可复现）==================
// 1. 服务端【下发的就是全文】：每篇都能在 HTML 里数到全部段落，
//    例如 125 段 / 51 段 / 9 段，且响应头是 payment: free。
//    正文段落被标成 <p class="paywall">，但那只是个"样品标记"，页面里
//    压根没有任何 .paywall 的 CSS 规则 —— 光有标记不会隐藏任何东西。
//
// 2. 隐藏是【客户端 JS】干的：React 水合后读取内嵌状态
//      "paywall":{"strategy":"beta","paragraphLimit":1,...}
//    然后把 .body__inner-container 整个清空，塞进硬付费墙
//    （实测 offer 名里写着 ...MOBILE_PAYWALL_IN_CONTENT_BARRIER_FILLED_0_HARD_GATE_INTL_...）。
//    ⇒ 用无头 Chrome 渲染线上真实页面，水合后 <p class="paywall"> 从 8 个变成 0 个，
//      正文容器变成空的 <div class="body__inner-container"></div>。
//    ⇒ 所以"只注入 CSS 掀遮罩"注定无效：东西被 JS 删了，不是被挡住了。
//
// 3. 上一版脚本还自己捅了一刀：CSS 里写了
//      [class*="paywall"]{display:none!important}
//    而正文段落本身就叫 class="paywall" ⇒ 把全文都藏了，只剩第一段。
//    （实测截图确认：只剩 "Signs of a midterm blue wave are everywhere..." 一段。）
//    这就是"删了脚本反而只剩一段"的真正原因。
//
// ================== 对策 ==================
// 页面自带样式是【内联】的（整站没有一条 <link rel="stylesheet">），
// 去掉 JS 后版式、配图、标题全都正常。所以：
//   ① 删掉页面全部 <script>：水合不再发生，服务端下发的全文原样留在 DOM 里；
//   ② 绝不再隐藏 .paywall（那是正文！），改为强制显示；
//   ③ 只精准隐藏"付费墙外壳"（PaywallModal/Bar/InlineBarrier/营销位）；
//   ④ 顺带把 loading="lazy" 改成 eager，静态页也能立刻出图。
//
// 实测证据（本地无头 Chrome 截图）：
//   删脚本 + 上述 CSS → 全文正常显示（125 段的虚构小说、51 段的政治报道均完整）。

var body = ($response && $response.body) ? $response.body : "";

// 只处理 HTML
if (!/<html|<!doctype/i.test(body)) {
  $done({ body: body });
} else if (/cf-browser-verification|challenge-platform|Just a moment\.\.\./i.test(body)) {
  // Cloudflare 挑战页：放行，绝不改
  $done({ body: body });
} else if (!/class="paywall"|body__inner-container|data-testid="BodyWrapper"/.test(body)) {
  // 不是"带墙的文章页"（首页 / 栏目页 / 已获完整权限的页面）→ 一律不动
  $done({ body: body });
} else {

  // ① 删掉全部脚本（含 ld+json 与 src 引用），阻断水合 —— 这是关键一步
  body = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "");

  // ② 静态页里让图片立刻加载
  body = body.replace(/loading="lazy"/gi, 'loading="eager"');

  var css =
    '<style id="qx-ny-unlock">' +

    // A. 只隐藏"付费墙外壳"，注意用大写 Paywall + 带后缀的类名，
    //    绝对不要用 [class*="paywall"]，否则会连正文 <p class="paywall"> 一起隐藏。
    '[class*="PaywallModal"],[class*="PaywallBar"],[class*="PaywallInlineBarrier"],' +
    '[class*="paywall-modal"],[class*="paywall-bar"],[class*="paywall-inline-barrier"],' +
    '[data-testid="PaywallInlineBarrierWrapper"],' +
    '[class*="InterstitialWrapper"],[class*="InContentBarrier"],[class*="journey-unit"],' +
    '[class*="consumer-marketing-unit"],' +
    '[class*="SubscriptionGate"],[class*="MemberOnly"]{' +
    'display:none!important;visibility:hidden!important;opacity:0!important;' +
    'height:0!important;max-height:0!important;overflow:hidden!important;' +
    'pointer-events:none!important}' +

    // B. 正文段落强制显示（class 就是 paywall，绝不能藏）
    'p.paywall,.article__body p,.body__container p,.body__inner-container p{' +
    'display:block!important;visibility:visible!important;opacity:1!important;' +
    'max-height:none!important;height:auto!important;overflow:visible!important;' +
    '-webkit-mask-image:none!important;mask-image:none!important;filter:none!important}' +

    // C. 正文容器解除高度/渐变压制
    'article,main,.article__body,[class*="body__container"],[class*="body__inner-container"],' +
    '[class*="BodyWrapper"],[class*="ArticleBody"]{' +
    'max-height:none!important;height:auto!important;min-height:0!important;' +
    'overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important}' +

    // D. 配图正常显示
    'article img,[class*="article"] img{max-width:100%!important;height:auto!important;' +
    'opacity:1!important;visibility:visible!important}' +

    '</style>';

  if (/<\/head>/i.test(body)) {
    body = body.replace(/<\/head>/i, css + '</head>');
  } else if (/<head[^>]*>/i.test(body)) {
    body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
  } else if (/<body[^>]*>/i.test(body)) {
    body = body.replace(/<body[^>]*>/i, function (h) { return h + css; });
  } else {
    body = css + body;
  }

  // 诊断：确认规则命中，并报告"服务端下发了多少段正文"。
  // ⚠️ 只写控制台日志，**不弹通知** —— 每次打开文章都弹一条横幅太吵（用户 2026-10-16 要求去掉）。
  //    需要看诊断时：QX → 更多 → 脚本日志 / 或把下面 console.log 临时换回 $notify 即可。
  try {
    var n = (body.match(/<p class="paywall"/g) || []).length +
            (body.match(/<p class="[^"]*has-dropcap[^"]*"/g) || []).length;
    if (typeof console !== "undefined" && console.log) {
      console.log("[纽约客解锁] 正文段落: " + n + "（已删除页面脚本，阻断客户端删正文）");
    }
  } catch (e) {}

  $done({ body: body });
}
