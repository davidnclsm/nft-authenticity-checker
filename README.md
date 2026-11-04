# NFT Authenticity Checker

Demonstrator für das Referat **„NFTs zwischen Vertrauen und Betrug – Was Blockchain wirklich garantiert“** (Modul Blockchain).

Die App zeigt live, was eine Blockchain bei NFTs garantiert und was nicht:

1. **Alice** (Künstlerin) mintet ein Bild als NFT. Der SHA-256-Hash der Datei wird im Smart Contract gespeichert.
2. **Bob** (Betrüger) versucht, eine identische Kopie zu minten. **Der Smart Contract lehnt ab.**
3. Bob ändert **ein einziges Pixel**. Der Hash ist komplett anders, der Contract akzeptiert die Kopie. → Grenze von kryptografischen Hashes.
4. **Erweiterung:** Ein Perceptual Hash (dHash) erkennt die Kopie als visuell ähnlich, aber nur *off-chain*. → Oracle-Problem.

Alles läuft **lokal und offline**: eigene Blockchain (Hardhat), kein MetaMask, kein Testnet, kein Internet während der Präsentation nötig.

---

## Aufbau

```
nft-authenticity-checker/
├── contracts/                     Smart Contract + lokale Blockchain (Hardhat)
│   ├── contracts/AuthenticNFT.sol    ERC-721-NFT mit Hash-Register
│   ├── test/AuthenticNFT.test.js     5 automatische Tests
│   └── scripts/deploy.js             Deployt den Contract und schreibt Adresse + ABI fürs Frontend
├── frontend/                      Web-App (Next.js + ethers.js)
│   ├── app/page.js                   Oberfläche: minten, prüfen, Liste der NFTs
│   ├── lib/chain.js                  Verbindung zur Blockchain
│   └── lib/hashing.js                SHA-256 und dHash im Browser
└── demo-bilder/                   Testbilder für die Live-Demo
```

| Technik | Wofür |
| --- | --- |
| Solidity 0.8.28 + OpenZeppelin 5 | Smart Contract nach dem ERC-721-Standard |
| Hardhat 2 | Lokale Ethereum-Blockchain, Kompilieren, Tests, Deployment |
| Next.js 16 + React 19 | Web-Oberfläche |
| ethers.js 6 | Kommunikation zwischen Browser und Blockchain |
| Web Crypto API | SHA-256 direkt im Browser |

---

## Einrichtung (einmalig)

Die Demo läuft auf **macOS und Windows** gleich. Die npm-Befehle sind identisch, nur das Terminal und die Ordnertrennzeichen unterscheiden sich:

| | macOS | Windows |
| --- | --- | --- |
| Terminal öffnen | `Cmd + Leertaste` → „Terminal“ | Windows-Taste → „PowerShell“ |
| In Unterordner wechseln | `cd contracts` | `cd contracts` |
| Eine Ebene hoch und weiter | `cd ../frontend` | `cd ..\frontend` |
| Laufenden Prozess beenden | `Ctrl + C` | `Strg + C` |

### 1. Node.js installieren

Im Terminal prüfen:

```bash
node -v
```

- Kommt **v20** oder höher (z. B. `v22.x.x`): passt.
- Kommt eine Fehlermeldung oder eine ältere Version: die **LTS-Version** von <https://nodejs.org> installieren (macOS: `.pkg`, Windows: `.msi`, Standardeinstellungen lassen). Danach das Terminal **schließen und neu öffnen**.

> **Nur Windows:** Meldet PowerShell bei `npm` *„Die Ausführung von Skripts ist auf diesem System deaktiviert“*, einmalig ausführen und mit `J` bestätigen:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

### 2. Projekt herunterladen

```bash
cd ~/Desktop
git clone https://github.com/davidnclsm/nft-authenticity-checker.git
cd nft-authenticity-checker
```

(Windows: `cd $HOME\Desktop` statt `cd ~/Desktop`.)

Ohne Git: Auf GitHub **Code → Download ZIP**, entpacken und im Terminal mit `cd` in den Ordner wechseln. Auf dem Mac fragt `git` beim ersten Mal eventuell, ob die Xcode-Command-Line-Tools installiert werden sollen: einfach bestätigen.

### 3. Pakete installieren

macOS:

```bash
cd contracts && npm install && cd ../frontend && npm install && cd ..
```

Windows (PowerShell):

```powershell
cd contracts; npm install; cd ..\frontend; npm install; cd ..
```

Das dauert beim ersten Mal 1–2 Minuten (hier wird noch Internet gebraucht).

### 4. Testen, ob alles funktioniert

```bash
cd contracts
npm test
```

Erwartet: **5 passing**. Beim ersten Mal lädt Hardhat den Solidity-Compiler herunter.

---

## Demo starten (vor jeder Präsentation)

Du brauchst **drei Terminal-Fenster** (macOS: im Terminal mit `Cmd + T` neue Tabs öffnen). In allen zuerst in den Projektordner `nft-authenticity-checker` wechseln.

**Fenster 1 – lokale Blockchain starten** (bleibt offen):

```bash
cd contracts
npm run chain
```

Es erscheinen 20 Testkonten mit je 10.000 ETH (Spielgeld). Fenster offen lassen.

**Fenster 2 – Smart Contract deployen** (einmal ausführen):

```bash
cd contracts
npm run deploy
```

Erwartet: `AuthenticNFT deployed an: 0x5FbDB2315678afecb367f032d93F642f64180aa3`

**Fenster 3 – Web-App starten** (bleibt offen):

```bash
cd frontend
npm run dev
```

Dann im Browser öffnen: **<http://localhost:3000>**

Oben rechts muss ein grüner Punkt mit **„Lokale Blockchain verbunden“** stehen.

> **Neu starten / zurücksetzen:** Fenster 1 mit `Ctrl + C` (Windows: `Strg + C`) beenden und `npm run chain` erneut starten. Damit ist die Blockchain wieder leer. Danach **immer** `npm run deploy` erneut ausführen und die Seite neu laden.

---

## Ablauf der Live-Demo (ca. 6 Minuten)

Die Bilder liegen im Ordner `demo-bilder/`.

| Schritt | Wallet | Aktion | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| 1 | Alice | Links `1_original.png` wählen, Name eingeben, **NFT minten** | ✓ NFT #1 erstellt, Besitzer Alice |
| 2 | Bob | Rechts `2_kopie_gleiche_datei.png` prüfen | ⚠ Datei bereits registriert (NFT #1, Alice) |
| 3 | Bob | Dieselbe Kopie links minten | ⛔ **Vom Smart Contract abgelehnt** |
| 4 | Bob | Rechts `3_kopie_1_pixel_geaendert.png` prüfen, dann links minten | ✓ Nicht registriert → ✓ NFT #2 erstellt. **Der Aha-Moment** |
| 5 | – | Rechts `4_kopie_verkleinert.png` prüfen, Häkchen **„Erweiterung: Perceptual-Hash“** setzen | ⚠ Sieht aus wie NFT #1, 61 von 64 Hash-Zeichen unterschiedlich |
| 6 | – | Gegenprobe `5_anderes_bild.png` | Kein ähnliches Bild gefunden |

**Kernaussage nach Schritt 4:** *Die Blockchain hat korrekt gearbeitet und trotzdem ist eine Kopie durchgerutscht. Sie beweist, wem ein Token gehört, aber nicht, ob das Bild dahinter original ist.*

Tipp: Vor dem Vortrag einmal komplett durchspielen, danach die Chain neu starten und neu deployen, damit die Liste leer ist. Zusätzlich eine Bildschirmaufnahme der Demo als Backup bereithalten.

---

## Wie es funktioniert

### Smart Contract (`contracts/contracts/AuthenticNFT.sol`)

```solidity
mapping(bytes32 => uint256) public tokenIdByHash;   // Bild-Hash → Token-ID

function mintNFT(bytes32 imageHash, string calldata uri) external returns (uint256 tokenId) {
    if (imageHash == bytes32(0)) revert EmptyHash();
    uint256 existing = tokenIdByHash[imageHash];
    if (existing != 0) revert AlreadyRegistered(imageHash, existing, ownerOf(existing));

    tokenId = _nextTokenId++;
    tokenIdByHash[imageHash] = tokenId;
    ...
    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, uri);
}
```

- Erbt von OpenZeppelin `ERC721URIStorage` (Standard-Funktionen wie `ownerOf`, `transferFrom`, `tokenURI`).
- `mintNFT` ist **nicht** Teil des ERC-721-Standards. Wie Tokens erzeugt werden, legt jeder Contract selbst fest.
- Gespeichert werden Token-ID, Besitzer, Ersteller, Zeitpunkt und der Hash. **Das Bild selbst liegt nicht auf der Blockchain.**
- Metadaten (Name, Beschreibung, Hashes) stecken als `data:`-URI im `tokenURI`. In einem echten Projekt würde man sie auf IPFS ablegen.

### Hashes (`frontend/lib/hashing.js`)

| | SHA-256 (kryptografisch) | dHash (Perceptual Hash) |
| --- | --- | --- |
| Was wird gehasht? | Die rohen Bytes der Datei | Wie das Bild aussieht (9×8 Pixel, Graustufen) |
| 1 Pixel geändert | Völlig anderer Hash | Gleicher oder fast gleicher Hash |
| Vergleich | Gleich / ungleich | Hamming-Distanz (unterschiedliche Bits von 64) |
| Wo geprüft? | **On-chain** im Smart Contract | **Off-chain** im Browser |

Warum nicht den Perceptual Hash on-chain prüfen? Jeder neue Mint müsste mit allen bisherigen Einträgen verglichen werden: teuer, und bei vielen Tokens praktisch unmöglich. Realistisch wäre ein externer Prüfdienst, dem man wieder vertrauen muss → **Oracle-Problem**.

### Bekannte Grenzen (Teil der Präsentation)

- Erkennt nur **byte-identische** Dateien (siehe Schritt 4).
- Gilt nur **in diesem Contract**. Auf anderen Contracts oder Marktplätzen kann dasselbe Bild beliebig oft gemintet werden.
- **Wer zuerst mintet, gewinnt.** Ist der Betrüger schneller als die Künstlerin, schützt das Register den Betrüger.
- Die Blockchain weiß nicht, **wer** der echte Urheber ist. Sie kennt nur Wallet-Adressen (Garbage In, Garbage Out).

---

## Häufige Probleme

| Meldung | Lösung |
| --- | --- |
| „Lokale Blockchain nicht erreichbar“ | Fenster 1 läuft nicht → `npm run chain` im Ordner `contracts` |
| „Noch kein Contract deployt“ | `npm run deploy` im Ordner `contracts`, dann Seite neu laden |
| „Blockchain wurde neu gestartet“ | Nach jedem Neustart der Chain erneut `npm run deploy` |
| Port 3000 oder 8545 belegt | Alte Terminal-Fenster schließen (dort `Ctrl + C`) oder Rechner neu starten |
| `npm` wird nicht erkannt / `command not found` | Node.js installieren und das Terminal neu öffnen |
