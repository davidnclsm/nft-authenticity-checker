// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title AuthenticNFT – NFT mit Duplikatprüfung über den SHA-256-Hash der Bilddatei
/// @notice Demonstrator für das Referat "NFTs zwischen Vertrauen und Betrug".
///         Jede Bilddatei (identifiziert über ihren SHA-256-Hash) kann in DIESEM
///         Contract nur einmal als NFT registriert werden.
/// @dev Grenzen (bewusst Teil der Präsentation):
///      - Erkennt nur byte-identische Dateien, keine visuell ähnlichen Bilder.
///      - Gilt nur innerhalb dieses Contracts, nicht für andere Contracts/Marktplätze.
///      - "Wer zuerst mintet, gewinnt" – auch wenn es nicht der Künstler ist.
contract AuthenticNFT is ERC721URIStorage {
    /// @dev Startet bei 1, damit 0 in tokenIdByHash "nicht registriert" bedeutet.
    uint256 private _nextTokenId = 1;

    /// @notice Bild-Hash => Token-ID (0 = noch nicht registriert)
    mapping(bytes32 => uint256) public tokenIdByHash;

    /// @notice Token-ID => Bild-Hash
    mapping(uint256 => bytes32) public imageHashOf;

    /// @notice Token-ID => Wallet, die den Token erzeugt (gemintet) hat
    mapping(uint256 => address) public creatorOf;

    /// @notice Token-ID => Zeitpunkt der Registrierung (Block-Timestamp)
    mapping(uint256 => uint256) public registeredAt;

    event ImageRegistered(uint256 indexed tokenId, bytes32 indexed imageHash, address indexed creator);

    error EmptyHash();
    error AlreadyRegistered(bytes32 imageHash, uint256 tokenId, address owner);

    constructor() ERC721("NFT Authenticity Demo", "NAD") {}

    /// @notice Erzeugt ein neues NFT für eine Bilddatei.
    /// @param imageHash SHA-256-Hash der Bilddatei (im Browser berechnet)
    /// @param uri       Metadaten-URI (hier: data:-URI mit JSON)
    /// @return tokenId  ID des neuen Tokens
    function mintNFT(bytes32 imageHash, string calldata uri) external returns (uint256 tokenId) {
        if (imageHash == bytes32(0)) revert EmptyHash();

        uint256 existing = tokenIdByHash[imageHash];
        if (existing != 0) revert AlreadyRegistered(imageHash, existing, ownerOf(existing));

        tokenId = _nextTokenId++;
        tokenIdByHash[imageHash] = tokenId;
        imageHashOf[tokenId] = imageHash;
        creatorOf[tokenId] = msg.sender;
        registeredAt[tokenId] = block.timestamp;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        emit ImageRegistered(tokenId, imageHash, msg.sender);
    }

    /// @notice Prüft, ob eine Datei (über ihren Hash) bereits registriert ist.
    function checkHash(bytes32 imageHash)
        external
        view
        returns (bool registered, uint256 tokenId, address owner, address creator, uint256 timestamp)
    {
        tokenId = tokenIdByHash[imageHash];
        if (tokenId == 0) {
            return (false, 0, address(0), address(0), 0);
        }
        return (true, tokenId, ownerOf(tokenId), creatorOf[tokenId], registeredAt[tokenId]);
    }

    /// @notice Anzahl bisher erzeugter Tokens.
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}
