// reader.js —— The New Yorker 响应体清理（同步，无网络请求）
//
// 【重要更正】此前"段落 20-30"的诊断是无效的：它统计的是整页所有 <p>，
//   包含相关推荐、侧栏、newsletter 推广等，所以数字很大却依旧只有一段正文。
//   本版改为【只统计正文区 <article> 内的段落】，并额外报告 JSON-LD 付费墙标记，
//   这样下一次看通知就能判断：服务器到底给了多少正文。
//
// 【主修已移到 ny_headers.js】真正的解锁靠 request-header 阶段伪装 Googlebot，
//   让服务端把全文下发；本文件只做兜底清理（藏付费墙浮层、解除可能的高度压制），
//   不改变托管逻辑，也不依赖任何 class 名猜谜。

var body = ($response && $response.body) ? $response.body : "";

if (!/<html|<!doctype/i.test(body)) {
  // 非 HTML（接口/JSON/静态资源）原样返回，绝不误伤
  $done({ body: body });
} else {

  // ---- 更诚实的诊断指标 ----
  var pAll   = (body.match(/<p[\s>]/gi) || []).length;
  var arts   = body.match(/<article\b[\s\S]*?<\/article>/gi) || [];
  var pArt   = 0;
  for (var i = 0; i < arts.length; i++) {
    pArt += (arts[i].match(/<p[\s>]/gi) || []).length;
  }
  var paywallMark = /isAccessibleForFree"?\s*:\s*false|"paywall"|Subscribe to continue|remaining free article/i.test(body);

  // ---- 兜底 CSS：隐藏付费墙浮层 + 解除任何高度/遮罩压制（不依赖类名）----
  var css =
    '<style id="qx-ny-unlock">' +
    '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
    '.paywall,.meter-gate,.metered-gate,.subscription-gate,.reader-gate,' +
    '[data-testid="paywall"],[data-paywall],' +
    '[class*="metered"],[class*="Metered"],[class*="SubscriptionGate"],[class*="MemberOnly"],' +
    '[class*="piano"],[class*="Piano"],[class*="tinypass"]{display:none!important}' +
    '*,*::before,*::after{max-height:none!important}' +
    '[class*="article"],[class*="Article"],[class*="body"],[class*="Body"],' +
    '[class*="content"],[class*="Content"]{' +
    'overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;opacity:1!important;filter:none!important}' +
    '</style>';

  if (/<head[^>]*>/i.test(body)) {
    body = body.replace(/<head[^>]*>/i, function (h) { return h + css; });
  } else if (/<html[^>]*>/i.test(body)) {
    body = body.replace(/<html[^>]*>/i, function (h) { return h + css; });
  } else {
    body = css + body;
  }

  // ---- 诊断通知（v4）----
  try {
    $notify("NY诊断v4", "正文区段落:" + pArt + " / 全页:" + pAll, "含付费墙标记:" + (paywallMark ? "是" : "否"));
  } catch (e) {}

  $done({ body: body });
}
