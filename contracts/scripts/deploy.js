// Deployt den AuthenticNFT-Contract auf die lokale Hardhat-Blockchain
// und schreibt Adresse + ABI für das Frontend nach frontend/public/contract.json.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploye mit Konto:", deployer.address);

  const contract = await hre.ethers.deployContract("AuthenticNFT");
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("AuthenticNFT deployed an:", address);

  const artifact = await hre.artifacts.readArtifact("AuthenticNFT");
  const { chainId } = await hre.ethers.provider.getNetwork();

  const outDir = path.join(__dirname, "..", "..", "frontend", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "contract.json");
  fs.writeFileSync(
    outFile,
    JSON.stringify({ address, chainId: Number(chainId), abi: artifact.abi }, null, 2)
  );
  console.log("Adresse + ABI geschrieben nach:", path.relative(process.cwd(), outFile));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
