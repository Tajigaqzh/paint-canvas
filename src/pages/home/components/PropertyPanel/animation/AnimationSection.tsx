import { useState } from "react";
import {
  DeleteOutlined,
  DownOutlined,
  HolderOutlined,
  PlusOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Empty, Form, Input, InputNumber, Select } from "antd";
import type { CanvasAnimationItem } from "@/types";
import {
  canSelectAnimationPreset,
  canUseInfiniteLoop,
  reorderAnimations,
} from "./animationOrder";
import {
  animationPresetOptions,
  createAnimationItem,
  fadeInDirectionOptions,
  fadeOutDirectionOptions,
  movePresetOptions,
  patchAnimationItem,
} from "./animationData";

type AnimationSectionProps = {
  /** 当前节点的动画列表。 */
  animationList: CanvasAnimationItem[];
  /** 把修改后的动画列表写回画布状态（外层会套用阶段顺序等规则）。 */
  commitAnimationList: (list: CanvasAnimationItem[]) => void;
};

function AnimationSection({ animationList, commitAnimationList }: AnimationSectionProps) {
  const [draggingAnimationId, setDraggingAnimationId] = useState<string>();
  const [collapsedAnimationIds, setCollapsedAnimationIds] = useState<Set<string>>(() => new Set());

  return (
    <section className="property-animation">
      <div className="property-section-title">
        <span>动画</span>
        <Button
          icon={<PlusOutlined />}
          size="small"
          onClick={() =>
            commitAnimationList([...animationList, createAnimationItem(animationList)])
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
            const isAnimationCollapsed = collapsedAnimationIds.has(animation.id);
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
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    title="删除动画"
                    onClick={() =>
                      commitAnimationList(
                        animationList.filter((item) => item.id !== animation.id),
                      )
                    }
                  />
                  <Input
                    size="small"
                    value={animation.name}
                    onChange={(event) => updateAnimation({ name: event.target.value })}
                  />
                  <Button
                    icon={isAnimationCollapsed ? <DownOutlined /> : <UpOutlined />}
                    size="small"
                    title={isAnimationCollapsed ? "展开动画" : "折叠动画"}
                    aria-label={isAnimationCollapsed ? "展开动画" : "折叠动画"}
                    onClick={() =>
                      setCollapsedAnimationIds((current) => {
                        const next = new Set(current);

                        if (next.has(animation.id)) next.delete(animation.id);
                        else next.add(animation.id);

                        return next;
                      })
                    }
                  />
                </div>
                {!isAnimationCollapsed && (
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
                          onChange={(loop) => updateAnimation({ loop: Number(loop ?? 0) })}
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
                    {animation.preset === "move" || animation.preset === "slideRight" ? (
                      <>
                        <Form.Item label="移动预设">
                          <Select
                            options={movePresetOptions}
                            value={animation.movePreset ?? "right"}
                            onChange={(movePreset) => updateAnimation({ movePreset })}
                          />
                        </Form.Item>
                        {animation.movePreset !== "custom" ? (
                          <Form.Item label="移动距离">
                            <InputNumber
                              min={0}
                              value={animation.moveDistance ?? 80}
                              onChange={(moveDistance) =>
                                updateAnimation({ moveDistance: Number(moveDistance ?? 0) })
                              }
                            />
                          </Form.Item>
                        ) : (
                          <div className="property-grid property-grid--two">
                            <Form.Item label="起始 X">
                              <InputNumber
                                value={animation.moveFromX ?? 0}
                                disabled={animation.movePreset !== "custom"}
                                onChange={(moveFromX) =>
                                  updateAnimation({ moveFromX: Number(moveFromX ?? 0) })
                                }
                              />
                            </Form.Item>
                            <Form.Item label="起始 Y">
                              <InputNumber
                                value={animation.moveFromY ?? 0}
                                disabled={animation.movePreset !== "custom"}
                                onChange={(moveFromY) =>
                                  updateAnimation({ moveFromY: Number(moveFromY ?? 0) })
                                }
                              />
                            </Form.Item>
                            <Form.Item label="结束 X">
                              <InputNumber
                                value={animation.moveToX ?? 80}
                                disabled={animation.movePreset !== "custom"}
                                onChange={(moveToX) =>
                                  updateAnimation({ moveToX: Number(moveToX ?? 0) })
                                }
                              />
                            </Form.Item>
                            <Form.Item label="结束 Y">
                              <InputNumber
                                value={animation.moveToY ?? 0}
                                disabled={animation.movePreset !== "custom"}
                                onChange={(moveToY) =>
                                  updateAnimation({ moveToY: Number(moveToY ?? 0) })
                                }
                              />
                            </Form.Item>
                          </div>
                        )}
                      </>
                    ) : null}
                  </Form>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty description="暂无动画" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </section>
  );
}

export default AnimationSection;
