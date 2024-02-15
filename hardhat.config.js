//require("dotenv").config()
require("dotenv").config()
require("@nomicfoundation/hardhat-toolbox")
require("hardhat-gas-reporter")
require("@nomicfoundation/hardhat-verify")
// require("hardhat-etherscan-abi")

const TESTNETS_PRIVATE_KEY = process.env.TESTNETS_PRIVATE_KEY
const MAINNETS_PRIVATE_KEY = process.env.MAINNETS_PRIVATE_KEY
const ALCHEMY_MAINNET_KEY = process.env.ALCHEMY_MAINNET_KEY

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },

  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      blast_sepolia: "blast_sepolia", // apiKey is not required, just set a placeholder
    },
    customChains: [
      {
        network: "blast_sepolia",
        chainId: 168587773,
        urls: {
          apiURL:
            "https://api.routescan.io/v2/network/testnet/evm/168587773/etherscan",
          browserURL: "https://testnet.blastscan.io",
        },
      },
    ],
  },

  networks: {
    hardhat: {
      //
    },
    sepolia: {
      url: `https://1rpc.io/sepolia`,
      chainId: 11155111,
      accounts: [`0x${TESTNETS_PRIVATE_KEY}`],
    },
    mainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_MAINNET_KEY}`,
      chainId: 1,
      accounts: [`0x${MAINNETS_PRIVATE_KEY}`],
    },
    // blast_sepolia: {
    //   url: "https://sepolia.blast.io",
    //   chainId: 168587773,
    // },
  },

  gasReporter: {
    enabled: true,
  },
}
