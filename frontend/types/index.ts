export interface FileRecord {
    id: number;
    cid: string;
    uploader_addr: string;
    file_size: number;
    is_encrypted: boolean;
    file_name: string;
    content_type: string;
    metadata: string;
    tx_hash?: string;
    status: 'pending' | 'confirmed' | 'failed';
    created_at: string;
    updated_at: string;
}

export interface AccessGrant {
    id: number;
    cid: string;
    granter_addr: string;
    grantee_addr: string;
    expires_at?: string;
    is_active: boolean;
    created_at: string;
}

export interface UserStats {
    total_files: number;
    total_size_bytes: number;
    encrypted_files: number;
    reward_balance_fil: string;
    blockchain_files_count: number;
    can_claim_rewards: boolean;
    rewards_earned: number;
}

export interface ContractStats {
    contract_address: string;
    network: string;
    total_files_stored: string;
    total_rewards_distributed_fil: string;
    total_storage_used_bytes: string;
    reward_config: {
        base_reward_fil: string;
        size_multiplier: string;
        encryption_bonus_fil: string;
    };
}

export interface ContractStatus {
    contract_address: string;
    network: string;
    rpc_url: string;
    is_deployed: boolean;
    bytecode_length: number;
    contract_balance_fil: string;
    wallet?: {
        address: string;
        balance_fil: string;
    };
    can_write: boolean;
    is_ready: boolean;
    stats?: ContractStats;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    details?: string;
}

export interface PaginatedResponse<T> {
    files: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

export interface UploadRequest {
    file: string; // base64 encoded
    file_name: string;
    content_type?: string;
    should_encrypt?: boolean;
    metadata?: {
        description?: string;
        tags?: string[];
        version?: string;
    };
    user_address: string;
    signature: string;
}

export interface UploadResponse {
    cid: string;
    file_size: number;
    is_encrypted: boolean;
    status: string;
    gateway_url: string;
    tx_hash?: string;
    blockchain_stored: boolean;
    reward_tx_hash?: string;
    reward_distributed: boolean;
    expected_reward_fil: string;
    actual_reward_fil: string;
    message: string;
}

export interface RetrieveRequest {
    cid: string;
    user_address: string;
    signature: string;
}

export interface RetrieveResponse {
    file: string; // base64 encoded
    file_name: string;
    content_type: string;
    metadata: any;
}

export interface AccessGrantRequest {
    cid: string;
    grantee: string;
    duration?: number;
    granter: string;
    signature: string;
}

export interface AccessGrantResponse {
    cid: string;
    grantee: string;
    expires_at: string;
    granted_at: string;
    blockchain_tx?: string;
}

export interface RewardClaimRequest {
    cid: string;
    user_address: string;
    signature: string;
}

export interface RewardClaimResponse {
    cid: string;
    tx_hash: string;
    reward_amount: string;
    block_number: number;
    message: string;
}

export interface HealthStatus {
    status: string;
    service: string;
    version: string;
    timestamp: string;
    w3up_ready: boolean;
    database_ready: boolean;
    contract_ready: boolean;
    environment: {
        node_env: string;
        has_web3_token: boolean;
        has_contract: boolean;
        has_private_key: boolean;
        skip_signature_verification: boolean;
    };
}

export interface AnalyticsOverview {
    total_files: number;
    total_users: number;
    total_storage_bytes: number;
    encrypted_files: number;
    recent_activity: Array<{
        date: string;
        uploads: number;
    }>;
}

export interface PerformanceMetrics {
    endpoints: Array<{
        endpoint: string;
        request_count: number;
        avg_response_time: number;
    }>;
}

export interface SystemMetrics {
    uptime: number;
    memory: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
    };
    timestamp: string;
}

export interface NotificationProps {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
    onClose?: () => void;
}

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: any;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface LoadingState {
    isLoading: boolean;
    error: string | null;
    data: any;
}

export interface WalletState {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    chainId: number | null;
}

export interface AccessRevokeRequest {
    cid: string;
    grantee: string;
    granter: string;
    signature: string;
}
