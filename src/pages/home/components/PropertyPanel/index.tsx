import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Divider, Empty, Form, Input, InputNumber, Select, Space } from "antd";
import type {
  CanvasAnimationItem,
  CanvasNode,
  CanvasStrokeStyle,
  CanvasTransformOrigin,
} from "@/types";
import CircleProperty from "./nodeProperty/CircleProperty";
import LineProperty from "./nodeProperty/LineProperty";
import PolygonProperty from "./nodeProperty/PolygonProperty";
import RectProperty from "./nodeProperty/RectProperty";
import StarProperty from "./nodeProperty/StarProperty";
import AnimationSection from "./animation/AnimationSection";
import { applyAnimationListRules } from "./animation/animationOrder";

type PropertyPanelProps = {
  /** 属性栏是否收起。 */
  collapsed: boolean;
  /** 当前选区是否包含可解开的组。 */
  canUngroup: boolean;
  /** 当前属性面板展示的主选中节点。 */
  node?: CanvasNode;
  /** 收起或展开属性栏。 */
  onToggle: () => void;
  /** 解开当前选中的组，和右键菜单共用同一个 store action。 */
  onUngroup: () => void;
  /** 将属性面板变更写入画布状态。 */
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

const toPanelNumber = (value: number | undefined) => Math.round(value ?? 0);

const getDefaultFill = (node: CanvasNode) => {
  if (node.kind === "ellipse") return "#14b8a6";
  if (node.kind === "line") return "#ffffff";
  if (node.kind === "polygon") return "#32cd79";
  if (node.kind === "star") return "#32cd79";
  if (node.kind === "text") return "#111827";
  if (node.kind === "rect") return "#4f46e5";

  return "#ffffff";
};

const strokeStyleOptions: Array<{
  label: string;
  value: CanvasStrokeStyle;
}> = [
  { label: "实线", value: "solid" },
  { label: "虚线", value: "dashed" },
  { label: "点线", value: "dotted" },
];

const transformOriginOptions: Array<{
  label: string;
  value: CanvasTransformOrigin;
}> = [
  { label: "左上", value: "top-left" },
  { label: "上中", value: "top" },
  { label: "右上", value: "top-right" },
  { label: "左中", value: "left" },
  { label: "中心", value: "center" },
  { label: "右中", value: "right" },
  { label: "左下", value: "bottom-left" },
  { label: "下中", value: "bottom" },
  { label: "右下", value: "bottom-right" },
];

function PropertyPanel({
  collapsed,
  canUngroup,
  node,
  onToggle,
  onUngroup,
  onUpdateNode,
}: PropertyPanelProps) {
  const animationList = node?.animationList ?? [];

  const commitAnimationList = (list: CanvasAnimationItem[]) => {
    if (!node) return;

    onUpdateNode(node.id, { animationList: applyAnimationListRules(list) });
  };

  return (
    <aside className="canvas-maker__properties" data-collapsed={collapsed}>
      <div className="panel-title">
        {!collapsed && <span>属性</span>}
        <Button
          type="text"
          icon={collapsed ? <LeftOutlined /> : <RightOutlined />}
          onClick={onToggle}
        />
      </div>

      {!collapsed &&
        (node ? (
          <div className="property-content">
            <strong>{node.name}</strong>
            {node.kind === "group" && (
              <div className="property-group-actions">
                <span>{node.childrenIds.length} 个元素</span>
                <Button danger disabled={!canUngroup} onClick={onUngroup}>
                  解组
                </Button>
              </div>
            )}
            <Divider />
            <Form className="property-basic-form" layout="vertical" size="middle">
              <div className="property-grid property-grid--two">
                <label className="property-field">
                  <span>X</span>
                  <InputNumber
                    value={toPanelNumber(node.x)}
                    onChange={(value) => onUpdateNode(node.id, { x: Number(value ?? 0) })}
                  />
                </label>
                <label className="property-field">
                  <span>Y</span>
                  <InputNumber
                    value={toPanelNumber(node.y)}
                    onChange={(value) => onUpdateNode(node.id, { y: Number(value ?? 0) })}
                  />
                </label>
              </div>

              {node.kind !== "text" && node.kind !== "line" && (
                <div className="property-grid property-grid--two">
                  <label className="property-field">
                    <span>宽</span>
                    <InputNumber
                      min={1}
                      value={toPanelNumber(node.width)}
                      onChange={(value) => onUpdateNode(node.id, { width: Number(value ?? 1) })}
                    />
                  </label>
                  <label className="property-field">
                    <span>高</span>
                    <InputNumber
                      min={1}
                      value={toPanelNumber(node.height)}
                      onChange={(value) => onUpdateNode(node.id, { height: Number(value ?? 1) })}
                    />
                  </label>
                </div>
              )}

              {node.kind === "rect" && <RectProperty node={node} onUpdateNode={onUpdateNode} />}
              {node.kind === "ellipse" && (
                <CircleProperty node={node} onUpdateNode={onUpdateNode} />
              )}
              {node.kind === "line" && <LineProperty node={node} onUpdateNode={onUpdateNode} />}
              {node.kind === "polygon" && (
                <PolygonProperty node={node} onUpdateNode={onUpdateNode} />
              )}
              {node.kind === "star" && <StarProperty node={node} onUpdateNode={onUpdateNode} />}

              {node.kind === "image" && (
                <label className="property-field">
                  <span>图片地址</span>
                  <Input
                    value={node.src}
                    onChange={(event) => onUpdateNode(node.id, { src: event.target.value })}
                  />
                </label>
              )}

              {node.kind !== "group" && (
                <div className="property-paint">
                  <span className="property-paint__label">外观</span>
                  <div className="property-grid property-grid--two">
                    {node.kind !== "line" && node.kind !== "image" && (
                      <label className="property-field">
                        <span>填充</span>
                        <Input
                          className="property-color-input"
                          type="color"
                          value={node.fill ?? getDefaultFill(node)}
                          onChange={(event) => onUpdateNode(node.id, { fill: event.target.value })}
                        />
                      </label>
                    )}
                    <label className="property-field">
                      <span>描边</span>
                      <Input
                        className="property-color-input"
                        type="color"
                        value={node.stroke ?? "#0f172a"}
                        onChange={(event) => onUpdateNode(node.id, { stroke: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="property-grid property-grid--two">
                    <label className="property-field">
                      <span>线宽</span>
                      <InputNumber
                        min={0}
                        value={toPanelNumber(node.strokeWidth)}
                        onChange={(value) =>
                          onUpdateNode(node.id, { strokeWidth: Number(value ?? 0) })
                        }
                      />
                    </label>
                    <label className="property-field">
                      <span>线型</span>
                      <Select
                        options={strokeStyleOptions}
                        value={node.strokeStyle ?? "solid"}
                        onChange={(strokeStyle) => onUpdateNode(node.id, { strokeStyle })}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="property-grid property-grid--two">
                <label className="property-field">
                  <span>旋转</span>
                  <Space.Compact className="property-unit-input">
                    <InputNumber
                      value={toPanelNumber(node.rotation)}
                      onChange={(value) => onUpdateNode(node.id, { rotation: Number(value ?? 0) })}
                    />
                    <span className="property-unit-input__suffix">deg</span>
                  </Space.Compact>
                </label>
                <label className="property-field">
                  <span>基准</span>
                  <Select
                    options={transformOriginOptions}
                    value={node.transformOrigin ?? "center"}
                    onChange={(transformOrigin) => onUpdateNode(node.id, { transformOrigin })}
                  />
                </label>
              </div>
            </Form>

            <Divider />

            <AnimationSection
              animationList={animationList}
              commitAnimationList={commitAnimationList}
            />
          </div>
        ) : (
          <Empty description="未选择元素" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ))}
    </aside>
  );
}

export default PropertyPanel;
