// ny_md2html.js —— 把 r.jina.ai 返回的 Markdown 渲染成干净可读的 HTML 页面
//
// 【配套的重写链路】（见 newyorker.conf / rewrite_rules.conf）
//   ① 文章页 302 跳转：https://www.newyorker.com/...  →  https://r.jina.ai/https://www.newyorker.com/...
//      jina 用它自己的爬虫身份去取源站，不受你本机计量状态影响，所以能拿到【真·全文 + 配图】。
//   ② 本脚本把 jina 的 Markdown 渲染成排版良好的阅读页（浅色、大字、适合长读）。
//      Safari 的「AA → 翻译成简体中文」在这种普通页面上照常可用。
//
// 【为什么走代理】实测结论：纽约客不看 UA（普通 UA 与 Googlebot UA 返回字节数完全一致，
//   伪装无效）；它以你本机的 cookie/计量状态决定是否下发全文 —— 你设备当前已被计满，
//   所以只给一段。改 UA 没用，只能换一个"全新身份"去取，这就是 jina 的价值。

var raw = ($response && $response.body) ? $response.body : "";

// 不是 jina 的内容（例如直接访问 / 报错 JSON）就不处理，避免误伤
if (!/Markdown Content:|URL Source:/i.test(raw)) {
  $done({ body: raw });
} else {

  // ---------- 1) 拆出元信息与正文 ----------
  var lines = raw.split(/\r?\n/);
  var title = "", source = "", time = "", start = -1;

  for (var i = 0; i < lines.length && i < 12; i++) {
    var ln = lines[i];
    if (/^Title:\s*/i.test(ln))        { title = ln.replace(/^Title:\s*/i, ""); }
    else if (/^URL Source:\s*/i.test(ln))      { source = ln.replace(/^URL Source:\s*/i, ""); }
    else if (/^Published Time:\s*/i.test(ln))  { time = ln.replace(/^Published Time:\s*/i, ""); }
    else if (/^Markdown Content:\s*/i.test(ln)) { start = i + 1; break; }
  }
  if (start < 0) { start = 0; }

  var rest = lines.slice(start);

  // ---------- 2) 砍掉尾部推荐位（jina 会以 "Read More" 开头）----------
  for (var k = 0; k < rest.length; k++) {
    if (/^\s*Read More\s*$/i.test(rest[k])) { rest = rest.slice(0, k); break; }
  }

  // ---------- 3) 行内 Markdown → HTML ----------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g,
        function (m, alt, url) { return '</p><figure><img src="' + url + '"><figcaption>' + alt.replace(/^Image\s*\d+:\s*/i, "") + '</figcaption></figure><p>'; });
    s = s.replace(/\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
    return s;
  }

  // ---------- 4) 按块渲染 ----------
  var body = "";
  var buf = [];
  var para = 0, figs = 0;

  function flush() {
    if (!buf.length) return;
    var block = buf.join("\n").trim();
    buf = [];
    if (!block) return;

    // 图片块
    var im = block.match(/^!\[([^\]]*)\]\((https?:[^)\s]+)\)$/);
    if (im) {
      figs++;
      body += '<figure><img src="' + im[2] + '" alt=""><figcaption>' +
              esc(im[1].replace(/^Image\s*\d+:\s*/i, "")) + '</figcaption></figure>';
      return;
    }
    // 图片题注行（jina 有时把 alt 单独放一行）
    if (/^(Photograph|Illustration|Cartoon|Photographs) (by|from)|^Photograph by/i.test(block) && block.length < 120) {
      body += '<p class="credit">' + inline(block) + '</p>';
      return;
    }
    para++;
    var html = inline(block).replace(/\n/g, "<br>");
    body += "<p>" + html + "</p>";
  }

  for (var j = 0; j < rest.length; j++) {
    var line = rest[j];
    if (/^\s*$/.test(line)) { flush(); } else { buf.push(line); }
  }
  flush();

  // ---------- 5) 组装页面 ----------
  var head = "";
  if (title)  head += "<h1>" + esc(title) + "</h1>";
  if (time)   head += '<p class="meta">' + esc(time.slice(0, 10)) + "</p>";
  var foot = source ? '<p class="src"><a href="' + esc(source) + '">原文链接</a></p>' : "";

  var css =
    "html{-webkit-text-size-adjust:100%}" +
    "body{background:#fbfbf9;color:#1a1a1a;margin:0;padding:20px 18px 60px;" +
    "font:18px/1.9 -apple-system,BlinkMacSystemFont,'Times New Roman',Georgia,serif;max-width:42em;margin-left:auto;margin-right:auto}" +
    "h1{font:600 27px/1.35 -apple-system,BlinkMacSystemFont,Georgia,serif;margin:8px 0 6px;letter-spacing:-.2px}" +
    ".meta{color:#8a8a8a;font-size:14px;margin:0 0 26px}" +
    "p{margin:0 0 1.15em;text-align:justify}" +
    "figure{margin:26px 0;padding:0}" +
    "figure img{display:block;width:100%;height:auto;border-radius:4px}" +
    "figcaption,.credit{color:#8a8a8a;font-size:13.5px;line-height:1.6;margin:8px 0 0;text-align:left}" +
    ".credit{margin:-.4em 0 1.2em}" +
    "a{color:#8a6a3a;text-decoration:none;border-bottom:1px solid rgba(138,106,58,.35)}" +
    ".src{margin-top:44px;padding-top:16px;border-top:1px solid #e6e4df;font-size:14px}";

  var out = "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
            "<title>" + esc(title || "New Yorker") + "</title><style>" + css + "</style></head><body>" +
            head + body + foot + "</body></html>";

  try {
    $notify("NY代理阅读", "段落:" + para + " 图:" + figs, (title || "").slice(0, 40));
  } catch (e) {}

  $done({ body: out });
}
