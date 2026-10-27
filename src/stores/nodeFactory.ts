import { translateKey } from "@/i18n";
import { TEST_MATERIAL_IMAGE_URL } from "@/constants/materialImages";
import type { CanvasMaterialKind, CanvasNode } from "@/types";

type NodeFactoryContext = {
  id: string;
  index: number;
  serial: number;
};

/** 按素材类型创建默认节点数据；序号和 ID 由 store 统一维护。 */
export const createNode = (
  kind: CanvasMaterialKind,
  { id, index, serial }: NodeFactoryContext,
): CanvasNode => {
  const x = 180 + index * 24;
  const y = 140 + index * 20;

  if (
    kind === "circle" ||
    kind === "ellipse" ||
    kind === "ring" ||
    kind === "sector" ||
    kind === "sector-ring" ||
    kind === "arc"
  ) {
    const nameKeys = {
      arc: "arcNodeName",
      circle: "circleNodeName",
      ellipse: "ellipseNodeName",
      ring: "ringNodeName",
      sector: "sectorNodeName",
      "sector-ring": "sectorRingNodeName",
    } satisfies Record<typeof kind, string>;
    const isArc = kind === "arc";
    const isSector = kind === "sector" || kind === "sector-ring" || isArc;

    return {
      animationList: [],
      closed: !isArc,
      cornerRadius: kind === "sector-ring" ? 10 : undefined,
      ellipseMode: kind,
      endAngle: isSector ? 180 : undefined,
      fill: isArc ? "transparent" : "#32cd79",
      height: kind === "ellipse" ? 160 : 132,
      id,
      innerRadius: kind === "ring" || kind === "sector-ring" ? 0.5 : undefined,
      kind: "ellipse",
      name: translateKey(nameKeys[kind], { count: serial }),
      rotation: 0,
      startAngle: isSector ? -60 : undefined,
      stroke: isArc ? "#32cd79" : "#0f172a",
      strokeAlign: isArc ? "center" : undefined,
      strokeCap: isArc ? "round" : undefined,
      strokeStyle: "solid",
      strokeWidth: isArc ? 10 : 0,
      transformOrigin: "center",
      width: 132,
      x,
      y,
    };
  }

  if (kind === "line") {
    return {
      animationList: [],
      curve: false,
      fill: "transparent",
      height: 0,
      id,
      kind,
      name: translateKey("lineCount", { count: serial }),
      source: "material",
      rotation: 0,
      stroke: "#32cd79",
      strokeCap: "round",
      strokeStyle: "solid",
      strokeWidth: 8,
      transformOrigin: "center",
      width: 180,
      x,
      y,
    };
  }

  if (kind === "triangle" || kind === "polygon") {
    return {
      animationList: [],
      cornerRadius: 0,
      fill: "#32cd79",
      height: 132,
      id,
      kind: "polygon",
      name: translateKey(kind === "triangle" ? "triangleCount" : "polygonCount", {
        count: serial,
      }),
      polygonMode: kind,
      rotation: 0,
      sides: kind === "triangle" ? 3 : 6,
      stroke: "#0f172a",
      strokeStyle: "solid",
      strokeWidth: 0,
      transformOrigin: "center",
      width: 132,
      x,
      y,
    };
  }

  if (kind === "star") {
    return {
      animationList: [],
      cornerRadius: 0,
      corners: 5,
      fill: "#32cd79",
      height: 132,
      id,
      innerRadius: 0.45,
      kind,
      name: translateKey("starCount", { count: serial }),
      rotation: 0,
      startAngle: -90,
      stroke: "#0f172a",
      strokeStyle: "solid",
      strokeWidth: 0,
      transformOrigin: "center",
      width: 132,
      x,
      y,
    };
  }

  if (kind === "text" || kind === "curvedText") {
    if (kind === "curvedText") {
      return {
        animationList: [],
        defaultStyle: { fill: "#172554", fontFamily: "Arial, sans-serif", fontSize: 32 },
        id,
        kind,
        layout: {
          align: "center",
          bendAngle: 90,
          direction: "clockwise",
          letterSpacing: 1,
          radius: 360,
          startAngle: -90,
        },
        name: translateKey("textCount", { count: serial }),
        rotation: 0,
        styleRuns: [],
        text: translateKey("doubleClickToEdit"),
        transformOrigin: "center",
        x,
        y,
      };
    }
    return {
      animationList: [],
      fill: "#111827",
      fontSize: 28,
      fontWeight: 600,
      lineHeight: 42,
      id,
      kind,
      name: translateKey("textCount", { count: serial }),
      rotation: 0,
      stroke: "#0f172a",
      strokeStyle: "solid",
      strokeWidth: 0,
      text: translateKey("doubleClickToEdit"),
      transformOrigin: "center",
      x,
      y,
    };
  }

  if (kind === "image") {
    return {
      animationList: [],
      height: 240,
      id,
      kind,
      name: translateKey("imageCount", { count: serial }),
      rotation: 0,
      src: TEST_MATERIAL_IMAGE_URL,
      stroke: "#0f172a",
      strokeStyle: "solid",
      strokeWidth: 0,
      transformOrigin: "center",
      width: 360,
      x,
      y,
    };
  }

  return {
    animationList: [],
    cornerRadius: 12,
    fill: "#4f46e5",
    height: 112,
    id,
    kind: "rect",
    name: translateKey("rectangleCount", { count: serial }),
    rotation: 0,
    stroke: "#0f172a",
    strokeStyle: "solid",
    strokeWidth: 0,
    transformOrigin: "center",
    width: 180,
    x,
    y,
  };
};
