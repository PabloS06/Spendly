import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "@/components/providers";
import { MemoryRouter } from "./next-shim";
import { connectClaudeStorage } from "./claude-backend";
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

let notifyFallback: (() => void) | null = null;

// Saves to the viewer's Claude account; without it, falls back to this browser.
async function connect() {
  const backend = await connectClaudeStorage().catch(() => null);
  if (!backend) notifyFallback?.();
  return backend;
}

function App() {
  const [fallback, setFallback] = useState(false);
  notifyFallback = () => setFallback(true);
  return (
    <>
      {fallback && (
        <p className="border-b hairline px-5 py-2 text-center text-xs text-muted">
          Sign in to Claude to save across devices. For now, changes stay in this browser.
        </p>
      )}
      <MemoryRouter>
        {(location) => {
          const Page = ROUTES[location.pathname] ?? Home;
          return (
            <Providers connect={connect}>
              <Page />
            </Providers>
          );
        }}
      </MemoryRouter>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
