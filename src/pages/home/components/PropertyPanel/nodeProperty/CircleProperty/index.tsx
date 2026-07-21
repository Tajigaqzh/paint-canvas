import { InputNumber, Select } from "antd";
import type { CanvasEllipseMode, CanvasNode } from "@/types";

type CirclePropertyProps = {
  node: Extract<CanvasNode, { kind: "ellipse" }>;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

const ellipseModeOptions: Array<{
  label: string;
  value: CanvasEllipseMode;
}> = [
  { label: "圆形", value: "circle" },
  { label: "椭圆", value: "ellipse" },
  { label: "圆环", value: "ring" },
  { label: "扇形", value: "sector" },
  { label: "扇形圆环", value: "sector-ring" },
  { label: "圆角弧线", value: "arc" },
];

function CircleProperty({ node, onUpdateNode }: CirclePropertyProps) {
  const mode = node.ellipseMode ?? (node.width === node.height ? "circle" : "ellipse");
  const hasAngle = mode === "sector" || mode === "sector-ring" || mode === "arc";
  const hasInnerRadius = mode === "ring" || mode === "sector-ring";

  return (
    <div className="property-ellipse">
      <label className="property-field">
        <span>形状</span>
        <Select
          options={ellipseModeOptions}
          value={mode}
          onChange={(ellipseMode) =>
            onUpdateNode(node.id, {
              closed: ellipseMode !== "arc",
              cornerRadius: ellipseMode === "sector-ring" ? (node.cornerRadius ?? 10) : undefined,
              ellipseMode,
              endAngle:
                ellipseMode === "sector" || ellipseMode === "sector-ring" || ellipseMode === "arc"
                  ? (node.endAngle ?? 180)
                  : undefined,
              fill: ellipseMode === "arc" ? "transparent" : node.fill,
              innerRadius:
                ellipseMode === "ring" || ellipseMode === "sector-ring"
                  ? (node.innerRadius ?? 0.5)
                  : undefined,
              startAngle:
                ellipseMode === "sector" || ellipseMode === "sector-ring" || ellipseMode === "arc"
                  ? (node.startAngle ?? -60)
                  : undefined,
              stroke: ellipseMode === "arc" ? (node.stroke ?? "#32cd79") : node.stroke,
              strokeAlign: ellipseMode === "arc" ? "center" : node.strokeAlign,
              strokeCap: ellipseMode === "arc" ? "round" : node.strokeCap,
              strokeWidth: ellipseMode === "arc" ? node.strokeWidth || 10 : node.strokeWidth,
            })
          }
        />
      </label>

      {hasAngle && (
        <div className="property-grid property-grid--two">
          <label className="property-field">
            <span>起角</span>
            <InputNumber
              value={node.startAngle ?? -60}
              onChange={(value) => onUpdateNode(node.id, { startAngle: Number(value ?? -60) })}
            />
          </label>
          <label className="property-field">
            <span>止角</span>
            <InputNumber
              value={node.endAngle ?? 180}
              onChange={(value) => onUpdateNode(node.id, { endAngle: Number(value ?? 180) })}
            />
          </label>
        </div>
      )}

      {hasInnerRadius && (
        <label className="property-field">
          <span>内径</span>
          <InputNumber
            max={0.95}
            min={0}
            step={0.05}
            value={node.innerRadius ?? 0.5}
            onChange={(value) => onUpdateNode(node.id, { innerRadius: Number(value ?? 0.5) })}
          />
        </label>
      )}

      {mode === "sector-ring" && (
        <label className="property-field">
          <span>圆角</span>
          <InputNumber
            min={0}
            value={node.cornerRadius ?? 10}
            onChange={(value) => onUpdateNode(node.id, { cornerRadius: Number(value ?? 0) })}
          />
        </label>
      )}
    </div>
  );
}

export default CircleProperty;
