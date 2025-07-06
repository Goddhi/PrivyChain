// Simplified wagmi configuration for wallet connection
import { mainnet, sepolia } from 'wagmi/chains';

// Filecoin Calibration Testnet configuration
export const filecoinCalibrationTestnet = {
    id: 314159,
    name: 'Filecoin Calibration Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Filecoin',
        symbol: 'tFIL',
    },
    rpcUrls: {
        default: {
            http: ['https://api.calibration.node.glif.io/rpc/v1'],
        },
    },
    blockExplorers: {
        default: { name: 'Filfox', url: 'https://calibration.filfox.info/en' },
    },
    testnet: true,
} as const;

// Filecoin Mainnet configuration
export const filecoinMainnet = {
    id: 314,
    name: 'Filecoin Mainnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Filecoin',
        symbol: 'FIL',
    },
    rpcUrls: {
        default: {
            http: ['https://api.node.glif.io/rpc/v1'],
        },
    },
    blockExplorers: {
        default: { name: 'Filfox', url: 'https://filfox.info/en' },
    },
} as const;

export const supportedChains = [filecoinCalibrationTestnet, filecoinMainnet, mainnet, sepolia];
export const defaultChain = filecoinCalibrationTestnet;

// For now, we'll use direct ethers.js connection instead of wagmi
// This simplifies the setup while maintaining wallet functionality
export const wagmiConfig = null;
