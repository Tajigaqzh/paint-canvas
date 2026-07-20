import { createElement, lazy } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";

const routeErrorElement = createElement(
  "div",
  { style: { padding: 24 } },
  createElement("h1", null, "页面运行异常"),
  createElement("p", null, "请刷新页面重试，或检查最近一次画布配置。"),
);

export const routes: RouteObject[] = [
  {
    errorElement: routeErrorElement,
    path: "/",
    element: createElement(lazy(() => import("@/pages/home"))),
  },
];

export const router = createBrowserRouter(routes);
