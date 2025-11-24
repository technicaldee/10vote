# Contract Deployment Instructions

## ⚠️ Important: Contract Needs Redeployment

The contract has been updated with **computer duel functionality**. The existing deployed contract does NOT have these new features:
- `createComputerDuel()` function
- `finishComputerDuel()` function
- `isComputerDuel` flag in Duel struct

## Prerequisites

1. Create a `.env` file in the project root (if it doesn't exist)
2. Add the following variables:

```env
# Required for deployment
PRIVATE_KEY=your_private_key_here
CELO_RPC_HTTP_URL=https://forno.celo.org

# Optional (will use defaults if not set)
FEE_COLLECTOR=0x900f96DD68CA49001228348f1A2Cd28556FB62dd
FEE_BPS=500

# These will be auto-populated after deployment
DUEL_CONTRACT_ADDRESS=
VITE_DUEL_CONTRACT_ADDRESS=
```

## Deployment Steps

1. **Compile the contract:**
   ```bash
   npm run compile:contracts
   ```

2. **Deploy to Celo Mainnet:**
   ```bash
   npm run deploy:celo
   ```

   Or using Hardhat directly:
   ```bash
   npx hardhat run scripts/deploy.cjs --network celo
   ```

3. **Verify the deployment:**
   - The script will output the deployed contract address
   - It will automatically update your `.env` file with:
     - `DUEL_CONTRACT_ADDRESS`
     - `VITE_DUEL_CONTRACT_ADDRESS`

4. **Update your frontend:**
   - The frontend reads from `VITE_DUEL_CONTRACT_ADDRESS` in `.env`
   - Restart your dev server after updating `.env`:
     ```bash
     npm run dev
     ```

## Current Contract Address

According to README.md, the current deployed contract is:
- `0x7CB521B5DA3A5Bf62517E90477394D08EdE4823F`

**This contract does NOT have computer duel features and needs to be redeployed.**

## After Deployment

1. Update `README.md` with the new contract address
2. Verify the contract on Celo Explorer (optional but recommended)
3. Test the computer duel functionality:
   - Start a Quick Match
   - Wait 4 seconds
   - Computer opponent should automatically join

## Security Notes

- ⚠️ **NEVER commit your `.env` file** (it's already in `.gitignore`)
- ⚠️ **NEVER share your private key**
- Make sure you have enough CELO in your wallet for gas fees
- Test on a testnet first if possible

