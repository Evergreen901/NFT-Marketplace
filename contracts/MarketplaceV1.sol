// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC20.sol";
import "./NFTCollection.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol"; //For debugging only

contract MarketplaceV1 is IERC721Receiver, ReentrancyGuard {
    // Name of the marketplace
    string public name;

    // Index of sales
    uint256 public index = 0;

    // Structure to define sale properties
    struct Sale {
        uint256 index; // Sale Index
        address addressNFTCollection; // Address of the ERC721 NFT Collection contract
        address addressPaymentToken; // Address of the ERC20 Payment Token contract
        uint256 nftId; // NFT Id
        address creator; // Creator of the sale
        uint256 price; // Price of sale
        uint256 endOfSale; // Timestamp for the end day&time of the sale
        bool soldOut; // default: false, NFT is sold out: true
    }

    // Array will all sales
    Sale[] private allSales;

    // Public event to notify that a new sale has been created
    event NewSale(
        uint256 index,
        address addressNFTCollection,
        address addressPaymentToken,
        uint256 nftId,
        address creator,
        uint256 price,
        uint256 endOfSale
    );

    // Public event to notif that NFT is sold
    event NFTClaimed(uint256 saleIndx, address claimedBy, uint256 price);

    // Public event to notify that an NFT has been refunded to the
    // creator of an sale
    event NFTRefunded(uint256 saleIndex, address claimedBy);

    // constructor of the contract
    constructor(string memory _name) {
        name = _name;
    }

    /**
     * Check if a specific address is
     * a contract address
     * @param _addr: address to verify
     */
    function isContract(address _addr) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(_addr)
        }
        return size > 0;
    }

    /**
     * Create a new sale of a specific NFT
     * @param _addressNFTCollection address of the ERC721 NFT collection contract
     * @param _addressPaymentToken address of the ERC20 payment token contract
     * @param _nftId Id of the NFT for sale
     * @param _price Price of sale
     * @param _endOfSale Timestamp with the end date and time of the sale
     */
    function createSale(
        address _addressNFTCollection,
        address _addressPaymentToken,
        uint256 _nftId,
        uint256 _price,
        uint256 _endOfSale
    ) external returns (uint256) {
        //Check is addresses are valid
        require(
            isContract(_addressNFTCollection),
            "Invalid NFT Collection contract address"
        );
        require(
            isContract(_addressPaymentToken),
            "Invalid Payment Token contract address"
        );

        // Check if the _endOfSale time is valid
        require(_endOfSale > block.timestamp, "Invalid end date for sale");

        // Get NFT collection contract
        NFTCollection nftCollection = NFTCollection(_addressNFTCollection);

        // Make sure the sender that wants to create a new sale
        // for a specific NFT is the owner of this NFT
        require(
            nftCollection.ownerOf(_nftId) == msg.sender,
            "Caller is not the owner of the NFT"
        );

        // Make sure the owner of the NFT approved that the MarketPlace contract
        // is allowed to change ownership of the NFT
        require(
            nftCollection.getApproved(_nftId) == address(this),
            "Require NFT ownership transfer approval"
        );

        // Lock NFT in Marketplace contract
        nftCollection.safeTransferFrom(msg.sender, address(this), _nftId);

        // Create new Sale object
        Sale memory newSale = Sale({
            index: index,
            addressNFTCollection: _addressNFTCollection,
            addressPaymentToken: _addressPaymentToken,
            nftId: _nftId,
            creator: msg.sender,
            price: _price,
            endOfSale: _endOfSale,
            soldOut: false
        });

        //update list
        allSales.push(newSale);

        // increment sale sequence
        index++;

        // Trigger event and return index of new sale
        emit NewSale(
            index,
            _addressNFTCollection,
            _addressPaymentToken,
            _nftId,
            msg.sender,
            _price,
            _endOfSale
        );
        return index;
    }

    /**
     * Check if the sale is open
     * @param _saleIndex Index of the sale
     */
    function isOpen(uint256 _saleIndex) public view returns (bool) {
        Sale storage sale = allSales[_saleIndex];
        if (block.timestamp >= sale.endOfSale) return false;
        return true;
    }

    /**
     * Buy a NFT with saleIndex
     * @param _saleIndex Index of sale
     */
    function buy(uint256 _saleIndex)
        external nonReentrant
        returns (bool)
    {
        require(_saleIndex < allSales.length, "Invalid sale index");
        Sale storage sale = allSales[_saleIndex];

        // check if sale is still open
        require(isOpen(_saleIndex), "Sale is not open");

        // check if NFT is sold out
        require(!sale.soldOut, "NFT is already sold out");

        // check if new bider is not the owner
        require(
            msg.sender != sale.creator,
            "Creator of the sale cannot buy his own NFT"
        );

        // get ERC20 token contract
        ERC20 paymentToken = ERC20(sale.addressPaymentToken);

        // Transfer Payment Token to sale creator
        require(
            paymentToken.transferFrom(msg.sender, sale.creator, sale.price),
            "Transfer of token failed"
        );

        // Get NFT collection contract
        NFTCollection nftCollection = NFTCollection(
            sale.addressNFTCollection
        );

        // Transfer NFT from marketplace contract
        // to the winner address
        nftCollection.safeTransferFrom(
            address(this),
            msg.sender,
            sale.nftId
        );

        // update sale info
        sale.soldOut = true;

        // Trigger public event
        emit NFTClaimed(_saleIndex, msg.sender, sale.price);

        return true;
    }

    /**
     * Function used by the creator of an sale
     * to get his NFT back in case the sale is closed
     * @param _saleIndex Index of the sale
     */
    function refund(uint256 _saleIndex) external {
        require(_saleIndex < allSales.length, "Invalid sale index");

        // Check if the sale is closed
        require(!isOpen(_saleIndex), "Sale is still open");

        // Get sale
        Sale storage sale = allSales[_saleIndex];

        // Check if the caller is the creator of the sale
        require(
            sale.creator == msg.sender,
            "Tokens can be claimed only by the creator of the sale"
        );

        require(
            sale.soldOut == false,
            "NFT is already sold out"
        );

        // Get NFT Collection contract
        NFTCollection nftCollection = NFTCollection(
            sale.addressNFTCollection
        );
        // Transfer NFT back from marketplace contract
        // to the creator of the sale
        nftCollection.transferFrom(
            address(this),
            sale.creator,
            sale.nftId
        );

        emit NFTRefunded(_saleIndex, msg.sender);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
