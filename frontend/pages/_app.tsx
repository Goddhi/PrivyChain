import "../styles/globals.css";
import type { AppProps } from "next/app";
import React, { useState, useEffect } from "react";
import { connectWallet, disconnectWallet } from "../utils/web3";

// Wallet Context
interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = React.createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = React.useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async () => {
    try {
      setIsConnecting(true);
      const connectedAddress = await connectWallet();
      setAddress(connectedAddress);
      setIsConnected(true);

      // Save to localStorage
      localStorage.setItem("wallet_address", connectedAddress);
      localStorage.setItem("wallet_connected", "true");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setAddress(null);
      setIsConnected(false);
      localStorage.removeItem("wallet_address");
      localStorage.removeItem("wallet_connected");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectWallet();
      setAddress(null);
      setIsConnected(false);

      // Clear localStorage
      localStorage.removeItem("wallet_address");
      localStorage.removeItem("wallet_connected");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  // Check if wallet is already connected on page load
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined") {
        // First check localStorage
        const savedAddress = localStorage.getItem("wallet_address");
        const savedConnection = localStorage.getItem("wallet_connected");

        if (savedAddress && savedConnection === "true") {
          // Verify the wallet is still connected
          if ((window as any).ethereum) {
            try {
              const accounts = await (window as any).ethereum.request({
                method: "eth_accounts",
              });
              if (
                accounts.length > 0 &&
                accounts[0].toLowerCase() === savedAddress.toLowerCase()
              ) {
                setAddress(savedAddress);
                setIsConnected(true);
                return;
              }
            } catch (error) {
              console.error("Failed to verify wallet connection:", error);
            }
          }

          // Clear invalid saved data
          localStorage.removeItem("wallet_address");
          localStorage.removeItem("wallet_connected");
        }
      }
    };

    checkConnection();
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, isConnected, isConnecting, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <Component {...pageProps} />
    </WalletProvider>
  );
}
