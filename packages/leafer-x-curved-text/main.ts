import { App } from "leafer-ui";
import { CurvedText } from "./src";

const app = new App({ view: window, fill: "#eef1f6" });
const curvedText = new CurvedText({
  x: 360,
  y: 210,
  text: "Curved text 你好 👩🏽‍🚀",
  layout: {
    align: "center",
    bendAngle: 150,
    direction: "clockwise",
    letterSpacing: 2,
    radius: 240,
    startAngle: -90,
  },
  defaultStyle: {
    fill: "#172554",
    fontFamily: "Arial, sans-serif",
    fontSize: 36,
    fontWeight: 700,
    shadow: { blur: 4, color: "rgba(15, 23, 42, 0.25)", x: 1, y: 2 },
  },
  styleRuns: [{ start: 13, end: 14, style: { fill: "#d9465f", fontSize: 48 } }],
  characterEditing: true,
});
app.tree.add(curvedText);

const panel = document.createElement("section");
Object.assign(panel.style, {
  background: "white",
  border: "1px solid #d9dee8",
  borderRadius: "6px",
  display: "grid",
  gap: "10px",
  left: "16px",
  padding: "12px",
  position: "fixed",
  top: "16px",
  zIndex: "10",
});

const textInput = document.createElement("input");
textInput.value = curvedText.text;
textInput.setAttribute("aria-label", "Text");
textInput.addEventListener("input", () => curvedText.setText(textInput.value));

const angleInput = document.createElement("input");
angleInput.type = "range";
angleInput.min = "0";
angleInput.max = "360";
angleInput.value = "150";
angleInput.setAttribute("aria-label", "Bend angle");
angleInput.addEventListener("input", () =>
  curvedText.setLayout({ bendAngle: Number(angleInput.value) }),
);

const direction = document.createElement("select");
direction.setAttribute("aria-label", "Direction");
direction.innerHTML =
  '<option value="clockwise">Clockwise</option><option value="counterclockwise">Counterclockwise</option>';
direction.addEventListener("change", () =>
  curvedText.setLayout({ direction: direction.value as "clockwise" | "counterclockwise" }),
);

const radiusInput = document.createElement("input");
radiusInput.type = "range";
radiusInput.min = "80";
radiusInput.max = "500";
radiusInput.value = "240";
radiusInput.setAttribute("aria-label", "Radius");
radiusInput.addEventListener("input", () =>
  curvedText.setLayout({ radius: Number(radiusInput.value) }),
);

const editToggle = document.createElement("label");
const editCheckbox = document.createElement("input");
editCheckbox.type = "checkbox";
editCheckbox.checked = true;
editCheckbox.addEventListener("change", () => {
  curvedText.characterEditing = editCheckbox.checked;
});
editToggle.append(editCheckbox, document.createTextNode(" Select characters"));

const selectionOutput = document.createElement("output");
selectionOutput.textContent = "No character selection";
curvedText.on("character-selection-change", ({ start, end }) => {
  selectionOutput.textContent =
    start === end ? "No character selection" : `Characters ${start + 1}-${end}`;
});

panel.append(textInput, angleInput, direction, radiusInput, editToggle, selectionOutput);
document.body.appendChild(panel);
window.addEventListener("beforeunload", () => {
  curvedText.destroy();
  app.destroy();
  panel.remove();
});
