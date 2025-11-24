export const duelManagerAbi = [
  // Events
  {
    type: 'event',
    name: 'DuelCreated',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'player1', type: 'address', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
  { type: 'event', name: 'DuelJoined', inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'player2', type: 'address', indexed: true },
    ], anonymous: false },
  { type: 'event', name: 'DuelStarted', inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
    ], anonymous: false },
  { type: 'event', name: 'ResultConfirmed', inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
    ], anonymous: false },
  { type: 'event', name: 'DuelFinished', inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'prize', type: 'uint256', indexed: false },
    ], anonymous: false },
  { type: 'event', name: 'DuelCancelled', inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
    ], anonymous: false },

  // Functions
  { type: 'function', stateMutability: 'nonpayable', name: 'createDuel', inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'stake', type: 'uint256' },
      { name: 'token', type: 'address' },
    ], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'joinDuel', inputs: [
      { name: 'id', type: 'bytes32' },
    ], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'confirmResult', inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'winner', type: 'address' },
    ], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'cancelDuel', inputs: [
      { name: 'id', type: 'bytes32' },
    ], outputs: [] },
  { type: 'function', stateMutability: 'view', name: 'duels', inputs: [
      { name: '', type: 'bytes32' },
    ], outputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'player1', type: 'address' },
      { name: 'player2', type: 'address' },
      { name: 'stake', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'status', type: 'uint8' },
      { name: 'winner', type: 'address' },
      { name: 'isComputerDuel', type: 'bool' },
    ] },
  { type: 'function', stateMutability: 'view', name: 'stats', inputs: [
      { name: '', type: 'address' },
    ], outputs: [
      { name: 'wins', type: 'uint256' },
      { name: 'losses', type: 'uint256' },
      { name: 'winnings', type: 'uint256' },
      { name: 'totalStaked', type: 'uint256' },
    ] },
  { type: 'function', stateMutability: 'view', name: 'getPlayers', inputs: [
      { name: 'start', type: 'uint256' },
      { name: 'count', type: 'uint256' },
    ], outputs: [
      { name: '', type: 'address[]' },
    ] },
  { type: 'function', stateMutability: 'nonpayable', name: 'createComputerDuel', inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'stake', type: 'uint256' },
      { name: 'token', type: 'address' },
    ], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'finishComputerDuel', inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'winner', type: 'address' },
    ], outputs: [] },
  { type: 'event', name: 'ComputerDuelCreated', inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'player1', type: 'address', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: true },
    ], anonymous: false },
  { type: 'event', name: 'ComputerDuelFinished', inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'prize', type: 'uint256', indexed: false },
      { name: 'playerWon', type: 'bool', indexed: false },
    ], anonymous: false },
] as const;

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'transferFrom', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;