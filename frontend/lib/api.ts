import axios from 'axios';
import type {
    ApiResponse,
    FileRecord,
    UserStats,
    ContractStats,
    ContractStatus,
    HealthStatus,
    UploadRequest,
    UploadResponse,
    RetrieveRequest,
    RetrieveResponse,
    AccessGrantRequest,
    AccessGrantResponse,
    AccessRevokeRequest,
    RewardClaimRequest,
    RewardClaimResponse,
    PaginatedResponse,
    AnalyticsOverview,
    PerformanceMetrics,
    SystemMetrics,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://privychain-dot-chainguardai.uc.r.appspot.com';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for logging
api.interceptors.request.use(
    (config) => {
        console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for logging
api.interceptors.response.use(
    (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error('❌ API Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
    }
);

export class PrivyChainAPI {
    // Health & Status
    static async getHealth(): Promise<HealthStatus> {
        const response = await api.get<ApiResponse<HealthStatus>>('/health');
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get health status');
        }
        return response.data.data!;
    }

    static async getSystemStatus(): Promise<SystemMetrics> {
        const response = await api.get<ApiResponse<SystemMetrics>>('/system/status');
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get system status');
        }
        return response.data.data!;
    }

    // File Operations
    static async uploadFile(request: UploadRequest): Promise<UploadResponse> {
        const response = await api.post<ApiResponse<UploadResponse>>('/upload', request);
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to upload file');
        }
        return response.data.data!;
    }

    static async retrieveFile(request: RetrieveRequest): Promise<RetrieveResponse> {
        const response = await api.post<ApiResponse<RetrieveResponse>>('/retrieve', request);
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to retrieve file');
        }
        return response.data.data!;
    }

    // Access Control
    static async grantAccess(request: AccessGrantRequest): Promise<AccessGrantResponse> {
        const response = await api.post<ApiResponse<AccessGrantResponse>>('/access/grant', request);
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to grant access');
        }
        return response.data.data!;
    }

    static async revokeAccess(request: AccessRevokeRequest): Promise<void> {
        const response = await api.post<ApiResponse<void>>('/access/revoke', request);
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to revoke access');
        }
    }

    // Rewards
    static async claimReward(request: RewardClaimRequest): Promise<RewardClaimResponse> {
        const response = await api.post<ApiResponse<RewardClaimResponse>>('/rewards/claim', request);
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to claim reward');
        }
        return response.data.data!;
    }

    // User Data
    static async getUserStats(address: string): Promise<UserStats> {
        const response = await api.get<ApiResponse<UserStats>>(`/users/${address}/stats`);
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get user stats');
        }
        return response.data.data!;
    }

    static async getUserFiles(address: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<FileRecord>> {
        const response = await api.get<ApiResponse<PaginatedResponse<FileRecord>>>(
            `/users/${address}/files?page=${page}&limit=${limit}`
        );
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get user files');
        }
        return response.data.data!;
    }

    // Contract Data
    static async getContractStats(): Promise<ContractStats> {
        const response = await api.get<ApiResponse<ContractStats>>('/contract/stats');
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get contract stats');
        }
        return response.data.data!;
    }

    static async getContractStatus(): Promise<ContractStatus> {
        const response = await api.get<ApiResponse<ContractStatus>>('/contract/status');
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get contract status');
        }
        return response.data.data!;
    }

    // Analytics
    static async getAnalyticsOverview(): Promise<AnalyticsOverview> {
        const response = await api.get<ApiResponse<AnalyticsOverview>>('/analytics/overview');
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get analytics overview');
        }
        return response.data.data!;
    }

    static async getPerformanceMetrics(hours: number = 24): Promise<PerformanceMetrics> {
        const response = await api.get<ApiResponse<PerformanceMetrics>>(`/analytics/performance?hours=${hours}`);
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get performance metrics');
        }
        return response.data.data!;
    }

    static async getSystemMetrics(): Promise<SystemMetrics> {
        const response = await api.get<ApiResponse<SystemMetrics>>('/analytics/system');
        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get system metrics');
        }
        return response.data.data!;
    }
}

export default PrivyChainAPI;
