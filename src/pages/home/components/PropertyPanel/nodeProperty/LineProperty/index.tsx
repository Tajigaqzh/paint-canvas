import { InputNumber, Select } from "antd";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import type { CanvasNode, CanvasStrokeCap, LineNode } from "@/types";

type LinePropertyProps = {
  node: LineNode;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

const DEFAULT_CURVE = 0.2;
const CURVE_LINE_HEIGHT = 100;

const createCurvePoints = (width: number): number[] => {
  const safeWidth = Math.max(width, 1);
  const sideX = safeWidth * 0.1;
  const farX = safeWidth * 0.9;

  // Leafer 的 curve 是基于 points 折线做平滑处理，不是单独设置贝塞尔控制点。
  return [sideX, 90, sideX, 10, safeWidth * 0.5, 70, farX, 10, farX, 90];
};

function LineProperty({ node, onUpdateNode }: LinePropertyProps) {
  const { t } = useAppTranslation();
  const strokeCapOptions: Array<{ label: string; value: CanvasStrokeCap }> = [
    { label: t("butt"), value: "none" },
    { label: t("round"), value: "round" },
    { label: t("square"), value: "square" },
  ];

  return (
    <div className="property-line">
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>{t("length")}</span>
          <InputNumber
            min={1}
            value={node.width}
            onChange={(value) => {
              const width = Number(value ?? 1);

              onUpdateNode(node.id, {
                points: node.curve ? createCurvePoints(width) : undefined,
                width,
              });
            }}
          />
        </label>
        <label className="property-field">
          <span>{t("lineCap")}</span>
          <Select
            options={strokeCapOptions}
            value={node.strokeCap ?? "round"}
            onChange={(strokeCap) => onUpdateNode(node.id, { strokeCap })}
          />
        </label>
      </div>
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>{t("curve")}</span>
          <Select
            options={[
              { label: t("off"), value: "off" },
              { label: t("on"), value: "on" },
            ]}
            value={node.curve ? "on" : "off"}
            onChange={(value) =>
              onUpdateNode(node.id, {
                curve: value === "on" ? DEFAULT_CURVE : false,
                height: value === "on" ? CURVE_LINE_HEIGHT : 0,
                points: value === "on" ? createCurvePoints(node.width) : undefined,
              })
            }
          />
        </label>
        <label className="property-field">
          <span>{t("curvature")}</span>
          <InputNumber
            disabled={!node.curve}
            max={1}
            min={-1}
            step={0.1}
            value={typeof node.curve === "number" ? node.curve : DEFAULT_CURVE}
            onChange={(value) => onUpdateNode(node.id, { curve: Number(value ?? DEFAULT_CURVE) })}
          />
        </label>
      </div>
    </div>
  );
}

export default LineProperty;
