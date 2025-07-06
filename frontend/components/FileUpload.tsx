import { useState, useRef, useCallback } from "react";
import { fileToBase64, formatFileSize, getFileIcon } from "../utils";
import {
  validateUploadRequest,
  generateUploadMessage,
  signMessage,
} from "../utils/web3";
import PrivyChainAPI from "../lib/api";
import type { UploadRequest, UploadResponse } from "../types";

interface FileUploadProps {
  userAddress: string;
  onUploadComplete: (response: UploadResponse) => void;
  onError: (error: string) => void;
}

const FileUpload = ({
  userAddress,
  onUploadComplete,
  onError,
}: FileUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [shouldEncrypt, setShouldEncrypt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (selectedFiles: FileList) => {
      const newFiles = Array.from(selectedFiles).filter((file) => {
        const errors = validateUploadRequest(file, userAddress);
        if (errors.length > 0) {
          onError(`Invalid file "${file.name}": ${errors.join(", ")}`);
          return false;
        }
        return true;
      });

      setFiles((prev) => [...prev, ...newFiles]);
    },
    [userAddress, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFileSelect(droppedFiles);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File) => {
    try {
      setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
      console.log("📤 Starting upload for file:", file.name);

      // Convert file to base64
      const base64Data = await fileToBase64(file);
      console.log("📦 File converted to base64, size:", base64Data.length);

      // Prepare upload data for signing
      const uploadData = {
        file: base64Data,
        file_name: file.name,
        content_type: file.type || "application/octet-stream",
        should_encrypt: shouldEncrypt,
        metadata: {
          description: file.name,
          tags: ["document", "upload"],
          version: "1.0",
        },
        user_address: userAddress,
      };

      console.log("📋 Upload data prepared:", {
        file_name: uploadData.file_name,
        content_type: uploadData.content_type,
        should_encrypt: uploadData.should_encrypt,
        user_address: uploadData.user_address,
        file_size: uploadData.file.length,
      });

      // Generate message for signing
      const message = generateUploadMessage(uploadData);

      // Sign the message
      console.log("🔐 Signing message...");
      const signature = await signMessage(message, userAddress);
      console.log("✅ Message signed successfully");

      // Prepare upload request
      const uploadRequest: UploadRequest = {
        ...uploadData,
        signature: signature,
      };

      // Upload to API
      setUploadProgress((prev) => ({ ...prev, [file.name]: 50 }));
      console.log("🚀 Uploading to API...");
      const response = await PrivyChainAPI.uploadFile(uploadRequest);
      console.log("✅ Upload successful:", response);

      setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
      return response;
    } catch (error) {
      console.error("❌ Upload failed:", error);
      setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
      throw error;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      onError("Please select at least one file to upload");
      return;
    }

    setIsUploading(true);

    try {
      // Upload files one by one
      for (const file of files) {
        try {
          const response = await uploadFile(file);
          onUploadComplete(response);
        } catch (error: any) {
          onError(`Failed to upload "${file.name}": ${error.message}`);
        }
      }

      // Clear files after successful upload
      setFiles([]);
      setUploadProgress({});
    } finally {
      setIsUploading(false);
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress < 0) return "bg-red-500";
    if (progress === 100) return "bg-green-500";
    return "bg-filecoin-500";
  };

  const getProgressText = (progress: number) => {
    if (progress < 0) return "Failed";
    if (progress === 100) return "Complete";
    return `${progress}%`;
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`file-upload-area ${
          files.length > 0 ? "border-filecoin-400" : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-center">
          <div className="text-4xl mb-4">📁</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Drop files here or click to select
          </h3>
          <p className="text-sm text-gray-500">
            Supports all file types • Max 100MB per file
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFileSelect(e.target.files);
            }
          }}
        />
      </div>

      {/* Upload Options */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="encrypt"
              checked={shouldEncrypt}
              onChange={(e) => setShouldEncrypt(e.target.checked)}
              className="rounded border-gray-300 text-filecoin-600 focus:ring-filecoin-500"
            />
            <label
              htmlFor="encrypt"
              className="text-sm font-medium text-gray-700"
            >
              Encrypt files
            </label>
          </div>
          <div className="text-xs text-gray-500">
            {shouldEncrypt
              ? "🔒 Files will be encrypted"
              : "🔓 Files will be public"}
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="card p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Selected Files ({files.length})
          </h3>

          <div className="space-y-3">
            {files.map((file, index) => {
              const progress = uploadProgress[file.name] || 0;
              const isComplete = progress === 100;
              const isFailed = progress < 0;

              return (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="text-2xl">{getFileIcon(file.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>

                    {isUploading && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-gray-500">
                            {getProgressText(progress)}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(
                              progress
                            )}`}
                            style={{ width: `${Math.max(0, progress)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {!isUploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Upload Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className={`btn-primary ${
                isUploading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isUploading ? (
                <span className="flex items-center">
                  <div className="loading-spinner mr-2"></div>
                  Uploading...
                </span>
              ) : (
                `Upload ${files.length} file${files.length === 1 ? "" : "s"}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload Info */}
      <div className="card p-4 bg-blue-50 border-blue-200">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          📊 Upload Information
        </h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Files are stored on Filecoin via Web3.Storage</li>
          <li>• Metadata is recorded on-chain for verification</li>
          <li>• You earn FIL rewards for each successful upload</li>
          <li>• Encrypted files are only accessible to you</li>
          <li>• Public files can be shared with others</li>
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;
