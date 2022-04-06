import {
  EventEmitter
} from 'events'

import WalletConnect from "@walletconnect/client";
import { keccak_256 } from "js-sha3"
import QRCodeModal from "@walletconnect/qrcode-modal";
import WalletConnectProvider from "@walletconnect/ethereum-provider";

class internal extends EventEmitter {
  connector
  provider
  connectedPromiseResolve
  connectedParams

  async init(opts) {
    // Create a connector
    const connector = new WalletConnect({
      bridge: "https://bridge.walletconnect.org", // Required
      qrcodeModal: QRCodeModal,
    });
    this.connector = connector

    // Subscribe to connection events
    connector.on("connect", (error, payload) => {
      if (error) {
        throw error;
      }

      // Get provided accounts and chainId
      const {
        accounts,
        chainId
      } = payload.params[0];

      this.connectedParams = payload.params[0]

      this.emit('connect', payload.params[0])

      if (this.connectedPromiseResolve) {
        this.connectedPromiseResolve(this.connectedParams)
        this.connectedPromiseResolve = null
      }
    });

    connector.on("session_update", (error, payload) => {
      if (error) {
        throw error;
      }

      // Get updated accounts and chainId
      const {
        accounts,
        chainId
      } = payload.params[0];

      this.emit('update', payload.params[0])
    });

    connector.on("disconnect", (error, payload) => {
      if (error) {
        throw error;
      }

      // Delete connector
      this.emit('disconnect', payload)
    });

    console.log(`[wc1] connector connected?`, connector.connected)

    if (connector.connected) {
      await this.web3()

      const [chainId, accounts] = await Promise.all([
        this.provider.request({ method: 'eth_chainId' }),
        this.provider.request({ method: 'eth_accounts' })
      ])

      console.log(`[wc1] chainId: ${chainId} accounts: ${accounts.join(', ')}`)

      this.connectedParams = { chainId, accounts }

      this.emit('connect', { chainId, accounts })
    }
  }

  async connect() {
    // Check if connection is already established
    return new Promise((resolve) => {
      if (this.connector.connected) {
        return resolve(this.connectedParams)
      }

      this.connectedPromiseResolve = resolve

      // create new session
      this.connector.createSession();
    })
  }

  async signMessage(account, message) {
    console.log(`121111111111111 sign mesge`)

    const msgParams = [
      account, //.substr(2),
      keccak_256("\x19Ethereum Signed Message:\n" + message.length + message)
    ];

    console.log(`HERE: `, msgParams)

    return this.connector.signMessage(msgParams)
  }

  async signPersonalMessage(account, message) {
    const hexmsg = "0x" + Array.from(
      new TextEncoder().encode(message),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");

    return this.connector.signPersonalMessage([hexmsg, account])
  }

  async request(rpc) {
    console.log('[wc1] rpc: ', rpc)
    const p = this.connector.sendCustomRequest(rpc)
    console.log(`p`, p)
    const z = await p
    console.log('z', z)
    return z
  }

  async web3() {
    if (this.provider) return this.provider;

    const provider = new WalletConnectProvider({
      infuraId: "x7e484dcd9e3efcfd25a83a78777cdf1", // Required
      //chainId: 1,
    });
    this.provider = provider

    provider.on("disconnect", (err) => {
      console.log(`provider disconnected`, err);
    });
    provider.on("chainChanged", (chainId) => {
      console.log(`provider chain changed`, chainId);
    });
    provider.on("accountsChanged", (accounts) => {
      console.log(`provider accounts changed`, accounts);
    });

    console.log(`[wc1] provider connected?`, provider.connected);

    /*
    const chainId = await provider.request({
      method: "eth_chainId"
    });
    console.log(`[wc1] chainId`, chainId);

    //const accounts = await provider.enable();
    //console.log(`provider accounts`, accounts);

    const z = await provider.request({
      method: "eth_accounts"
    });
    console.log(`[wc1] accounts: `, z);
    */

    console.log(`[wc1] web3 loaded`)

    return provider
  }
}

export default new internal()
