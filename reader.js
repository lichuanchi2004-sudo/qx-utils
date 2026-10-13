// reader.js —— The New Yorker 解锁（同步，无网络请求）
//
// 【诊断结论驱动的实现】设备实测反馈：原始 HTML 里有 20~30 个 <p> 全文，但付费墙关键词(Piano/tinypass)=0。
// 由此确定纽约客的付费墙：
//   - 不是 Piano 体系（所以"删 Piano 脚本"无效，它压根没匹配到东西）
//   - 不是服务端截断（20-30 段全文都在 HTML 里）
//   - 而是【用 CSS 把正文藏起来】：容器被 max-height / overflow:hidden / 渐变遮罩(mask-image) 限制，
//     再叠一个付费墙浮层。用户只看到一段，正是因为容器高度被压住。
//
// 【策略】既然猜不准它真实的 class 名（版本迭代会变），就两手都下：
//   ① CSS 端「不依赖类名」：全局重置 max-height / mask，覆盖任何容器的高度压制；
//      再按类名关键字（多种大小写变体）隐藏付费墙浮层。
//   ② JS 端「动态定位」：注入运行时脚本，找出真正包着正文的元素链（所有含 <p> 的祖先链），
//      逐个解开 max-height/overflow/mask；并在多次延时 + DOM 变化时反复重跑，
//      确保 hydration 之后若被重新截断，还能再解开。
//   全程保留页面原有脚本（水合与图片懒加载必须活着）。

var body = ($response && $response.body) ? $response.body : "";

if (!/<html|<!doctype/i.test(body)) {
  // 非 HTML（接口/JSON/静态资源）原样返回，绝不误伤
  $done({ body: body });
} else {

  // ---- 诊断指标（改动前统计）----
  var paraBefore = (body.match(/<p[\s>]/gi) || []).length;
  var vendorHit  = (body.match(/tinypass|piano|__tprofiles|window\.tp\b|tp\.init/i) || []).length;

  // ---- 1) 付费墙脚本兜底清理（本次实测为 0，保留以防后续版本启用 Piano）----
  var removedPaywall = 0;
  body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function (m) {
    if (/tinypass|piano|__tprofiles|window\.tp\b|tp\.init/i.test(m)) { removedPaywall++; return ''; }
    if (/\bpaywall|meter|gate\b/i.test(m) && /\bsrc\s*=/.test(m)) {
      var srcMatch = m.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (srcMatch && /\bpaywall|meter|gate\b/i.test(srcMatch[0])) { removedPaywall++; return ''; }
    }
    return m; // 其余脚本（水合 / 图片懒加载）一律保留
  });

  // ---- 2) CSS：不依赖类名的强制显形 ----
  var css =
    '<style id="qx-ny-unlock">' +
    // (a) 隐藏付费墙浮层 / 计量门 / 订阅门（多大小写变体）
    '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
    '.paywall,.article-paywall,.meter-gate,.metered-gate,.subscription-gate,.reader-gate,' +
    '[data-testid="paywall"],[data-paywall],' +
    '[class*="metered"],[class*="Metered"],[class*="SubscriptionGate"],[class*="MemberOnly"],' +
    '[class*="piano"],[class*="Piano"],[class*="tinypass"]{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}' +
    // (b) 关键：全局重置高度压制与渐变遮罩——不看类名，任何靠 max-height/mask 截断正文的容器都会被解开
    '*,*::before,*::after{max-height:none!important}' +
    '[style*="max-height"]{max-height:none!important}' +
    // (c) 针对内容容器（多变体）彻底解除限制
    '[class*="article"],[class*="Article"],[class*="body"],[class*="Body"],' +
    '[class*="content"],[class*="Content"],[class*="story"],[class*="Story"]{' +
    'height:auto!important;overflow:visible!important;overflow-y:visible!important;' +
    '-webkit-mask-image:none!important;mask-image:none!important;opacity:1!important;filter:none!important' +
    '}' +
    '[class*="fade"],[class*="Fade"],[class*="blur"],[class*="Blur"],[class*="gradient"],[class*="Gradient"]{' +
    'opacity:1!important;filter:none!important;-webkit-mask-image:none!important;mask-image:none!important}' +
    'html,body{overflow:auto!important;height:auto!important;position:static!important}' +
    '</style>';

  if (/<head[^>]*>/i.test(body)) {
    body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
  } else if (/<html[^>]*>/i.test(body)) {
    body = body.replace(/<html[^>]*>/i, function (h) { return h + css; });
  } else {
    body = css + body;
  }

  // ---- 3) 运行时脚本：动态定位正文容器并解开（弥补 CSS 猜不中类名的不足）----
  // 若站点 CSP 禁止内联脚本，此段不执行也没关系，上面的 CSS 已独立生效。
  var rt = [
    '<script>(function(){',
    'function blocked(el){try{var c=getComputedStyle(el);',
    'if(!c)return false;',
    'if(c.maxHeight&&c.maxHeight!=="none")return true;',
    'if(c.overflow==="hidden"||c.overflowY==="hidden")return true;',
    'if(c.webkitMaskImage&&c.webkitMaskImage!=="none")return true;',
    'if(c.maskImage&&c.maskImage!=="none")return true;',
    'return false;}catch(e){return false}}',
    'function unlockUp(el,depth){var n=el,i=0;while(n&&i<(depth||6)){',
    'if(blocked(n)){try{',
    'n.style.setProperty("max-height","none","important");',
    'n.style.setProperty("overflow","visible","important");',
    'n.style.setProperty("-webkit-mask-image","none","important");',
    'n.style.setProperty("mask-image","none","important");',
    'n.style.setProperty("height","auto","important");',
    '}catch(e){}}n=n.parentElement;i++;}}',
    'var KS=["paywall","Paywall","metered","Metered","subscription-gate","SubscriptionGate","reader-gate","ReaderGate","member-only","MemberOnly"];',
    'function hideGates(){try{var els=document.querySelectorAll("div,section,aside,form");',
    'for(var i=0;i<els.length;i++){var e=els[i];var cl=e.className;',
    'if(typeof cl!=="string"||!cl)continue;',
    'var hit=false;for(var j=0;j<KS.length;j++){if(cl.indexOf(KS[j])>-1){hit=true;break}}',
    'if(!hit)continue;',
    'if(e.querySelectorAll("p").length>3)continue;',
    'e.style.setProperty("display","none","important");',
    '}}catch(e){}}',
    'function scan(){try{var ps=document.querySelectorAll("p");',
    'for(var i=0;i<ps.length;i++){unlockUp(ps[i],6);}hideGates();}catch(e){}}',
    'scan();',
    'setTimeout(scan,150);setTimeout(scan,700);setTimeout(scan,1800);setTimeout(scan,4000);',
    'if(window.MutationObserver){try{new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true});}catch(e){}}',
    '})();<\/script>'
  ].join('');

  if (/<\/body>/i.test(body)) {
    body = body.replace(/<\/body>/i, rt + '</body>');
  } else {
    body = body + rt;
  }

  // ---- 4) 诊断通知（版本号 v3，确认你拉到的是新版）----
  try {
    $notify("NY诊断v3", "段落:" + paraBefore + " 付费墙脚本:" + removedPaywall, "Piano关键词:" + vendorHit);
  } catch (e) {}

  $done({ body: body });
}
