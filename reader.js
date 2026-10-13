// reader.js —— The New Yorker 软墙解锁（同步，无网络请求）
//
// 【回到最初那一版】用法就一句话：注入样式，隐藏遮罩，解除截断。
//   纽约客是软墙：正文其实就在下发的 HTML 里，付费墙只是盖了一层遮罩 +
//   用高度/渐变把下半截压住。所以只需注入 CSS 掀掉遮罩、放开高度即可。
//
// 【绝不做的事】（都是实测踩过的坑）
//   - 不删任何页面脚本：正文靠客户端水合渲染，删脚本会只剩服务端预渲染的一段。
//   - 不清 cookie / localStorage：用户实测「Safari 清 cookies 后纽约客就不行了」，
//     自动清计量状态会帮倒忙。
//   - 不依赖第三方代理（jina 等），纯本机改写。

var body = ($response && $response.body) ? $response.body : "";

// 非 HTML（接口 / JSON / js / css / 图片）原样返回，绝不误伤
if (!/<html|<!doctype/i.test(body)) {
  $done({ body: body });
} else {

  var css =
    '<style id="qx-ny-unlock">' +

    // ① 隐藏付费墙遮罩 / 浮层 / 订阅条
    //    class 名取自真实抓取的纽约客页面：paywall / paywall-modal / paywall-bar /
    //    PaywallModalWrapper-* / PaywallBarWrapper-* / consumer-marketing-unit__slot--paywall-*
    '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
    '[class*="metered"],[class*="Metered"],' +
    '[class*="consumer-marketing-unit"],' +
    '[data-testid*="paywall"],[data-testid*="Paywall"],[data-paywall],' +
    '[class*="SubscriptionGate"],[class*="MemberOnly"],[class*="Subscribe"],' +
    '[class*="piano"],[class*="Piano"],[class*="tinypass"]{' +
    'display:none!important;visibility:hidden!important;opacity:0!important;' +
    'height:0!important;max-height:0!important;overflow:hidden!important;' +
    'pointer-events:none!important;z-index:-1!important}' +

    // ② 解除正文截断：放开高度、去掉渐变遮罩
    //    真实正文容器：article__body / body__container / body__inner-container / BodyWrapper-*
    '.article-body,[class*="article-body"],[class*="article__body"],' +
    '[class*="ArticleBody"],[class*="ArticleBodyWrapper"],' +
    '[class*="article-content"],[class*="ArticleContent"],' +
    '[class*="body__container"],[class*="body__inner-container"],' +
    '[class*="BodyWrapper"],[class*="body-content"],[class*="BodyContent"],' +
    'article,main,.article{' +
    'max-height:none!important;height:auto!important;min-height:0!important;' +
    'overflow:visible!important;overflow-y:visible!important;' +
    '-webkit-mask-image:none!important;mask-image:none!important;' +
    'opacity:1!important;filter:none!important;transform:none!important;' +
    'position:static!important}' +

    // ③ 兜底：任何残留的渐变遮罩都失效（实测压制来自外链 CSS，非内联样式）
    '[style*="mask-image"],[style*="linear-gradient"]{' +
    '-webkit-mask-image:none!important;mask-image:none!important}' +

    // ④ 正文段落与配图正常显示
    'article p,[class*="article"] p,[class*="body"] p{' +
    'display:block!important;visibility:visible!important;opacity:1!important}' +
    'article img,[class*="article"] img{max-width:100%!important;height:auto!important}' +
    '</style>';

  if (/<\/head>/i.test(body)) {
    // 放 </head> 之前，确保早于页面自身的 CSS/JS 生效
    body = body.replace(/<\/head>/i, css + '</head>');
  } else if (/<head[^>]*>/i.test(body)) {
    body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
  } else if (/<html[^>]*>/i.test(body)) {
    body = body.replace(/<html[^>]*>/i, function (h) { return h + css + '<head></head>'; });
  } else {
    body = css + body;
  }

  // 诊断：脚本真跑起来就会弹，用于确认规则已命中
  try {
    var arts = body.match(/<article\b[\s\S]*?<\/article>/gi) || [];
    var pArt = 0;
    for (var i = 0; i < arts.length; i++) {
      pArt += (arts[i].match(/<p[\s>]/gi) || []).length;
    }
    $notify("NY解锁", "正文区段落:" + pArt, "脚本已运行（保留全部页面脚本，未清cookie）");
  } catch (e) {}

  $done({ body: body });
}
