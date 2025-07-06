import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useWallet } from "./_app";
import {
  generateRetrieveMessage,
  generateAccessMessage,
  generateRevokeMessage,
  generateRewardMessage,
  signMessage,
} from "../utils/web3";
import PrivyChainAPI from "../lib/api";
import { formatFileSize, formatFilcoins } from "../utils";
import type {
  FileRecord,
  PaginatedResponse,
  AccessGrantRequest,
  AccessRevokeRequest,
  RewardClaimRequest,
  UploadResponse,
} from "../types";
import Header from "../components/Header";
import Notification from "../components/Notification";
import FileUpload from "../components/FileUpload";

export default function FilesPage() {
  const {
    address: userAddress,
    isConnected,
    isConnecting,
    connect,
    disconnect,
  } = useWallet();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [accessGrantForm, setAccessGrantForm] = useState({
    cid: "",
    grantee: "",
    duration: 3600, // 1 hour default
  });
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [retrievingFile, setRetrievingFile] = useState<string | null>(null);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);

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
      if (userAddress) {
        await fetchUserFiles(userAddress);
      }
    } catch (error: any) {
      showNotification("error", "Connection Failed", error.message);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setFiles([]);
    showNotification(
      "info",
      "Wallet Disconnected",
      "Wallet has been disconnected"
    );
  };

  const fetchUserFiles = async (address: string, page: number = 1) => {
    setLoading(true);
    try {
      const response = await PrivyChainAPI.getUserFiles(
        address,
        page,
        pagination.limit
      );
      setFiles(response.files);
      setPagination({
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        totalPages: response.pagination.total_pages,
      });
    } catch (error: any) {
      showNotification("error", "Failed to fetch files", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveFile = async (cid: string, fileName: string) => {
    if (!userAddress) return;

    setRetrievingFile(cid);
    try {
      // Generate message for signing
      const message = generateRetrieveMessage(cid);
      const signature = await signMessage(message, userAddress);

      // Retrieve file
      const response = await PrivyChainAPI.retrieveFile({
        cid,
        user_address: userAddress,
        signature,
      });

      // Download file
      const blob = new Blob([atob(response.file)], {
        type: response.content_type,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.file_name || fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotification(
        "success",
        "File Retrieved",
        `Successfully downloaded ${fileName}`
      );
    } catch (error: any) {
      showNotification("error", "Retrieval Failed", error.message);
    } finally {
      setRetrievingFile(null);
    }
  };

  const handleGrantAccess = async () => {
    if (!userAddress || !accessGrantForm.cid || !accessGrantForm.grantee)
      return;

    try {
      // Generate message for signing
      const message = generateAccessMessage(
        accessGrantForm.cid,
        accessGrantForm.grantee
      );
      const signature = await signMessage(message, userAddress);

      // Grant access
      const request: AccessGrantRequest = {
        cid: accessGrantForm.cid,
        grantee: accessGrantForm.grantee,
        duration: accessGrantForm.duration,
        granter: userAddress,
        signature,
      };

      const response = await PrivyChainAPI.grantAccess(request);

      showNotification(
        "success",
        "Access Granted",
        `Access granted to ${accessGrantForm.grantee} until ${new Date(
          response.expires_at
        ).toLocaleString()}`
      );

      setShowAccessModal(false);
      setAccessGrantForm({ cid: "", grantee: "", duration: 3600 });
    } catch (error: any) {
      showNotification("error", "Access Grant Failed", error.message);
    }
  };

  const handleRevokeAccess = async (cid: string, grantee: string) => {
    if (!userAddress) return;

    try {
      // Generate message for signing
      const message = generateRevokeMessage(cid, grantee);
      const signature = await signMessage(message, userAddress);

      // Revoke access
      const request: AccessRevokeRequest = {
        cid,
        grantee,
        granter: userAddress,
        signature,
      };

      await PrivyChainAPI.revokeAccess(request);

      showNotification(
        "success",
        "Access Revoked",
        `Access revoked for ${grantee}`
      );
    } catch (error: any) {
      showNotification("error", "Access Revoke Failed", error.message);
    }
  };

  const handleClaimReward = async (cid: string) => {
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
        `Claimed ${response.reward_amount} FIL for file ${cid.slice(0, 8)}...`
      );

      // Refresh files to update reward status
      await fetchUserFiles(userAddress, pagination.page);
    } catch (error: any) {
      showNotification("error", "Reward Claim Failed", error.message);
    } finally {
      setClaimingReward(null);
    }
  };

  const handlePageChange = (page: number) => {
    if (userAddress) {
      fetchUserFiles(userAddress, page);
    }
  };

  const openAccessModal = (cid: string) => {
    setAccessGrantForm({ ...accessGrantForm, cid });
    setShowAccessModal(true);
  };

  const handleUploadComplete = useCallback(
    (response: UploadResponse) => {
      const rewardText = response.reward_distributed
        ? `${response.actual_reward_fil} FIL reward earned!`
        : `${response.expected_reward_fil} FIL reward pending`;

      showNotification(
        "success",
        "🎉 File Uploaded Successfully!",
        `✅ File uploaded to IPFS\n� Gateway: ${response.gateway_url}\n💰 ${rewardText}\n🔗 CID: ${response.cid}`
      );
      // Refresh the files list
      if (userAddress) {
        fetchUserFiles(userAddress, pagination.page);
      }
    },
    [userAddress, pagination.page]
  );

  const handleUploadError = useCallback((error: string) => {
    showNotification("error", "Upload Failed", error);
  }, []);

  // Load files when component mounts or user changes
  useEffect(() => {
    if (isConnected && userAddress) {
      fetchUserFiles(userAddress);
    }
  }, [isConnected, userAddress, pagination.limit]);

  return (
    <>
      <Head>
        <title>My Files - PrivyChain</title>
        <meta name="description" content="Manage your files on PrivyChain" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header
          userAddress={userAddress}
          isConnected={isConnected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">My Files</h1>
            <p className="text-gray-600">
              Manage your uploaded files, access controls, and rewards
            </p>
          </div>

          {!isConnected ? (
            <div className="text-center py-12">
              <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-filecoin-500 to-privy-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
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
                <h2 className="text-xl font-semibold mb-4">
                  Connect Your Wallet
                </h2>
                <p className="text-gray-600 mb-6">
                  Connect your wallet to view and manage your files
                </p>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="btn-primary"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Upload Section */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold">Upload Files</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Upload files to the decentralized storage network
                  </p>
                </div>
                <div className="p-6">
                  {userAddress && (
                    <FileUpload
                      userAddress={userAddress}
                      onUploadComplete={handleUploadComplete}
                      onError={handleUploadError}
                    />
                  )}
                </div>
              </div>

              {/* Files List */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold">Your Files</h2>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-filecoin-500"></div>
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No files uploaded yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            File
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Size
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Uploaded
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {files.map((file) => (
                          <tr key={file.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <span className="text-gray-500 text-sm">
                                    📄
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {file.file_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {file.cid.slice(0, 16)}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatFileSize(file.file_size)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  file.status === "confirmed"
                                    ? "bg-green-100 text-green-800"
                                    : file.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {file.status}
                              </span>
                              {file.is_encrypted && (
                                <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  Encrypted
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(file.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                              <button
                                onClick={() =>
                                  handleRetrieveFile(file.cid, file.file_name)
                                }
                                disabled={retrievingFile === file.cid}
                                className="text-filecoin-600 hover:text-filecoin-900 disabled:opacity-50"
                              >
                                {retrievingFile === file.cid
                                  ? "Downloading..."
                                  : "Download"}
                              </button>
                              <button
                                onClick={() => openAccessModal(file.cid)}
                                className="text-privy-600 hover:text-privy-900"
                              >
                                Share
                              </button>
                              {file.tx_hash && (
                                <button
                                  onClick={() => handleClaimReward(file.cid)}
                                  disabled={claimingReward === file.cid}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                >
                                  {claimingReward === file.cid
                                    ? "Claiming..."
                                    : "Claim Reward"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing{" "}
                          <span className="font-medium">
                            {(pagination.page - 1) * pagination.limit + 1}
                          </span>{" "}
                          to{" "}
                          <span className="font-medium">
                            {Math.min(
                              pagination.page * pagination.limit,
                              pagination.total
                            )}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium">
                            {pagination.total}
                          </span>{" "}
                          results
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button
                            onClick={() =>
                              handlePageChange(pagination.page - 1)
                            }
                            disabled={pagination.page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          {Array.from(
                            { length: pagination.totalPages },
                            (_, i) => (
                              <button
                                key={i + 1}
                                onClick={() => handlePageChange(i + 1)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  pagination.page === i + 1
                                    ? "z-10 bg-filecoin-50 border-filecoin-500 text-filecoin-600"
                                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {i + 1}
                              </button>
                            )
                          )}
                          <button
                            onClick={() =>
                              handlePageChange(pagination.page + 1)
                            }
                            disabled={pagination.page === pagination.totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Access Grant Modal */}
        {showAccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl max-w-md w-full m-4 p-6">
              <h3 className="text-lg font-semibold mb-4">Grant File Access</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grantee Address
                  </label>
                  <input
                    type="text"
                    value={accessGrantForm.grantee}
                    onChange={(e) =>
                      setAccessGrantForm({
                        ...accessGrantForm,
                        grantee: e.target.value,
                      })
                    }
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-filecoin-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (seconds)
                  </label>
                  <select
                    value={accessGrantForm.duration}
                    onChange={(e) =>
                      setAccessGrantForm({
                        ...accessGrantForm,
                        duration: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-filecoin-500"
                  >
                    <option value={3600}>1 hour</option>
                    <option value={86400}>1 day</option>
                    <option value={604800}>1 week</option>
                    <option value={0}>Permanent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAccessModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGrantAccess}
                  className="px-4 py-2 text-sm font-medium text-white bg-filecoin-500 rounded-lg hover:bg-filecoin-600"
                >
                  Grant Access
                </button>
              </div>
            </div>
          </div>
        )}

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
    </>
  );
}
