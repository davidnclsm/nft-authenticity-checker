// Verbindung zur lokalen Hardhat-Blockchain über ethers.js.
// Kein MetaMask nötig: Die Hardhat-Testkonten sind im lokalen Node entsperrt,
// Transaktionen werden direkt vom Node signiert.
import { Contract, JsonRpcProvider, Network } from "ethers";

export const RPC_URL = "http://127.0.0.1:8545";
export const CHAIN_ID = 31337; // Standard-Chain-ID des Hardhat-Nodes

/** Rollen für die ersten drei Hardhat-Testkonten – macht die Demo greifbarer. */
export const ROLES = [
  { name: "Alice", role: "Künstlerin" },
  { name: "Bob", role: "Betrüger" },
  { name: "Carol", role: "Sammlerin" },
];

let provider;
export function getProvider() {
  if (!provider) {
    provider = new JsonRpcProvider(RPC_URL, Network.from(CHAIN_ID), {
      staticNetwork: true,
      pollingInterval: 1000,
    });
  }
  return provider;
}

/** Liest Adresse + ABI, die "npm run deploy" nach public/contract.json schreibt. */
export async function loadDeployment() {
  const res = await fetch("/contract.json", { cache: "no-store" });
  if (!res.ok) throw new Error("NO_DEPLOYMENT");
  return res.json();
}

/** Liefert den Contract (nur lesend) und prüft, ob er auf der Chain existiert. */
export async function getReadContract(deployment) {
  const p = getProvider();
  const code = await p.getCode(deployment.address);
  if (code === "0x") throw new Error("NOT_DEPLOYED");
  return new Contract(deployment.address, deployment.abi, p);
}

/** Die Testkonten des Hardhat-Nodes mit Rollen. */
export async function loadAccounts() {
  const addresses = await getProvider().send("eth_accounts", []);
  return addresses.slice(0, ROLES.length).map((address, i) => ({ address, ...ROLES[i] }));
}

/** Liest alle registrierten Tokens direkt aus dem Contract. */
export async function loadTokens(contract) {
  const total = Number(await contract.totalMinted());
  const ids = Array.from({ length: total }, (_, i) => i + 1);
  return Promise.all(
    ids.map(async (id) => {
      const [owner, creator, imageHash, uri, registeredAt] = await Promise.all([
        contract.ownerOf(id),
        contract.creatorOf(id),
        contract.imageHashOf(id),
        contract.tokenURI(id),
        contract.registeredAt(id),
      ]);
      return {
        id,
        owner,
        creator,
        imageHash,
        registeredAt: Number(registeredAt),
        metadata: fromDataUri(uri),
      };
    })
  );
}

// --- Metadaten als data:-URI (statt IPFS, damit die Demo offline läuft) ---

export function toDataUri(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return "data:application/json;base64," + btoa(bin);
}

export function fromDataUri(uri) {
  try {
    const bin = atob(uri.split(",")[1]);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// --- Fehler verständlich machen ---

/** Liest den Revert-Grund (Custom Error) aus einem ethers-Fehler. */
export function decodeRevert(err, contract) {
  if (err?.revert?.name) return err.revert;
  const data = err?.data ?? err?.info?.error?.data ?? err?.error?.data;
  if (typeof data === "string" && contract) {
    try {
      const parsed = contract.interface.parseError(data);
      if (parsed) return { name: parsed.name, args: parsed.args };
    } catch {}
  }
  return null;
}

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "–");
export const shortHash = (h, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-6)}` : "–");
