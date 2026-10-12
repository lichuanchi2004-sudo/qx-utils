// reader-atl.js —— The Atlantic 硬墙辅助（单脚本异步方案）
// 原理：QX 拦截大西洋文章页时，本脚本用 $httpClient 请求 r.jina.ai 全文代理，
// 取回 markdown 全文后转成阅读用 HTML，通过 $done 替换原（被截断的）响应。
// 仅对文章页生效；任何一步失败则原样返回（$done({})），绝不白屏。
// MITM 仅需解密 theatlantic.com 即可（jina 由 QX 内部请求，无需加入 MITM）。

var articleUrl = $request.url;
var jinaUrl = "https://r.jina.ai/" + articleUrl;

function inlineText(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function mdToHtml(md) {
  var lines = md.split('\n'), html = '', para = [];
  function flush() {
    if (para.length) { html += '<p>' + inlineText(para.join(' ')) + '</p>'; para = []; }
  }
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (t === '') { flush(); continue; }
    var h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); var l = Math.min(h[1].length, 6); html += '<h' + l + '>' + inlineText(h[2]) + '</h' + l + '>'; continue; }
    var bq = t.match(/^>\s?(.*)$/);
    if (bq) { flush(); html += '<blockquote>' + inlineText(bq[1]) + '</blockquote>'; continue; }
    var li = t.match(/^[-*]\s+(.*)$/);
    if (li) { flush(); html += '<li>' + inlineText(li[1]) + '</li>'; continue; }
    para.push(t);
  }
  flush();
  return html;
}

function buildPage(title, md) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + title + '</title>'
    + '<style>body{font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:0 auto;padding:20px 18px;color:#1a1a1a}'
    + 'h1{font-size:24px;line-height:1.3;margin:0 0 16px}h2,h3{line-height:1.3;margin-top:24px}a{color:#0a66c2}'
    + 'blockquote{border-left:3px solid #ccc;margin:16px 0;padding:4px 0 4px 12px;color:#555}img{max-width:100%;height:auto}li{margin:4px 0}</style></head>'
    + '<body><h1>' + title + '</h1>' + mdToHtml(md) + '</body></html>';
}

$httpClient.get({ url: jinaUrl, headers: { "User-Agent": "Mozilla/5.0" } }, function (error, response, data) {
  if (error || !data) {
    $done({});
    return;
  }
  var tm = data.match(/^Title:\s*(.+)$/m);
  var title = tm ? tm[1].trim() : 'Article';
  var idx = data.indexOf('Markdown Content:');
  var md = idx >= 0 ? data.slice(idx + 'Markdown Content:'.length).trim() : data;
  $done({
    body: buildPage(title, md),
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
});
