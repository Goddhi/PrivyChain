import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useWallet } from "./_app";
import { generateRewardMessage, signMessage } from "../utils/web3";
import PrivyChainAPI from "../lib/api";
import { formatFileSize, formatFilcoins, formatDate } from "../utils";
import type { UserStats, FileRecord, RewardClaimRequest } from "../types";
import Header from "../components/Header";
import Notification from "../components/Notification";

export default function RewardsPage() {
  const {
    address: userAddress,
    isConnected,
    isConnecting,
    connect,
    disconnect,
  } = useWallet();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [claimableFiles, setClaimableFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);

  const showNotification = useCallback(
    (
      type: "success" | "error" | "warning" | "info",
      title: string,
      message: string
    ) => {
      setNotification({ type, title, message });
    },
    []
  );

  const handleConnect = async () => {
    try {
      await connect();
      showNotification(
        "success",
        "Wallet Connected",
        `Connected to ${userAddress}`
      );
    } catch (error: any) {
      showNotification("error", "Connection Failed", error.message);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setUserStats(null);
    setClaimableFiles([]);
    showNotification(
      "info",
      "Wallet Disconnected",
      "Wallet has been disconnected"
    );
  };

  const fetchUserData = async (address: string) => {
    setLoading(true);
    try {
      // Fetch user stats
      const stats = await PrivyChainAPI.getUserStats(address);
      setUserStats(stats);

      // Fetch user files to find claimable ones
      const filesResponse = await PrivyChainAPI.getUserFiles(address, 1, 100);
      const claimable = filesResponse.files.filter(
        (file) =>
          file.status === "confirmed" &&
          file.tx_hash &&
          !file.tx_hash.includes("reward")
      );
      setClaimableFiles(claimable);
    } catch (error: any) {
      showNotification("error", "Failed to fetch data", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (cid: string, fileName: string) => {
    if (!userAddress) return;

    setClaimingReward(cid);
    try {
      // Generate message for signing
      const message = generateRewardMessage(cid);
      const signature = await signMessage(message, userAddress);

      // Claim reward
      const request: RewardClaimRequest = {
        cid,
        user_address: userAddress,
        signature,
      };

      const response = await PrivyChainAPI.claimReward(request);

      showNotification(
        "success",
        "Reward Claimed",
        `Claimed ${response.reward_amount} FIL for file "${fileName}"`
      );

      // Refresh data
      await fetchUserData(userAddress);
    } catch (error: any) {
      showNotification("error", "Reward Claim Failed", error.message);
    } finally {
      setClaimingReward(null);
    }
  };

  const handleBatchClaim = async () => {
    if (!userAddress || claimableFiles.length === 0) return;

    setBatchClaiming(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const file of claimableFiles) {
        try {
          await handleClaimReward(file.cid, file.file_name);
          successCount++;
          // Small delay between claims to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          failureCount++;
        }
      }

      if (successCount > 0) {
        showNotification(
          "success",
          "Batch Claim Complete",
          `Successfully claimed rewards for ${successCount} files${
            failureCount > 0 ? `. ${failureCount} failed.` : "."
          }`
        );
      }
    } catch (error: any) {
      showNotification("error", "Batch Claim Failed", error.message);
    } finally {
      setBatchClaiming(false);
    }
  };

  useEffect(() => {
    // Load user data when wallet is connected
    if (isConnected && userAddress) {
      fetchUserData(userAddress);
    }
  }, [isConnected, userAddress]);

  const RewardCard = ({
    title,
    value,
    subtitle,
    icon,
    highlight = false,
  }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ReactNode;
    highlight?: boolean;
  }) => (
    <div
      className={`bg-white rounded-lg shadow-md p-6 ${
        highlight ? "border-2 border-filecoin-300" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="text-filecoin-500">{icon}</div>
      </div>
      <p
        className={`text-2xl font-bold ${
          highlight ? "text-filecoin-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {subtitle && <p className="text-sm text-gray-600 mt-2">{subtitle}</p>}
    </div>
  );

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-filecoin-50 to-privy-50">
        <Head>
          <title>Rewards - PrivyChain</title>
          <meta name="description" content="Claim your PrivyChain rewards" />
        </Head>
        <Header
          userAddress={userAddress}
          isConnected={isConnected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-filecoin-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-filecoin-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-gray-600">
                Connect your wallet to view and claim your PrivyChain rewards.
              </p>
            </div>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full bg-filecoin-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-filecoin-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-filecoin-50 to-privy-50">
      <Head>
        <title>Rewards - PrivyChain</title>
        <meta name="description" content="Claim your PrivyChain rewards" />
      </Head>

      <Header
        userAddress={userAddress}
        isConnected={isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Rewards Dashboard
            </h1>
            <p className="text-gray-600">
              View your earnings and claim rewards from your stored files
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <RewardCard
              title="Total Earnings"
              value={
                userStats
                  ? formatFilcoins(userStats.reward_balance_fil)
                  : "0 FIL"
              }
              subtitle="All time earnings"
              icon={
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              }
              highlight
            />
            <RewardCard
              title="Files Stored"
              value={userStats ? userStats.total_files.toString() : "0"}
              subtitle="Total files uploaded"
              icon={
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              }
            />
            <RewardCard
              title="Storage Used"
              value={
                userStats ? formatFileSize(userStats.total_size_bytes) : "0 B"
              }
              subtitle="Total storage space"
              icon={
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              }
            />
          </div>

          {/* Claimable Files */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Claimable Rewards
                </h2>
                {claimableFiles.length > 0 && (
                  <button
                    onClick={handleBatchClaim}
                    disabled={batchClaiming}
                    className="bg-filecoin-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-filecoin-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {batchClaiming
                      ? "Claiming..."
                      : `Claim All (${claimableFiles.length})`}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-filecoin-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading rewards...</p>
                </div>
              ) : claimableFiles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Rewards Available
                  </h3>
                  <p className="text-gray-600">
                    You don't have any unclaimed rewards at the moment.
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Upload Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estimated Reward
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {claimableFiles.map((file) => (
                      <tr key={file.cid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-10 h-10 bg-filecoin-100 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-filecoin-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                {file.file_name}
                              </div>
                              <div className="text-sm text-gray-500 font-mono">
                                {file.cid.slice(0, 10)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatFileSize(file.file_size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(file.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {/* Estimate based on file size - this is a placeholder calculation */}
                          {formatFilcoins(
                            ((file.file_size / 1024 / 1024) * 0.001).toString()
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              handleClaimReward(file.cid, file.file_name)
                            }
                            disabled={claimingReward === file.cid}
                            className="bg-filecoin-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-filecoin-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {claimingReward === file.cid
                              ? "Claiming..."
                              : "Claim Reward"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
