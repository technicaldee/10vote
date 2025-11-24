require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL || 'https://forno.celo.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '0x' + '0'.repeat(64), provider);
  
  const duelManagerAddress = process.env.DUEL_CONTRACT_ADDRESS;
  if (!duelManagerAddress) {
    console.error('DUEL_CONTRACT_ADDRESS not set in .env');
    process.exit(1);
  }

  // ABI for registerVerifiedPlayer
  const abi = [
    'function registerVerifiedPlayer(address player) external',
    'function batchRegisterVerified(address[] calldata players) external'
  ];

  const contract = new ethers.Contract(duelManagerAddress, abi, wallet);

  // Get players from command line or env
  const players = process.argv.slice(2);
  if (players.length === 0) {
    console.error('Usage: node register-verified-players.cjs <address1> <address2> ...');
    process.exit(1);
  }

  console.log('Registering verified players:', players);

  if (players.length === 1) {
    const tx = await contract.registerVerifiedPlayer(players[0]);
    console.log('Transaction:', tx.hash);
    await tx.wait();
    console.log('✅ Player registered:', players[0]);
  } else {
    const tx = await contract.batchRegisterVerified(players);
    console.log('Transaction:', tx.hash);
    await tx.wait();
    console.log('✅ Players registered:', players.length);
  }
}

main().catch(console.error);


