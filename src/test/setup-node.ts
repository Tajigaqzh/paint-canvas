/** Node 环境没有 worker/页面 origin，相对 URL 解析需要一个假 location。 */
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: { href: "http://localhost/" },
});

if (typeof globalThis.self === "undefined") {
  Object.defineProperty(globalThis, "self", {
    configurable: true,
    value: globalThis,
  });
}
