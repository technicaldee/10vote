
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AppProviders } from "./lib/wallet";

const root = createRoot(document.getElementById("root")!);
root.render(
  <AppProviders>
    <App />
  </AppProviders>
);

// Farcaster MiniApp SDK: call ready() after app mounts to display content
(async () => {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isWarpcast = /Warpcast/i.test(ua);
    if (!isWarpcast) return;
    // Dynamically import SDK via ESM CDN to avoid adding a build dependency
    const sdkUrl = 'https://esm.sh/@farcaster/miniapp-sdk';
    // @ts-ignore - dynamic import of remote URL at runtime
    const mod: any = await import(/* @vite-ignore */ sdkUrl);
    (window as any).__isFarcasterMiniApp = !!mod?.sdk;
    // Ensure the app has rendered; then signal ready to hide splash screen
    await mod.sdk.actions.ready();
    // Obtain Farcaster-provided EIP-1193 provider and inject for Wagmi
    try {
      const provider = await mod?.sdk?.wallet?.getEthereumProvider?.();
      if (provider) {
        (window as any).ethereum = provider;
        (window as any).__hasInjectedFromFarcaster = true;
        // Proactively request sign-in to authorize wallet if needed
        try { await mod?.sdk?.actions?.signIn?.(); } catch {}
      }
    } catch {}
  } catch (err) {
    // No-op if SDK is unavailable or not in Farcaster environment
  }
})();
  