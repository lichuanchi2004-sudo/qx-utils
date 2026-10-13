// ny_headers.js —— 【已废弃 / 空操作】
//
// 2026-10-14 重新定案后，纽约客不再需要改动请求头：
//   服务端本来就下发全文（响应头 payment: free），付费墙是客户端 JS 水合后
//   按内嵌状态 "paywall":{"paragraphLimit":1} 把正文容器整个清空的。
//   所以"换身份 cookie 拿全文"的思路是错的，本脚本已无用途。
//
// 这里保留一个空操作实现：如果你 QX 里还挂着引用它的旧规则，不会报错、也不会改任何东西。
// 建议直接在 QX 里删掉那条 script-request-header 规则，只用 rewrite_newyorker.conf。

var h = $request.headers || {};
$done({ headers: h });
