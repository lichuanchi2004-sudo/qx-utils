// atl_md2html.js —— The Atlantic 硬墙辅助
// 作用：把 r.jina.ai 返回的全文(markdown) 转成可直接阅读的 HTML。
// 关键点：本脚本【同步】运行、无网络请求，规避 QX 重写脚本不支持异步网络的限制。
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function mdToHtml(md) {
  var lines = md.split('\n'), html = '', para = [];
  function flush() { if (para.length) { html += '<p>' + inline(para.join(' ')) + '</p>'; para = []; } }
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (t === '') { flush(); continue; }
    var h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flush(); var l = h[1].length; html += '<h' + l + '>' + inline(h[2]) + '</h' + l + '>'; continue; }
    var bq = t.match(/^>\s?(.*)$/);
    if (bq) { flush(); html += '<blockquote>' + inline(bq[1]) + '</blockquote>'; continue; }
    var li = t.match(/^[-*]\s+(.*)$/);
    if (li) { flush(); html += '<li>' + inline(li[1]) + '</li>'; continue; }
    para.push(t);
  }
  flush();
  return html;
}
var raw = $response.body || '';
var idx = raw.search(/^Published Time:/m);
var bodyMd = idx >= 0
  ? raw.slice(raw.indexOf('\n', idx) + 1)
  : raw.replace(/^Title:[^\n]*\n/, '').replace(/^URL Source:[^\n]*\n/, '');
var tm = raw.match(/^Title:\s*(.+)$/m);
var title = tm ? tm[1].trim() : 'Article';
var page = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>' + title + '</title>'
  + '<style>body{font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:720px;margin:0 auto;padding:20px 18px;color:#1a1a1a}'
  + 'h1{font-size:24px;line-height:1.3;margin:0 0 16px}h2,h3{line-height:1.3}a{color:#0a66c2}'
  + 'blockquote{border-left:3px solid #ccc;margin:16px 0;padding:4px 0 4px 12px;color:#555}img{max-width:100%}</style></head>'
  + '<body><h1>' + title + '</h1>' + mdToHtml(bodyMd) + '</body></html>';
$done({ body: page, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
