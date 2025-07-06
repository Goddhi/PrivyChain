# PrivyChain Frontend

A modern, responsive web application for the PrivyChain decentralized file storage system built on Filecoin.

## Features

### 🚀 Core Functionality
- **File Upload & Storage**: Upload files to Web3.Storage with encryption options
- **Blockchain Integration**: Record file metadata on Filecoin smart contracts
- **Access Control**: Grant and revoke file access permissions
- **Rewards System**: Earn FIL tokens for storing files
- **File Management**: View, download, and manage your stored files

### 📊 Analytics & Monitoring
- **Real-time Statistics**: View system health and performance metrics
- **User Dashboard**: Track your storage usage, rewards, and file statistics
- **Network Overview**: Monitor contract statistics and network activity
- **Performance Metrics**: API response times and system monitoring

### 🔐 Security & Privacy
- **Wallet Integration**: Connect with Web3 wallets for authentication
- **File Encryption**: Client-side encryption for sensitive files
- **Signature Verification**: Cryptographic signatures for all operations
- **Access Control**: Fine-grained permissions for file sharing

### 🔗 Wallet Integration

#### Supported Wallets
- **MetaMask** (recommended) - Browser extension wallet
- **WalletConnect** - Mobile wallet connections
- **Coinbase Wallet** - Coinbase's Web3 wallet
- **Injected Wallets** - Any Ethereum-compatible wallet

#### Network Support
- **Filecoin Calibration Testnet** (default for development)
- **Filecoin Mainnet** (production)
- **Automatic Network Switching** - Prompts users to switch to Filecoin
- **Custom RPC Endpoints** - Configured for optimal Filecoin connectivity

#### Authentication Flow
1. **Connect Wallet** - User clicks "Connect Wallet" button
2. **Browser Prompt** - Wallet extension opens connection dialog
3. **User Approval** - User approves connection in wallet
4. **Network Check** - System checks if user is on Filecoin network
5. **Network Switch** - If needed, prompts user to switch networks
6. **Authentication** - User is authenticated and can access features

#### Message Signing
- **Cryptographic Signatures** - All file operations require wallet signatures
- **Message Generation** - Standardized message format for consistency
- **Signature Verification** - Backend validates signatures before processing
- **User Control** - Users approve each signature request

#### Security Features
- **No Private Key Storage** - Private keys never leave the user's wallet
- **Session Management** - Secure session handling with wallet state
- **Network Validation** - Ensures users are on the correct network
- **Error Handling** - Graceful handling of wallet connection issues

## Technology Stack

### Frontend
- **Next.js 14** - React framework with server-side rendering
- **TypeScript** - Type-safe JavaScript development
- **Tailwind CSS** - CSS framework
- **React Hooks** - React state management

### Blockchain & Storage
- **Filecoin** - Decentralized storage network
- **Web3.Storage** - IPFS/Filecoin gateway service
- **Ethers.js** - Ethereum JavaScript library
- **Wagmi** - React hooks for Ethereum

### UI Components
- **Lucide React** - Icons
- **Recharts** - Chart library
- **React Icons** - Icon library

## API Integration

The frontend integrates with the PrivyChain backend API:

### File Operations
- `POST /upload` - Upload files with encryption
- `POST /retrieve` - Download and decrypt files
- `POST /access/grant` - Grant file access
- `POST /access/revoke` - Revoke file access

### User Management
- `GET /users/:address/stats` - Get user statistics
- `GET /users/:address/files` - List user files

### Blockchain Data
- `GET /contract/stats` - Contract statistics
- `GET /contract/status` - Contract status
- `POST /rewards/claim` - Claim storage rewards

### System Monitoring
- `GET /health` - System health check
- `GET /analytics/overview` - System analytics
- `GET /analytics/performance` - Performance metrics

## Getting Started

### Prerequisites
- Node.js 16.0 or higher
- npm or yarn package manager
- PrivyChain backend server running

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   NODE_ENV=development
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start
```

## Key Components

### Dashboard
- System health monitoring
- User statistics (files, storage, rewards)
- Contract statistics (network activity)
- Quick actions and navigation

### File Upload
- Drag & drop file interface
- Encryption options
- Progress tracking
- Error handling

### File Management
- File listing with search/filter
- Download functionality
- Access control management
- File sharing options

### Rewards System
- Reward balance display
- Claim functionality
- Transaction history
- Reward calculator

## Features in Detail

### 1. File Upload System
- **Multi-file support**: Upload multiple files simultaneously
- **File validation**: Type and size restrictions
- **Progress tracking**: Real-time upload progress
- **Error handling**: Comprehensive error messages
- **Encryption options**: Client-side encryption for privacy

### 2. Blockchain Integration
- **Smart contract interaction**: Direct contract calls
- **Transaction tracking**: Monitor transaction status
- **Gas estimation**: Accurate gas cost calculation
- **Error handling**: User-friendly blockchain error messages

### 3. User Dashboard
- **Statistics overview**: Files, storage, rewards
- **Activity feed**: Recent uploads and actions
- **Quick actions**: Upload, claim rewards, manage files
- **Settings**: Account and privacy preferences

### 4. File Management
- **File browser**: Intuitive file listing
- **Search & filter**: Find files quickly
- **Bulk operations**: Select multiple files
- **Access control**: Manage file permissions

### 5. Rewards System
- **Reward calculation**: Real-time reward estimates
- **Claim interface**: Easy reward claiming
- **Transaction history**: Track reward transactions

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```bash
docker build -t privychain-frontend .
docker run -p 3000:3000 privychain-frontend
```

### Static Export
```bash
npm run build
npm run export
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Built with ❤️ for the Filecoin ecosystem**
