// reader.js —— The New Yorker 软墙解锁（同步，无网络请求）
//
// 【恢复第一版打法】昨晚用配置文件订阅时，这一版是成功的：
//   纽约客是软墙 —— 全文就在 HTML 里，只是在正文上盖了一层浮层 + 用 max-height/渐变
//   把下半截压住，再靠本机 cookie/localStorage 的计量计数决定要不要压。
//   所以正确做法是：保留页面自己的脚本（水合靠它，删了正文就没了），
//   只注入 CSS 掀掉浮层、解除截断，并清掉本机计量状态。
//
//   后续走过的弯路（均已证伪，勿再回头）：
//   - 删全部脚本 → 破坏水合，正文只剩服务端预渲染的一段
//   - 伪装 Googlebot UA → 实测普通 UA 与 Googlebot UA 返回字节数完全一致，无效
//   - 走 r.jina.ai 代理 → 能出全文，但依赖第三方且版式非原站，非必要

var body = ($response && $response.body) ? $response.body : "";

// 非 HTML（接口/JSON/静态资源）原样返回，绝不误伤
if (!/<html|<!doctype/i.test(body)) {
  $done({ body: body });
} else {

  // ============ 1) CSS：掀掉付费墙浮层 + 解除正文截断 ============
  var css =
    '<style id="qx-ny-unlock">' +
    // ① 付费墙 / 计量浮层（class 名取自真实抓取的纽约客页面）
    //    paywall(33处) / paywall-modal / paywall-bar / PaywallModalWrapper /
    //    PaywallBarWrapper / consumer-marketing-unit__slot--paywall-*
    '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
    '[class*="metered"],[class*="Metered"],[class*="Meter"],' +
    '.paywall,.meter-gate,.metered-gate,.subscription-gate,.reader-gate,.member-gate,' +
    '[data-testid*="paywall"],[data-paywall],[data-testid*="Meter"],' +
    '[class*="SubscriptionGate"],[class*="MemberOnly"],[class*="Subscribe"],' +
    '[class*="consumer-marketing-unit"],[class*="piano"],[class*="Piano"],' +
    '[class*="tinypass"],[class*="ad--overlay"],[class*="ad__slot--overlay"]{' +
    'display:none!important;visibility:hidden!important;height:0!important;' +
    'max-height:0!important;overflow:hidden!important;opacity:0!important}' +

    // ② 正文容器：解除高度压制与渐变遮罩（真实 class：article__body /
    //    body__container / body__inner-container / BodyWrapper-*）
    '.article-body,[class*="article-body"],[class*="ArticleBody"],' +
    '[class*="article__body"],[class*="ArticleBodyWrapper"],' +
    '[class*="article-content"],[class*="ArticleContent"],' +
    '[class*="body__container"],[class*="body__inner-container"],' +
    '[class*="BodyWrapper"],[class*="body-content"],[class*="BodyContent"],' +
    'article,main,.article{' +
    'max-height:none!important;height:auto!important;overflow:visible!important;' +
    '-webkit-mask-image:none!important;mask-image:none!important;' +
    'opacity:1!important;filter:none!important;transform:none!important;' +
    'position:static!important}' +

    // ③ 兜底：任何残留的渐变遮罩都失效（实测压制来自外链 CSS，非内联样式）
    '[style*="mask-image"],[style*="linear-gradient"]{' +
    '-webkit-mask-image:none!important;mask-image:none!important;' +
    'background-image:none!important}' +

    // ④ 正文图片正常显示
    '[class*="article"] img,article img{max-width:100%!important;height:auto!important;display:block!important}' +
    '</style>';

  // ============ 2) JS：清掉本机计量状态 ============
  // 纽约客用 cookie/localStorage 记录已读篇数，计数满了就压正文。
  // 清掉这些键，付费墙脚本读不到计数即按"未计量"放行。
  var js =
    '<script id="qx-ny-reset">' +
    '(function(){' +
    'try{' +
      'var L=window.localStorage,S=window.sessionStorage,i,k;' +
      'var bad=/meter|paywall|nsdr|ny_|newyorker|read|count|gate|wall|reg|track|session|visit/i;' +
      'for(i=0;i<L.length;i++){k=L.key(i);if(k&&bad.test(k))L.removeItem(k);}' +
      'for(i=0;i<S.length;i++){k=S.key(i);if(k&&bad.test(k))S.removeItem(k);}' +
    '}catch(e){}' +
    'try{' +
      'var c=document.cookie.split(";");' +
      'for(var j=0;j<c.length;j++){' +
        'var n=(c[j].split("=")[0]||"").trim();' +
        'if(/meter|nsdr|ny_|newyorker|paywall|read|count|visit/i.test(n)){' +
          'document.cookie=n+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.newyorker.com";' +
          'document.cookie=n+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";' +
        '}' +
      '}' +
    '}catch(e){}' +
    '})();' +
    '</script>';

  // 注入 CSS 到 <head> 之后
  if (/<head[^>]*>/i.test(body)) {
    body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
  } else if (/<html[^>]*>/i.test(body)) {
    body = body.replace(/<html[^>]*>/i, function (h) { return h + css + '<head></head>'; });
  } else {
    body = css + body;
  }

  // 注入清计量脚本到 </head> 之前（越早越好，赶在付费墙脚本读计数之前）
  if (/<\/head>/i.test(body)) {
    body = body.replace(/<\/head>/i, js + '</head>');
  } else if (/<body[^>]*>/i.test(body)) {
    body = body.replace(/<body[^>]*>/i, function (b) { return b + js; });
  } else {
    body = js + body;
  }

  // ============ 3) 诊断（脚本真跑起来就会弹） ============
  try {
    var arts = body.match(/<article\b[\s\S]*?<\/article>/gi) || [];
    var pArt = 0;
    for (var i = 0; i < arts.length; i++) {
      pArt += (arts[i].match(/<p[\s>]/gi) || []).length;
    }
    var pAll = (body.match(/<p[\s>]/gi) || []).length;
    $notify("NY解锁v1", "正文区段落:" + pArt + " / 全页:" + pAll, "脚本已运行，保留全部页面脚本");
  } catch (e) {}

  $done({ body: body });
}
