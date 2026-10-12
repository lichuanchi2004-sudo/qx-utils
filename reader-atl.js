// reader-atl.js —— The Atlantic 硬墙专用（QX 引擎式）
// 原理：大西洋是「服务端截断」硬墙，正文不在原 HTML 里。
// 故在 QX 侧用 $httpClient 调 r.jina.ai 抓全文，替换进正文容器后返回。
// 仅对 text/html 响应生效；失败则原样返回（至少能看到前几段）。

// ---------- 工具 ----------
function getHeader(headers, name) {
  if (!headers) return '';
  name = name.toLowerCase();
  for (var k in headers) { if (k.toLowerCase() === name) return headers[k]; }
  return '';
}

function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// 极简 markdown -> html（段落 / 标题 / 引用 / 列表 / 行内格式）
function mdToHtml(md) {
  var lines = md.split('\n');
  var html = '', para = [];
  function flush() {
    if (para.length) { html += '<p>' + inline(para.join(' ')) + '</p>\n'; para = []; }
  }
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (t === '') { flush(); continue; }
    var h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flush(); var l = h[1].length; html += '<h' + l + '>' + inline(h[2]) + '</h' + l + '>\n'; continue; }
    var bq = t.match(/^>\s?(.*)$/);
    if (bq) { flush(); html += '<blockquote>' + inline(bq[1]) + '</blockquote>\n'; continue; }
    var li = t.match(/^[-*]\s+(.*)$/);
    if (li) { flush(); html += '<li>' + inline(li[1]) + '</li>\n'; continue; }
    para.push(t);
  }
  flush();
  return html;
}

// 解析 jina 返回：提取 Title + 正文（去掉开头 metadata 三行）
function parseJina(txt) {
  var title = '';
  var mt = txt.match(/^Title:\s*(.+)$/m);
  if (mt) title = mt[1].trim();
  var idx = txt.search(/^Published Time:/m);
  var bodyMd;
  if (idx >= 0) {
    var nl = txt.indexOf('\n', idx);
    bodyMd = txt.slice(nl + 1);
  } else {
    // 兜底：去掉前两行 metadata
    bodyMd = txt.replace(/^Title:[^\n]*\n/, '').replace(/^URL Source:[^\n]*\n/, '');
  }
  return { title: title, body: bodyMd };
}

// 用 jina 全文替换 article-content-body 内部；失败返回 null（降级全量阅读页）
function replaceContainer(html, newInner) {
  var marker = 'class="article-content-body"';
  var i = html.indexOf(marker);
  if (i < 0) return null;
  var tagStart = html.lastIndexOf('<', i);
  var gt = html.indexOf('>', tagStart);
  var pos = gt + 1, depth = 1;
  while (pos < html.length && depth > 0) {
    if (html.substr(pos, 4) === '<div') { depth++; }
    else if (html.substr(pos, 6) === '</div') { depth--; }
    pos++;
  }
  var before = html.slice(0, gt + 1);            // 开标签（含 class）
  var after = html.slice(pos);                   // 最终 </div> 之后
  return before + '<div class="reader-full">' + newInner + '</div>' + after;
}

// ---------- 主流程 ----------
var ct = getHeader($response.headers, 'Content-Type');
if (ct.indexOf('text/html') < 0) { $done({ body: $response.body }); return; }

var target = $request.url;
var jinaUrl = 'https://r.jina.ai/' + target;

$httpClient.get({ url: jinaUrl, headers: { 'User-Agent': 'Mozilla/5.0' } }, function (err, resp, data) {
  if (err || !data || data.indexOf('Just a moment') >= 0) {
    // jina 抓取失败（或被拦），原样返回，至少保留前几段
    $done({ body: $response.body });
    return;
  }
  var p = parseJina(data);
  var bodyHtml = mdToHtml(p.body);
  var newFull = replaceContainer($response.body, bodyHtml);
  if (newFull) {
    $done({ body: newFull });
  } else {
    // 容器结构变化，降级为独立阅读页（仍含全文）
    var page = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + p.title + '</title>'
      + '<style>body{font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:720px;margin:0 auto;padding:20px 18px;color:#1a1a1a}'
      + 'h1{font-size:24px;line-height:1.3;margin:0 0 18px}h2,h3{line-height:1.3}a{color:#0a66c2}'
      + 'blockquote{border-left:3px solid #ccc;margin:16px 0;padding:4px 0 4px 12px;color:#555}</style></head>'
      + '<body><h1>' + p.title + '</h1>' + bodyHtml + '</body></html>';
    $done({ body: page });
  }
});
