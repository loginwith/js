import "preact/debug"

import { h, render, Component, Fragment, createContext } from "preact";
import { useState, useEffect, useReducer, useContext } from "preact/hooks";
import React from "preact/compat";

import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/outline'
import { CalendarIcon, ClockIcon, PhotographIcon, TableIcon, ViewBoardsIcon, ViewListIcon } from '@heroicons/react/outline'

import { MetaMaskIcon, EthereumIcon, SolanaIcon, WalletConnectIcon, TrezorIcon } from './icons'

let ORIGIN
let DOMAIN
let SUPPORTED_NETWORKS
let SUPPORTED_WALLETS
let PREFERENCES

window.addEventListener("load", async () => {
  console.log(`LoginWith UI IFrame loaded`);

  const params = Object.fromEntries(
    new URLSearchParams(window.location.search).entries(),
  );
  console.log(`query: `, params);

  ORIGIN = params.origin
  DOMAIN = new URL(ORIGIN).host
  SUPPORTED_NETWORKS = params.networks.split(',')
  SUPPORTED_WALLETS = params.wallets.split(',')

  // load preferences
  PREFERENCES = JSON.parse(localStorage.getItem(`prefs:${ORIGIN}`) || '{}')

  console.log(`preferences for ${ORIGIN}`, PREFERENCES)

  React.render(<App origin={params.origin} />, document.body);
});

const savePreferences = () => localStorage.setItem(`prefs:${ORIGIN}`, JSON.stringify(PREFERENCES))

export const App = (params) => {
  const { origin } = params

  return (
    <Modal origin={origin} />
  )
}

export const Modal = (params) => {
  const { origin } = params

  const [open, setOpen] = useState(true)

  const close = () => {
    setOpen(false)
    window.parent.postMessage({ loginwith: { cmd: 'exit' } }, origin)
  }

  return (
    <Transition
      show={open}
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
    >
      <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={close}>
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>
          <div className="border-t-8 border-indigo-600 inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6">

            <WizardState>
              <MyWizard />
            </WizardState>

            <div className="hidden mt-5 sm:mt-6">
              <button
                type="button"
                className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                onClick={() => close()}
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

function signInMethods() {
  let items = []

  if(SUPPORTED_NETWORKS.includes("ethereum")) {
    if(SUPPORTED_WALLETS.includes('metamask')) {
      items.push({
        id: 'ethereum',
        title: 'MetaMask',
        description: 'And other compatible Ethereum wallets',
        icon: MetaMaskIcon,
      })
    } else {
      items.push({
        id: 'ethereum',
        title: 'Ethereum',
        description: 'Ethereum-based wallets like MetaMask',
        icon: EthereumIcon,
      })
    }
  }

  // TODO: gate with ethererum
  if(SUPPORTED_WALLETS.includes("walletconnect")) {
    items.push({
      id: 'walletconnect',
      title: 'WalletConnect',
      description: 'Most mobile and desktop wallets',
      icon: WalletConnectIcon,
    })
  }

  if(SUPPORTED_NETWORKS.includes("solana")) {
    if(SUPPORTED_WALLETS.includes('phantom')) {
      items.push({
        id: 'solana',
        title: 'Phantom',
        description: 'And other compatible Solana wallets',
        icon: SolanaIcon,
      })
    } else {
      items.push({
        id: 'solana',
        title: 'Solana',
        description: 'e.g., Phantom Wallet',
        icon: SolanaIcon,
      })
    }
  }

  if(SUPPORTED_WALLETS.includes("trezor")) {
    items.push({
      id: 'trezor',
      title: 'Trezor',
      description: 'Model One and Model T hardware wallets',
      icon: TrezorIcon,
    })
  }

  return items
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}


const initialWizardState = {}
const WizardReducer = (previousState, action) => {
  switch(action.type) {
    case 'SELECT_METHOD':
      return { ...previousState, step: action.type, method: action.method };
    case 'SWITCH_TO_MAINNET_WALLET':
      return { ...previousState, step: action.type, needsMainnet: true };
    case 'CONNECT_WALLET':
      return { ...previousState, step: action.type, connected: true };
    case 'ASK_USE_EXISTING_ACCOUNT':
      return { ...previousState, step: action.type, hasExistingAccount: true, accounts: action.accounts };
    case 'SIGN_MESSAGE':
      return { ...previousState, step: action.type, signatureRequested: true };
    case 'LOGGED_IN':
      PREFERENCES['last_method'] = previousState.method
      PREFERENCES['last_account'] = previousState.account
      PREFERENCES['last_login_at'] = Date.now()
      savePreferences()
      return { ...previousState, step: action.type, loggedIn: true };
    case 'RESET':
      return initialWizardState
    default:
      throw new Error(`unexpected action ${action?.type}`)
  }
}

const WizardContext = createContext()

function useWizard() {
  const { state, dispatch } = useContext(WizardContext)
  return [state, dispatch]
}

function WizardState({ children }) {
  const [state, dispatch] = useReducer(WizardReducer, initialWizardState)

  return (
    <WizardContext.Provider value={
      {state: state, dispatch: dispatch}
    }>
      {children}
    </WizardContext.Provider>
  )
}

function MyWizard() {
  const [wiz, dispatch] = useWizard()

  useEffect(() => {
    const onMessage = (event) => {
      if(event.source != window.top) return;

      console.log(`[LoginWith-API-IFrame] got message`, event.data);

      const { error, connected, accounts, loggedIn } = event.data;

      // TODO: read existing connected accounts/method and make it the most recent

      if(error?.code == 4001) {
        dispatch({ type: "RESET" })
      } else if(error?.code == 'NOT_ON_MAINNET') {
        dispatch({ type: "SWITCH_TO_MAINNET_WALLET" })
      } else if(connected) {
        if(accounts) { // user has existing accounts
          dispatch({ type: "ASK_USE_EXISTING_ACCOUNT", accounts })
        } else {
          dispatch({ type: "SIGN_MESSAGE" })
        }
      } else if(loggedIn) {
        dispatch({ type: "LOGGED_IN" })
      }
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [])


  let title
  let step
  if(!wiz.method) {
    title = "Select Web3 Sign-In Method"
    step = <ChooseMethod />
  } else if(wiz.needsMainnet) {
    title = "Mainnet Wallet Required"
    step = <MainnetRequired />
  } else if(wiz.loggedIn) {
    title = "Logged In!"
    step = <WaitMessage
      spinner={true}
      cancel={false}
      message="Signing you in..." />
  } else if(wiz.hasExistingAccount) {
    title = "Use Existing Account"
    step = <ChooseAccount accounts={wiz.accounts} />
  } else if(wiz.signatureRequested) {
    title = "Sign Message"
    step = <WaitMessage
      title="Sign Message"
      message="Approve the signing request. The signature will not cost you any fees." />
  } else {
    step = <ConnectWallet />
  }

  return (
    <div>
      <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900">
        {title}
      </Dialog.Title>

      {step}

      <div className="mt-4 flex border-t border-gray-200 pt-4">
        <span className="text-xs font-normal">Web3 sign-in powered by <a href="https://loginwith.xyz" target="_blank" className="text-indigo-600 hover:text-indigo-500">loginwith.xyz<span aria-hidden="true"> &rarr;</span></a></span>
      </div>
    </div>
  )
}

const ChooseMethod = () => {
  const [wizard, dispatch] = useWizard()

  const select = (method) => dispatch({ type: 'SELECT_METHOD', method })

  let items = signInMethods()

  const isFirstTime = !PREFERENCES['last_login_at']

  let lastLoginDate
  let lastMethod
  let lastAccount

  if(!isFirstTime) {
    lastMethod = PREFERENCES['last_method']
    lastAccount = PREFERENCES['last_account']
    lastLoginDate = new Date(PREFERENCES['last_login_at'])

    // insert last account as the first sign-in method
    /*
    items.unshift({
      recent: true,
      id: lastMethod,
      title: lastAccount,
      icon: MetaMaskIcon,
    })
    */
  }

  return (
    <div>
      {isFirstTime && (
      <p className="mt-1 text-sm text-gray-500">
        This is the first time you're signing into <span className="text-indigo-600">{DOMAIN}</span>.
      </p>
      )}
      {!isFirstTime && (
      <p className="mt-1 text-sm text-gray-500">
        You last signed into <span className="text-indigo-600">{DOMAIN}</span> on {lastLoginDate.toString()} using <span className="text-indigo-600">{lastMethod}</span>
      </p>
      )}
      <ul role="list" className="mt-6 border-t border-gray-200 py-6 grid grid-cols-1 gap-6 sm:grid-cols-1">
        {items.map((item, itemIdx) => (
          <li key={itemIdx} className="flow-root">
            <div className="relative -m-2 p-2 flex items-center space-x-4 rounded-xl hover:bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500">
              <div
                className={classNames(
                  item.background,
                  'flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-lg'
                )}
              >
                <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  <button type="button" className="focus:outline-none" onClick={() => select(item.id)}>
                    <span className="absolute inset-0" aria-hidden="true" />
                    {item.title}
                    <span aria-hidden="true"> &rarr;</span>
                  </button>
                </h3>
                <p className="mt-1 text-sm text-gray-500">{item.description}</p>
              </div>
            </div>
          </li>
        ))}

        {items.length == 0 && (
          <div className="relative -m-2 p-2 flex items-center space-x-4 rounded-xl hover:bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500">
            <p>No wallets found.</p>
          </div>
        )}
      </ul>
    </div>
  )
}

const MainnetRequired = () => {
  const [wizard, dispatch] = useWizard()

  const close = () => dispatch({ type: 'RESET' })

  return (
    <>
      <div className="mt-3 text-center sm:mt-5">
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            This site requires a mainnet account. Please use a mainnet account and try again.
          </p>
        </div>
      </div>

      <div className="mt-5 sm:mt-6">
        <button
          type="button"
          className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
          onClick={() => close()}
        >
          Start Over
        </button>
      </div>
    </>
  )
}

const WaitMessage = ({ message, spinner, cancel }) => {
  const [wizard, dispatch] = useWizard()

  const close = () => dispatch({ type: 'RESET' })

  return (
    <>
      <div className="mx-auto mt-6 flex items-center justify-center h-12 w-12 rounded-full">
        {spinner && (
        <svg class="animate-spin -ml-1 mr-3 h-10 w-10 text-gray" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        )}

      </div>
      <div className="mt-3 text-center sm:mt-5">
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            {message}
          </p>
        </div>
      </div>

      {cancel && (
      <div className="mt-5 sm:mt-6">
        <button
          type="button"
          className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
          onClick={() => close()}
        >
          Cancel
        </button>
      </div>
      )}
    </>
  )
}

const ConnectWallet = () => {
  const [wizard, dispatch] = useWizard()

  const close = () => dispatch({ type: 'RESET' })

  useEffect(() => {
    window.parent.postMessage({ loginwith: { cmd: 'login', method: wizard.method } }, ORIGIN)
  }, [])

  return (
    <>
      <div className="mx-auto mt-6 flex items-center justify-center h-12 w-12 rounded-full">
        <svg class="animate-spin -ml-1 mr-3 h-10 w-10 text-gray" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>

      </div>
      <div className="mt-3 text-center sm:mt-5">
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            Unlock and authorize your wallet.
          </p>
        </div>
      </div>

      <div className="mt-5 sm:mt-6">
        <button
          type="button"
          className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
          onClick={() => close()}
        >
          Cancel
        </button>
      </div>
    </>
  )
}

const ChooseAccount = () => {
  const [wizard, dispatch] = useWizard()

  const close = () => dispatch({ type: 'RESET' })

  // TODO: show list of accounts that were previously used
  // TODO: allow user to remove accounts from list

  useEffect(() => {
    console.log(`_________ ChooseAccount: accounts: `, wizard.accounts)
    //window.parent.postMessage({ loginwith: { cmd: 'login', method: wizard.method } }, ORIGIN)
  }, [])

  return (
    <>
      <p>Choose existing account or connect again.</p>
    </>
  )
}
