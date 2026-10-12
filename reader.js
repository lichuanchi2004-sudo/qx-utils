/*
 * Quantumult X 脚本 —— 网页全文阅读辅助
 * 适用：iOS Quantumult X（需开启 MitM 并信任 CA 证书）
 * 原理：拦截目标站点的 HTML 文档响应，注入少量样式隐藏阅读限制遮罩、
 *       解除正文高度截断，并清除本地计量计数，从而在浏览器中直接显示完整正文。
 * 说明：仅对“计量 / 遮罩式”限制有效；若正文被服务端整体截断（硬限制），
 *       客户端无法恢复，可配合 archive.today 等镜像作为补充。
 */

(function () {
  try {
    var headers = $response.headers || {};
    var ctype = headers['Content-Type'] || headers['content-type'] || '';

    // 只处理 HTML 文档，避免误伤 JS / CSS / 图片 / API 响应
    if (!/text\/html/i.test(ctype)) {
      $done({});
      return;
    }

    var body = $response.body;
    if (typeof body !== 'string' || !body) {
      $done({});
      return;
    }

    // 1) 注入样式：隐藏遮罩 + 解除正文截断 + 解除滚动锁定
    var style = [
      '<style id="qx-reader">',
      '  /* 隐藏盖在正文之上的阅读限制浮层 */',
      '  [data-testid="paywall"],',
      '  #paywall,',
      '  .paywall,',
      '  .paywall-gate,',
      '  .paywall-overlay,',
      '  .article-paywall,',
      '  .meter-gate,',
      '  .subscription-gate,',
      '  .reader-gate,',
      '  div[id*="paywall" i],',
      '  div[class*="paywall" i],',
      '  div[class*="metered" i] {',
      '    display: none !important;',
      '  }',
      '',
      '  /* 解除正文高度截断与渐隐遮罩 */',
      '  .article-body,',
      '  .article-content,',
      '  .story-body,',
      '  .post-content,',
      '  [data-testid="articleBody"],',
      '  .article__body,',
      '  .article-lede-wrapper,',
      '  .article-body__section {',
      '    max-height: none !important;',
      '    overflow: visible !important;',
      '    -webkit-mask-image: none !important;',
      '    mask-image: none !important;',
      '    position: static !important;',
      '    opacity: 1 !important;',
      '  }',
      '',
      '  /* 解除因遮罩产生的滚动锁定 */',
      '  html, body {',
      '    overflow: auto !important;',
      '    height: auto !important;',
      '    position: static !important;',
      '  }',
      '',
      '  /* 隐藏常驻订阅提示条（可选） */',
      '  .site-header__subscribe,',
      '  .newsletter-promo,',
      '  .subscribe-banner { display: none !important; }',
      '</style>'
    ].join('\n');

    if (/<\/head>/i.test(body)) {
      body = body.replace(/<\/head>/i, style + '\n</head>');
    } else if (/<body/i.test(body)) {
      body = body.replace(/<body[^>]*>/i, function (m) { return m + style; });
    } else {
      body = style + body;
    }

    // 2) 注入重置计量器的脚本（浏览器侧清除本地计数 / 计费 cookie）
    var reset = [
      '<script>',
      '(function(){',
      '  try {',
      '    var k = Object.keys(localStorage || {});',
      '    for (var i = 0; i < k.length; i++) {',
      '      if (/meter|paywall|subscription|entitlement|article|count|limit|access/i.test(k[i])) {',
      '        localStorage.removeItem(k[i]);',
      '      }',
      '    }',
      '    document.cookie.split(";").forEach(function (c) {',
      '      var n = c.split("=")[0].trim();',
      '      if (/meter|paywall|subscription|entitlement|access/i.test(n)) {',
      '        document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.newyorker.com";',
      '        document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";',
      '      }',
      '    });',
      '  } catch (e) {}',
      '})();',
      '<\/script>'
    ].join('\n');

    if (/<\/body>/i.test(body)) {
      body = body.replace(/<\/body>/i, reset + '\n</body>');
    } else {
      body = body + reset;
    }

    $done({ body: body });
  } catch (e) {
    // 出错则原样返回，避免破坏页面
    $done({});
  }
})();
