// reader.js —— The New Yorker 解锁（同步，无网络请求）
//
// 关键结构判断：纽约客正文靠 JS「水合」渲染，付费墙（Piano/Tinypass）负责把正文删/截断。
// 两个极端都只会显示一段，所以必须【精准】：
//   - 删全部脚本 → 水合没了 → 只剩 SSR 首段（已验证失败）
//   - 保留全部脚本 → 付费墙脚本把正文删掉 → 仍只剩一段（已验证失败）
// 故本版：只删付费墙脚本，保留水合/图片懒加载脚本；再用 CSS 隐藏浮层、解除高度限制。
//
// 诊断：脚本会弹通知，报告「原始段落数 / 删掉的付费墙脚本数 / 是否识别到 Piano」。
// 请按通知内容判断：段落数很多而付费墙脚本=0 → 说明墙另有机制，把数字告诉我再调。

var body = ($response && $response.body) ? $response.body : "";

if (!/<html|<!doctype/i.test(body)) {
  // 非 HTML（接口/JSON/静态资源）原样返回，绝不误伤
  $done({ body: body });
} else {

  // ---- 诊断指标（改动前统计，便于定位）----
  var paraBefore = (body.match(/<p[\s>]/gi) || []).length;
  var vendorHit  = (body.match(/tinypass|piano|__tprofiles|window\.tp\b|tp\.init/i) || []).length;

  // ---- 1) 精准移除付费墙脚本，其余脚本一律保留 ----
  // 命中判定（m 是完整 <script ...>...</script>，故 src 与内联内容都会被检查）：
  //   a) 明确的 Piano/Tinypass 体系关键词
  //   b) 外链脚本 src 里含 paywall / meter / gate（内联脚本不以此误判，避免误删水合 bundle）
  var removedPaywall = 0;
  body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function (m) {
    if (/tinypass|piano|__tprofiles|window\.tp\b|tp\.init/i.test(m)) { removedPaywall++; return ''; }
    if (/\bpaywall|meter|gate\b/i.test(m) && /\bsrc\s*=/.test(m)) {
      var src = (m.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[0] || '';
      if (/\bpaywall|meter|gate\b/i.test(src)) { removedPaywall++; return ''; }
    }
    return m;
  });

  // ---- 2) 注入「强制显示全文」CSS：隐藏付费墙浮层，解除正文高度/渐变限制 ----
  var css =
    '<style id="qx-ny-unlock">' +
    '[class*="paywall"],[class*="Paywall"],[id*="paywall"],[id*="Paywall"],' +
    '.paywall,.article-paywall,.meter-gate,.metered-gate,.subscription-gate,.reader-gate,' +
    '[data-testid="paywall"],[data-paywall],[class*="metered"],[class*="Metered"],' +
    '[class*="piano"],[class*="Piano"],[class*="tinypass"]{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}' +
    '[class*="article-body"],[class*="articleBody"],[class*="article-content"],[class*="story-body"],' +
    '[data-testid="articleBody"],.article__body{display:block!important;max-height:none!important;height:auto!important;overflow:visible!important;' +
    '-webkit-mask-image:none!important;mask-image:none!important;opacity:1!important;filter:none!important}' +
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

  // ---- 3) 诊断通知：把真实数字报出来，下一轮据此调整 ----
  try {
    $notify("NY诊断", "段落:" + paraBefore + " 付费墙脚本:" + removedPaywall, "Piano关键词:" + vendorHit);
  } catch (e) {}

  $done({ body: body });
}
