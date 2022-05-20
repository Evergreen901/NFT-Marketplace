async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const MarketplaceV1 = await ethers.getContractFactory("MarketplaceV1");
  const marketplaceV1 = await MarketplaceV1.deploy("My NFT Marketplace");
  console.log("Marketplace address:", marketplaceV1.address);

  const MarketplaceV2 = await ethers.getContractFactory("MarketplaceV2");
  const marketplaceV2 = await MarketplaceV2.deploy("My NFT Marketplace");
  console.log("Marketplace address:", marketplaceV2.address);

  const NFTCollection = await ethers.getContractFactory("NFTCollection");
  const nftCollection = await NFTCollection.deploy();
  console.log("NFT Collection address:", nftCollection.address);

  const ERC20 = await ethers.getContractFactory("ERC20");
  const erc20 = await ERC20.deploy(1000000, "Test Payment Token", "TPT");
  console.log("ERC20 Token address:", erc20.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
