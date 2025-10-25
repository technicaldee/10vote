require('dotenv').config();

require('@nomicfoundation/hardhat-toolbox');

const { CELO_RPC_HTTP_URL, PRIVATE_KEY } = process.env;

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    celo: {
      url: CELO_RPC_HTTP_URL || 'https://forno.celo.org',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 42220,
      gasPrice: 'auto'
    }
  }
};