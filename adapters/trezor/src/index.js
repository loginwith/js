import { EventEmitter } from 'events'

import TrezorConnect, { DEVICE_EVENT, DEVICE, TRANSPORT_EVENT, TRANSPORT, UI, UI_EVENT } from 'trezor-connect'

// https://github.com/bitcoinjs/bitcoinjs-message

class internal extends EventEmitter {
  connector
  provider

  async init(opts) {
    TrezorConnect.on(DEVICE_EVENT, event => {
      console.log(`[Trezor] device event: `, event)

      // not obvious event
      if (event.type === DEVICE.CONNECT_UNACQUIRED) {
        // connected device is unknown or busy
        // most common reasons is that either device is currently used somewhere else
        // or app refreshed during call and trezor-bridge didn't managed to release the session
        // render "Acquire device" button and after click try to fetch device features using:
        // TrezorConnect.getFeatures();
      }

      if (event.type === DEVICE.CONNECT) {
        this.emit('connect', {})
      } else if (event.type === DEVICE.DISCONNECT) {
        this.emit('disconnect', {})
      }
    })

    TrezorConnect.on(TRANSPORT_EVENT, event => {
      console.log(`[Trezor] transport event: `, event)

      if (event.type === TRANSPORT.ERROR) {
        // trezor-bridge not installed
      }

      if (event.type === TRANSPORT.START) {}
    })

    TrezorConnect.on(UI_EVENT, event => {
      console.log(`[Trezor] UI event: `, event)
      return

      if (event.type === UI.REQUEST_PIN) {
        // example how to respond to pin request
        TrezorConnect.uiResponse({ type: UI.RECEIVE_PIN, payload: '1234' });
      }

      if (event.type === UI.REQUEST_PASSPHRASE) {
        if (event.payload.device.features.capabilities.includes('Capability_PassphraseEntry')) {
          // device does support entering passphrase on device
          // let user choose where to enter
          // if he choose to do it on device respond with:
          TrezorConnect.uiResponse({
            type: UI.RECEIVE_PASSPHRASE,
            payload: { passphraseOnDevice: true, value: '' },
          });
        } else {
          // example how to respond to passphrase request from regular UI input (form)
          TrezorConnect.uiResponse({
            type: UI.RECEIVE_PASSPHRASE,
            payload: { value: 'type your passphrase here', save: true },
          });
        }
      }

      if (event.type === UI.SELECT_DEVICE) {
        if (event.payload.devices.length > 0) {
          // more then one device connected
          // example how to respond to select device
          TrezorConnect.uiResponse({
            type: UI.RECEIVE_DEVICE,
            payload: event.payload.devices[0],
          });
        } else {
          // no devices connected, waiting for connection
        }
      }

      // getAddress from device which is not backed up
      // there is a high risk of coin loss at this point
      // warn user about it
      if (event.type === UI.REQUEST_CONFIRMATION) {
        // payload: true - user decides to continue anyway
        TrezorConnect.uiResponse({ type: UI.RECEIVE_CONFIRMATION, payload: true });
      }
    })

    await TrezorConnect.init({
      manifest: {
        email: 'hi@loginwith.xyz',
        appUrl: 'https://loginwith.xyz'
      }
    })
  }

  async connect(params) {
    /*
    const pk = await TrezorConnect.getPublicKey({
      path: "m/49'/0'/0'",
      coin: 'btc',
    })

    console.log(`[Trezor] public key: `, pk)
    return;
    */

    /*
    const params = {
      challengeHidden: "1 example.com <iat unix> <exp unix> <nonce>",
      challengeVisual: 'Login (until YYYY-MM-DD HH:MM:SS UTC) to',
    }
    */

    /*
    // works
    return TrezorConnect.ethereumSignMessage({
      path: "m/44'/60'/0'",
      message: "dead beef",
      hex: false
    });
    */

    // tricky, need to choose HD account, list? ask user to specify BIP44 path? lol
    /*
    return TrezorConnect.signMessage({
      path: "m/84'/0'/0'/0/0",
      message: "dead beef",
      hex: false
    })
    */

    return TrezorConnect.requestLogin(params);
  }
}

export default new internal()
