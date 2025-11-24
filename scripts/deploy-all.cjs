require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const network = process.env.NETWORK || 'celo';
  const provider = new ethers.JsonRpcProvider(
    network === 'celo' 
      ? process.env.CELO_RPC_URL || process.env.CELO_RPC_HTTP_URL || 'https://forno.celo.org'
      : process.env.RPC_URL || 'http://localhost:8545'
  );

  if (!process.env.PRIVATE_KEY) {
    console.error('PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log('Deploying from:', wallet.address);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'CELO');

  const feeCollector = process.env.FEE_COLLECTOR || wallet.address;
  const feeBps = BigInt(process.env.FEE_BPS || '500'); // 5%

  // Read contract ABIs
  const artifactsDir = path.join(__dirname, '../artifacts/contracts');
  const duelManagerV2Artifact = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, 'DuelManagerV2.sol/DuelManagerV2.json'), 'utf8')
  );
  const tournamentArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, 'Tournament.sol/Tournament.json'), 'utf8')
  );
  const stakingArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, 'StakingRewards.sol/StakingRewards.json'), 'utf8')
  );
  const referralArtifact = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, 'ReferralSystem.sol/ReferralSystem.json'), 'utf8')
  );

  console.log('\n=== Deploying Contracts ===\n');

  // 1. Deploy DuelManagerV2
  console.log('1. Deploying DuelManagerV2...');
  const DuelManagerV2Factory = new ethers.ContractFactory(
    duelManagerV2Artifact.abi,
    duelManagerV2Artifact.bytecode,
    wallet
  );
  const duelManagerV2 = await DuelManagerV2Factory.deploy(feeCollector, feeBps);
  await duelManagerV2.waitForDeployment();
  const duelManagerV2Address = await duelManagerV2.getAddress();
  console.log('   DuelManagerV2 deployed to:', duelManagerV2Address);

  // 2. Deploy Tournament (needs DuelManager address)
  console.log('2. Deploying Tournament...');
  const TournamentFactory = new ethers.ContractFactory(
    tournamentArtifact.abi,
    tournamentArtifact.bytecode,
    wallet
  );
  const tournament = await TournamentFactory.deploy(duelManagerV2Address, feeCollector, feeBps);
  await tournament.waitForDeployment();
  const tournamentAddress = await tournament.getAddress();
  console.log('   Tournament deployed to:', tournamentAddress);

  // 3. Deploy StakingRewards (needs reward token - using cUSD)
  console.log('3. Deploying StakingRewards...');
  const CUSD_ADDRESS = process.env.CUSD_ADDRESS || '0x765DE816845861e75A25fCA122bb6898B8B1282a';
  const INITIAL_REWARD_RATE = BigInt(process.env.INITIAL_REWARD_RATE || '1000000000000'); // 1e12 per second
  const StakingFactory = new ethers.ContractFactory(
    stakingArtifact.abi,
    stakingArtifact.bytecode,
    wallet
  );
  const staking = await StakingFactory.deploy(CUSD_ADDRESS, INITIAL_REWARD_RATE);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log('   StakingRewards deployed to:', stakingAddress);

  // 4. Deploy ReferralSystem
  console.log('4. Deploying ReferralSystem...');
  const REFERRAL_BPS = BigInt(process.env.REFERRAL_BPS || '100'); // 1%
  const ReferralFactory = new ethers.ContractFactory(
    referralArtifact.abi,
    referralArtifact.bytecode,
    wallet
  );
  const referral = await ReferralFactory.deploy(REFERRAL_BPS);
  await referral.waitForDeployment();
  const referralAddress = await referral.getAddress();
  console.log('   ReferralSystem deployed to:', referralAddress);

  // Update .env file
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (e) {
    console.log('Creating new .env file...');
  }

  // Remove old contract addresses
  envContent = envContent.replace(/DUEL_CONTRACT_ADDRESS=.*\n/g, '');
  envContent = envContent.replace(/VITE_DUEL_CONTRACT_ADDRESS=.*\n/g, '');
  envContent = envContent.replace(/TOURNAMENT_CONTRACT_ADDRESS=.*\n/g, '');
  envContent = envContent.replace(/STAKING_CONTRACT_ADDRESS=.*\n/g, '');
  envContent = envContent.replace(/REFERRAL_CONTRACT_ADDRESS=.*\n/g, '');

  // Add new addresses
  if (!envContent.endsWith('\n')) envContent += '\n';
  envContent += `# Contract Addresses (${network} - deployed ${new Date().toISOString()})\n`;
  envContent += `DUEL_CONTRACT_ADDRESS=${duelManagerV2Address}\n`;
  envContent += `VITE_DUEL_CONTRACT_ADDRESS=${duelManagerV2Address}\n`;
  envContent += `TOURNAMENT_CONTRACT_ADDRESS=${tournamentAddress}\n`;
  envContent += `STAKING_CONTRACT_ADDRESS=${stakingAddress}\n`;
  envContent += `REFERRAL_CONTRACT_ADDRESS=${referralAddress}\n`;

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ .env file updated with contract addresses');

  console.log('\n=== Deployment Summary ===');
  console.log('Network:', network);
  console.log('DuelManagerV2:', duelManagerV2Address);
  console.log('Tournament:', tournamentAddress);
  console.log('StakingRewards:', stakingAddress);
  console.log('ReferralSystem:', referralAddress);
  console.log('Fee Collector:', feeCollector);
  console.log('Fee BPS:', feeBps.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

