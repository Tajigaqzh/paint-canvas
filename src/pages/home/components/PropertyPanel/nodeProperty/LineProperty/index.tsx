import { InputNumber, Select } from "antd";
import type { CanvasNode, CanvasStrokeCap, LineNode } from "@/types";

type LinePropertyProps = {
  node: LineNode;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

const strokeCapOptions: Array<{
  label: string;
  value: CanvasStrokeCap;
}> = [
  { label: "平头", value: "none" },
  { label: "圆头", value: "round" },
  { label: "方头", value: "square" },
];

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
  return (
    <div className="property-line">
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>长度</span>
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
          <span>端点</span>
          <Select
            options={strokeCapOptions}
            value={node.strokeCap ?? "round"}
            onChange={(strokeCap) => onUpdateNode(node.id, { strokeCap })}
          />
        </label>
      </div>
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>曲线</span>
          <Select
            options={[
              { label: "关闭", value: "off" },
              { label: "开启", value: "on" },
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
          <span>曲率</span>
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
