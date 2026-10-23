import { InputNumber } from "antd";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import type { CanvasNode, RectNode } from "@/types";
import { cornerRadiusLabels, patchCornerRadius, toCornerRadiusValues } from "./utils";

type RectPropertyProps = {
  node: RectNode;
  onUpdateNode: (id: string, data: Partial<CanvasNode>) => void;
};

function RectProperty({ node, onUpdateNode }: RectPropertyProps) {
  const { t } = useAppTranslation();
  const cornerRadiusValues = toCornerRadiusValues(node.cornerRadius);

  return (
    <div className="property-corner-radius">
      <span className="property-corner-radius__label">{t("cornerRadius")}</span>
      <div className="property-corner-radius__grid">
        {cornerRadiusLabels.map((label, index) => (
          <label className="property-corner-radius__field" key={label}>
            <span>{t(label)}</span>
            <InputNumber
              min={0}
              value={cornerRadiusValues[index]}
              onChange={(value) =>
                onUpdateNode(node.id, {
                  cornerRadius: patchCornerRadius(node.cornerRadius, index, value),
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default RectProperty;
