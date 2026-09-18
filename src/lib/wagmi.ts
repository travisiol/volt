import { createConfig, http, type Config } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { BROWSER_RPC_URL, RPC_URL, isBrowser, robinhoodChain } from "@/config/chains";
import { WALLETCONNECT_PROJECT_ID } from "@/config/contracts";
import { voltConfig } from "@/config/volt";

/**
 * Injected wallets always (every EIP-6963 provider shows up as its own
 * entry). WalletConnect only when a project id is configured — without one
 * the connector would throw at boot.
 */
export const wagmiConfig: Config = createConfig({
  chains: [robinhoodChain],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(WALLETCONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: WALLETCONNECT_PROJECT_ID,
            showQrModal: true,
            metadata: { name: voltConfig.site.name, description: voltConfig.site.line, url: voltConfig.site.url, icons: [`${voltConfig.site.url}/icon.svg`] },
          }),
        ]
      : []),
  ],
  transports: { [robinhoodChain.id]: http(isBrowser() ? BROWSER_RPC_URL : RPC_URL, { batch: true }) },
  multiInjectedProviderDiscovery: true,
  ssr: true,
});

export const hasWalletConnect = Boolean(WALLETCONNECT_PROJECT_ID);
