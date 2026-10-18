// Stand-ins for next/link and next/navigation so the app can run as one
// self-contained page (the shareable demo). Routing is kept in memory.
import { createContext, useContext, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

interface Location {
  pathname: string;
  search: string;
}

interface RouterValue {
  location: Location;
  navigate: (href: string) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function parse(href: string): Location {
  const [path, search = ""] = href.split("?");
  const pathname = path.length > 1 ? path.replace(/\/+$/, "") : "/";
  return { pathname: pathname || "/", search };
}

export function MemoryRouter({ children }: { children: (location: Location) => ReactNode }) {
  const [location, setLocation] = useState<Location>({ pathname: "/", search: "" });
  const value = useMemo(
    () => ({
      location,
      navigate: (href: string) => {
        setLocation(parse(href));
        window.scrollTo({ top: 0 });
      },
    }),
    [location],
  );
  return <RouterContext.Provider value={value}>{children(location)}</RouterContext.Provider>;
}

function useRouterValue() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("router missing");
  return ctx;
}

export function useRouter() {
  const { navigate } = useRouterValue();
  return useMemo(() => ({ push: navigate, replace: (href: string, _opts?: unknown) => navigate(href), back: () => navigate("/") }), [navigate]);
}

export function usePathname() {
  return useRouterValue().location.pathname;
}

export function useSearchParams() {
  const { search } = useRouterValue().location;
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Link({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { navigate } = useRouterValue();
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
