# Pi Browser Connect

Minimal Node.js + Express app for Pi Browser authentication.

## Install

```bash
npm install
npm start
```

Then register a Pi app in the Pi Developer Portal from inside Pi Browser.

For phone/Pi Browser testing this project uses:

```js
Pi.init({ version: "2.0", sandbox: false });
```

Choose Pi Testnet when registering the first app. The registered app determines whether it connects to Testnet or Mainnet.

Use `sandbox: true` only if you intentionally switch to Pi's separate Sandbox environment.
