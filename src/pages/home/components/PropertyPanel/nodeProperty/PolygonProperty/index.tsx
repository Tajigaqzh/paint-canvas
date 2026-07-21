import { InputNumber } from "antd";
import type { CanvasNode, PolygonNode } from "@/types";

type PolygonPropertyProps = {
  node: PolygonNode;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

function PolygonProperty({ node, onUpdateNode }: PolygonPropertyProps) {
  return (
    <div className="property-polygon">
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>边数</span>
          <InputNumber
            max={12}
            min={3}
            value={node.sides}
            onChange={(value) => onUpdateNode(node.id, { sides: Number(value ?? 3) })}
          />
        </label>
        <label className="property-field">
          <span>圆角</span>
          <InputNumber
            min={0}
            value={node.cornerRadius ?? 0}
            onChange={(value) => onUpdateNode(node.id, { cornerRadius: Number(value ?? 0) })}
          />
        </label>
      </div>
    </div>
  );
}

export default PolygonProperty;
