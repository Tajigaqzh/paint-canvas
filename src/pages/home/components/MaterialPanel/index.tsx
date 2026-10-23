import {
  BorderOutlined,
  FileImageOutlined,
  LeftOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { Button, Tabs } from "antd";
import type { ReactNode } from "react";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import { TEST_MATERIAL_IMAGE_URL } from "@/constants/materialImages";
import type { CanvasMaterialKind } from "@/types";
import { MATERIAL_DRAG_MIME, setDraggingMaterialKind } from "../../materialDrop";

const RectMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <rect x="8" y="12" width="32" height="24" rx="4" />
  </svg>
);

const EllipseMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="15" />
  </svg>
);

const OvalMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <ellipse cx="24" cy="24" rx="16" ry="11" />
  </svg>
);

const RingMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" fillRule="evenodd">
    <path d="M24 8a16 16 0 1 1 0 32 16 16 0 0 1 0-32Zm0 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
  </svg>
);

const SectorMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <path d="M24 24V8a16 16 0 0 1 13.9 23.9Z" />
  </svg>
);

const SectorRingMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" fillRule="evenodd">
    <path d="M24 24V8a16 16 0 0 1 13.9 23.9l-7.8-4.5A7 7 0 0 0 24 17Z" />
  </svg>
);

const ArcMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" fill="none">
    <path
      d="M32 10.1A16 16 0 0 1 8 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="7"
    />
  </svg>
);

const TextMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <path d="M12 12h24v5h-9v19h-6V17h-9z" />
  </svg>
);

const LineMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" fill="none">
    <path d="M10 34L38 14" stroke="currentColor" strokeLinecap="round" strokeWidth="6" />
  </svg>
);

const TriangleMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <path d="M24 9l17 30H7z" />
  </svg>
);

const PolygonMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <path d="M24 7l15 8.5v17L24 41 9 32.5v-17z" />
  </svg>
);

const StarMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <path d="M24 6l5.2 11 11.8 1.7-8.5 8.3 2 11.8L24 33.2 13.5 38.8l2-11.8L7 18.7 18.8 17z" />
  </svg>
);

const ImageMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <rect x="8" y="10" width="32" height="28" rx="4" />
    <circle cx="19" cy="20" r="4" />
    <path d="M12 34l9-9 6 6 5-5 5 8z" />
  </svg>
);

const materials = [
  {
    key: "rect",
    titleKey: "rectangle",
    icon: <RectMaterialIcon />,
  },
  {
    key: "circle",
    titleKey: "circle",
    icon: <EllipseMaterialIcon />,
  },
  {
    key: "ellipse",
    titleKey: "ellipse",
    icon: <OvalMaterialIcon />,
  },
  {
    key: "ring",
    titleKey: "ring",
    icon: <RingMaterialIcon />,
  },
  {
    key: "sector",
    titleKey: "sector",
    icon: <SectorMaterialIcon />,
  },
  {
    key: "sector-ring",
    titleKey: "sectorRing",
    icon: <SectorRingMaterialIcon />,
  },
  {
    key: "arc",
    titleKey: "arc",
    icon: <ArcMaterialIcon />,
  },
  {
    key: "text",
    titleKey: "text",
    icon: <TextMaterialIcon />,
  },
  {
    key: "line",
    titleKey: "line",
    icon: <LineMaterialIcon />,
  },
  {
    key: "triangle",
    titleKey: "triangle",
    icon: <TriangleMaterialIcon />,
  },
  {
    key: "polygon",
    titleKey: "polygon",
    icon: <PolygonMaterialIcon />,
  },
  {
    key: "star",
    titleKey: "star",
    icon: <StarMaterialIcon />,
  },
] satisfies Array<{
  key: CanvasMaterialKind;
  titleKey: string;
  icon: ReactNode;
}>;

const imageMaterials = [
  {
    key: "image",
    titleKey: "sampleImage",
    previewUrl: TEST_MATERIAL_IMAGE_URL,
  },
  {
    key: "upload",
    titleKey: "uploadImage",
    icon: <ImageMaterialIcon />,
  },
] as const;

type MaterialPanelProps = {
  /** 素材栏是否收起。 */
  collapsed: boolean;
  /** 添加素材节点到画布。 */
  onAddNode: (kind: CanvasMaterialKind) => void;
  /** 收起或展开素材栏。 */
  onToggle: () => void;
};

function MaterialPanel({ collapsed, onAddNode, onToggle }: MaterialPanelProps) {
  const { t } = useAppTranslation();
  const tabItems = [
    {
      children: (
        <div className="material-tab-content">
          {materials.map((material) => (
            <button
              className="material-item"
              draggable
              key={material.key}
              title={t(material.titleKey)}
              type="button"
              onClick={() => onAddNode(material.key)}
              onDragEnd={() => setDraggingMaterialKind(undefined)}
              onDragStart={(event) => {
                setDraggingMaterialKind(material.key);
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(MATERIAL_DRAG_MIME, material.key);
                event.dataTransfer.setData("text/plain", material.key);
              }}
            >
              <span className="material-item__icon">{material.icon}</span>
            </button>
          ))}
        </div>
      ),
      key: "basic",
      label: t("basicShapes"),
      icon: <BorderOutlined />,
    },
    {
      children: (
        <div className="material-tab-content">
          {imageMaterials.map((material) => (
            <button
              className="material-item"
              data-preview={"previewUrl" in material ? "image" : undefined}
              draggable={material.key === "image"}
              key={material.key}
              title={t(material.titleKey)}
              type="button"
              disabled={material.key !== "image"}
              onClick={() => {
                if (material.key === "image") onAddNode("image");
              }}
              onDragEnd={() => setDraggingMaterialKind(undefined)}
              onDragStart={(event) => {
                if (material.key !== "image") return;
                setDraggingMaterialKind("image");
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(MATERIAL_DRAG_MIME, "image");
                event.dataTransfer.setData("text/plain", "image");
              }}
            >
              {"previewUrl" in material ? (
                <img
                  alt={t(material.titleKey)}
                  className="material-item__preview"
                  referrerPolicy="no-referrer"
                  src={material.previewUrl}
                />
              ) : (
                <span className="material-item__icon">{material.icon}</span>
              )}
            </button>
          ))}
        </div>
      ),
      key: "images",
      label: t("imageAssets"),
      icon: <FileImageOutlined />,
    },
  ];

  return (
    <aside className="canvas-maker__materials" data-collapsed={collapsed}>
      {collapsed ? (
        <Button
          className="panel-collapsed-button"
          type="text"
          icon={<PictureOutlined />}
          onClick={onToggle}
        />
      ) : (
        <div className="panel-title">
          <span>{t("assets")}</span>
          <Button type="text" icon={<LeftOutlined />} onClick={onToggle} />
        </div>
      )}

      {!collapsed && (
        <div className="material-list">
          <Tabs defaultActiveKey="basic" type="card" items={tabItems} />
        </div>
      )}
    </aside>
  );
}

export default MaterialPanel;
