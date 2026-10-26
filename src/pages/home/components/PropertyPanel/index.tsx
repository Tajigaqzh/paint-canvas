import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Divider, Empty, Form, Input, InputNumber, Select, Space } from "antd";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import type { CharacterSelection } from "leafer-x-curved-text";
import type {
  CanvasAnimationItem,
  CanvasNode,
  CurvedTextNode,
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
  characterSelection?: CharacterSelection;
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

function CurvedTextProperty({
  node,
  characterSelection,
  onUpdateNode,
}: {
  node: CurvedTextNode;
  characterSelection?: CharacterSelection;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
}) {
  const updateLayout = (layout: Partial<CurvedTextNode["layout"]>) =>
    onUpdateNode(node.id, { layout: { ...node.layout, ...layout } });
  const updateStyle = (style: CurvedTextNode["defaultStyle"]) => {
    if (!characterSelection) {
      onUpdateNode(node.id, { defaultStyle: { ...node.defaultStyle, ...style } });
      return;
    }
    const { start, end } = characterSelection;
    const runs = [...node.styleRuns, { start, end, style }]
      .sort((left, right) => left.start - right.start)
      .map((run) => ({ ...run, style: { ...run.style } }));
    onUpdateNode(node.id, { styleRuns: runs });
  };

  return (
    <>
      <label className="property-field">
        <span>文字</span>
        <Input
          value={node.text}
          onChange={(event) => onUpdateNode(node.id, { text: event.target.value })}
        />
      </label>
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>弯曲角度</span>
          <InputNumber
            min={0}
            max={360}
            value={toPanelNumber(node.layout.bendAngle)}
            onChange={(value) => updateLayout({ bendAngle: Number(value ?? 0) })}
          />
        </label>
        <label className="property-field">
          <span>方向</span>
          <Select
            value={node.layout.direction ?? "clockwise"}
            options={[
              { label: "顺时针", value: "clockwise" },
              { label: "逆时针", value: "counterclockwise" },
            ]}
            onChange={(direction) => updateLayout({ direction })}
          />
        </label>
        <label className="property-field">
          <span>半径</span>
          <InputNumber
            min={0}
            value={toPanelNumber(node.layout.radius)}
            onChange={(value) => updateLayout({ radius: Number(value ?? 0) })}
          />
        </label>
        <label className="property-field">
          <span>起始角度</span>
          <InputNumber
            value={toPanelNumber(node.layout.startAngle)}
            onChange={(value) => updateLayout({ startAngle: Number(value ?? 0) })}
          />
        </label>
        <label className="property-field">
          <span>对齐</span>
          <Select
            value={node.layout.align ?? "center"}
            options={[
              { label: "起始", value: "start" },
              { label: "居中", value: "center" },
              { label: "结束", value: "end" },
            ]}
            onChange={(align) => updateLayout({ align })}
          />
        </label>
        <label className="property-field">
          <span>字距</span>
          <InputNumber
            value={toPanelNumber(node.layout.letterSpacing)}
            onChange={(value) => updateLayout({ letterSpacing: Number(value ?? 0) })}
          />
        </label>
      </div>
      <div className="property-grid property-grid--two">
        <label className="property-field">
          <span>字号</span>
          <InputNumber
            min={1}
            value={toPanelNumber(node.defaultStyle.fontSize)}
            onChange={(value) => updateStyle({ fontSize: Number(value ?? 1) })}
          />
        </label>
        <label className="property-field">
          <span>文字颜色</span>
          <Input
            className="property-color-input"
            type="color"
            value={(node.defaultStyle.fill as string) ?? "#111827"}
            onChange={(event) => updateStyle({ fill: event.target.value })}
          />
        </label>
      </div>
    </>
  );
}

function PropertyPanel({
  collapsed,
  canUngroup,
  node,
  onToggle,
  onUngroup,
  onUpdateNode,
  characterSelection,
}: PropertyPanelProps) {
  const { t } = useAppTranslation();
  const animationList = node?.animationList ?? [];
  const strokeStyleOptions: Array<{ label: string; value: CanvasStrokeStyle }> = [
    { label: t("solid"), value: "solid" },
    { label: t("dashed"), value: "dashed" },
    { label: t("dotted"), value: "dotted" },
  ];
  const transformOriginOptions: Array<{ label: string; value: CanvasTransformOrigin }> = [
    { label: t("topLeft"), value: "top-left" },
    { label: t("topCenter"), value: "top" },
    { label: t("topRight"), value: "top-right" },
    { label: t("middleLeft"), value: "left" },
    { label: t("center"), value: "center" },
    { label: t("middleRight"), value: "right" },
    { label: t("bottomLeft"), value: "bottom-left" },
    { label: t("bottomCenter"), value: "bottom" },
    { label: t("bottomRight"), value: "bottom-right" },
  ];

  const commitAnimationList = (list: CanvasAnimationItem[]) => {
    if (!node) return;

    onUpdateNode(node.id, { animationList: applyAnimationListRules(list) });
  };

  return (
    <aside className="canvas-maker__properties" data-collapsed={collapsed}>
      <div className="panel-title">
        {!collapsed && <span>{t("properties")}</span>}
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
                <span>{t("countElements", { count: node.childrenIds.length })}</span>
                <Button danger disabled={!canUngroup} onClick={onUngroup}>
                  {t("ungroupObjects")}
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

              {node.kind !== "text" && node.kind !== "curvedText" && node.kind !== "line" && (
                <div className="property-grid property-grid--two">
                  <label className="property-field">
                    <span>{t("width")}</span>
                    <InputNumber
                      min={1}
                      value={toPanelNumber(node.width)}
                      onChange={(value) => onUpdateNode(node.id, { width: Number(value ?? 1) })}
                    />
                  </label>
                  <label className="property-field">
                    <span>{t("height")}</span>
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
              {node.kind === "curvedText" && (
                <CurvedTextProperty
                  characterSelection={characterSelection}
                  node={node}
                  onUpdateNode={onUpdateNode}
                />
              )}

              {node.kind === "image" && (
                <label className="property-field">
                  <span>{t("imageUrl")}</span>
                  <Input
                    value={node.src}
                    onChange={(event) => onUpdateNode(node.id, { src: event.target.value })}
                  />
                </label>
              )}

              {node.kind !== "group" && node.kind !== "curvedText" && (
                <div className="property-paint">
                  <span className="property-paint__label">{t("appearance")}</span>
                  <div className="property-grid property-grid--two">
                    {node.kind !== "line" && node.kind !== "image" && (
                      <label className="property-field">
                        <span>{t("fill")}</span>
                        <Input
                          className="property-color-input"
                          type="color"
                          value={node.fill ?? getDefaultFill(node)}
                          onChange={(event) => onUpdateNode(node.id, { fill: event.target.value })}
                        />
                      </label>
                    )}
                    <label className="property-field">
                      <span>{t("outline")}</span>
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
                      <span>{t("strokeWidth")}</span>
                      <InputNumber
                        min={0}
                        value={toPanelNumber(node.strokeWidth)}
                        onChange={(value) =>
                          onUpdateNode(node.id, { strokeWidth: Number(value ?? 0) })
                        }
                      />
                    </label>
                    <label className="property-field">
                      <span>{t("strokeStyle")}</span>
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
                  <span>{t("rotation")}</span>
                  <Space.Compact className="property-unit-input">
                    <InputNumber
                      value={toPanelNumber(node.rotation)}
                      onChange={(value) => onUpdateNode(node.id, { rotation: Number(value ?? 0) })}
                    />
                    <span className="property-unit-input__suffix">deg</span>
                  </Space.Compact>
                </label>
                <label className="property-field">
                  <span>{t("origin")}</span>
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
          <Empty description={t("noElementSelected")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ))}
    </aside>
  );
}

export default PropertyPanel;
