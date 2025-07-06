import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import PrivyChainAPI from "../lib/api";
import { formatFileSize, formatFilcoins } from "../utils";
import { useWallet } from "./_app";
import Header from "../components/Header";
import Notification from "../components/Notification";
import type { HealthStatus, UserStats, ContractStats } from "../types";

export default function Home() {
  const {
    address: userAddress,
    isConnected,
    isConnecting,
    connect,
    disconnect,
  } = useWallet();
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [contractStats, setContractStats] = useState<ContractStats | null>(
    null
  );
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const connectWallet = async () => {
    try {
      await connect();
      showNotification("success", "Wallet connected successfully!");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      showNotification("error", "Failed to connect wallet. Please try again.");
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
      showNotification("success", "Wallet disconnected successfully!");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      showNotification("error", "Failed to disconnect wallet.");
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const health = await PrivyChainAPI.getHealth();
      setHealthStatus(health);
    } catch (error) {
      console.error("Failed to fetch health status:", error);
    }
  };

  const fetchUserStats = async (address: string) => {
    try {
      const stats = await PrivyChainAPI.getUserStats(address);
      setUserStats(stats);
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
    }
  };

  const fetchContractStats = async () => {
    try {
      const stats = await PrivyChainAPI.getContractStats();
      setContractStats(stats);
    } catch (error) {
      console.error("Failed to fetch contract stats:", error);
    }
  };

  useEffect(() => {
    fetchHealthStatus();
    fetchContractStats();
  }, []);

  // Fetch user stats when wallet is connected
  useEffect(() => {
    if (isConnected && userAddress) {
      fetchUserStats(userAddress);
    } else {
      setUserStats(null);
    }
  }, [isConnected, userAddress]);

  const StatsCard = ({
    title,
    value,
    subtitle,
    icon,
  }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: string;
  }) => (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-3xl opacity-60">{icon}</div>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>PrivyChain - Decentralized File Storage</title>
        <meta
          name="description"
          content="Decentralized file storage on Filecoin with privacy and rewards"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Notification */}
        {notification && (
          <Notification
            type={notification.type}
            title={notification.type === "success" ? "Success" : "Error"}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Header */}
        <Header
          userAddress={userAddress}
          isConnected={isConnected}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
        />

        {/* Main Dashboard Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="text-center py-12">
              <h1 className="text-4xl font-bold gradient-text mb-4">
                Welcome to PrivyChain
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Decentralized file storage on Filecoin with privacy, rewards,
                and blockchain verification.
              </p>
            </div>

            {/* System Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard
                title="System Status"
                value={healthStatus?.status || "Unknown"}
                subtitle={
                  healthStatus ? `Version ${healthStatus.version}` : undefined
                }
                icon="⚡"
              />
              <StatsCard
                title="Storage Service"
                value={healthStatus?.w3up_ready ? "Ready" : "Offline"}
                subtitle="Web3.Storage w3up"
                icon="☁️"
              />
              <StatsCard
                title="Blockchain"
                value={
                  healthStatus?.contract_ready ? "Connected" : "Disconnected"
                }
                subtitle="Filecoin Network"
                icon="🔗"
              />
            </div>

            {/* User Stats (if connected) */}
            {isConnected && userStats && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Your Statistics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatsCard
                    title="Files Stored"
                    value={userStats.total_files.toString()}
                    icon="📁"
                  />
                  <StatsCard
                    title="Storage Used"
                    value={formatFileSize(userStats.total_size_bytes)}
                    icon="💾"
                  />
                  <StatsCard
                    title="FIL Rewards"
                    value={formatFilcoins(userStats.reward_balance_fil)}
                    icon="💰"
                  />
                  <StatsCard
                    title="Encrypted Files"
                    value={userStats.encrypted_files.toString()}
                    icon="🔒"
                  />
                </div>
              </div>
            )}

            {/* Contract Stats */}
            {contractStats && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Network Statistics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatsCard
                    title="Total Files"
                    value={contractStats.total_files_stored}
                    subtitle="On-chain records"
                    icon="📊"
                  />
                  <StatsCard
                    title="Total Storage"
                    value={formatFileSize(
                      parseInt(contractStats.total_storage_used_bytes)
                    )}
                    subtitle="Network usage"
                    icon="🌐"
                  />
                  <StatsCard
                    title="Rewards Distributed"
                    value={formatFilcoins(
                      contractStats.total_rewards_distributed_fil
                    )}
                    subtitle="FIL tokens"
                    icon="🏆"
                  />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {isConnected ? (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Link
                    href="/files"
                    className="flex items-center justify-center p-6 bg-gradient-to-br from-filecoin-500 to-filecoin-600 text-white rounded-xl hover:from-filecoin-600 hover:to-filecoin-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">📁</div>
                      <h3 className="text-xl font-semibold">Manage Files</h3>
                      <p className="text-filecoin-100 mt-1">
                        Upload, download, and manage your files
                      </p>
                    </div>
                  </Link>
                  <Link
                    href="/rewards"
                    className="flex items-center justify-center p-6 bg-gradient-to-br from-privy-500 to-privy-600 text-white rounded-xl hover:from-privy-600 hover:to-privy-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">💰</div>
                      <h3 className="text-xl font-semibold">Claim Rewards</h3>
                      <p className="text-privy-100 mt-1">
                        View and claim your FIL rewards
                      </p>
                    </div>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-gradient-to-br from-filecoin-50 to-privy-50 rounded-2xl">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Get Started
                </h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Connect your wallet to start uploading files, earning rewards,
                  and managing your decentralized storage.
                </p>
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="btn-primary text-lg px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <p className="text-gray-600">
                Built on Filecoin • Powered by Storacha
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
