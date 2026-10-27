import { App } from "leafer-ui";
import { RichText } from "./src";

const app = new App({
  view: document.querySelector("#canvas") as HTMLElement,
  tree: {},
  editor: {},
});

const richText = new RichText({
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

const status = document.querySelector("#status") as HTMLElement;
const updateStatus = () => {
  status.textContent = richText.isEditing
    ? `选区：${richText.selectionStart}-${richText.selectionEnd}`
    : "双击文字后拖选字符";
};

const apply = (style: Parameters<RichText["setSelectionStyles"]>[0]) => {
  richText.setSelectionStyles(style);
  updateStatus();
};

document.querySelector("#red")?.addEventListener("click", () => apply({ fill: "#dc2626" }));
document.querySelector("#large")?.addEventListener("click", () => apply({ fontSize: 58 }));
document.querySelector("#bold")?.addEventListener("click", () => apply({ fontWeight: "bold" }));
setInterval(updateStatus, 100);

window.addEventListener("beforeunload", () => app.destroy());
