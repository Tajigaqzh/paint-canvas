import { useState } from "react";
import {
  DeleteOutlined,
  DownOutlined,
  HolderOutlined,
  PlusOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Empty, Form, Input, InputNumber, Select } from "antd";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import type { CanvasAnimationItem } from "@/types";
import { canSelectAnimationPreset, canUseInfiniteLoop, reorderAnimations } from "./animationOrder";
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
  const { t } = useAppTranslation();
  const [draggingAnimationId, setDraggingAnimationId] = useState<string>();
  const [collapsedAnimationIds, setCollapsedAnimationIds] = useState<Set<string>>(() => new Set());

  return (
    <section className="property-animation">
      <div className="property-section-title">
        <span>{t("animation")}</span>
        <Button
          icon={<PlusOutlined />}
          size="small"
          onClick={() =>
            commitAnimationList([...animationList, createAnimationItem(animationList)])
          }
        >
          {t("add")}
        </Button>
      </div>
      <p className="property-animation__hint">{t("animationOrderHint")}</p>

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
                    title={t("dragToReorder")}
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
                    title={t("deleteAnimation")}
                    onClick={() =>
                      commitAnimationList(animationList.filter((item) => item.id !== animation.id))
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
                    title={isAnimationCollapsed ? t("expandAnimation") : t("collapseAnimation")}
                    aria-label={
                      isAnimationCollapsed ? t("expandAnimation") : t("collapseAnimation")
                    }
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
                    <Form.Item label={t("type")}>
                      <Select
                        options={animationPresetOptions.map((option) => ({
                          ...option,
                          label: t(option.labelKey),
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
                      <Form.Item label={t("duration")}>
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
                      <Form.Item label={t("delayLabel")}>
                        <InputNumber
                          min={0}
                          value={animation.delay}
                          onChange={(delay) => updateAnimation({ delay: Number(delay ?? 0) })}
                        />
                      </Form.Item>
                    </div>
                    <div className="property-grid property-grid--two">
                      <Form.Item label={t("iterations")}>
                        <InputNumber
                          disabled={animation.loop < 0}
                          min={0}
                          value={animation.loop < 0 ? 0 : animation.loop}
                          onChange={(loop) => updateAnimation({ loop: Number(loop ?? 0) })}
                        />
                      </Form.Item>
                      <Form.Item label={t("infiniteLoop")}>
                        <Checkbox
                          checked={animation.loop < 0}
                          disabled={!allowInfiniteLoop}
                          onChange={(event) =>
                            updateAnimation({ loop: event.target.checked ? -1 : 0 })
                          }
                        >
                          {t("on")}
                        </Checkbox>
                      </Form.Item>
                    </div>
                    {animation.preset === "fadeIn" ? (
                      <>
                        <Form.Item label={t("fadeInDirection")}>
                          <Select
                            options={fadeInDirectionOptions.map((option) => ({
                              ...option,
                              label: t(option.labelKey),
                            }))}
                            value={animation.fadeInDirection ?? "current"}
                            onChange={(fadeInDirection) => updateAnimation({ fadeInDirection })}
                          />
                        </Form.Item>
                        {animation.fadeInDirection && animation.fadeInDirection !== "current" ? (
                          <Form.Item label={t("slideInDistance")}>
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
                        <Form.Item label={t("fadeOutDirection")}>
                          <Select
                            options={fadeOutDirectionOptions.map((option) => ({
                              ...option,
                              label: t(option.labelKey),
                            }))}
                            value={animation.fadeInDirection ?? "current"}
                            onChange={(fadeInDirection) => updateAnimation({ fadeInDirection })}
                          />
                        </Form.Item>
                        {animation.fadeInDirection && animation.fadeInDirection !== "current" ? (
                          <Form.Item label={t("slideOutDistance")}>
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
                        <Form.Item label={t("movePreset")}>
                          <Select
                            options={movePresetOptions.map((option) => ({
                              ...option,
                              label: t(option.labelKey),
                            }))}
                            value={animation.movePreset ?? "right"}
                            onChange={(movePreset) => updateAnimation({ movePreset })}
                          />
                        </Form.Item>
                        {animation.movePreset !== "custom" ? (
                          <Form.Item label={t("moveDistance")}>
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
                            <Form.Item label={t("startX")}>
                              <InputNumber
                                value={animation.moveFromX ?? 0}
                                disabled={animation.movePreset !== "custom"}
                                onChange={(moveFromX) =>
                                  updateAnimation({ moveFromX: Number(moveFromX ?? 0) })
                                }
                              />
                            </Form.Item>
                            <Form.Item label={t("startY")}>
                              <InputNumber
                                value={animation.moveFromY ?? 0}
                                disabled={animation.movePreset !== "custom"}
                                onChange={(moveFromY) =>
                                  updateAnimation({ moveFromY: Number(moveFromY ?? 0) })
                                }
                              />
                            </Form.Item>
                            <Form.Item label={t("endX")}>
                              <InputNumber
                                value={animation.moveToX ?? 80}
                                disabled={animation.movePreset !== "custom"}
                                onChange={(moveToX) =>
                                  updateAnimation({ moveToX: Number(moveToX ?? 0) })
                                }
                              />
                            </Form.Item>
                            <Form.Item label={t("endY")}>
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
        <Empty description={t("noAnimations")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </section>
  );
}

export default AnimationSection;
