import { App } from "leafer-ui";
import { RichTextPlus } from "./src";

const app = new App({
  view: document.querySelector("#canvas") as HTMLElement,
  tree: {},
  editor: {},
});

const richText = new RichTextPlus({
  x: 120,
  y: 180,
  text: "选中任意文字，单独修改它的样式",
  fontSize: 42,
  fill: "#172554",
  editable: true,
  padding: 12,
  styleRanges: [
    { start: 0, end: 2, fill: "#d9465f", fontWeight: "bold" },
    { start: 8, end: 10, fontSize: 54, fill: "#2563eb" },
  ],
});
app.tree.add(richText);

const circleText = new RichTextPlus({
  x: 610,
  y: 420,
  text: "沿路径排版的富文本",
  fontSize: 36,
  fill: "#087f8c",
  editable: true,
  textPath: "circle",
  pathRadius: 150,
  pathAlign: "center",
  pathSide: "outer",
  styleRanges: [
    { start: 0, end: 1, fill: "#e76f51", rotation: 0 },
    { start: 7, end: 9, fontSize: 44, fontWeight: "bold" },
  ],
});
app.tree.add(circleText);

const status = document.querySelector("#status") as HTMLElement;
const updateStatus = () => {
  status.textContent = richText.isEditing
    ? `选区：${richText.selectionStart}-${richText.selectionEnd}`
    : "双击文字后拖选字符";
};

const apply = (style: Parameters<RichTextPlus["setSelectionStyles"]>[0]) => {
  richText.setSelectionStyles(style);
  updateStatus();
};

document.querySelector("#circle")?.addEventListener("click", () => {
  circleText.textPath = "circle";
  circleText.pathSide = "outer";
  circleText.pathRadius = 150;
  circleText.setPathEditing(false);
  circleText.forceRender();
});
document.querySelector("#inner")?.addEventListener("click", () => {
  circleText.pathSide = circleText.pathSide === "inner" ? "outer" : "inner";
  circleText.forceRender();
});
document.querySelector("#custom")?.addEventListener("click", () => {
  circleText.setPathAnchors([
    { x: -180, y: 0, handleOut: { x: 90, y: -150 } },
    { x: 0, y: -100, handleIn: { x: -70, y: -50 }, handleOut: { x: 90, y: 100 } },
    { x: 190, y: 10, handleIn: { x: -90, y: 20 } },
  ]);
  circleText.setPathEditing(true);
});
document.querySelector("#editPath")?.addEventListener("click", () => {
  if (circleText.textPath === "circle") circleText.convertCircleToPath();
  circleText.setPathEditing(!circleText.pathEditing);
});

document.querySelector("#red")?.addEventListener("click", () => apply({ fill: "#dc2626" }));
document.querySelector("#large")?.addEventListener("click", () => apply({ fontSize: 58 }));
document.querySelector("#bold")?.addEventListener("click", () => apply({ fontWeight: "bold" }));
setInterval(() => {
  updateStatus();
  const pathStatus = document.querySelector("#path-status") as HTMLElement;
  pathStatus.textContent = circleText.pathEditing
    ? `路径编辑：${circleText.pathAnchors?.length ?? 0} 个锚点`
    : `路径：${circleText.textPath} / ${circleText.pathSide}`;
}, 100);

window.addEventListener("beforeunload", () => app.destroy());
