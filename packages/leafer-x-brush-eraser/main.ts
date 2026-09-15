import { App, Frame, Line } from "leafer-ui";
import { Brush, Eraser } from "./src";

// 纯 HTML / 无框架用法：插件只负责手势和预览，文档状态由宿主自己管。
// 这里用一个普通数组当"文档"，React 换 store、Vue 换 reactive 也一样。
const app = new App({ view: window, fill: "#eef1f6" });
const board = new Frame({
  fill: "#ffffff",
  height: 1080,
  overflow: "hide",
  width: 1920,
});

app.tree.add(board);

type StrokeEvent = Parameters<Parameters<Brush["on"]>[1]>[0];

const strokes: StrokeEvent[] = [];

const brush = new Brush({ container: board, strokeWidth: 8 });

brush.on("draw", (event) => {
  // 宿主决定怎么落库：这里直接建成一个正式 Line 节点，并记进自己的数组。
  strokes.push(event);
  board.add(
    new Line({
      ...event,
      curve: 0.2,
      fill: "transparent",
      strokeCap: "round",
    }),
  );
});

const eraser = new Eraser({ container: board, strokeWidth: 24 });

eraser.on("erase", ({ container, points, strokeWidth }) => {
  // 插件已经销毁了自己的预览，宿主把轨迹作为持久 eraser 子节点留下来。
  container.add(
    new Line({
      eraser: "pixel",
      fill: "transparent",
      points,
      stroke: "#000000",
      strokeCap: "round",
      strokeWidth,
      x: 0,
      y: 0,
    }),
  );
});

// 工具切换也只是命令式 API，状态放在这个模块里。
let active: "brush" | "eraser" = "brush";
const applyTool = () => {
  brush.enabled = active === "brush";
  eraser.enabled = active === "eraser";
};

applyTool();

const toolbar = document.createElement("div");

Object.assign(toolbar.style, {
  display: "flex",
  gap: "8px",
  left: "12px",
  position: "fixed",
  top: "12px",
  zIndex: "10",
});

[
  ["画笔", "brush"],
  ["橡皮擦", "eraser"],
  ["清空", "clear"],
].forEach(([label, value]) => {
  const button = document.createElement("button");

  button.textContent = label;
  button.addEventListener("click", () => {
    if (value === "clear") {
      board.children?.slice().forEach((child) => child !== board && child.destroy());
      strokes.length = 0;
      return;
    }

    active = value as "brush" | "eraser";
    applyTool();
  });
  toolbar.appendChild(button);
});

document.body.appendChild(toolbar);
