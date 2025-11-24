// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title StakingRewards - Staking contract for hackathon
 * @notice Players can stake tokens to earn rewards
 */
contract StakingRewards {
    struct StakeInfo {
        uint256 amount;
        uint64 stakedAt;
        uint64 lastClaimed;
        uint256 totalEarned;
    }

    address public immutable owner;
    address public immutable rewardToken;
    uint256 public rewardRate; // tokens per second per staked token
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;

    mapping(address => StakeInfo) public stakes;
    address[] public stakers;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _rewardToken, uint256 _initialRewardRate) {
        owner = msg.sender;
        rewardToken = _rewardToken;
        rewardRate = _initialRewardRate;
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) {
            info.stakedAt = uint64(block.timestamp);
            info.lastClaimed = uint64(block.timestamp);
            stakers.push(msg.sender);
        } else {
            // Claim pending rewards before staking more
            _claimRewards(msg.sender);
        }

        require(IERC20(rewardToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        info.amount += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        StakeInfo storage info = stakes[msg.sender];
        require(info.amount >= amount, "Insufficient stake");

        // Claim rewards first
        _claimRewards(msg.sender);

        info.amount -= amount;
        totalStaked -= amount;

        if (info.amount == 0) {
            info.stakedAt = 0;
            info.lastClaimed = 0;
        }

        require(IERC20(rewardToken).transfer(msg.sender, amount), "Transfer failed");
        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external {
        _claimRewards(msg.sender);
    }

    function _claimRewards(address user) internal {
        StakeInfo storage info = stakes[user];
        if (info.amount == 0) return;

        uint256 pending = calculatePendingRewards(user);
        if (pending > 0) {
            info.totalEarned += pending;
            info.lastClaimed = uint64(block.timestamp);
            totalRewardsDistributed += pending;
            
            require(IERC20(rewardToken).transfer(user, pending), "Reward transfer failed");
            emit RewardsClaimed(user, pending);
        }
    }

    function calculatePendingRewards(address user) public view returns (uint256) {
        StakeInfo memory info = stakes[user];
        if (info.amount == 0 || info.lastClaimed == 0) return 0;

        uint256 timeElapsed = block.timestamp - info.lastClaimed;
        return (info.amount * rewardRate * timeElapsed) / 1e18;
    }

    function setRewardRate(uint256 newRate) external onlyOwner {
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    function depositRewards(uint256 amount) external {
        require(IERC20(rewardToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }

    function getStakeInfo(address user) external view returns (StakeInfo memory) {
        return stakes[user];
    }

    function getTotalStakers() external view returns (uint256) {
        return stakers.length;
    }
}


