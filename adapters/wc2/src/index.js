import {
  EventEmitter
} from 'events'

import {
  Client,
  CLIENT_EVENTS
} from "@walletconnect/client";
//import { PairingTypes, SessionTypes } from "@walletconnect/types";
import WalletConnectProvider from "@walletconnect/ethereum-provider";
import QRCodeModal from "@walletconnect/qrcode-modal";

class internal extends EventEmitter {
  client

  async init(opts) {
    console.log(`WC2Connector init`)

    const client = await Client.init({
      name: "LoginWith",
      controller: true,
      logger: "debug",
      apiKey: "73e2a0b4127feecf07fce2a21d878bea",
      metadata: {
        name: "Example Dapp",
        description: "Example Dapp",
        url: "https://ytmod.pilvy.dev",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      },
      relayProvider: "wss://relay.walletconnect.org",
    });
    this.client = client

    client.on(
      CLIENT_EVENTS.pairing.proposal,
      async (proposal) => {
        // uri should be shared with the Wallet either through QR Code scanning or mobile deep linking
        const {
          uri
        } = proposal.signal.params;

        console.log(`paired uri:`, uri);

        QRCodeModal.open(uri, async () => {
          console.log(`qr code modal done`);
        });
      },
    );
    client.on(
      CLIENT_EVENTS.pairing.sync,
      async () => {
        console.log(`pairings: `, client.pairing.values);
      },
    );
    client.on(
      CLIENT_EVENTS.session.sync,
      () => {
        console.log(`sessions`, client.session.values);
      },
    );
    client.on(
      CLIENT_EVENTS.session.created,
      (session) => {
        console.log(`session created`, session);
        QRCodeModal.close();
      },
    );

    // get pending request events (topic, request)
    // (session proposals would be included here)
    const requests = client.pairing.history.pending;

    // get pending request events (topic, request, chainId)
    const requests2 = client.session.history.pending;

    console.log(`requests`, requests);
    console.log(`requests2`, requests2);

    console.log(`....`);

    const session = await client.connect({
      permissions: {
        blockchain: {
          chains: ["eip155:1"],
        },
        jsonrpc: {
          methods: [
            "eth_sendTransaction",
            "personal_sign",
            "eth_signTypedData",
          ],
        },
      },
      metadata: {
        name: "Example Dapp",
        description: "Example Dapp",
        url: "https://ytmod.pilvy.dev",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      },
    });
    console.log(`wc session: `, session);

    /*
    console.log(`ready almost`);

    const provider = new WalletConnectProvider({
      infuraId: "x7e484dcd9e3efcfd25a83a78777cdf1", // Required
      //chainId: 1,
    });
    provider.on("disconnect", (err) => {
      console.log(`provider disconnected`, err);
    });
    provider.on("chainChanged", (chainId) => {
      console.log(`provider chain changed`, chainId);
    });
    provider.on("accountsChanged", (accounts) => {
      console.log(`provider accounts changed`, accounts);
    });
    console.log(`a`);

    console.log(`provider connected?`, provider.connected);

    const chainId = await provider.request({
      method: "eth_chainId"
    });
    console.log(`chainId`, chainId);

    //const accounts = await provider.enable();
    //console.log(`provider accounts`, accounts);

    const z = await provider.request({
      method: "eth_accounts"
    });
    console.log(`z:`, z);

    console.log(`post enable`);

    const web3 = new Web3(provider as any);

    console.log(`web3: `, web3);
    //await web3.eth.requestAccounts();

    const accts = await web3.eth.getAccounts();
    console.log(`accts`, accts);
    }
    */

  }
}

export default new internal()
