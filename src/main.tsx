
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
    // Dynamically import SDK via ESM CDN to avoid adding a build dependency
    const sdkUrl = 'https://esm.sh/@farcaster/miniapp-sdk';
    // @ts-ignore - dynamic import of remote URL at runtime
    const mod: any = await import(/* @vite-ignore */ sdkUrl);
    const sdk = mod?.sdk;
    if (!sdk) return;
    (window as any).__isFarcasterMiniApp = true;
    // Ensure the app has rendered; then signal ready to hide splash screen
    await new Promise((r) => requestAnimationFrame(r));
    await sdk.actions.ready();
    // Obtain Farcaster-provided EIP-1193 provider and inject for Wagmi
    try {
      const provider = await sdk?.wallet?.getEthereumProvider?.();
      if (provider) {
        (window as any).ethereum = provider;
        (window as any).__hasInjectedFromFarcaster = true;
        // Proactively request sign-in to authorize wallet if needed
        try { await sdk?.actions?.signIn?.(); } catch {}
        // Notify app that provider is ready for connection
        try { window.dispatchEvent(new CustomEvent('farcaster:provider-ready')); } catch {}
      }
    } catch {}
  } catch (err) {
    // No-op if SDK is unavailable or not in Farcaster environment
  }
})();
  