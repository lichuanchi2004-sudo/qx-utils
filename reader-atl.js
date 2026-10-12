/*
 * Quantumult X 脚本 —— 网页全文阅读辅助（The Atlantic）
 * 适用：iOS Quantumult X（需开启 MitM 并信任 CA 证书）
 * 原理：拦截目标站点的 HTML 文档响应，注入少量样式 + 一段浏览器侧脚本，
 *       隐藏阅读限制浮层（#paywall 及其遮罩）、解除正文高度截断，
 *       并清除本地计量计数，从而在浏览器中直接显示完整正文。
 * 说明：The Atlantic 为“计量 / 遮罩式”限制，正文其实仍在页面 HTML 里，
 *       只是被 JS 渲染的浮层盖住；本脚本去除浮层即可显示，无需从别处抓取。
 *       若某篇被服务端整体截断（硬限制），客户端无法恢复，可用 archive.today 等镜像补充。
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

    // 1) 注入样式：隐藏浮层 + 解除正文截断 + 解除滚动锁定
    var style = [
      '<style id="qx-reader-atl">',
      '  /* 隐藏阅读限制浮层（The Atlantic 的遮罩层 id 为 paywall） */',
      '  #paywall,',
      '  [id*="paywall" i],',
      '  div[class*="paywall" i],',
      '  [class*="Paywall" i] {',
      '    display: none !important;',
      '    visibility: hidden !important;',
      '    pointer-events: none !important;',
      '  }',
      '',
      '  /* 解除正文高度截断与渐隐遮罩（正文容器 .article-content-body） */',
      '  .article-content-body,',
      '  div[class*="ArticleBody_root" i],',
      '  div[class*="ArticleLayout_article" i] {',
      '    max-height: none !important;',
      '    height: auto !important;',
      '    overflow: visible !important;',
      '    -webkit-mask-image: none !important;',
      '    mask-image: none !important;',
      '    position: static !important;',
      '    opacity: 1 !important;',
      '  }',
      '',
      '  /* 解除因浮层产生的滚动锁定 */',
      '  html, body {',
      '    overflow: auto !important;',
      '    height: auto !important;',
      '    position: static !important;',
      '  }',
      '</style>'
    ].join('\n');

    if (/<\/head>/i.test(body)) {
      body = body.replace(/<\/head>/i, style + '\n</head>');
    } else if (/<body/i.test(body)) {
      body = body.replace(/<body[^>]*>/i, function (m) { return m + style; });
    } else {
      body = style + body;
    }

    // 2) 注入浏览器侧脚本：去除浮层（含客户端渲染出来的）+ 重置计量计数
    var reset = [
      '<script>',
      '(function(){',
      '  function hideOverlay(){',
      '    try {',
      '      // 直接移除已知的浮层容器',
      '      var p = document.getElementById("paywall");',
      '      if (p) p.remove();',
      '      // 兜底：类名 / id 含 paywall 的元素一并隐藏',
      '      var all = document.querySelectorAll(\'[id*="paywall" i], [class*="paywall" i]\');',
      '      for (var i = 0; i < all.length; i++) { all[i].style.display = "none"; }',
      '      // 解除滚动锁定',
      '      document.documentElement.style.overflow = "auto";',
      '      document.body.style.overflow = "auto";',
      '      document.body.style.position = "static";',
      '    } catch (e) {}',
      '  }',
      '  function clearMeter(){',
      '    try {',
      '      var k = Object.keys(localStorage || {});',
      '      for (var i = 0; i < k.length; i++) {',
      '        if (/meter|paywall|subscription|entitlement|article|count|limit|access|piano|tinypass/i.test(k[i])) {',
      '          localStorage.removeItem(k[i]);',
      '        }',
      '      }',
      '      (document.cookie || "").split(";").forEach(function (c) {',
      '        var n = c.split("=")[0].trim();',
      '        if (/meter|paywall|subscription|entitlement|access|piano|tinypass/i.test(n)) {',
      '          document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.theatlantic.com";',
      '          document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";',
      '        }',
      '      });',
      '    } catch (e) {}',
      '  }',
      '  try {',
      '    hideOverlay();',
      '    clearMeter();',
      '    // 客户端渲染的浮层可能在 hydration 后才插入，用观察器兜底',
      '    if (window.MutationObserver) {',
      '      var mo = new MutationObserver(function () { hideOverlay(); });',
      '      mo.observe(document.documentElement, { childList: true, subtree: true });',
      '      // 前 4 秒多兜几次，确保渲染完成',
      '      var t = 0;',
      '      var iv = setInterval(function () { hideOverlay(); t++; if (t > 8) clearInterval(iv); }, 500);',
      '    }',
      '    document.addEventListener("DOMContentLoaded", hideOverlay);',
      '    window.addEventListener("load", hideOverlay);',
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
