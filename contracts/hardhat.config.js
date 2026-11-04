require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // OpenZeppelin 5.x nutzt den Opcode "mcopy" (seit dem Cancun-Upgrade von Ethereum)
      evmVersion: "cancun",
    },
  },
  networks: {
    // Lokale Blockchain, gestartet mit "npm run chain"
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
