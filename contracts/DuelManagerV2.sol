// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title DuelManagerV2 - Optimized Duel Contract with Self Verification
 * @notice Gas-optimized version with enforced verification and automatic payouts
 */
contract DuelManagerV2 {
    enum Status { Open, Active, Finished, Cancelled }

    struct Duel {
        bytes32 id;
        address player1;
        address player2;
        uint128 stake; // Packed to save gas
        address token;
        uint8 status; // Packed enum
        address winner;
        uint64 createdAt; // Packed timestamp
        uint64 finishedAt; // Packed timestamp
    }

    struct PlayerStats {
        uint128 wins;
        uint128 losses;
        uint192 winnings; // Packed to save gas
        uint192 totalStaked;
    }

    // Storage layout optimized for gas
    address public immutable owner;
    address public immutable feeCollector;
    uint256 public immutable feeBps; // Immutable to save gas
    
    mapping(bytes32 => Duel) public duels;
    mapping(bytes32 => mapping(address => address)) public confirmations;
    mapping(address => PlayerStats) public stats;
    mapping(address => bool) public verifiedPlayers; // Self-verified players
    address[] public players;
    mapping(address => uint256) private playerIndex; // For O(1) lookup

    // Events
    event DuelCreated(bytes32 indexed id, address indexed player1, uint256 stake, address indexed token);
    event DuelJoined(bytes32 indexed id, address indexed player2);
    event DuelStarted(bytes32 indexed id);
    event ResultConfirmed(bytes32 indexed id, address indexed player, address indexed winner);
    event DuelFinished(bytes32 indexed id, address indexed winner, uint256 prize, uint256 fee);
    event DuelCancelled(bytes32 indexed id);
    event PlayerVerified(address indexed player);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyPlayers(bytes32 id) {
        Duel storage d = duels[id];
        require(msg.sender == d.player1 || msg.sender == d.player2, "Not a player");
        _;
    }

    modifier onlyVerified() {
        require(verifiedPlayers[msg.sender], "Not verified");
        _;
    }

    constructor(address _feeCollector, uint256 _feeBps) {
        owner = msg.sender;
        feeCollector = _feeCollector == address(0) ? msg.sender : _feeCollector;
        require(_feeBps <= 2000, "Fee too high");
        feeBps = _feeBps;
    }

    /**
     * @notice Register a verified player (called by backend after Self verification)
     */
    function registerVerifiedPlayer(address player) external onlyOwner {
        verifiedPlayers[player] = true;
        emit PlayerVerified(player);
    }

    /**
     * @notice Batch register verified players
     */
    function batchRegisterVerified(address[] calldata playerList) external onlyOwner {
        for (uint256 i = 0; i < playerList.length; i++) {
            verifiedPlayers[playerList[i]] = true;
            emit PlayerVerified(playerList[i]);
        }
    }

    /**
     * @notice Create a duel - requires Self verification
     */
    function createDuel(bytes32 id, uint256 stake, address token) external onlyVerified {
        require(duels[id].player1 == address(0), "Duel exists");
        require(stake > 0 && stake <= type(uint128).max, "Invalid stake");
        require(token != address(0), "Token required");

        duels[id] = Duel({
            id: id,
            player1: msg.sender,
            player2: address(0),
            stake: uint128(stake),
            token: token,
            status: uint8(Status.Open),
            winner: address(0),
            createdAt: uint64(block.timestamp),
            finishedAt: 0
        });

        require(IERC20(token).transferFrom(msg.sender, address(this), stake), "Transfer failed");
        
        PlayerStats storage s = stats[msg.sender];
        s.totalStaked += uint192(stake);
        _trackPlayer(msg.sender);

        emit DuelCreated(id, msg.sender, stake, token);
    }

    /**
     * @notice Join a duel - requires Self verification
     */
    function joinDuel(bytes32 id) external onlyVerified {
        Duel storage d = duels[id];
        require(d.player1 != address(0), "Duel missing");
        require(d.status == uint8(Status.Open), "Not open");
        require(d.player2 == address(0), "Joined");
        require(msg.sender != d.player1, "Same player");
        require(verifiedPlayers[d.player1], "Player1 not verified");

        d.player2 = msg.sender;
        d.status = uint8(Status.Active);

        require(IERC20(d.token).transferFrom(msg.sender, address(this), d.stake), "Transfer failed");
        
        PlayerStats storage s = stats[msg.sender];
        s.totalStaked += uint192(d.stake);
        _trackPlayer(msg.sender);

        emit DuelJoined(id, msg.sender);
        emit DuelStarted(id);
    }

    /**
     * @notice Confirm result - both players must confirm same winner
     */
    function confirmResult(bytes32 id, address winner) external onlyPlayers(id) {
        Duel storage d = duels[id];
        require(d.status == uint8(Status.Active), "Not active");
        require(winner == d.player1 || winner == d.player2, "Invalid winner");

        confirmations[id][msg.sender] = winner;
        emit ResultConfirmed(id, msg.sender, winner);

        address c1 = confirmations[id][d.player1];
        address c2 = confirmations[id][d.player2];
        
        // Both confirmed and agree
        if (c1 != address(0) && c2 != address(0) && c1 == c2) {
            _finishDuel(id, c1);
        }
    }

    /**
     * @notice Force finish duel after timeout (only owner, for disputes)
     */
    function forceFinishDuel(bytes32 id, address winner) external onlyOwner {
        Duel storage d = duels[id];
        require(d.status == uint8(Status.Active), "Not active");
        require(winner == d.player1 || winner == d.player2, "Invalid winner");
        require(block.timestamp > d.createdAt + 1 hours, "Too early");
        _finishDuel(id, winner);
    }

    function cancelDuel(bytes32 id) external {
        Duel storage d = duels[id];
        require(d.player1 == msg.sender, "Only creator");
        require(d.status == uint8(Status.Open), "Not open");
        d.status = uint8(Status.Cancelled);
        require(IERC20(d.token).transfer(d.player1, d.stake), "Refund failed");
        emit DuelCancelled(id);
    }

    /**
     * @notice Finish duel - winner gets prize, loser loses stake, fee collected
     */
    function _finishDuel(bytes32 id, address winner) internal {
        Duel storage d = duels[id];
        require(d.status == uint8(Status.Active), "Not active");

        uint256 totalPool = uint256(d.stake) * 2;
        uint256 fee = (totalPool * feeBps) / 10000;
        uint256 prize = totalPool - fee;

        d.status = uint8(Status.Finished);
        d.winner = winner;
        d.finishedAt = uint64(block.timestamp);

        // Winner gets prize
        require(IERC20(d.token).transfer(winner, prize), "Prize transfer failed");
        
        // Fee to collector
        if (fee > 0) {
            require(IERC20(d.token).transfer(feeCollector, fee), "Fee transfer failed");
        }

        // Update stats - loser automatically loses stake (already transferred)
        address loser = winner == d.player1 ? d.player2 : d.player1;
        PlayerStats storage winnerStats = stats[winner];
        PlayerStats storage loserStats = stats[loser];
        
        winnerStats.wins += 1;
        winnerStats.winnings += uint192(prize);
        loserStats.losses += 1;

        emit DuelFinished(id, winner, prize, fee);
    }

    function getPlayers(uint256 start, uint256 count) external view returns (address[] memory) {
        uint256 n = players.length;
        if (start >= n) return new address[](0);
        uint256 end = start + count;
        if (end > n) end = n;
        uint256 size = end - start;
        address[] memory out = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = players[start + i];
        }
        return out;
    }

    function _trackPlayer(address p) internal {
        if (playerIndex[p] == 0 && p != players[0]) {
            players.push(p);
            playerIndex[p] = players.length;
        }
    }

    // View functions
    function getDuel(bytes32 id) external view returns (Duel memory) {
        return duels[id];
    }

    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return stats[player];
    }

    function isVerified(address player) external view returns (bool) {
        return verifiedPlayers[player];
    }
}

