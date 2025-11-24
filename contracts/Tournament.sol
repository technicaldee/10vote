// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IDuelManager {
    function verifiedPlayers(address) external view returns (bool);
}

/**
 * @title Tournament - Multi-round tournament contract
 * @notice For hackathon: enables tournament mode with brackets
 */
contract Tournament {
    enum TournamentStatus { Open, Active, Finished, Cancelled }
    enum RoundStatus { Pending, Active, Finished }

    struct TournamentInfo {
        bytes32 id;
        address creator;
        uint256 entryFee;
        address token;
        uint256 prizePool;
        uint256 maxPlayers;
        uint256 currentPlayers;
        TournamentStatus status;
        uint256 rounds;
        uint256 currentRound;
        uint64 startTime;
        uint64 endTime;
    }

    struct Round {
        bytes32 tournamentId;
        uint256 roundNumber;
        RoundStatus status;
        mapping(address => bool) participants;
        address[] participantList;
        mapping(address => address) matchups; // player => opponent
        mapping(address => bool) winners;
        address[] winnerList;
    }

    struct MatchResult {
        address player1;
        address player2;
        address winner;
        bool confirmed;
    }

    address public immutable owner;
    address public immutable duelManager;
    uint256 public immutable feeBps;
    address public immutable feeCollector;

    mapping(bytes32 => TournamentInfo) public tournaments;
    mapping(bytes32 => mapping(uint256 => Round)) public rounds; // tournamentId => roundNumber => Round
    mapping(bytes32 => mapping(uint256 => mapping(address => MatchResult))) public matchResults;
    mapping(bytes32 => address[]) public tournamentPlayers;
    mapping(address => uint256) public playerTournamentWins;

    event TournamentCreated(bytes32 indexed id, address indexed creator, uint256 entryFee, uint256 maxPlayers);
    event PlayerJoined(bytes32 indexed id, address indexed player);
    event TournamentStarted(bytes32 indexed id);
    event RoundStarted(bytes32 indexed id, uint256 roundNumber);
    event MatchResultRecorded(bytes32 indexed id, uint256 round, address indexed winner);
    event RoundFinished(bytes32 indexed id, uint256 roundNumber);
    event TournamentFinished(bytes32 indexed id, address indexed winner, uint256 prize);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyVerified() {
        require(IDuelManager(duelManager).verifiedPlayers(msg.sender), "Not verified");
        _;
    }

    constructor(address _duelManager, address _feeCollector, uint256 _feeBps) {
        owner = msg.sender;
        duelManager = _duelManager;
        feeCollector = _feeCollector;
        feeBps = _feeBps;
    }

    function createTournament(
        bytes32 id,
        uint256 entryFee,
        address token,
        uint256 maxPlayers,
        uint256 /* durationHours */
    ) external onlyVerified {
        require(tournaments[id].creator == address(0), "Tournament exists");
        require(entryFee > 0, "Invalid fee");
        require(maxPlayers >= 4 && maxPlayers <= 64, "Invalid players");
        require((maxPlayers & (maxPlayers - 1)) == 0, "Must be power of 2");

        tournaments[id] = TournamentInfo({
            id: id,
            creator: msg.sender,
            entryFee: entryFee,
            token: token,
            prizePool: 0,
            maxPlayers: maxPlayers,
            currentPlayers: 0,
            status: TournamentStatus.Open,
            rounds: _calculateRounds(maxPlayers),
            currentRound: 0,
            startTime: 0,
            endTime: 0
        });

        emit TournamentCreated(id, msg.sender, entryFee, maxPlayers);
    }

    function joinTournament(bytes32 id) external onlyVerified {
        TournamentInfo storage t = tournaments[id];
        require(t.status == TournamentStatus.Open, "Not open");
        require(t.currentPlayers < t.maxPlayers, "Full");
        require(!_isPlayerInTournament(id, msg.sender), "Already joined");

        require(IERC20(t.token).transferFrom(msg.sender, address(this), t.entryFee), "Transfer failed");
        
        t.prizePool += t.entryFee;
        t.currentPlayers++;
        tournamentPlayers[id].push(msg.sender);

        emit PlayerJoined(id, msg.sender);

        // Auto-start when full
        if (t.currentPlayers == t.maxPlayers) {
            _startTournament(id);
        }
    }

    function startTournament(bytes32 id) external {
        TournamentInfo storage t = tournaments[id];
        require(t.creator == msg.sender || msg.sender == owner, "Not authorized");
        require(t.status == TournamentStatus.Open, "Not open");
        require(t.currentPlayers >= 4, "Not enough players");
        _startTournament(id);
    }

    function _startTournament(bytes32 id) internal {
        TournamentInfo storage t = tournaments[id];
        t.status = TournamentStatus.Active;
        t.startTime = uint64(block.timestamp);
        t.currentRound = 1;
        
        Round storage round = rounds[id][1];
        round.tournamentId = id;
        round.roundNumber = 1;
        round.status = RoundStatus.Active;
        round.participantList = tournamentPlayers[id];
        
        for (uint256 i = 0; i < round.participantList.length; i++) {
            round.participants[round.participantList[i]] = true;
        }

        _pairPlayers(id, 1);
        emit TournamentStarted(id);
        emit RoundStarted(id, 1);
    }

    function recordMatchResult(
        bytes32 tournamentId,
        uint256 roundNumber,
        address opponent,
        address winner
    ) external onlyVerified {
        TournamentInfo storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Active, "Not active");
        require(roundNumber == t.currentRound, "Wrong round");
        
        Round storage round = rounds[tournamentId][roundNumber];
        require(round.status == RoundStatus.Active, "Round not active");
        require(round.participants[msg.sender], "Not a participant");
        require(round.participants[opponent], "Invalid opponent");
        require(round.matchups[msg.sender] == opponent, "Not your opponent");
        require(winner == msg.sender || winner == opponent, "Invalid winner");

        MatchResult storage result = matchResults[tournamentId][roundNumber][msg.sender];
        
        if (!result.confirmed) {
            result.player1 = msg.sender < opponent ? msg.sender : opponent;
            result.player2 = msg.sender < opponent ? opponent : msg.sender;
            result.winner = winner;
            result.confirmed = true;
            emit MatchResultRecorded(tournamentId, roundNumber, winner);
            
            // Add winner to next round
            if (!round.winners[winner]) {
                round.winners[winner] = true;
                round.winnerList.push(winner);
            }
        } else {
            require(result.winner == winner, "Result mismatch");
        }

        // Check if round is complete
        if (_isRoundComplete(tournamentId, roundNumber)) {
            _finishRound(tournamentId, roundNumber);
        }
    }

    function _finishRound(bytes32 tournamentId, uint256 roundNumber) internal {
        Round storage round = rounds[tournamentId][roundNumber];
        round.status = RoundStatus.Finished;

        TournamentInfo storage t = tournaments[tournamentId];
        
        if (roundNumber < t.rounds) {
            // Start next round
            t.currentRound++;
            Round storage nextRound = rounds[tournamentId][t.currentRound];
            nextRound.tournamentId = tournamentId;
            nextRound.roundNumber = t.currentRound;
            nextRound.status = RoundStatus.Active;
            nextRound.participantList = round.winnerList;
            
            for (uint256 i = 0; i < nextRound.participantList.length; i++) {
                nextRound.participants[nextRound.participantList[i]] = true;
            }
            
            _pairPlayers(tournamentId, t.currentRound);
            emit RoundStarted(tournamentId, t.currentRound);
        } else {
            // Tournament finished
            t.status = TournamentStatus.Finished;
            t.endTime = uint64(block.timestamp);
            
            address winner = round.winnerList[0];
            uint256 fee = (t.prizePool * feeBps) / 10000;
            uint256 prize = t.prizePool - fee;
            
            require(IERC20(t.token).transfer(winner, prize), "Prize failed");
            if (fee > 0) {
                require(IERC20(t.token).transfer(feeCollector, fee), "Fee failed");
            }
            
            playerTournamentWins[winner]++;
            emit TournamentFinished(tournamentId, winner, prize);
        }
        
        emit RoundFinished(tournamentId, roundNumber);
    }

    function _pairPlayers(bytes32 tournamentId, uint256 roundNumber) internal {
        Round storage round = rounds[tournamentId][roundNumber];
        uint256 count = round.participantList.length;
        
        for (uint256 i = 0; i < count; i += 2) {
            address p1 = round.participantList[i];
            address p2 = round.participantList[i + 1];
            round.matchups[p1] = p2;
            round.matchups[p2] = p1;
        }
    }

    function _isRoundComplete(bytes32 tournamentId, uint256 roundNumber) internal view returns (bool) {
        Round storage round = rounds[tournamentId][roundNumber];
        uint256 expectedMatches = round.participantList.length / 2;
        return round.winnerList.length == expectedMatches;
    }

    function _isPlayerInTournament(bytes32 id, address player) internal view returns (bool) {
        address[] memory players = tournamentPlayers[id];
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == player) return true;
        }
        return false;
    }

    function _calculateRounds(uint256 playerCount) internal pure returns (uint256) {
        uint256 roundCount = 0;
        while (playerCount > 1) {
            roundCount++;
            playerCount /= 2;
        }
        return roundCount;
    }

    // View functions
    function getTournament(bytes32 id) external view returns (TournamentInfo memory) {
        return tournaments[id];
    }

    function getRoundParticipants(bytes32 tournamentId, uint256 roundNumber) external view returns (address[] memory) {
        return rounds[tournamentId][roundNumber].participantList;
    }

    function getRoundWinners(bytes32 tournamentId, uint256 roundNumber) external view returns (address[] memory) {
        return rounds[tournamentId][roundNumber].winnerList;
    }

    function getMatchup(bytes32 tournamentId, uint256 roundNumber, address player) external view returns (address) {
        return rounds[tournamentId][roundNumber].matchups[player];
    }
}

