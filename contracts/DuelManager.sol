// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract DuelManager {
    enum Status { Open, Active, Finished, Cancelled }

    struct Duel {
        bytes32 id;
        address player1;
        address player2;
        uint256 stake;
        address token; // cUSD (or any ERC20)
        Status status;
        address winner;
    }

    struct PlayerStats {
        uint256 wins;
        uint256 losses;
        uint256 winnings; // total prize won
        uint256 totalStaked;
    }

    address public owner;
    address public feeCollector;
    uint256 public feeBps; // e.g., 500 = 5%

    mapping(bytes32 => Duel) public duels;
    mapping(bytes32 => mapping(address => address)) public confirmations; // duelId => player => winner

    mapping(address => PlayerStats) public stats;
    address[] public players;
    mapping(address => bool) private seenPlayer;

    event DuelCreated(bytes32 indexed id, address indexed player1, uint256 stake, address indexed token);
    event DuelJoined(bytes32 indexed id, address indexed player2);
    event DuelStarted(bytes32 indexed id);
    event ResultConfirmed(bytes32 indexed id, address indexed player, address indexed winner);
    event DuelFinished(bytes32 indexed id, address indexed winner, uint256 prize);
    event DuelCancelled(bytes32 indexed id);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyPlayers(bytes32 id) {
        Duel storage d = duels[id];
        require(msg.sender == d.player1 || msg.sender == d.player2, "Not a player");
        _;
    }

    constructor(address _feeCollector, uint256 _feeBps) {
        owner = msg.sender;
        feeCollector = _feeCollector == address(0) ? msg.sender : _feeCollector;
        feeBps = _feeBps;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        feeCollector = _feeCollector;
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 2000, "Fee too high"); // max 20%
        feeBps = _feeBps;
    }

    function createDuel(bytes32 id, uint256 stake, address token) external {
        require(duels[id].player1 == address(0), "Duel exists");
        require(stake > 0, "Stake>0");
        require(token != address(0), "Token required");

        duels[id] = Duel({
            id: id,
            player1: msg.sender,
            player2: address(0),
            stake: stake,
            token: token,
            status: Status.Open,
            winner: address(0)
        });

        // pull stake from player1
        require(IERC20(token).transferFrom(msg.sender, address(this), stake), "stake transfer failed");
        stats[msg.sender].totalStaked += stake;
        _trackPlayer(msg.sender);

        emit DuelCreated(id, msg.sender, stake, token);
    }

    function joinDuel(bytes32 id) external {
        Duel storage d = duels[id];
        require(d.player1 != address(0), "Duel missing");
        require(d.status == Status.Open, "Not open");
        require(d.player2 == address(0), "Joined");
        require(msg.sender != d.player1, "Same player");

        d.player2 = msg.sender;
        d.status = Status.Active;

        // pull stake from player2
        require(IERC20(d.token).transferFrom(msg.sender, address(this), d.stake), "stake transfer failed");
        stats[msg.sender].totalStaked += d.stake;
        _trackPlayer(msg.sender);

        emit DuelJoined(id, msg.sender);
        emit DuelStarted(id);
    }

    // Each player confirms who the winner is. If both agree, payout.
    function confirmResult(bytes32 id, address winner) external onlyPlayers(id) {
        Duel storage d = duels[id];
        require(d.status == Status.Active, "Not active");
        require(winner == d.player1 || winner == d.player2, "Invalid winner");

        confirmations[id][msg.sender] = winner;
        emit ResultConfirmed(id, msg.sender, winner);

        address c1 = confirmations[id][d.player1];
        address c2 = confirmations[id][d.player2];
        if (c1 != address(0) && c2 != address(0) && c1 == c2) {
            _finishDuel(id, c1);
        }
    }

    function cancelDuel(bytes32 id) external {
        Duel storage d = duels[id];
        require(d.player1 == msg.sender, "Only creator");
        require(d.status == Status.Open, "Not open");
        d.status = Status.Cancelled;
        // Refund stake to player1
        require(IERC20(d.token).transfer(d.player1, d.stake), "refund failed");
        emit DuelCancelled(id);
    }

    function _finishDuel(bytes32 id, address winner) internal {
        Duel storage d = duels[id];
        require(d.status == Status.Active, "Not active");

        uint256 totalPool = d.stake * 2;
        uint256 fee = (totalPool * feeBps) / 10000;
        uint256 prize = totalPool - fee;

        d.status = Status.Finished;
        d.winner = winner;

        require(IERC20(d.token).transfer(winner, prize), "prize transfer failed");
        if (fee > 0) {
            require(IERC20(d.token).transfer(feeCollector, fee), "fee transfer failed");
        }

        // Update stats
        address loser = winner == d.player1 ? d.player2 : d.player1;
        stats[winner].wins += 1;
        stats[winner].winnings += prize;
        stats[loser].losses += 1;

        emit DuelFinished(id, winner, prize);
    }

    function getPlayers(uint256 start, uint256 count) external view returns (address[] memory out) {
        uint256 n = players.length;
        if (start >= n) return new address[](0);
        uint256 end = start + count;
        if (end > n) end = n;
        uint256 size = end - start;
        out = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = players[start + i];
        }
    }

    function _trackPlayer(address p) internal {
        if (!seenPlayer[p]) {
            seenPlayer[p] = true;
            players.push(p);
        }
    }
}