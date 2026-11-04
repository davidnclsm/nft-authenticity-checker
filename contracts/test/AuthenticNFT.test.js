const { expect } = require("chai");
const { ethers } = require("hardhat");

// SHA-256 eines Byte-Arrays als bytes32 (genau wie im Browser)
const sha = (text) => ethers.sha256(ethers.toUtf8Bytes(text));

describe("AuthenticNFT", function () {
  let nft, alice, bob;

  beforeEach(async function () {
    [alice, bob] = await ethers.getSigners();
    nft = await ethers.deployContract("AuthenticNFT");
  });

  it("mintet ein NFT und speichert Hash, Besitzer und Ersteller", async function () {
    const hash = sha("original.png");
    await expect(nft.connect(alice).mintNFT(hash, "data:application/json,{}"))
      .to.emit(nft, "ImageRegistered")
      .withArgs(1n, hash, alice.address);

    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.creatorOf(1)).to.equal(alice.address);
    expect(await nft.imageHashOf(1)).to.equal(hash);
    expect(await nft.tokenIdByHash(hash)).to.equal(1n);
    expect(await nft.tokenURI(1)).to.equal("data:application/json,{}");
    expect(await nft.totalMinted()).to.equal(1n);
  });

  it("lehnt eine identische Datei ab (Copy-Minting)", async function () {
    const hash = sha("original.png");
    await nft.connect(alice).mintNFT(hash, "uri-1");

    await expect(nft.connect(bob).mintNFT(hash, "uri-2"))
      .to.be.revertedWithCustomError(nft, "AlreadyRegistered")
      .withArgs(hash, 1n, alice.address);
  });

  it("akzeptiert eine minimal veränderte Datei (Grenze von SHA-256)", async function () {
    await nft.connect(alice).mintNFT(sha("original.png"), "uri-1");
    // Ein einziges geändertes Zeichen/Pixel => komplett anderer Hash
    await nft.connect(bob).mintNFT(sha("original.pnh"), "uri-2");

    expect(await nft.ownerOf(2)).to.equal(bob.address);
    expect(await nft.totalMinted()).to.equal(2n);
  });

  it("checkHash liefert Status, Besitzer und Ersteller", async function () {
    const hash = sha("original.png");
    let res = await nft.checkHash(hash);
    expect(res.registered).to.equal(false);

    await nft.connect(alice).mintNFT(hash, "uri-1");
    // Token wird an Bob verkauft/übertragen: Besitzer ändert sich, Ersteller nicht
    await nft.connect(alice).transferFrom(alice.address, bob.address, 1);

    res = await nft.checkHash(hash);
    expect(res.registered).to.equal(true);
    expect(res.tokenId).to.equal(1n);
    expect(res.owner).to.equal(bob.address);
    expect(res.creator).to.equal(alice.address);
  });

  it("lehnt einen leeren Hash ab", async function () {
    await expect(nft.mintNFT(ethers.ZeroHash, "uri")).to.be.revertedWithCustomError(nft, "EmptyHash");
  });
});
