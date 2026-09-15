import { App, Rect } from "leafer-ui";
import { Magnifier } from "./src";

// 纯 HTML / 无框架用法：插件只需要一个 Leafer App 实例。
const app = new App({ view: window, fill: "#eef1f6" });

app.tree.add(
  new Rect({
    cornerRadius: 12,
    fill: "#1AA5FF",
    height: 160,
    width: 260,
    x: 120,
    y: 120,
  }),
);

const magnifier = new Magnifier(app, { size: 200, zoom: 3 });

/**
 * 演示「状态由宿主自己管」：这里就是一个普通变量，React 换成 store、Vue 换成 reactive 也一样。
 * 控件也在代码里建，Demo 不依赖页面里预先存在任何元素。
 */
const toggle = document.createElement("button");

toggle.textContent = "开关放大镜";
Object.assign(toggle.style, {
  left: "12px",
  position: "fixed",
  top: "12px",
  zIndex: "10",
});
toggle.addEventListener("click", () => {
  magnifier.enabled = !magnifier.enabled;
});
document.body.appendChild(toggle);
