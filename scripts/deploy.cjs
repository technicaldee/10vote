require('dotenv').config();
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);

  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;
  const feeBps = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 500; // default 5%

  const DuelManager = await ethers.getContractFactory('DuelManager');
  const duelManager = await DuelManager.deploy(feeCollector, feeBps);
  await duelManager.waitForDeployment();

  const address = await duelManager.getAddress();
  console.log('DuelManager deployed at:', address);

  // Write to .env (append or update DUEL_CONTRACT_ADDRESS)
  const envPath = '.env';
  let env = '';
  try { env = fs.readFileSync(envPath, 'utf8'); } catch {}

  const keys = ['DUEL_CONTRACT_ADDRESS', 'VITE_DUEL_CONTRACT_ADDRESS'];
  for (const key of keys) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(env)) {
      env = env.replace(regex, `${key}=${address}`);
    } else {
      env += (env.endsWith('\n') ? '' : '\n') + `${key}=${address}\n`;
    }
  }
  fs.writeFileSync(envPath, env);
  console.log('Updated .env with DUEL_CONTRACT_ADDRESS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});