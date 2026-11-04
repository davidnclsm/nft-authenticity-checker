"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decodeRevert,
  getProvider,
  getReadContract,
  loadAccounts,
  loadDeployment,
  loadTokens,
  shortAddr,
  shortHash,
  toDataUri,
} from "../lib/chain";
import { SIMILARITY_THRESHOLD, dHashFile, differingChars, hammingDistance, sha256File } from "../lib/hashing";

export default function Home() {
  const [conn, setConn] = useState({ state: "loading" });
  const [contract, setContract] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [active, setActive] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [flashId, setFlashId] = useState(null);
  // Vorschaubilder: Hash -> Object-URL (nur im Browser, das Bild liegt NICHT auf der Blockchain)
  const [previews, setPreviews] = useState({});

  // ---------- Verbindung & Daten ----------
  const refresh = useCallback(async (c = contract) => {
    if (!c) return;
    setTokens(await loadTokens(c));
  }, [contract]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deployment = await loadDeployment();
        const c = await getReadContract(deployment);
        const accs = await loadAccounts();
        if (cancelled) return;
        setContract(c);
        setAccounts(accs);
        setConn({ state: "ok", address: deployment.address });
        setTokens(await loadTokens(c));
      } catch (e) {
        if (cancelled) return;
        if (e.message === "NO_DEPLOYMENT") setConn({ state: "error", reason: "deploy" });
        else if (e.message === "NOT_DEPLOYED") setConn({ state: "error", reason: "redeploy" });
        else setConn({ state: "error", reason: "chain" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Blocknummer live mitlesen
  const [block, setBlock] = useState(null);
  useEffect(() => {
    if (conn.state !== "ok") return;
    const p = getProvider();
    p.getBlockNumber().then(setBlock).catch(() => {});
    const onBlock = (n) => setBlock(n);
    p.on("block", onBlock);
    return () => { p.off("block", onBlock); };
  }, [conn.state]);

  const label = (addr) => {
    const a = accounts.find((x) => x.address.toLowerCase() === addr?.toLowerCase());
    return a ? `${a.name} (${a.role})` : shortAddr(addr);
  };
  const me = accounts[active];

  const rememberPreview = (hash, url) => setPreviews((p) => (p[hash] ? p : { ...p, [hash]: url }));

  return (
    <main className="page">
      <header className="top">
        <div className="title">
          <h1>NFT Authenticity Checker</h1>
          <p>Was die Blockchain garantiert – und was nicht.</p>
        </div>
        <div className="status">
          <span className={`dot ${conn.state === "ok" ? "on" : ""}`} />
          {conn.state === "ok" ? (
            <span>
              Lokale Blockchain verbunden · Block <b>#{block ?? "…"}</b> · Contract <b>{shortAddr(conn.address)}</b>
            </span>
          ) : conn.state === "loading" ? (
            <span>Verbinde …</span>
          ) : (
            <span>Nicht verbunden</span>
          )}
        </div>
      </header>

      {conn.state === "error" && <ConnectionHelp reason={conn.reason} />}

      {accounts.length > 0 && (
        <div className="wallets">
          <span className="label">Aktive Wallet:</span>
          {accounts.map((a, i) => (
            <button key={a.address} className={`wallet ${i === active ? "active" : ""}`} onClick={() => setActive(i)}>
              <span className="who">{a.name}</span> · {a.role}
              <small>{shortAddr(a.address)}</small>
            </button>
          ))}
        </div>
      )}

      <div className="grid">
        <MintCard
          contract={contract}
          me={me}
          label={label}
          onMinted={async (tokenId, hash, url) => {
            rememberPreview(hash, url);
            await refresh();
            setFlashId(tokenId);
          }}
        />
        <CheckCard contract={contract} tokens={tokens} previews={previews} label={label} onRefresh={refresh} />
      </div>

      <section className="card ledger">
        <h2>Registrierte NFTs auf der Blockchain</h2>
        <p className="lead">
          Direkt aus dem Smart Contract gelesen. Gespeichert sind nur Token-ID, Besitzer, Ersteller und der Hash –
          nicht das Bild selbst.
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Token</th>
              <th>Name</th>
              <th>Besitzer</th>
              <th>Ersteller</th>
              <th>SHA-256 (on-chain)</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr><td colSpan={6} className="empty-row">Noch keine NFTs registriert.</td></tr>
            ) : (
              [...tokens].reverse().map((t) => (
                <tr key={t.id} className={t.id === flashId ? "flash" : ""}>
                  <td><Thumb src={previews[t.imageHash]} /></td>
                  <td><b>#{t.id}</b></td>
                  <td>{t.metadata?.name ?? "–"}</td>
                  <td>{label(t.owner)}</td>
                  <td>{label(t.creator)}</td>
                  <td className="mono">{shortHash(t.imageHash, 14)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="foot">
          Vorschaubilder kennt nur dieser Browser. Die Blockchain selbst „sieht“ das Bild nie.
        </p>
      </section>
    </main>
  );
}

// ======================================================================
// 1 · NFT erstellen
// ======================================================================
function MintCard({ contract, me, label, onMinted }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const pick = async (f) => {
    setResult(null);
    const info = await analyze(f);
    setFile(info);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  // Bild komplett entfernen, um ein neues zu nehmen
  const clear = () => {
    setFile(null);
    setResult(null);
    setName("");
    setDesc("");
  };

  const mint = async () => {
    if (!contract || !file || !me) return;
    setBusy(true);
    setResult(null);
    try {
      const signer = await getProvider().getSigner(me.address);
      const metadata = {
        name: name || file.name,
        description: desc,
        image: "(Demo: Datei bleibt lokal, in Produktion z. B. ipfs://…)",
        sha256: file.sha,
        dHash: file.dHash,
      };
      const tx = await contract.connect(signer).mintNFT(file.sha, toDataUri(metadata));
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "ImageRegistered");
      const tokenId = Number(event.args.tokenId);
      setResult({ kind: "ok", tokenId, owner: me.address, tx: receipt.hash, block: receipt.blockNumber, gas: receipt.gasUsed });
      await onMinted(tokenId, file.sha, file.url);
    } catch (err) {
      const revert = decodeRevert(err, contract);
      if (revert?.name === "AlreadyRegistered") {
        setResult({ kind: "rejected", tokenId: Number(revert.args[1]), owner: revert.args[2] });
      } else {
        console.error(err);
        setResult({ kind: "error", message: err.shortMessage ?? err.message });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2><span className="step">1</span> NFT erstellen</h2>
      <p className="lead">Bild wählen → SHA-256 wird im Browser berechnet → Smart Contract erzeugt den Token.</p>

      <DropZone file={file} onFile={pick} onClear={clear} />

      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Sonnenuntergang #1" />
      </div>
      <div className="field">
        <label>Beschreibung</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="optional" />
      </div>

      {file && (
        <dl className="kv">
          <dt>SHA-256</dt><dd>{file.sha}</dd>
          <dt>Wallet</dt><dd>{me ? `${label(me.address)} · ${shortAddr(me.address)}` : "–"}</dd>
        </dl>
      )}

      <button className="btn" disabled={!file || !contract || busy} onClick={mint}>
        {busy ? "Transaktion läuft …" : `NFT minten als ${me?.name ?? "…"}`}
      </button>

      {result?.kind === "ok" && (
        <div className="result ok">
          <h3>✓ NFT #{result.tokenId} erstellt</h3>
          <dl className="kv">
            <dt>Token-ID</dt><dd>#{result.tokenId}</dd>
            <dt>Besitzer</dt><dd>{label(result.owner)} · {result.owner}</dd>
            <dt>SHA-256</dt><dd>{file?.sha}</dd>
            <dt>Transaktion</dt><dd>{result.tx}</dd>
            <dt>Block</dt><dd>#{result.block} · {result.gas.toString()} Gas</dd>
          </dl>
        </div>
      )}
      {result?.kind === "rejected" && (
        <div className="result bad">
          <h3>⛔ Vom Smart Contract abgelehnt</h3>
          <p>Diese Datei ist bereits als <b>NFT #{result.tokenId}</b> registriert.</p>
          <p>Besitzer: <b>{label(result.owner)}</b></p>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Revert-Grund aus dem Contract: <code>AlreadyRegistered(hash, {result.tokenId}, {shortAddr(result.owner)})</code>
          </p>
        </div>
      )}
      {result?.kind === "error" && (
        <div className="result bad"><h3>Fehler</h3><p>{result.message}</p></div>
      )}
    </section>
  );
}

// ======================================================================
// 2 · Echtheit prüfen
// ======================================================================
function CheckCard({ contract, tokens, previews, label, onRefresh }) {
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [perceptual, setPerceptual] = useState(false);
  const [checkRun, setCheckRun] = useState(0);
  const [reloading, setReloading] = useState(false);

  const pick = async (f) => {
    setRes(null);
    setFile(await analyze(f));
  };

  // Bild komplett entfernen, um ein neues zu prüfen
  const clear = () => {
    setFile(null);
    setRes(null);
  };

  // Prüfung neu laden: aktuellen Stand frisch von der Blockchain lesen und erneut prüfen
  const recheck = async () => {
    setReloading(true);
    setRes(null);
    try {
      await onRefresh?.();
      setCheckRun((n) => n + 1);
    } finally {
      setReloading(false);
    }
  };

  // Prüfen, sobald Datei, Token-Liste oder "Neu prüfen" sich ändern
  useEffect(() => {
    if (!file || !contract) return;
    let cancelled = false;
    (async () => {
      const r = await contract.checkHash(file.sha);
      // Erweiterung: visuell ähnliche Bilder über den dHash aus den Metadaten finden (off-chain!)
      let similar = null;
      for (const t of tokens) {
        const other = t.metadata?.dHash;
        if (!other) continue;
        const dist = hammingDistance(file.dHash, other);
        if (!similar || dist < similar.dist) similar = { token: t, dist };
      }
      if (!cancelled) setRes({ registered: r.registered, tokenId: Number(r.tokenId), owner: r.owner, creator: r.creator, similar });
    })();
    return () => { cancelled = true; };
  }, [file, contract, tokens, checkRun]);

  const similarHit = res && !res.registered && res.similar && res.similar.dist <= SIMILARITY_THRESHOLD;

  return (
    <section className="card">
      <h2><span className="step">2</span> Echtheit prüfen</h2>
      <p className="lead">Wurde diese Datei schon als NFT registriert? Der Contract vergleicht den SHA-256-Hash.</p>

      <DropZone file={file} onFile={pick} onClear={clear} />

      <button className="btn secondary" disabled={!file || !contract || reloading} onClick={recheck}>
        {reloading ? "Lade Blockchain …" : "↻ Neu prüfen"}
      </button>

      {file && (
        <dl className="kv">
          <dt>SHA-256</dt><dd>{file.sha}</dd>
          {perceptual && (<><dt>dHash</dt><dd>{file.dHash}</dd></>)}
        </dl>
      )}

      {res?.registered && (
        <div className="result bad">
          <h3>⚠ Datei bereits registriert</h3>
          <div className="match">
            <Thumb src={previews[file.sha]} />
            <div>
              <p><b>NFT #{res.tokenId}</b></p>
              <p>Besitzer: {label(res.owner)}</p>
              <p>Ersteller: {label(res.creator)}</p>
            </div>
          </div>
        </div>
      )}

      {res && !res.registered && (
        <div className="result ok">
          <h3>✓ Nicht registriert</h3>
          <p>Laut Blockchain gibt es zu genau dieser Datei noch kein NFT. Sie könnte jetzt gemintet werden.</p>
        </div>
      )}

      {perceptual && similarHit && (
        <div className="result warn">
          <h3>⚠ Aber: sieht aus wie NFT #{res.similar.token.id}</h3>
          <div className="match">
            <Thumb src={previews[res.similar.token.imageHash]} />
            <div>
              <p>
                Perceptual Hash: nur <b>{res.similar.dist} von 64 Bit</b> unterschiedlich → visuell (fast) identisch.
              </p>
              <p>Ersteller des Originals: {label(res.similar.token.creator)}</p>
            </div>
          </div>
          <HashCompare a={res.similar.token.imageHash} b={file.sha} />
        </div>
      )}
      {perceptual && res && !res.registered && !similarHit && tokens.length > 0 && (
        <div className="result info">
          <h3>Kein ähnliches Bild gefunden</h3>
          <p>Kleinste Distanz: {res.similar?.dist ?? "–"} von 64 Bit (Schwelle: {SIMILARITY_THRESHOLD}).</p>
        </div>
      )}

      <label className="toggle">
        <input type="checkbox" checked={perceptual} onChange={(e) => setPerceptual(e.target.checked)} />
        Erweiterung: Perceptual-Hash-Prüfung (off-chain) anzeigen
      </label>
    </section>
  );
}

// ======================================================================
// Hilfskomponenten
// ======================================================================

/** Berechnet beide Hashes und eine Vorschau für eine Datei. */
async function analyze(f) {
  const [sha, dHash] = await Promise.all([sha256File(f), dHashFile(f)]);
  return { name: f.name, size: f.size, url: URL.createObjectURL(f), sha, dHash };
}

function DropZone({ file, onFile, onClear }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const take = (f) => f && f.type.startsWith("image/") && onFile(f);
  return (
    <div
      className={`drop ${over ? "over" : ""}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={(e) => { take(e.target.files[0]); e.target.value = ""; }}
      />
      {file ? <img className="thumb" src={file.url} alt="" /> : <div className="thumb empty">🖼</div>}
      <div className="drop-text">
        <div className="fname">{file ? file.name : "Bild auswählen oder hierher ziehen"}</div>
        <div className="hint">{file ? `${(file.size / 1024).toFixed(1)} KB · klicken zum Wechseln` : "PNG oder JPG"}</div>
      </div>
      {file && onClear && (
        <button
          type="button"
          className="clear"
          title="Bild entfernen"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
        >
          ✕ Bild entfernen
        </button>
      )}
    </div>
  );
}

function Thumb({ src }) {
  return src ? <img className="thumb" src={src} alt="" /> : <div className="thumb empty" style={{ fontSize: 18 }}>?</div>;
}

/** Zeigt zwei SHA-256-Hashes untereinander und markiert jedes abweichende Zeichen. */
function HashCompare({ a, b }) {
  const x = a.replace(/^0x/, "");
  const y = b.replace(/^0x/, "");
  const n = differingChars(a, b);
  return (
    <div className="hashcmp">
      <div className="lbl">SHA-256 Original (on-chain)</div>
      <div>{x}</div>
      <div className="lbl">SHA-256 dieser Datei</div>
      <div>{[...y].map((c, i) => <span key={i} className={c !== x[i] ? "d" : ""}>{c}</span>)}</div>
      <div className="lbl">{n} von 64 Zeichen unterschiedlich → für den Smart Contract eine völlig andere Datei</div>
    </div>
  );
}

function ConnectionHelp({ reason }) {
  return (
    <div className="banner">
      {reason === "chain" && (
        <>Lokale Blockchain nicht erreichbar. Starte sie im Ordner <code>contracts</code> mit <code>npm run chain</code>.</>
      )}
      {reason === "deploy" && (
        <>Noch kein Contract deployt. Führe im Ordner <code>contracts</code> <code>npm run deploy</code> aus und lade die Seite neu.</>
      )}
      {reason === "redeploy" && (
        <>Die Blockchain wurde neu gestartet, der Contract existiert dort nicht mehr. Führe <code>npm run deploy</code> erneut aus und lade die Seite neu.</>
      )}
    </div>
  );
}
