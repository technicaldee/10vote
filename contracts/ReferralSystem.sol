// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReferralSystem - Referral tracking for hackathon
 * @notice Tracks referrals and rewards referrers
 */
contract ReferralSystem {
    struct ReferralData {
        address referrer;
        uint256 referrals;
        uint256 totalEarnings;
        uint256 claimedEarnings;
    }

    address public immutable owner;
    uint256 public referralRewardBps; // e.g., 100 = 1%
    mapping(address => ReferralData) public referrals;
    mapping(address => address) public referrerOf; // user => referrer
    mapping(address => bool) public registered;

    event ReferralRegistered(address indexed user, address indexed referrer);
    event ReferralRewardEarned(address indexed referrer, address indexed referee, uint256 amount);
    event RewardsClaimed(address indexed referrer, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 _referralRewardBps) {
        owner = msg.sender;
        referralRewardBps = _referralRewardBps;
    }

    function registerReferral(address referrer) external {
        require(!registered[msg.sender], "Already registered");
        require(referrer != msg.sender, "Cannot refer self");
        require(referrer != address(0), "Invalid referrer");

        referrerOf[msg.sender] = referrer;
        registered[msg.sender] = true;
        referrals[referrer].referrals++;

        emit ReferralRegistered(msg.sender, referrer);
    }

    function recordReferralReward(address referee, uint256 transactionAmount) external {
        address referrer = referrerOf[referee];
        if (referrer == address(0)) return;

        uint256 reward = (transactionAmount * referralRewardBps) / 10000;
        referrals[referrer].totalEarnings += reward;

        emit ReferralRewardEarned(referrer, referee, reward);
    }

    function claimRewards() external {
        ReferralData storage data = referrals[msg.sender];
        uint256 claimable = data.totalEarnings - data.claimedEarnings;
        require(claimable > 0, "No rewards");

        data.claimedEarnings += claimable;
        emit RewardsClaimed(msg.sender, claimable);
    }

    function setReferralRewardBps(uint256 newBps) external onlyOwner {
        require(newBps <= 1000, "Max 10%");
        referralRewardBps = newBps;
    }

    function getReferralData(address user) external view returns (ReferralData memory) {
        return referrals[user];
    }

    function getReferrer(address user) external view returns (address) {
        return referrerOf[user];
    }
}


