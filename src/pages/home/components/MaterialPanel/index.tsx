import {
  BorderOutlined,
  FileImageOutlined,
  LeftOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { Button, Tabs } from "antd";
import type { ReactNode } from "react";
import type { CanvasMaterialKind } from "@/types";

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
    title: "矩形",
    description: "按钮、卡片、容器",
    icon: <RectMaterialIcon />,
  },
  {
    key: "circle",
    title: "圆形",
    description: "头像、节点、徽标",
    icon: <EllipseMaterialIcon />,
  },
  {
    key: "ellipse",
    title: "椭圆",
    description: "标签、背景、装饰",
    icon: <OvalMaterialIcon />,
  },
  {
    key: "ring",
    title: "圆环",
    description: "进度、状态、图标",
    icon: <RingMaterialIcon />,
  },
  {
    key: "sector",
    title: "扇形",
    description: "饼图、角标、强调",
    icon: <SectorMaterialIcon />,
  },
  {
    key: "sector-ring",
    title: "扇形圆环",
    description: "进度段、仪表盘",
    icon: <SectorRingMaterialIcon />,
  },
  {
    key: "arc",
    title: "圆角弧线",
    description: "路径、进度、标注",
    icon: <ArcMaterialIcon />,
  },
  {
    key: "text",
    title: "文本",
    description: "标题、标签、说明",
    icon: <TextMaterialIcon />,
  },
  {
    key: "line",
    title: "线条",
    description: "分割线、连接线、标注",
    icon: <LineMaterialIcon />,
  },
  {
    key: "triangle",
    title: "三角形",
    description: "箭头、标识、图标",
    icon: <TriangleMaterialIcon />,
  },
  {
    key: "polygon",
    title: "正多边形",
    description: "徽章、图标、容器",
    icon: <PolygonMaterialIcon />,
  },
  {
    key: "star",
    title: "星形",
    description: "评级、标识、强调",
    icon: <StarMaterialIcon />,
  },
] satisfies Array<{
  key: CanvasMaterialKind;
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
  onAddNode: (kind: CanvasMaterialKind) => void;
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
