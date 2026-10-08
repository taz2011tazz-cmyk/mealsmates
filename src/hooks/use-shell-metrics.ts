import { useEffect } from "react";

type ShellMode = "with-header" | "no-header";

export function useShellMetrics(mode: ShellMode) {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.getElementById("app-header");
    const nav = document.getElementById("app-nav");

    const update = () => {
      const headerHeight = mode === "with-header" && header ? header.getBoundingClientRect().height : 0;
      const navHeight = nav?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--app-header-h", `${headerHeight}px`);
      root.style.setProperty("--app-nav-h", `${navHeight}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    if (header) observer.observe(header);
    if (nav) observer.observe(nav);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [mode]);
}
