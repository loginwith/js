//import { ethers } from "ethers";
//import * as nacl from "tweetnacl";
//import Web3 from "web3";

import { genLWT } from "./lwt";

/*
export interface Network {
  name: string;
  isMain: boolean;
}

export interface UserInfo {
  id: string;
  account: string;
  network: Network;
  displayName: string;
  avatar: string;
  services: Promise<object>;
  expires: Date;
}
*/

enum CoinType {
  Bitcoin = 0,
  Ethereum = 60,
  Solana = 501,
}

interface InitOptions {
  networks: string[];
  mainnet: boolean;
}

class loginwith {
  private apiKey;
  private config;
  private ethProvider;
  private wc;
  private iframe;
  private onlogin;
  private wallets;
  private opts;

  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async verifySignature(network, signature) {
    switch (network) {
      case "solana": {
        console.log(
          ` verify ${signature.attestation} - ${signature.signature} - ${signature.pubkey}`
        );

        console.log(`********************** publicKey: `, signature.p);
        console.log(`********************** sig: `, signature.s);

        const { default: nacl } = await import("tweetnacl");

        return nacl.sign.detached.verify(
          new TextEncoder().encode(signature.attestation),
          signature.s,
          signature.p
        );

        break;
      }
      case "ethereum": {
        const { default: Web3 } = await import("web3");
        console.log("given provider: ", Web3.givenProvider);

        const web3 = new Web3((window as any).ethereum);

        console.log(
          "RECOVERL ",
          web3.eth.accounts.recover(signature.attestation, signature.s)
        );

        const account = await web3.eth.personal.ecRecover(
          signature.attestation,
          signature.s
        );

        console.log("eth account recovered: ", account);

        break;
      }
      default:
        throw new Error(`unsupported network: ${network}`);
    }
  }

  setupListener() {
    window.addEventListener("message", async (event) => {
      if (!event.data.loginwith) return;

      console.log(`[LoginWith-API] got message`, event.data);

      const { loginwith: payload } = event.data;
      const { cmd, error } = payload;

      switch (cmd) {
        case "exit": {
          console.log(`parent: UI exit`);
          this.iframe?.remove();
          this.iframe = null;
          break;
        }
        case "login": {
          try {
            let ticket;
            let user;

            switch (payload.method) {
              case "ethereum": {
                console.log(`login with eth`);
                [ticket, user] = await this.loginEthereum();
                break;
              }
              case "solana": {
                console.log(`login with sol`);
                [ticket, user] = await this.loginSolana();
                break;
              }
              case "walletconnect": {
                console.log(`login with WalletConnect`);
                [ticket, user] = await this.loginWalletConnect();
                break;
              }
              case "trezor": {
                console.log(`login with Trezor`);

                const { default: trezor } = await import("../adapters/trezor");

                console.log(`trezor`, trezor);

                await trezor.init();

                // Trezor uses SLIP-0013 for signing with login challenge
                // message being signed is: sha256(challenge hidden) + sha256(callenge visual)
                // represent it in LWT as:
                // ct=0
                // v=trezor
                // msg=[hidden, visual]

                const [challengeHidden, challengeVisual] = signingTemplate(
                  "bitcoin",
                  {
                    domain: window.location.host,
                  }
                );

                const { success, payload } = await trezor.connect({
                  challengeHidden,
                  challengeVisual,
                });

                this.iframe.contentWindow.postMessage({ connected: true }, "*");

                console.log(`payload:`, payload);

                if (!success) {
                  console.log(`error: `, payload);
                  this.iframe.contentWindow.postMessage(
                    {
                      error: payload.error,
                    },
                    "*"
                  );
                  return;
                }

                const { address, publicKey, signature } = payload;

                console.log(`address`, address);
                console.log(`publicKey`, publicKey);
                console.log(`signature`, signature);

                const lwt = genLWT(CoinType.Bitcoin, "", {
                  sig: signature,
                  pub: publicKey,
                });
                console.log(`LWT: `, lwt);

                return [
                  lwt,
                  {
                    account: address,
                    display_name: abbreviate(publicKey),
                  },
                ];
                break;
              }
              default:
                console.log(`unknown method: `, payload.method);
                return;
            }

            console.log(`ticket: `, ticket);
            console.log(`user: `, user);

            // TODO: fetch info about user

            this.iframe.contentWindow.postMessage({ loggedIn: true }, "*");

            // dispatch login result
            if ("function" == typeof this.onlogin) {
              this.onlogin.call(null, payload.method, user, ticket);
            }

            setTimeout(() => {
              this.iframe?.remove();
              this.iframe = null;
            }, 5000);
          } catch (err) {
            if (err.code === 4001) {
              // EIP-1193 userRejectedRequest error
              // If this happens, the user rejected the connection request.
              this.iframe.contentWindow.postMessage({ error: err }, "*");
              return;
            }

            console.log(`login: `, err);
          }

          break;
        }
        case "login_sign": {
          const { network, account, ticket, signature } = payload;

          if ("function" == typeof this.onlogin) {
            /*
            if (await this.verifySignature(network, signature.signature)) {
              const user = {
                address: signature.address,
                signature: signature.signature,
              };
              */

            // TODO: fetch info about user
            const user = {
              account,
            };

            console.log("ticket: ", ticket);

            this.onlogin.call(null, network, user, ticket);
            /*
            } else {
              alert("error verifying signature, beware of malicious site!");
            }
            */
          }
          break;
        }
        default:
          console.log(`received unknown message: `, event);
      }
    });
  }

  async start() {
    await this.showIframe();
  }

  async showIframe() {
    if (!this.iframe) {
      await this._mountIframe(document.body);
    }

    this.iframe.style.display = "";
  }

  async mount(sel) {
    let el: HTMLElement;

    if ("string" == typeof sel) {
      el = document.querySelector(sel);
    }

    if (!el) throw new Error(`no element found: ${sel}`);

    await this._mountIframe(document.body);
    return;

    console.log(`mounting ui at ${sel}`);

    let s = document.createElement("link");
    s.rel = "stylesheet";
    s.href = new URL(import.meta.url).href + "loginwith.css";
    s.onload = () => {};
    document.head.appendChild(s);
  }

  async _mountIframe(root) {
    if (this.iframe) return;

    this.iframe = document.createElement("iframe");
    const iframe = this.iframe;

    const networks = await this.supportedNetworks();
    console.log(`supported networks: `, networks);

    const wallets = await this.supportedWallets();
    console.log(`supported wallets: `, wallets);

    let params = new URLSearchParams();
    params.set("origin", window.location.origin);
    params.set("uri", window.location.href);
    params.set("networks", networks.join(","));
    params.set("wallets", wallets.join(","));
    params.set("rnd", Math.random());

    iframe.src =
      new URL(import.meta.url).href + "iframe.html?" + params.toString();
    iframe.style.position = "fixed";
    iframe.style.display = "none";
    //iframe.style.maxWidth = "500px";
    //iframe.style.maxHeight = "500px";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.background = "transparent";
    iframe.style.top = 0;
    iframe.style.bottom = 0;
    iframe.style.left = 0;
    iframe.style.right = 0;
    iframe.style.zIndex = "999999";
    iframe.style.margin = "auto";
    iframe.style.border = 0;

    return new Promise((resolve) => {
      iframe.onload = () => {
        console.log("iframe loaded");
        resolve(null);
      };

      root.appendChild(iframe);
    });
  }

  async init(__config: InitOptions) {
    let h = new URL(import.meta.url).host;
    if (h.startsWith("localhost")) {
      h = "http://localhost:8080";
    } else {
      h = "https://loginwith.xyz";
    }

    const res = await fetch(`${h}/api/init`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const config = await res.json();
    this.config = config;

    // load networks
    if (!config.methods) throw new Error(`no  specified`);

    this.setupListener();
    this._mountIframe(document.body);

    // check if we've logged into this site before and offer the previously selected login method

    this.wallets = await this.supportedWallets();
    console.log(`supported wallets: `, this.wallets);

    //const { WC2Connector } = await import("../adapters/wc2");
    //await WC2Connector.init();

    const { default: wc } = await import("../adapters/wc1");
    this.wc = wc;

    wc.on("connect", async (msg) => {
      console.log(`walletconnect is connected`, msg);

      //const web3 = new Web3(await wc.web3().eth);

      //console.log(web3);
      //console.log("send", web3.send);

      //this.ethProvider = new ethers.providers.Web3Provider(web3);

      // TODO: communicate available wallets to background page
      this.iframe.contentWindow.postMessage(
        { connected: true, walletconnect: { msg } },
        "*"
      );
    });
    wc.on("update", (msg) => {
      console.log(`WE GOT UPDATE`, msg);
    });
    wc.on("disconnect", (msg) => {
      console.log(`WE GOT DISCONNECT`, msg);
    });

    await wc.init();

    if (wc.connected) {
      console.log(`WC IS CONNECTED`);
    }

    /*
    const web3 = new Web3(await wc.web3());

    console.log(`web3: `, web3);

    const accts = await web3.eth.getAccounts();
    console.log(`accts`, accts);
    */
  }

  hasWallet(method) {
    return this.wallets.includes(method);
  }

  setError(msg) {
    if (this.iframe) {
      this.iframe.contentWindow.postMessage({ error: msg }, "*");
    }
  }

  async supportedNetworks() {
    let networks = [];

    if ((window as any).ethereum && this.config.methods.includes("ethereum"))
      networks.push("ethereum");
    if ((window as any).solana && this.config.methods.includes("solana"))
      networks.push("solana");

    return networks;
  }

  async supportedWallets() {
    const ethereum = (window as any).ethereum;
    const solana = (window as any).solana;

    const isMetaMaskInstalled = ethereum && ethereum.isMetaMask;
    const isPhantomInstalled = solana && solana.isPhantom;

    let wallets = [];

    if (
      ethereum &&
      isMetaMaskInstalled &&
      this.config.methods.includes("metamask")
    )
      wallets.push("metamask");
    if (solana && isPhantomInstalled && this.config.methods.includes("solana"))
      wallets.push("phantom");

    // WalletConnect is always available
    if (this.config.methods.includes("ethereum")) wallets.push("walletconnect");

    // Trezor is always available (HIDDEN ALPHA)
    if (
      location.hash.includes("lwt.trezor=true") &&
      this.config.methods.includes("bitcoin")
    ) {
      wallets.push("trezor");
    }

    return wallets;
  }

  async ___UNUSED_login(opts: any = {}) {
    console.log(`lw: login: `, opts);
    this.opts = opts;

    //await this.injectIframe();
    //this.iframe.contentWindow.postMessage({ loginwith: "hello LoginWith" });
    let ticket;
    let user;

    this.ethProvider = new ethers.providers.Web3Provider(
      (window as any).ethereum
    );

    switch (opts.method) {
      case "metamask":
      case "ethereum": {
        console.log(`login with eth`);
        [ticket, user] = await this.loginEthereum();

        const name = await this.ethProvider.lookupAddress(
          user.account
          //"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        );
        console.log(`resolved ens name:`, name);

        if (name) {
          const res = await this.ethProvider.getResolver(name);

          // https://eips.ethereum.org/EIPS/eip-634
          const p = [res.getText("avatar"), res.getText("url")];
          const [avatar, url] = await Promise.all(p);

          user.ens = {
            name,
            avatar,
            url,
          };
        }

        break;
      }
      case "solana": {
        console.log(`login with sol`);
        [ticket, user] = await this.loginSolana();
        break;
      }
      default:
        throw new Error(`unknown method: ${opts.method}`);
    }

    console.log(`ticket: `, ticket);
    console.log(`user: `, user);

    // TODO: fetch info about user

    // dispatch login result
    if ("function" == typeof this.onlogin) {
      this.onlogin.call(null, opts.method, user, ticket);
    }

    return;

    return new Promise((resolve) => {
      const res = {
        id: "eth:0xtest",
        network: {
          name: "ethereum",
          isMain: true,
        },
        account: "0xtest",
        displayName: "RickAstley.eth",
        avatar:
          "https://forums.cubecraftcdn.com/xenforo/data/avatars/o/34/34915.jpg",
        sevices: new Promise((resolve) => {
          return { "com.twitter": "rickastley" };
        }),
        expires: new Date(Date.now() + 60_000),
      };

      setTimeout(() => {
        resolve(res);
      }, 1000);
    });
  }

  async loginEthereum() {
    const ethereum = (window as any).ethereum;

    console.log(`ethereum provider: `, ethereum);

    let accounts;

    console.log(`requesting accounts from ethereum provider...`);
    try {
      accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log(`accounts: `, accounts);
      //await handleAccountsChanged(accounts);
    } catch (err) {
      if (err.code === 4001) {
        // EIP-1193 userRejectedRequest error
        // If this happens, the user rejected the connection request.
        console.log("Please connect to MetaMask.");
        this.setError("Wallet connection rejected");
      } else {
        console.error(err);
        this.setError(err.message);
      }

      throw err;
    }

    const chainId = await ethereum.request({
      method: "eth_chainId",
    });
    console.log(`eth chain id: `, chainId);

    if (chainId != "0x1" && !this.opts?.mainnet) {
      console.log(`[LoginWith-API] not on mainnet: ${chainId}`);

      this.iframe.contentWindow.postMessage(
        {
          error: { code: "NOT_ON_MAINNET", chainId },
        },
        "*"
      );

      // TODO: send state to iframe, so we can resume flow if page reloads on chain change

      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1" }],
        });
      } catch (err) {
        console.log(`err: `, err);
        throw new Error(`not on mainnet, chain: ${chainId}`);
      }
    }

    // TODO: move this to once
    ethereum.on("chainChanged", () => {
      console.log(`[LoginWith-API] ethereum chain changed`);
    });

    const currentAccount = await ethereum.request({
      method: "eth_accounts",
    });

    //ethereum.on('accountsChanged', handleAccountsChanged)

    console.log(`current eth account: `, currentAccount);

    // TODO: do we need to ask the user which account they want to use so we sign with the correct one?

    const from = currentAccount[0];
    const attestation = signingTemplate("ethereum", {
      domain: window.location.host,
      uri: window.location.href,
      address: currentAccount,
    });

    // https://api.opensea.io/api/v1/assets?owner=0xef3398709aa0de1a3edc741b19065b62ce400003&asset_contract_address=0x7828c811636ccf051993c1ec3157b0b732e55b23&order_direction=desc&offset=0&limit=1

    // TODO: as part of the connect message, send available accounts, last account?
    this.iframe.contentWindow.postMessage(
      { connected: true, accounts: currentAccount },
      "*"
    );

    console.log(`requesting signature...`);

    //const msg = `0x${ArrayBuffer.from(attestation, "utf8").toString("hex")}`;
    const msg =
      "0x" +
      Array.from(new TextEncoder().encode(attestation), (b) =>
        b.toString(16).padStart(2, "0")
      ).join("");
    const sig = await ethereum.request({
      method: "personal_sign",
      params: [msg, from, "Example password"],
    });

    console.log(`msg: `, msg);
    console.log(`sig: `, sig);
    console.log(`pub: `, from);

    const lwt = genLWT(CoinType.Ethereum, attestation, { sig, pub: from });
    console.log(`LWT: `, lwt);

    const displayName = abbreviate(from);

    return [lwt, { account: from, display_name: displayName }];
  }

  async loginWalletConnect() {
    console.log(`login with wallet connect`);

    const { chainId, accounts } = await this.wc.connect();

    console.log(`XXX chainId`, chainId);
    console.log(`XXX accounts`, accounts);

    this.iframe.contentWindow.postMessage({ connected: true }, "*");

    //const signed = await wc.signMessage(msg.accounts[0], "hi there");
    //console.log(`SIGNED: `, signed);

    /*
      const sig = await wc.request({
        method: "personal_sign",
        params: [message, msg.accounts[0], "Example password"],
      });
      */
    const attestation = signingTemplate("ethereum", {
      domain: window.location.host,
      uri: window.location.href,
      address: accounts[0],
      chainId,
    });

    /*
    const message = "0x" + Array.from(
      new TextEncoder().encode(attestation),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");

    console.log(`mgs`, message);
    */

    const sig = await this.wc.signPersonalMessage(accounts[0], attestation);
    console.log("SISISIS: ", sig);

    // https://api.opensea.io/api/v1/assets?owner=0xef3398709aa0de1a3edc741b19065b62ce400003&asset_contract_address=0x7828c811636ccf051993c1ec3157b0b732e55b23&order_direction=desc&offset=0&limit=1

    //const msg = `0x${ArrayBuffer.from(attestation, "utf8").toString("hex")}`;
    /*
    const msg = "0x" + Array.from(
      new TextEncoder().encode(attestation),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const sig = await ethereum.request({
      method: "personal_sign",
      params: [msg, from, "Example password"],
    });

    console.log(`msg: `, msg);
    console.log(`sig: `, sig);
    console.log(`pub: `, from);
    */

    const lwt = genLWT(CoinType.Ethereum, attestation, {
      sig,
      pub: accounts[0],
    });
    console.log(`LWT: `, lwt);

    return [
      lwt,
      {
        account: accounts[0],
        display_name: abbreviate(accounts[0]),
      },
    ];
  }

  async loginSolana() {
    const solana = (window as any).solana;

    console.log(`solana provider: `, solana);

    try {
      const resp = await solana.connect();
      console.log(`solana pubkey: ` + resp.publicKey.toString());

      const pubkey = resp.publicKey.toString();

      const attestation = signingTemplate("solana", {
        domain: window.location.host,
        uri: window.location.href,
        address: pubkey,
      });

      console.log(`attestation: `, attestation);

      this.iframe.contentWindow.postMessage({ connected: true }, "*");

      const displayName = abbreviate(pubkey);

      const lwt = await solana_sign(attestation);
      return [lwt, { account: pubkey, display_name: displayName }];
    } catch (err) {
      // { code: 4001, message: 'User rejected the request.' }
      if (err.code === 4001) {
        this.setError("Wallet connection rejected");
      } else {
        console.error(`error: `, err);
        this.setError(err.message);
      }

      throw err;
    }
  }
}

function abbreviate(addr, max = 20) {
  if (addr.length > max) {
    if (addr.startsWith("0x")) {
      addr = addr.substr(2);
      addr = addr.substr(0, 4) + "..." + addr.substr(-4);
      addr = "0x" + addr;
    } else {
      addr = addr.substr(0, 4) + "..." + addr.substr(-4);
    }
  }

  return addr;
}

// sign attestation and return LWT
async function solana_sign(message) {
  const encodedMessage = new TextEncoder().encode(message);
  const signedMessage = await (window as any).solana.signMessage(
    encodedMessage,
    "utf8"
  );

  console.log(`signed msg: `, signedMessage);
  console.log("encoded msg: ", encodedMessage);

  const msg = Array.from(encodedMessage, (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  const sig = Array.from(signedMessage.signature, (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  const pub = Array.from(signedMessage.publicKey.toBuffer(), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  console.log("sig:", sig);
  console.log("pub:", pub);

  const { default: nacl } = await import("tweetnacl");

  console.log(`11111111111: `, encodedMessage);
  console.log(`22222222222: `, signedMessage.signature);
  console.log(`33333333333: `, signedMessage.publicKey.toBuffer());

  const nn = nacl.sign.detached.verify(
    encodedMessage,
    signedMessage.signature,
    signedMessage.publicKey.toBuffer()
  );
  console.log(`NNNNN VERIFIED: `, nn);

  const lwt = genLWT(CoinType.Solana, message, { sig, pub });
  console.log(`LWT: `, lwt);

  return lwt;
}

function signingTemplate(network, opts) {
  const { origin, uri, domain, address, statement } = opts;

  const version = "1";
  const chainId = opts.chainId || "TODO";
  const nonce = Math.floor(10000000 + Math.random() * 90000000);
  const issuedAt = new Date();
  const expirationTime = new Date(Date.now() + 24 * 60 * 60_000);

  switch (network) {
    case "bitcoin": {
      const hidden = `1 ${domain} ${issuedAt / 1000} ${
        expirationTime / 1000
      } ${nonce}`;
      const visual = `Login (until ${expirationTime
        .toISOString()
        .substr(0, 19)
        .replace("T", " ")} UTC) to`;
      return [hidden, visual];
    }
    case "ethereum":
      network = "Ethereum";
      break;
    case "solana":
      network = "Solana";
      break;
  }

  return `${domain} wants you to sign in with your ${network} account:
${address}

${
  statement ||
  `Sign this message to login to ${domain}. The signature will not cost you any fees.`
}

URI: ${uri}
Version: ${version}
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expirationTime.toISOString()}`;
}

export const LoginWith = (apiKey) => {
  console.log(`LoginWith: new`);

  return new loginwith(apiKey);
};

window.LoginWith = LoginWith;
