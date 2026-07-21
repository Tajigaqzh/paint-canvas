import { DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Divider, Empty, Form, Input, InputNumber, Select, Space } from "antd";
import type {
  CanvasAnimationItem,
  CanvasAnimationPreset,
  CanvasNode,
  CanvasStrokeStyle,
  CanvasTransformOrigin,
} from "@/types";
import CircleProperty from "./nodeProperty/CircleProperty";
import LineProperty from "./nodeProperty/LineProperty";
import PolygonProperty from "./nodeProperty/PolygonProperty";
import RectProperty from "./nodeProperty/RectProperty";
import StarProperty from "./nodeProperty/StarProperty";

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

const animationPresetOptions: Array<{
  label: string;
  value: CanvasAnimationPreset;
}> = [
  { label: "淡入", value: "fadeIn" },
  { label: "右移", value: "slideRight" },
  { label: "旋转", value: "rotate" },
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

const createAnimationData = (
  preset: CanvasAnimationPreset,
  duration: number,
  delay: number,
  loop: number,
): CanvasAnimationItem["animation"] => {
  if (preset === "rotate") {
    return {
      delay,
      duration,
      keyframes: [{ style: { rotation: 0 } }, { style: { rotation: 360 }, duration }],
      loop,
    };
  }

  if (preset === "slideRight") {
    return {
      delay,
      duration,
      loop,
      style: { x: 80 },
    };
  }

  return {
    delay,
    duration,
    loop,
    style: { opacity: 1 },
  };
};

const createAnimationItem = (): CanvasAnimationItem => {
  const preset = "fadeIn";
  const duration = 600;
  const delay = 0;
  const loop = 0;

  return {
    animation: createAnimationData(preset, duration, delay, loop),
    delay,
    duration,
    id: `animation-${Date.now()}`,
    loop,
    name: "淡入动画",
    preset,
    seek: 0,
  };
};

const patchAnimationItem = (item: CanvasAnimationItem, data: Partial<CanvasAnimationItem>) => {
  const next = { ...item, ...data };

  return {
    ...next,
    animation: createAnimationData(next.preset, next.duration, next.delay, next.loop),
  };
};

function PropertyPanel({
  collapsed,
  canUngroup,
  node,
  onToggle,
  onUngroup,
  onUpdateNode,
}: PropertyPanelProps) {
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

              {node.kind !== "group" && (
                <div className="property-paint">
                  <span className="property-paint__label">外观</span>
                  <div className="property-grid property-grid--two">
                    {node.kind !== "line" && (
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

            <section className="property-animation">
              <div className="property-section-title">
                <span>动画</span>
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() =>
                    onUpdateNode(node.id, {
                      animationList: [...(node.animationList ?? []), createAnimationItem()],
                    })
                  }
                >
                  添加
                </Button>
              </div>

              {node.animationList?.length ? (
                <div className="property-animation__list">
                  {node.animationList.map((animation) => {
                    const updateAnimation = (data: Partial<CanvasAnimationItem>) => {
                      onUpdateNode(node.id, {
                        animationList: node.animationList?.map((item) =>
                          item.id === animation.id ? patchAnimationItem(item, data) : item,
                        ),
                      });
                    };

                    return (
                      <div className="property-animation__item" key={animation.id}>
                        <div className="property-animation__header">
                          <Input
                            value={animation.name}
                            onChange={(event) => updateAnimation({ name: event.target.value })}
                          />
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            onClick={() =>
                              onUpdateNode(node.id, {
                                animationList: node.animationList?.filter(
                                  (item) => item.id !== animation.id,
                                ),
                              })
                            }
                          />
                        </div>
                        <Form layout="vertical" size="small">
                          <Form.Item label="类型">
                            <Select
                              options={animationPresetOptions}
                              value={animation.preset}
                              onChange={(preset) => updateAnimation({ preset })}
                            />
                          </Form.Item>
                          <div className="property-grid property-grid--two">
                            <Form.Item label="时长">
                              <InputNumber
                                min={0}
                                value={animation.duration}
                                onChange={(duration) =>
                                  updateAnimation({
                                    duration: Number(duration ?? 0),
                                  })
                                }
                              />
                            </Form.Item>
                            <Form.Item label="延时">
                              <InputNumber
                                min={0}
                                value={animation.delay}
                                onChange={(delay) => updateAnimation({ delay: Number(delay ?? 0) })}
                              />
                            </Form.Item>
                          </div>
                          <div className="property-grid property-grid--two">
                            <Form.Item label="循环">
                              <InputNumber
                                value={animation.loop}
                                onChange={(loop) => updateAnimation({ loop: Number(loop ?? 0) })}
                              />
                            </Form.Item>
                            <Form.Item label="Seek">
                              <InputNumber
                                max={1}
                                min={0}
                                step={0.1}
                                value={animation.seek}
                                onChange={(seek) => updateAnimation({ seek: Number(seek ?? 0) })}
                              />
                            </Form.Item>
                          </div>
                        </Form>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty description="暂无动画" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </section>
          </div>
        ) : (
          <Empty description="未选择元素" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ))}
    </aside>
  );
}

export default PropertyPanel;
