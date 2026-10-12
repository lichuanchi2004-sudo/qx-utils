// atl_md2html.js —— 把 r.jina.ai 返回的 markdown 全文【同步】转成阅读用 HTML。
// 关键：本脚本【不做任何网络请求】，纯字符串处理，QX 的 script-response-body 必能稳定执行。
// 配合 theatlantic.conf 里的「url 302 重定向到 r.jina.ai」使用：
//   Safari 打开大西洋文章 → QX 302 转到 r.jina.ai 拿全文 → 本脚本把 markdown 转成排版 HTML 返回。

var body = ($response && $response.body) ? $response.body : "";
var idx = body.indexOf('Markdown Content:');
var md = idx >= 0 ? body.slice(idx + 'Markdown Content:'.length).trim() : body;
var tm = body.match(/^Title:\s*(.+)$/m);
var title = tm ? tm[1].trim() : 'Article';

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
var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>' + title + '</title>'
  + '<style>body{font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:0 auto;padding:20px 18px;color:#1a1a1a}'
  + 'h1{font-size:24px;line-height:1.3;margin:0 0 16px}h2,h3{line-height:1.3;margin-top:24px}a{color:#0a66c2}'
  + 'blockquote{border-left:3px solid #ccc;margin:16px 0;padding:4px 0 4px 12px;color:#555}img{max-width:100%;height:auto}li{margin:4px 0}</style></head>'
  + '<body><h1>' + title + '</h1>' + mdToHtml(md) + '</body></html>';

$done({ body: html, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
