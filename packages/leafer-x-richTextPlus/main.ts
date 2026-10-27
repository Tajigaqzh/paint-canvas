import { App } from "leafer-ui";
import { RichTextPlus, TextPathMode } from "./src";

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
  textPath: {
    mode: TextPathMode.Circle,
    radius: 150,
    align: "center",
    side: "outer",
  },
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
  circleText.set({
    textPath: { ...circleText.textPath, mode: TextPathMode.Circle, side: "outer", radius: 150 },
  });
  circleText.setPathEditing(false);
});
document.querySelector("#inner")?.addEventListener("click", () => {
  circleText.set({
    textPath: {
      ...circleText.textPath,
      side: circleText.textPath.side === "inner" ? "outer" : "inner",
    },
  });
});
document.querySelector("#polygon")?.addEventListener("click", () => {
  circleText.set({
    textPath: { ...circleText.textPath, mode: TextPathMode.Polygon, sides: 3, radius: 150, editing: false },
  });
});
document.querySelector("#generated")?.addEventListener("click", () => {
  circleText.set({
    textPath: { ...circleText.textPath, mode: TextPathMode.Custom, closed: true, editing: false },
  });
  circleText.setPathGenerator(() =>
    Array.from({ length: 10 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 10 - Math.PI / 2;
      const radius = index % 2 === 0 ? 150 : 70;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }),
  );
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
  circleText.setPathEditing(!circleText.textPath.editing);
});

document.querySelector("#red")?.addEventListener("click", () => apply({ fill: "#dc2626" }));
document.querySelector("#large")?.addEventListener("click", () => apply({ fontSize: 58 }));
document.querySelector("#bold")?.addEventListener("click", () => apply({ fontWeight: "bold" }));
setInterval(() => {
  updateStatus();
  const pathStatus = document.querySelector("#path-status") as HTMLElement;
  pathStatus.textContent = circleText.textPath.editing
    ? circleText.textPath.mode === TextPathMode.Circle
      ? "路径编辑：拖动路径调整半径"
      : circleText.textPath.mode === TextPathMode.Polygon
        ? `路径编辑：拖动顶点调整半径（${circleText.textPath.sides ?? 3} 边）`
        : `路径编辑：${circleText.textPath.anchors?.length ?? 0} 个锚点`
    : `路径：${circleText.textPath.mode} / ${circleText.textPath.side ?? "outer"}`;
}, 100);

window.addEventListener("beforeunload", () => app.destroy());
