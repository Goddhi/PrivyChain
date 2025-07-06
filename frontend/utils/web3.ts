import { ethers } from 'ethers';

// Web3 utilities for PrivyChain
export function isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function formatAddress(address: string): string {
    if (!address) return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Message generation functions that match the API documentation
export function generateMessage(action: string, data: any): string {
    // Generate consistent message format for signing
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `PrivyChain ${action}\n${JSON.stringify(data)}\nTimestamp: ${timestamp}`;
    return message;
}

export function generateUploadMessage(data: any): string {
    // For upload requests, sign the file content and metadata
    // Based on the API documentation, this should match the backend expectation
    const message = `data_to_authenticate: ${JSON.stringify({
        file: data.file,
        file_name: data.file_name,
        content_type: data.content_type,
        should_encrypt: data.should_encrypt,
        metadata: data.metadata,
        user_address: data.user_address
    })}`;
    console.log('🔐 Generated upload message for signing:', message.substring(0, 100) + '...');
    return message;
}

export function generateRetrieveMessage(cid: string): string {
    // For retrieve requests, sign the CID
    const message = `data_to_authenticate: ${cid}`;
    return message;
}

export function generateAccessMessage(cid: string, grantee: string): string {
    // For access grant requests, sign the CID and grantee
    const message = `data_to_authenticate: ${cid + grantee}`;
    return message;
}

export function generateRevokeMessage(cid: string, grantee: string): string {
    // For access revoke requests, sign the CID and grantee
    const message = `data_to_authenticate: ${cid + grantee}`;
    return message;
}

export function generateRewardMessage(cid: string): string {
    // For reward claim requests, sign the CID
    const message = `data_to_authenticate: ${cid}`;
    return message;
}

// Real wallet signing using ethers
export async function signMessage(message: string, address: string): Promise<string> {
    try {
        // Check if we're in a browser environment with ethereum provider
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // Verify the signer address matches the expected address
            const signerAddress = await signer.getAddress();
            if (signerAddress.toLowerCase() !== address.toLowerCase()) {
                throw new Error('Signer address does not match expected address');
            }

            // Sign the message
            const signature = await signer.signMessage(message);
            console.log('✅ Message signed successfully');
            return signature;
        } else {
            throw new Error('No Ethereum provider found. Please install MetaMask or another Web3 wallet.');
        }
    } catch (error: any) {
        console.error('❌ Failed to sign message:', error);
        throw new Error(`Failed to sign message: ${error.message}`);
    }
}

export function getNetworkConfig() {
    return {
        name: 'Filecoin Calibration Testnet',
        chainId: 314159,
        rpcUrl: 'https://api.calibration.node.glif.io/rpc/v1',
        explorerUrl: 'https://calibration.filfox.info/en',
        currency: {
            name: 'Filecoin',
            symbol: 'tFIL',
            decimals: 18,
        },
    };
}

export function getMainnetNetworkConfig() {
    return {
        name: 'Filecoin Mainnet',
        chainId: 314,
        rpcUrl: 'https://api.node.glif.io/rpc/v1',
        explorerUrl: 'https://filfox.info/en',
        currency: {
            name: 'Filecoin',
            symbol: 'FIL',
            decimals: 18,
        },
    };
}

export function getExplorerUrl(txHash: string, isMainnet: boolean = false): string {
    const network = isMainnet ? getMainnetNetworkConfig() : getNetworkConfig();
    return `${network.explorerUrl}/tx/${txHash}`;
}

export function getGatewayUrl(cid: string): string {
    return `https://w3s.link/ipfs/${cid}`;
}

export function isValidCID(cid: string): boolean {
    // Basic CID validation - should start with 'Qm' for v0 or 'bafy' for v1
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{50,})$/.test(cid);
}

export function getChainExplorerUrl(address: string, isMainnet: boolean = false): string {
    const network = isMainnet ? getMainnetNetworkConfig() : getNetworkConfig();
    return `${network.explorerUrl}/address/${address}`;
}

export function formatTransactionHash(hash: string): string {
    if (!hash) return '';
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export function validateUploadRequest(file: File, userAddress: string): string[] {
    const errors: string[] = [];

    if (!file) {
        errors.push('File is required');
    } else {
        // Check file size (100MB limit)
        if (file.size > 100 * 1024 * 1024) {
            errors.push('File size must be less than 100MB');
        }

        // Check file name
        if (!file.name || file.name.length > 255) {
            errors.push('File name must be between 1 and 255 characters');
        }
    }

    if (!userAddress || !isValidEthereumAddress(userAddress)) {
        errors.push('Valid Ethereum address is required');
    }

    return errors;
}

export function validateAccessRequest(cid: string, grantee: string, granter: string): string[] {
    const errors: string[] = [];

    if (!cid || !isValidCID(cid)) {
        errors.push('Valid CID is required');
    }

    if (!grantee || !isValidEthereumAddress(grantee)) {
        errors.push('Valid grantee address is required');
    }

    if (!granter || !isValidEthereumAddress(granter)) {
        errors.push('Valid granter address is required');
    }

    if (grantee === granter) {
        errors.push('Cannot grant access to yourself');
    }

    return errors;
}

export function getWalletErrorMessage(error: any): string {
    if (error?.code === 4001) {
        return 'User rejected the transaction';
    }
    if (error?.code === -32602) {
        return 'Invalid transaction parameters';
    }
    if (error?.code === -32603) {
        return 'Internal wallet error';
    }
    if (error?.message?.includes('insufficient funds')) {
        return 'Insufficient funds for transaction';
    }
    if (error?.message?.includes('nonce')) {
        return 'Transaction nonce error - please retry';
    }
    if (error?.message?.includes('user rejected')) {
        return 'Transaction was rejected by user';
    }
    if (error?.message?.includes('network')) {
        return 'Network error - please check your connection';
    }

    return error?.message || 'An unknown wallet error occurred';
}

export function formatWalletError(error: any): string {
    const message = getWalletErrorMessage(error);
    return `Wallet Error: ${message}`;
}

// Network switching utilities
export async function switchToFilecoinNetwork(isMainnet: boolean = false): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('No Ethereum provider found');
    }

    const ethereum = (window as any).ethereum;
    const networkConfig = isMainnet ? getMainnetNetworkConfig() : getNetworkConfig();

    try {
        // Try to switch to the network
        await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }],
        });
    } catch (switchError: any) {
        // If the network doesn't exist, add it
        if (switchError.code === 4902) {
            try {
                await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: `0x${networkConfig.chainId.toString(16)}`,
                            chainName: networkConfig.name,
                            nativeCurrency: networkConfig.currency,
                            rpcUrls: [networkConfig.rpcUrl],
                            blockExplorerUrls: [networkConfig.explorerUrl],
                        },
                    ],
                });
            } catch (addError) {
                throw new Error('Failed to add Filecoin network to wallet');
            }
        } else {
            throw new Error('Failed to switch to Filecoin network');
        }
    }
}

// Wallet connection utilities
export async function connectWallet(): Promise<string> {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('No Ethereum provider found. Please install MetaMask or another Web3 wallet.');
    }

    try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);

        // Request account access
        const accounts = await provider.send('eth_requestAccounts', []);

        if (accounts.length === 0) {
            throw new Error('No accounts found');
        }

        const address = accounts[0];
        console.log('✅ Wallet connected:', address);

        // Switch to Filecoin network
        await switchToFilecoinNetwork();

        return address;
    } catch (error: any) {
        console.error('❌ Failed to connect wallet:', error);
        throw new Error(`Failed to connect wallet: ${getWalletErrorMessage(error)}`);
    }
}

export async function disconnectWallet(): Promise<void> {
    // Most wallets don't support programmatic disconnection
    // This is mainly for clearing local state
    console.log('🔌 Wallet disconnected');
}
