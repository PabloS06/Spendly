import { createRoot } from "react-dom/client";
import { Providers } from "@/components/providers";
import { DEMO_SESSION_KEY, seedDemo, storage } from "@/lib/backend";
import { sampleSnapshot } from "@/lib/sample";
import { MemoryRouter } from "./next-shim";
import Home from "@/app/page";
import Login from "@/app/login/page";
import Onboarding from "@/app/onboarding/page";
import Activity from "@/app/activity/page";
import Insights from "@/app/insights/page";
import Settings from "@/app/settings/page";
import Import from "@/app/settings/import/page";
import Rollover from "@/app/rollover/page";

const ROUTES: Record<string, () => React.ReactNode> = {
  "/": Home,
  "/login": Login,
  "/onboarding": Onboarding,
  "/activity": Activity,
  "/insights": Insights,
  "/settings": Settings,
  "/settings/import": Import,
  "/rollover": Rollover,
};

// The shareable demo opens on sample data so there's something to look at straight away.
if (!storage.get(DEMO_SESSION_KEY)) {
  seedDemo(sampleSnapshot());
  storage.set(DEMO_SESSION_KEY, "1");
}

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    {(location) => {
      const Page = ROUTES[location.pathname] ?? Home;
      return (
        <Providers>
          <Page />
        </Providers>
      );
    }}
  </MemoryRouter>,
);
