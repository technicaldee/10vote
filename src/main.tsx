
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

// Telegram MiniApp: attempt to initialize and use injected EVM provider if available
(async () => {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    (window as any).__isTelegramMiniApp = true;
    try { tg.ready?.(); } catch {}
    // If Telegram Wallet exposes an EIP-1193 provider, use it
    const provider = (window as any).ethereum;
    if (provider) {
      (window as any).__hasInjectedFromTelegram = true;
      try { await provider.request?.({ method: 'eth_requestAccounts' }); } catch {}
      try { window.dispatchEvent(new CustomEvent('farcaster:provider-ready')); } catch {}
    } else {
      // Some Telegram wallets inject provider after app is ready; poll briefly
      const start = Date.now();
      const poll = () => {
        const p = (window as any).ethereum;
        if (p || Date.now() - start > 3000) {
          if (p) {
            (window as any).__hasInjectedFromTelegram = true;
            try { window.dispatchEvent(new CustomEvent('farcaster:provider-ready')); } catch {}
          }
          return;
        }
        setTimeout(poll, 200);
      };
      poll();
    }
  } catch {}
})();
  