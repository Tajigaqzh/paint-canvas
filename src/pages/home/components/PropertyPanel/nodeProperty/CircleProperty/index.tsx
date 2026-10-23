import { InputNumber, Select } from "antd";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import type { CanvasEllipseMode, CanvasNode } from "@/types";

type CirclePropertyProps = {
  node: Extract<CanvasNode, { kind: "ellipse" }>;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

function CircleProperty({ node, onUpdateNode }: CirclePropertyProps) {
  const { t } = useAppTranslation();
  const ellipseModeOptions: Array<{ label: string; value: CanvasEllipseMode }> = [
    { label: t("circle"), value: "circle" },
    { label: t("ellipse"), value: "ellipse" },
    { label: t("ring"), value: "ring" },
    { label: t("sector"), value: "sector" },
    { label: t("sectorRing"), value: "sector-ring" },
    { label: t("arc"), value: "arc" },
  ];
  const mode = node.ellipseMode ?? (node.width === node.height ? "circle" : "ellipse");
  const hasAngle = mode === "sector" || mode === "sector-ring" || mode === "arc";
  const hasInnerRadius = mode === "ring" || mode === "sector-ring";

  return (
    <div className="property-ellipse">
      <label className="property-field">
        <span>{t("shape")}</span>
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
            <span>{t("startAngle")}</span>
            <InputNumber
              value={node.startAngle ?? -60}
              onChange={(value) => onUpdateNode(node.id, { startAngle: Number(value ?? -60) })}
            />
          </label>
          <label className="property-field">
            <span>{t("endAngle")}</span>
            <InputNumber
              value={node.endAngle ?? 180}
              onChange={(value) => onUpdateNode(node.id, { endAngle: Number(value ?? 180) })}
            />
          </label>
        </div>
      )}

      {hasInnerRadius && (
        <label className="property-field">
          <span>{t("innerRadius")}</span>
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
          <span>{t("cornerRadius")}</span>
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
