import { useState } from "react";
import { DeleteOutlined, HolderOutlined, LeftOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Checkbox, Divider, Empty, Form, Input, InputNumber, Select, Space } from "antd";
import type {
  CanvasAnimationItem,
  CanvasAnimationPreset,
  CanvasFadeInDirection,
  CanvasNode,
  CanvasStrokeStyle,
  CanvasTransformOrigin,
} from "@/types";
import {
  applyAnimationListRules,
  canSelectAnimationPreset,
  canUseInfiniteLoop,
  reorderAnimations,
} from "./animationOrder";
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
  { label: "淡出", value: "fadeOut" },
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

const fadeInDirectionOptions: Array<{
  label: string;
  value: CanvasFadeInDirection;
}> = [
  { label: "从当前位置", value: "current" },
  { label: "从左边", value: "left" },
  { label: "从上边", value: "top" },
  { label: "从下边", value: "bottom" },
];

const fadeOutDirectionOptions: Array<{
  label: string;
  value: CanvasFadeInDirection;
}> = [
  { label: "在当前位置", value: "current" },
  { label: "向左边", value: "left" },
  { label: "向上边", value: "top" },
  { label: "向下边", value: "bottom" },
];

const getFadeOffset = (direction: CanvasFadeInDirection, distance: number) => {
  if (direction === "left") return { offsetX: -distance };
  if (direction === "top") return { offsetY: -distance };
  if (direction === "bottom") return { offsetY: distance };

  return {};
};

const createAnimationData = (
  item: Pick<
    CanvasAnimationItem,
    | "delay"
    | "duration"
    | "fadeInDirection"
    | "fadeInDistance"
    | "loop"
    | "preset"
    | "slideFromX"
    | "slideToX"
  >,
): CanvasAnimationItem["animation"] => {
  const { delay, duration, loop, preset } = item;

  if (preset === "rotate") {
    return {
      delay,
      duration,
      keyframes: [{ style: { rotation: 0 } }, { style: { rotation: 360 } }],
      loop,
    };
  }

  if (preset === "slideRight") {
    return {
      delay,
      duration,
      keyframes: [
        { style: { offsetX: item.slideFromX ?? 0 } },
        { style: { offsetX: item.slideToX ?? 80 } },
      ],
      loop,
    };
  }

  if (preset === "fadeOut") {
    const fadeOutDirection = item.fadeInDirection ?? "current";
    const fadeOutDistance = item.fadeInDistance ?? 80;
    const fadeOutOffset = getFadeOffset(fadeOutDirection, fadeOutDistance);

    return {
      delay,
      duration,
      keyframes: [
        { style: { opacity: 1, offsetX: 0, offsetY: 0 } },
        { style: { opacity: 0, ...fadeOutOffset } },
      ],
      loop,
    };
  }

  const fadeInDirection = item.fadeInDirection ?? "current";
  const fadeInDistance = item.fadeInDistance ?? 80;
  const fadeInOffset = getFadeOffset(fadeInDirection, fadeInDistance);

  return {
    delay,
    duration,
    keyframes: [
      { style: { opacity: 0, ...fadeInOffset } },
      { style: { opacity: 1, offsetX: 0, offsetY: 0 } },
    ],
    loop,
  };
};

const getAnimationName = (preset: CanvasAnimationPreset) => {
  if (preset === "fadeOut") return "淡出动画";
  if (preset === "slideRight") return "右移动画";
  if (preset === "rotate") return "旋转动画";

  return "淡入动画";
};

const createAnimationItem = (list: CanvasAnimationItem[]): CanvasAnimationItem => {
  const preset: CanvasAnimationPreset = list.some((item) => item.preset === "fadeIn")
    ? "slideRight"
    : "fadeIn";
  const item: Omit<CanvasAnimationItem, "animation"> = {
    delay: 0,
    duration: 600,
    fadeInDirection: "current",
    fadeInDistance: 80,
    id: `animation-${Date.now()}`,
    loop: 0,
    name: getAnimationName(preset),
    preset,
  };

  return {
    ...item,
    animation: createAnimationData(item),
  };
};

const patchAnimationItem = (item: CanvasAnimationItem, data: Partial<CanvasAnimationItem>) => {
  const next: CanvasAnimationItem = { ...item, ...data };

  if (next.preset === "slideRight") {
    next.slideFromX = next.slideFromX ?? 0;
    next.slideToX = next.slideToX ?? 80;
  }

  if (next.preset === "fadeIn" || next.preset === "fadeOut") {
    next.fadeInDirection = next.fadeInDirection ?? "current";
    next.fadeInDistance = next.fadeInDistance ?? 80;
  }

  if (data.preset && data.preset !== item.preset && item.name === getAnimationName(item.preset)) {
    next.name = getAnimationName(next.preset);
  }

  return {
    ...next,
    animation: createAnimationData(next),
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
  const [draggingAnimationId, setDraggingAnimationId] = useState<string>();
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

            <section className="property-animation">
              <div className="property-section-title">
                <span>动画</span>
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() =>
                    commitAnimationList([
                      ...animationList,
                      createAnimationItem(animationList),
                    ])
                  }
                >
                  添加
                </Button>
              </div>
              <p className="property-animation__hint">
                淡入最先播放，移动和旋转居中，淡出最后。可拖动手柄调整同阶段顺序。
              </p>

              {animationList.length ? (
                <div className="property-animation__list">
                  {animationList.map((animation, index) => {
                    const allowInfiniteLoop = canUseInfiniteLoop(animationList, animation.id);
                    const updateAnimation = (data: Partial<CanvasAnimationItem>) => {
                      commitAnimationList(
                        animationList.map((item) =>
                          item.id === animation.id ? patchAnimationItem(item, data) : item,
                        ),
                      );
                    };

                    return (
                      <div
                        className="property-animation__item"
                        data-dragging={draggingAnimationId === animation.id}
                        key={animation.id}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const fromId = event.dataTransfer.getData("text/plain");
                          const from = animationList.findIndex((item) => item.id === fromId);

                          commitAnimationList(reorderAnimations(animationList, from, index));
                          setDraggingAnimationId(undefined);
                        }}
                      >
                        <div className="property-animation__header">
                          <span
                            className="property-animation__drag"
                            draggable
                            title="拖动排序"
                            onDragEnd={() => setDraggingAnimationId(undefined)}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", animation.id);
                              setDraggingAnimationId(animation.id);
                            }}
                          >
                            <HolderOutlined />
                          </span>
                          <Input
                            size="small"
                            value={animation.name}
                            onChange={(event) => updateAnimation({ name: event.target.value })}
                          />
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            onClick={() =>
                              commitAnimationList(
                                animationList.filter((item) => item.id !== animation.id),
                              )
                            }
                          />
                        </div>
                        <Form layout="vertical" size="small">
                          <Form.Item label="类型">
                            <Select
                              options={animationPresetOptions.map((option) => ({
                                ...option,
                                disabled: !canSelectAnimationPreset(
                                  animationList,
                                  animation.id,
                                  option.value,
                                ),
                              }))}
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
                                onChange={(delay) =>
                                  updateAnimation({ delay: Number(delay ?? 0) })
                                }
                              />
                            </Form.Item>
                          </div>
                          <div className="property-grid property-grid--two">
                            <Form.Item label="循环次数">
                              <InputNumber
                                disabled={animation.loop < 0}
                                min={0}
                                value={animation.loop < 0 ? 0 : animation.loop}
                                onChange={(loop) =>
                                  updateAnimation({ loop: Number(loop ?? 0) })
                                }
                              />
                            </Form.Item>
                            <Form.Item label="无限循环">
                              <Checkbox
                                checked={animation.loop < 0}
                                disabled={!allowInfiniteLoop}
                                onChange={(event) =>
                                  updateAnimation({ loop: event.target.checked ? -1 : 0 })
                                }
                              >
                                开启
                              </Checkbox>
                            </Form.Item>
                          </div>
                          {animation.preset === "fadeIn" ? (
                            <>
                              <Form.Item label="淡入方向">
                                <Select
                                  options={fadeInDirectionOptions}
                                  value={animation.fadeInDirection ?? "current"}
                                  onChange={(fadeInDirection) =>
                                    updateAnimation({ fadeInDirection })
                                  }
                                />
                              </Form.Item>
                              {animation.fadeInDirection &&
                              animation.fadeInDirection !== "current" ? (
                                <Form.Item label="滑入距离">
                                  <InputNumber
                                    min={0}
                                    value={animation.fadeInDistance ?? 80}
                                    onChange={(fadeInDistance) =>
                                      updateAnimation({
                                        fadeInDistance: Number(fadeInDistance ?? 0),
                                      })
                                    }
                                  />
                                </Form.Item>
                              ) : null}
                            </>
                          ) : null}
                          {animation.preset === "fadeOut" ? (
                            <>
                              <Form.Item label="淡出方向">
                                <Select
                                  options={fadeOutDirectionOptions}
                                  value={animation.fadeInDirection ?? "current"}
                                  onChange={(fadeInDirection) =>
                                    updateAnimation({ fadeInDirection })
                                  }
                                />
                              </Form.Item>
                              {animation.fadeInDirection &&
                              animation.fadeInDirection !== "current" ? (
                                <Form.Item label="滑出距离">
                                  <InputNumber
                                    min={0}
                                    value={animation.fadeInDistance ?? 80}
                                    onChange={(fadeInDistance) =>
                                      updateAnimation({
                                        fadeInDistance: Number(fadeInDistance ?? 0),
                                      })
                                    }
                                  />
                                </Form.Item>
                              ) : null}
                            </>
                          ) : null}
                          {animation.preset === "slideRight" ? (
                            <div className="property-grid property-grid--two">
                              <Form.Item label="起始 X">
                                <InputNumber
                                  value={animation.slideFromX ?? 0}
                                  onChange={(slideFromX) =>
                                    updateAnimation({ slideFromX: Number(slideFromX ?? 0) })
                                  }
                                />
                              </Form.Item>
                              <Form.Item label="结束 X">
                                <InputNumber
                                  value={animation.slideToX ?? 80}
                                  onChange={(slideToX) =>
                                    updateAnimation({ slideToX: Number(slideToX ?? 0) })
                                  }
                                />
                              </Form.Item>
                            </div>
                          ) : null}
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
