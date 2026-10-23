import { createElement, lazy, type ReactNode } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { useAuthSession } from "@/api/session";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import "@/i18n";

function RouteErrorPage() {
  const { t } = useAppTranslation();

  return createElement(
    "div",
    { style: { padding: 24 } },
    createElement("h1", null, t("pageError")),
    createElement("p", null, t("routeErrorHint")),
  );
}

const routeErrorElement = createElement(RouteErrorPage);
const LoginPage = lazy(() => import("@/pages/login"));
const WorksPage = lazy(() => import("@/pages/works"));
const HomePage = lazy(() => import("@/pages/home"));
const PreviewPage = lazy(() => import("@/pages/preview"));

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  return session ? children : createElement(Navigate, { replace: true, to: "/login" });
}

function GuestOnly({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  return session ? createElement(Navigate, { replace: true, to: "/works" }) : children;
}

function IndexRedirect() {
  const session = useAuthSession();
  return createElement(Navigate, { replace: true, to: session ? "/works" : "/login" });
}

export const routes: RouteObject[] = [
  {
    errorElement: routeErrorElement,
    path: "/",
    element: createElement(lazy(() => import("@/layouts/AppLayout"))),
    children: [
      {
        path: "login",
        element: createElement(GuestOnly, { children: createElement(LoginPage) }),
      },
      {
        index: true,
        element: createElement(IndexRedirect),
      },
      {
        path: "works",
        element: createElement(RequireAuth, { children: createElement(WorksPage) }),
      },
      {
        path: "editor/:documentId",
        element: createElement(RequireAuth, { children: createElement(HomePage) }),
      },
      {
        path: "preview",
        element: createElement(RequireAuth, { children: createElement(PreviewPage) }),
      },
      {
        path: "image-cache-worker-test",
        element: createElement(lazy(() => import("@/pages/image-cache-test"))),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
