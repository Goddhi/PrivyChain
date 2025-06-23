package services

import (
	"context"
	"crypto/sha256"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/goddhi/privychain/internal/config"
	"github.com/goddhi/privychain/pkg/errors"
)

type BlockchainService struct {
	client       *ethclient.Client
	contractABI  abi.ABI
	config       *config.Config
	contractAddr common.Address
}

func NewBlockchainService(cfg *config.Config) *BlockchainService {
	client, _ := ethclient.Dial(cfg.EthereumRPC)
	contractABI, _ := abi.JSON(strings.NewReader(getContractABI()))
	
	return &BlockchainService{
		client:       client,
		contractABI:  contractABI,
		config:       cfg,
		contractAddr: common.HexToAddress(cfg.ContractAddress),
	}
}

// RecordUpload records a file upload on the blockchain
func (s *BlockchainService) RecordUpload(cid, uploader string, fileSize int64, isEncrypted bool, metadata string) (string, error) {
	// Get private key
	privateKey, err := crypto.HexToECDSA(s.config.PrivateKey)
	if err != nil {
		return "", errors.NewBlockchainError("Invalid private key", err)
	}

	// Create transactor
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(314159)) // Filecoin mainnet
	if err != nil {
		return "", errors.NewBlockchainError("Failed to create transactor", err)
	}

	// Set gas parameters
	auth.GasLimit = uint64(300000)
	auth.GasPrice = big.NewInt(20000000000) // 20 gwei

	// Convert CID to bytes32
	cidBytes, err := s.cidToBytes32(cid)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to convert CID", err)
	}

	// Pack function call
	data, err := s.contractABI.Pack("recordUpload", cidBytes, big.NewInt(fileSize), isEncrypted, metadata)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to pack contract call", err)
	}

	// Create transaction
	tx := types.NewTransaction(
		auth.Nonce.Uint64(),
		s.contractAddr,
		auth.Value,
		auth.GasLimit,
		auth.GasPrice,
		data,
	)

	// Sign transaction
	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to sign transaction", err)
	}

	// Send transaction
	err = s.client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to send transaction", err)
	}

	return signedTx.Hash().Hex(), nil
}

// ClaimReward triggers reward claim for a file
func (s *BlockchainService) ClaimReward(cid, claimer string) (string, error) {
	privateKey, err := crypto.HexToECDSA(s.config.PrivateKey)
	if err != nil {
		return "", errors.NewBlockchainError("Invalid private key", err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(314159))
	if err != nil {
		return "", errors.NewBlockchainError("Failed to create transactor", err)
	}

	auth.GasLimit = uint64(200000)
	auth.GasPrice = big.NewInt(20000000000)

	// Convert CID to bytes32
	cidBytes, err := s.cidToBytes32(cid)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to convert CID", err)
	}

	// Pack function call
	data, err := s.contractABI.Pack("claimUploadReward", cidBytes)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to pack contract call", err)
	}

	// Create and send transaction
	tx := types.NewTransaction(
		auth.Nonce.Uint64(),
		s.contractAddr,
		auth.Value,
		auth.GasLimit,
		auth.GasPrice,
		data,
	)

	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to sign transaction", err)
	}

	err = s.client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to send transaction", err)
	}

	return signedTx.Hash().Hex(), nil
}

// GrantAccessOnChain grants access to a file on blockchain
func (s *BlockchainService) GrantAccessOnChain(cid, granter, grantee string, duration int64) (string, error) {
	privateKey, err := crypto.HexToECDSA(s.config.PrivateKey)
	if err != nil {
		return "", errors.NewBlockchainError("Invalid private key", err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(314159))
	if err != nil {
		return "", errors.NewBlockchainError("Failed to create transactor", err)
	}

	auth.GasLimit = uint64(250000)
	auth.GasPrice = big.NewInt(20000000000)

	// Convert CID to bytes32
	cidBytes, err := s.cidToBytes32(cid)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to convert CID", err)
	}

	// Pack function call
	granteeAddr := common.HexToAddress(grantee)
	data, err := s.contractABI.Pack("grantAccess", cidBytes, granteeAddr, big.NewInt(duration))
	if err != nil {
		return "", errors.NewBlockchainError("Failed to pack contract call", err)
	}

	// Create and send transaction
	tx := types.NewTransaction(
		auth.Nonce.Uint64(),
		s.contractAddr,
		auth.Value,
		auth.GasLimit,
		auth.GasPrice,
		data,
	)

	signedTx, err := auth.Signer(auth.From, tx)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to sign transaction", err)
	}

	err = s.client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		return "", errors.NewBlockchainError("Failed to send transaction", err)
	}

	return signedTx.Hash().Hex(), nil
}

// CheckFileExists checks if a file exists on the blockchain
func (s *BlockchainService) CheckFileExists(cid string) (bool, error) {
	cidBytes, err := s.cidToBytes32(cid)
	if err != nil {
		return false, errors.NewBlockchainError("Failed to convert CID", err)
	}

	// Pack function call for view function
	data, err := s.contractABI.Pack("getFileRecord", cidBytes)
	if err != nil {
		return false, errors.NewBlockchainError("Failed to pack contract call", err)
	}

	// Create call message using ethereum.CallMsg
	msg := ethereum.CallMsg{
		To:   &s.contractAddr,
		Data: data,
	}

	// Call contract
	result, err := s.client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return false, errors.NewBlockchainError("Contract call failed", err)
	}

	// If we get a result, the file exists
	return len(result) > 0, nil
}

// GetTransactionStatus gets the status of a transaction
func (s *BlockchainService) GetTransactionStatus(txHash string) (string, error) {
	hash := common.HexToHash(txHash)
	
	// Check if transaction is pending
	_, isPending, err := s.client.TransactionByHash(context.Background(), hash)
	if err != nil {
		return "failed", errors.NewBlockchainError("Failed to get transaction", err)
	}

	if isPending {
		return "pending", nil
	}

	// Get transaction receipt
	receipt, err := s.client.TransactionReceipt(context.Background(), hash)
	if err != nil {
		return "pending", nil // Transaction might still be mining
	}

	if receipt.Status == 1 {
		return "confirmed", nil
	} else {
		return "failed", nil
	}
}

// HealthCheck checks if blockchain connection is healthy
func (s *BlockchainService) HealthCheck() error {
	// Try to get latest block number
	_, err := s.client.BlockNumber(context.Background())
	if err != nil {
		return errors.NewBlockchainError("Blockchain health check failed", err)
	}
	return nil
}

// Helper functions

// cidToBytes32 converts a CID string to bytes32 for smart contract
func (s *BlockchainService) cidToBytes32(cidStr string) ([32]byte, error) {
	// Simple approach: hash the CID string
	hash := sha256.Sum256([]byte(cidStr))
	return hash, nil
}

// getContractABI returns the smart contract ABI
func getContractABI() string {
	return `[
		{
			"inputs": [
				{"internalType": "bytes32", "name": "cid", "type": "bytes32"},
				{"internalType": "uint256", "name": "fileSize", "type": "uint256"},
				{"internalType": "bool", "name": "isEncrypted", "type": "bool"},
				{"internalType": "string", "name": "metadata", "type": "string"}
			],
			"name": "recordUpload",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{"internalType": "bytes32", "name": "cid", "type": "bytes32"}
			],
			"name": "claimUploadReward",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{"internalType": "bytes32", "name": "cid", "type": "bytes32"},
				{"internalType": "address", "name": "grantee", "type": "address"},
				{"internalType": "uint256", "name": "duration", "type": "uint256"}
			],
			"name": "grantAccess",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{"internalType": "bytes32", "name": "cid", "type": "bytes32"}
			],
			"name": "getFileRecord",
			"outputs": [
				{"internalType": "bytes32", "name": "", "type": "bytes32"},
				{"internalType": "address", "name": "", "type": "address"},
				{"internalType": "uint256", "name": "", "type": "uint256"},
				{"internalType": "uint256", "name": "", "type": "uint256"},
				{"internalType": "bool", "name": "", "type": "bool"},
				{"internalType": "bool", "name": "", "type": "bool"},
				{"internalType": "string", "name": "", "type": "string"}
			],
			"stateMutability": "view",
			"type": "function"
		}
	]`
}


