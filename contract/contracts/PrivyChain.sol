// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PrivyChain
 * @dev Smart contract for encrypted file storage tracking and incentives on Filecoin
 * @author PrivyChain Team
 */
contract PrivyChain is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Structs
    struct FileRecord {
        bytes32 cid;
        address uploader;
        uint256 timestamp;
        uint256 fileSize;
        bool isEncrypted;
        bool rewardClaimed;
        string metadata; // JSON metadata string
    }
    
    struct AccessGrant {
        address granter;
        address grantee;
        uint256 expiresAt;
        bool isActive;
    }
    
    // State variables
    mapping(bytes32 => FileRecord) public fileRecords;
    mapping(bytes32 => mapping(address => AccessGrant)) public accessGrants;
    mapping(address => bytes32[]) public userUploads;
    mapping(address => uint256) public userRewardBalance;
    
    // Reward configuration
    uint256 public baseRewardAmount = 0.01 ether; // Base reward in FIL
    uint256 public sizeMultiplier = 1000; // Reward multiplier per KB
    uint256 public encryptionBonus = 0.005 ether; // Bonus for encrypted files
    
    // Optional ERC20 token for rewards
    IERC20 public rewardToken;
    bool public useTokenRewards = false;
    
    // Access control
    mapping(address => bool) public authorizedUploaders;
    bool public requireAuthorization = false;
    
    // Statistics
    uint256 public totalFilesStored;
    uint256 public totalRewardsDistributed;
    uint256 public totalStorageUsed;
    
    // Events
    event FileUploaded(
        bytes32 indexed cid,
        address indexed uploader,
        uint256 fileSize,
        bool isEncrypted,
        uint256 timestamp
    );
    
    event RewardClaimed(
        bytes32 indexed cid,
        address indexed uploader,
        uint256 rewardAmount,
        uint256 timestamp
    );
    
    event AccessGranted(
        bytes32 indexed cid,
        address indexed granter,
        address indexed grantee,
        uint256 expiresAt
    );
    
    event AccessRevoked(
        bytes32 indexed cid,
        address indexed granter,
        address indexed grantee
    );
    
    event RewardConfigUpdated(
        uint256 baseReward,
        uint256 sizeMultiplier,
        uint256 encryptionBonus
    );
    
    // Modifiers
    modifier onlyAuthorizedUploader() {
        if (requireAuthorization) {
            require(authorizedUploaders[msg.sender] || msg.sender == owner(), "Not authorized to upload");
        }
        _;
    }
    
    modifier fileExists(bytes32 cid) {
        require(fileRecords[cid].uploader != address(0), "File does not exist");
        _;
    }
    
    modifier onlyFileOwner(bytes32 cid) {
        require(fileRecords[cid].uploader == msg.sender, "Not the file owner");
        _;
    }
    
    constructor(address _rewardToken) Ownable(msg.sender) {
        if (_rewardToken != address(0)) {
            rewardToken = IERC20(_rewardToken);
            useTokenRewards = true;
        }
    }
    
    /**
     * @dev Records a file upload on-chain
     * @param cid The IPFS/Filecoin CID of the uploaded file
     * @param fileSize Size of the file in bytes
     * @param isEncrypted Whether the file is encrypted
     * @param metadata JSON metadata string
     */
    function recordUpload(
        bytes32 cid,
        uint256 fileSize,
        bool isEncrypted,
        string calldata metadata
    ) external onlyAuthorizedUploader whenNotPaused {
        require(cid != bytes32(0), "Invalid CID");
        require(fileRecords[cid].uploader == address(0), "File already recorded");
        require(fileSize > 0, "File size must be greater than 0");
        
        FileRecord memory newRecord = FileRecord({
            cid: cid,
            uploader: msg.sender,
            timestamp: block.timestamp,
            fileSize: fileSize,
            isEncrypted: isEncrypted,
            rewardClaimed: false,
            metadata: metadata
        });
        
        fileRecords[cid] = newRecord;
        userUploads[msg.sender].push(cid);
        
        // Update statistics
        totalFilesStored++;
        totalStorageUsed += fileSize;
        
        emit FileUploaded(cid, msg.sender, fileSize, isEncrypted, block.timestamp);
    }
    
    /**
     * @dev Claims upload reward for a file
     * @param cid The CID of the uploaded file
     */
    function claimUploadReward(bytes32 cid) external fileExists(cid) nonReentrant whenNotPaused {
        FileRecord storage record = fileRecords[cid];
        require(record.uploader == msg.sender, "Not the uploader");
        require(!record.rewardClaimed, "Reward already claimed");
        
        uint256 rewardAmount = calculateReward(record.fileSize, record.isEncrypted);
        record.rewardClaimed = true;
        
        if (useTokenRewards) {
            rewardToken.safeTransfer(msg.sender, rewardAmount);
        } else {
            require(address(this).balance >= rewardAmount, "Insufficient contract balance");
            payable(msg.sender).transfer(rewardAmount);
        }
        
        userRewardBalance[msg.sender] += rewardAmount;
        totalRewardsDistributed += rewardAmount;
        
        emit RewardClaimed(cid, msg.sender, rewardAmount, block.timestamp);
    }
    
    /**
     * @dev Batch claim rewards for multiple files
     * @param cids Array of CIDs to claim rewards for
     */
    function batchClaimRewards(bytes32[] calldata cids) external nonReentrant whenNotPaused {
        uint256 totalReward = 0;
        
        for (uint256 i = 0; i < cids.length; i++) {
            FileRecord storage record = fileRecords[cids[i]];
            
            if (record.uploader == msg.sender && !record.rewardClaimed) {
                uint256 rewardAmount = calculateReward(record.fileSize, record.isEncrypted);
                record.rewardClaimed = true;
                totalReward += rewardAmount;
                
                emit RewardClaimed(cids[i], msg.sender, rewardAmount, block.timestamp);
            }
        }
        
        require(totalReward > 0, "No rewards to claim");
        
        if (useTokenRewards) {
            rewardToken.safeTransfer(msg.sender, totalReward);
        } else {
            require(address(this).balance >= totalReward, "Insufficient contract balance");
            payable(msg.sender).transfer(totalReward);
        }
        
        userRewardBalance[msg.sender] += totalReward;
        totalRewardsDistributed += totalReward;
    }
    
    /**
     * @dev Grants access to a file for another address
     * @param cid The CID of the file
     * @param grantee The address to grant access to
     * @param duration Duration of access in seconds (0 for permanent)
     */
    function grantAccess(
        bytes32 cid,
        address grantee,
        uint256 duration
    ) external fileExists(cid) onlyFileOwner(cid) whenNotPaused {
        require(grantee != address(0), "Invalid grantee address");
        require(grantee != msg.sender, "Cannot grant access to yourself");
        
        uint256 expiresAt = duration == 0 ? type(uint256).max : block.timestamp + duration;
        
        accessGrants[cid][grantee] = AccessGrant({
            granter: msg.sender,
            grantee: grantee,
            expiresAt: expiresAt,
            isActive: true
        });
        
        emit AccessGranted(cid, msg.sender, grantee, expiresAt);
    }
    
    /**
     * @dev Revokes access to a file
     * @param cid The CID of the file
     * @param grantee The address to revoke access from
     */
    function revokeAccess(bytes32 cid, address grantee) external fileExists(cid) onlyFileOwner(cid) {
        require(accessGrants[cid][grantee].isActive, "Access not granted");
        
        accessGrants[cid][grantee].isActive = false;
        
        emit AccessRevoked(cid, msg.sender, grantee);
    }
    
    /**
     * @dev Checks if an address has access to a file
     * @param cid The CID of the file
     * @param viewer The address to check access for
     * @return bool indicating if access is granted
     */
    function hasAccess(bytes32 cid, address viewer) external view returns (bool) {
        FileRecord memory record = fileRecords[cid];
        
        // Owner always has access
        if (record.uploader == viewer) {
            return true;
        }
        
        AccessGrant memory grant = accessGrants[cid][viewer];
        
        // Check if access is granted and not expired
        return grant.isActive && block.timestamp <= grant.expiresAt;
    }
    
    /**
     * @dev Calculates reward amount based on file size and encryption status
     * @param fileSize Size of the file in bytes
     * @param isEncrypted Whether the file is encrypted
     * @return uint256 reward amount
     */
    function calculateReward(uint256 fileSize, bool isEncrypted) public view returns (uint256) {
        uint256 sizeReward = (fileSize / 1024) * sizeMultiplier; // Per KB
        uint256 totalReward = baseRewardAmount + sizeReward;
        
        if (isEncrypted) {
            totalReward += encryptionBonus;
        }
        
        return totalReward;
    }
    
    /**
     * @dev Gets user's upload history
     * @param user The user address
     * @return bytes32[] array of CIDs uploaded by the user
     */
    function getUserUploads(address user) external view returns (bytes32[] memory) {
        return userUploads[user];
    }
    
    /**
     * @dev Gets file record details
     * @param cid The CID of the file
     * @return FileRecord struct with file details
     */
    function getFileRecord(bytes32 cid) external view returns (FileRecord memory) {
        return fileRecords[cid];
    }
    
    /**
     * @dev Gets access grant details
     * @param cid The CID of the file
     * @param grantee The address of the grantee
     * @return AccessGrant struct with access details
     */
    function getAccessGrant(bytes32 cid, address grantee) external view returns (AccessGrant memory) {
        return accessGrants[cid][grantee];
    }
    
    // Admin functions
    
    /**
     * @dev Updates reward configuration
     * @param newBaseReward New base reward amount
     * @param newSizeMultiplier New size multiplier
     * @param newEncryptionBonus New encryption bonus
     */
    function updateRewardConfig(
        uint256 newBaseReward,
        uint256 newSizeMultiplier,
        uint256 newEncryptionBonus
    ) external onlyOwner {
        baseRewardAmount = newBaseReward;
        sizeMultiplier = newSizeMultiplier;
        encryptionBonus = newEncryptionBonus;
        
        emit RewardConfigUpdated(newBaseReward, newSizeMultiplier, newEncryptionBonus);
    }
    
    /**
     * @dev Sets authorization requirement
     * @param required Whether authorization is required for uploads
     */
    function setAuthorizationRequired(bool required) external onlyOwner {
        requireAuthorization = required;
    }
    
    /**
     * @dev Authorizes or deauthorizes an uploader
     * @param uploader The address to authorize/deauthorize
     * @param authorized Whether the address is authorized
     */
    function setUploaderAuthorization(address uploader, bool authorized) external onlyOwner {
        authorizedUploaders[uploader] = authorized;
    }
    
    /**
     * @dev Sets the reward token address
     * @param newRewardToken Address of the new reward token
     */
    function setRewardToken(address newRewardToken) external onlyOwner {
        if (newRewardToken != address(0)) {
            rewardToken = IERC20(newRewardToken);
            useTokenRewards = true;
        } else {
            useTokenRewards = false;
        }
    }
    
    /**
     * @dev Withdraws contract balance (only owner)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        payable(owner()).transfer(balance);
    }
    
    /**
     * @dev Withdraws ERC20 tokens (only owner)
     * @param token The token address to withdraw
     * @param amount The amount to withdraw
     */
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount); // Automatically reverts on failure
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Fallback functions to receive FIL
    receive() external payable {}
    
    fallback() external payable {}
}

