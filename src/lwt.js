class LWTError extends Error {
  constructor(message, code) {
    super(message)
    this.name = this.constructor.name
    this.code = code
  }
}

// eth
//   message, signature
// slip0013
//   [<domain> <iat> <exp> <nonce>, "visual"]

export function genLWT(ct, tpl, opts) {
  const spec = parseTemplate(ct, tpl)

  // template spec
  let payload = {
    ct,
    a: spec.account,
    msg: tpl,
    exp: Math.floor(spec.expiration.getTime() / 1000)
  }

  payload.sig = opts.sig
  payload.pub = opts.pub

  return [
    JSON.stringify({
      typ: 'lwt'
    }),
    JSON.stringify(payload)
  ].map(s => btoa(s).replace(/=/g, '')).join('.')
}

export function parseLWT(lwt) {
  const [hdr, payload] = lwt.split('.')

  const {
    typ
  } = JSON.parse(atob(hdr))

  if(typ != 'lwt') throw new LWTError(`not an LWT: ${typ}`, 'INVALID_FORMAT')

  const {
    ct, // SLIP-0044 coin type
    exp, // expiration time
    a, // account
    msg, // coin-specific message
    pub, // public key of signer in hex
    sig, // signed message
  } = JSON.parse(atob(payload))

  if(exp * 1000 < Date.now()) throw new LWTError(`LWT expired: ${exp}`, 'EXPIRED')

  const parsedMsg = parseTemplate(ct, msg)

  return {
    ct,
    a,
    msg,
    exp,
    pub,
    sig
  }
}

const TEMPLATE_REGEX = `(?<domain>(.+)) wants you to sign in with your (?<network>(.+)) account:
(?<account>(.+))

(?<statement>(.+))

URI: (?<uri>(.+))
Version: (?<version>(.+))
Chain ID: (?<chain>(.+))
Nonce: (?<nonce>(.+))
Issued At: (?<issued>(.+))
Expiration Time: (?<expiration>(.+))(
Resources:
(?<resources>(?:\n(?!\n)|.)*))?`

export function parseTemplate(ct, msg) {
  if(ct != 60 && ct != 501) throw new LWTError(`unsupported coin type: ${ct}`, 'UNSUPPORTED_COIN_TYPE')

  const m = msg.match(RegExp(TEMPLATE_REGEX, 'm'))

  if(!m) return null;

  let {
    domain,
    network,
    account,
    statement,
    uri,
    version,
    chain,
    nonce,
    issued,
    expiration,
    resources
  } = m.groups

  if(resources) {
    resources = Array.from(resources.matchAll(RegExp('- (.*)', 'gm'))).map(e => e[1])
  }

  if(version != '1') throw new LWTError(`unsupported version: ${version}`, 'UNSUPPORTED_LWT_VERSION')

  issued = new Date(Date.parse(issued))
  expiration = new Date(Date.parse(expiration))

  return {
    domain,
    network,
    account,
    statement,
    uri,
    version,
    chain,
    nonce,
    issued,
    expiration,
    resources
  }
}

const TEST_TPL_WITH_RESOURCES = `demo.loginwith.xyz wants you to sign in with your Ethereum account:
0x1234567890

You are not sending any funds, this is just to verify your wallet ownership.

URI: https://demo.loginwith.xyz
Version: 1
Chain ID: 1
Nonce: 38474872
Issued At: 2021-11-01T05:43:01Z
Expiration Time: 2021-11-30T05:43:01Z
Resources:
- ipfs://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq/
- https://example.com/my-web2-claim.json`

const TEST_TPL_WITHOUT_RESOURCES = `demo.loginwith.xyz wants you to sign in with your Ethereum account:
0x1234567890

You are not sending any funds, this is just to verify your wallet ownership.

URI: https://demo.loginwith.xyz
Version: 1
Chain ID: 1
Nonce: 38474872
Issued At: 2021-11-01T05:43:01Z
Expiration Time: 2021-11-30T05:43:01Z`

// tests
if(globalThis.process?.env?.NODE_ENV == 'test') {
  console.log(`parse eth msg with resources`, parseTemplate(60, TEST_TPL_WITHOUT_RESOURCES))

  {
    console.log(`*** test with resources`)

    const lwt = genLWT(60, TEST_TPL_WITH_RESOURCES)
    console.log(`LWT: `, lwt)

    const parsedLwt = parseLWT(lwt)
    console.log(`parsed LWT: `, parsedLwt)
  }

  {
    console.log(`*** test without resources`)

    const lwt = genLWT(60, TEST_TPL_WITHOUT_RESOURCES)
    console.log(`LWT: `, lwt)

    const parsedLwt = parseLWT(lwt)
    console.log(`parsed LWT: `, parsedLwt)
  }
}
