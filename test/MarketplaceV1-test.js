const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace contract", () => {
  beforeEach(async () => {
    // Deploy Marketplace contract

    MarketplaceContract = await ethers.getContractFactory("MarketplaceV1");
    Marketplace = await MarketplaceContract.deploy("My NFT Marketplace");
    [ownerMarketPlace, USER1, USER2, _] = await ethers.getSigners();
  });

  describe("Deployment", () => {
    it("Should set the correct name", async () => {
      expect(await Marketplace.name()).to.equal("My NFT Marketplace");
    });

    it("Should initialize sale sequence to 0", async () => {
      expect(await Marketplace.index()).to.equal(0);
    });
  });

  describe("Create Sale - Success", () => {
    beforeEach(async () => {
      // Deploy NFTCollection contract
      NFTCollectionContract = await ethers.getContractFactory("NFTCollection");
      NFTCollection = await NFTCollectionContract.deploy();
      [ownerNFTCollection, _, _, _] = await ethers.getSigners();

      // Deploy payment token contract
      PaymentTokenContract = await ethers.getContractFactory("ERC20");
      PaymentToken = await PaymentTokenContract.deploy(
        1000000,
        "Test Token",
        "XTS"
      );
      [ownerPaymentToken, _, _, _] = await ethers.getSigners();

      // Mint new NFT
      await NFTCollection.mintNFT("Test NFT", "https://ipfs.io/test");

      // Approve NFT Transfer by Marketplace
      await NFTCollection.approve(Marketplace.address, 0);
    });

    let endOfSale = Math.floor(Date.now() / 1000) + 10000;

    it("Check if auction is created", async () => {
      await Marketplace.createSale(
        NFTCollection.address,
        PaymentToken.address,
        0,
        50,
        endOfSale
      );
      const index = await Marketplace.index();
      expect(index).to.equal(1);
    });

    it("Owner of NFT should be the marketplace contract ", async () => {
      await Marketplace.createSale(
        NFTCollection.address,
        PaymentToken.address,
        0,
        50,
        endOfSale
      );
      const ownerNFT = await NFTCollection.ownerOf(0);
      expect(ownerNFT).to.equal(Marketplace.address);
    });
  });

  describe("Transactions - Buy NFT", () => {
    beforeEach(async () => {
      // Deploy NFTCollection contract
      NFTCollectionContract = await ethers.getContractFactory("NFTCollection");
      NFTCollection = await NFTCollectionContract.deploy();
      [ownerNFTCollection, _, _, _] = await ethers.getSigners();

      // Deploy payment token contract
      PaymentTokenContract = await ethers.getContractFactory("ERC20");
      PaymentToken = await PaymentTokenContract.deploy(
        1000000,
        "Test Token",
        "XTS"
      );
      [ownerPaymentToken, _, _, _] = await ethers.getSigners();

      // Mint new NFT
      await NFTCollection.mintNFT("Test NFT", "test.uri.domain.io");

      // Approve NFT transfer by the marketplace
      await NFTCollection.approve(Marketplace.address, 0);

      // Create new auction
      let endOfSale = Math.floor(Date.now() / 1000) + 10000;
      await Marketplace.createSale(
        NFTCollection.address,
        PaymentToken.address,
        0,
        500,
        endOfSale
      );
    });

    describe("Buy NFT - Failure", () => {
      it("Should reject because the sale index is invalid", async () => {
        await expect(Marketplace.connect(USER1).buy(1111)).to.be.revertedWith(
          "Invalid sale index"
        );
      });

      it("Should reject because caller is the creator of the sale", async () => {
        await expect(Marketplace.buy(0)).to.be.revertedWith(
          "Creator of the sale cannot buy his own NFT"
        );
      });

      it("Should reject new Bid because marketplace contract has no approval for token transfer", async () => {
        await expect(Marketplace.connect(USER1).buy(0)).to.be.revertedWith(
          "Invalid allowance"
        );
      });

      it("Should reject because buyer has not enough balances", async () => {
        await PaymentToken.connect(USER1).approve(Marketplace.address, 10000);

        await expect(Marketplace.connect(USER1).buy(0)).to.be.reverted;
      });
    });

    describe("Buy NFT - Success", () => {
      beforeEach(async () => {
        // Allow marketplace contract to transfer token of USER1
        await PaymentToken.connect(USER1).approve(Marketplace.address, 10000);
        // credit USER1 balance with tokens
        await PaymentToken.transfer(USER1.address, 10000);
        // Place new bid with USER1
        await Marketplace.connect(USER1).buy(0);
      });

      it("Token balance of new bider must be debited with the bid amount", async () => {
        let USER1Bal = await PaymentToken.balanceOf(USER1.address);
        expect(USER1Bal).to.equal(9500);
      });

      it("Owner of NFT should be changed to buyer", async () => {
        let ownerNFTAfterTransfer = await NFTCollection.ownerOf(0);
        expect(ownerNFTAfterTransfer).to.equal(USER1.address);
      });

      it("Check balance of sale creator", async () => {
        let balance = await PaymentToken.balanceOf(ownerNFTCollection.address);
        expect(balance).to.equal(
          ethers.BigNumber.from("999999999999999999990500")
        );
      });
    });
  });
});
