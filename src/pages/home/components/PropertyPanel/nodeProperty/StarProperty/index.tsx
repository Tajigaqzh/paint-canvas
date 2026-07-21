import { InputNumber } from "antd";
import type { CanvasNode, StarNode } from "@/types";

type StarPropertyProps = {
  node: StarNode;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

function StarProperty({ node, onUpdateNode }: StarPropertyProps) {
  return (
    <div className="property-star">
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>角数</span>
          <InputNumber
            max={12}
            min={3}
            value={node.corners}
            onChange={(value) => onUpdateNode(node.id, { corners: Number(value ?? 5) })}
          />
        </label>
        <label className="property-field">
          <span>内径</span>
          <InputNumber
            max={0.9}
            min={0.1}
            step={0.05}
            value={node.innerRadius ?? 0.45}
            onChange={(value) => onUpdateNode(node.id, { innerRadius: Number(value ?? 0.45) })}
          />
        </label>
      </div>
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>起角</span>
          <InputNumber
            value={node.startAngle ?? -90}
            onChange={(value) => onUpdateNode(node.id, { startAngle: Number(value ?? -90) })}
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

export default StarProperty;
