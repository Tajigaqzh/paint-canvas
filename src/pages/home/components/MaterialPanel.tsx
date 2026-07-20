import {
  BorderOutlined,
  FileImageOutlined,
  LeftOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { Button, Tabs } from "antd";
import type { ReactNode } from "react";
import type { CanvasNodeKind } from "../types";

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

const TextMaterialIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48">
    <path d="M12 12h24v5h-9v19h-6V17h-9z" />
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
    title: "矩形",
    description: "按钮、卡片、容器",
    icon: <RectMaterialIcon />,
  },
  {
    key: "ellipse",
    title: "圆形",
    description: "头像、节点、徽标",
    icon: <EllipseMaterialIcon />,
  },
  {
    key: "text",
    title: "文本",
    description: "标题、标签、说明",
    icon: <TextMaterialIcon />,
  },
] satisfies Array<{
  key: Exclude<CanvasNodeKind, "group">;
  title: string;
  description: string;
  icon: ReactNode;
}>;

const imageMaterials = [
  {
    key: "upload",
    title: "上传图片",
    description: "导入本地图片素材",
    icon: <ImageMaterialIcon />,
  },
  {
    key: "placeholder",
    title: "图片占位",
    description: "预留图片容器",
    icon: <ImageMaterialIcon />,
  },
];

type MaterialPanelProps = {
  /** 素材栏是否收起。 */
  collapsed: boolean;
  /** 添加素材节点到画布。 */
  onAddNode: (kind: Exclude<CanvasNodeKind, "group">) => void;
  /** 收起或展开素材栏。 */
  onToggle: () => void;
};

function MaterialPanel({ collapsed, onAddNode, onToggle }: MaterialPanelProps) {
  const tabItems = [
    {
      children: (
        <div className="material-tab-content">
          {materials.map((material) => (
            <button
              className="material-item"
              key={material.key}
              title={material.title}
              type="button"
              onClick={() => onAddNode(material.key)}
            >
              <span className="material-item__icon">{material.icon}</span>
            </button>
          ))}
        </div>
      ),
      key: "basic",
      label: "基础图形",
      icon: <BorderOutlined />,
    },
    {
      children: (
        <div className="material-tab-content">
          {imageMaterials.map((material) => (
            <button
              className="material-item"
              key={material.key}
              title={material.title}
              type="button"
              disabled
            >
              <span className="material-item__icon">{material.icon}</span>
            </button>
          ))}
        </div>
      ),
      key: "images",
      label: "图片素材",
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
          <span>素材</span>
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
