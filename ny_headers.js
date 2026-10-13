// ny_headers.js —— The New Yorker 请求头处理（script-request-header，同步）
//
// 【实测依据】2026-10-14 本机验证：
//   以全新匿名身份请求纽约客文章，服务端下发的是【完整全文】
//   （同一批文章的 <article> 正文段落数：125 段/4650 词、14 段/2995 词…）。
//   响应头里可见 Condé Nast 的身份与分群 cookie：
//     Set-Cookie: CN_xid=...; CN_xid_refresh=...; CN_segments=co.w2642; xid1=1
//   ⇒ 纽约客的"计量/付费墙状态"是绑在 CN_xid 这个服务端身份上的。
//     你设备上的 CN_xid 已被计满 → 服务端只给首段；
//     而全新身份每次都能拿到全文。所以：把身份 cookie 抹掉，等于换新身份。
//
// 【本脚本做的事】仅在请求 HTML 页面时，从 Cookie 里剔除 Condé Nast 的身份/计量键，
//   让服务端按"新访客"重新下发全文。图片/JS/CSS 等静态资源请求不动。
//   注意：只剔除计量相关键，不是清空全部 Cookie（清空全部会连带丢掉 cf_clearance
//   导致 Cloudflare 反复验证）。

var h = $request.headers || {};
var ua = h['User-Agent'] || h['user-agent'] || '';
var accept = h['Accept'] || h['accept'] || '';
var ck = h['Cookie'] || h['cookie'] || '';

// 只在"取 HTML 页面"的请求上动手，避免误伤静态资源与接口
if (ck && /text\/html/i.test(accept)) {
  var drop = /^(CN_xid|CN_xid_refresh|CN_segments|CN_geo_country_code|xid1|xid2|cn_xid|cnxid)$/i;
  var keep = [];
  var parts = ck.split(';');
  for (var i = 0; i < parts.length; i++) {
    var name = (parts[i].split('=')[0] || '').trim();
    if (!name) continue;
    if (drop.test(name)) continue;              // 身份/分群键：剔除
    if (/meter|paywall|article_?count|article_?read|viewed|free_?article/i.test(name)) continue;
    keep.push(parts[i].trim());
  }
  if (h['Cookie'] !== undefined) h['Cookie'] = keep.join('; ');
  else if (h['cookie'] !== undefined) h['cookie'] = keep.join('; ');
}

$done({ headers: h });
