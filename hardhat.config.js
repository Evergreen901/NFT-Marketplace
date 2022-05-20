/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-waffle");

const LOCAL_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; //PUT YOUR PRIVATE KEY HERE

module.exports = {
  solidity: "0.8.4",
  networks: {
    localhost: {
      url: `http://localhost:8545`,
      accounts: [`${LOCAL_PRIVATE_KEY}`],
    },
  },
};
