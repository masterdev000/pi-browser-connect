import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as StellarSdk from "@stellar/stellar-sdk";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const PI_API = "https://api.minepi.com";

const TESTNET_HORIZON = "https://api.testnet.minepi.com";
const TESTNET_PASSPHRASE = "Pi Testnet";

const server = new StellarSdk.Horizon.Server(TESTNET_HORIZON);

app.use(express.json({ limit: "1mb" }));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// --------------------------------------------------
// Verify Pi access token
// --------------------------------------------------

async function verifyPiAccessToken(accessToken) {

    if (!accessToken) {
        throw new Error("Missing Pi access token");
    }

    const response = await fetch(
        `${PI_API}/v2/me`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = {
            raw: text
        };
    }

    if (!response.ok) {

        console.error(
            "Pi /v2/me error:",
            response.status,
            data
        );

        throw new Error(
            `Pi authentication verification failed (${response.status})`
        );
    }

    return data;
}


// --------------------------------------------------
// Verify authenticated Pi user
// --------------------------------------------------

app.post(
    "/api/verify",
    async (req, res) => {

        try {

            const {
                accessToken
            } = req.body;

            const user =
                await verifyPiAccessToken(
                    accessToken
                );

            res.json({
                ok: true,
                user
            });

        } catch (error) {

            console.error(error);

            res.status(401).json({
                ok: false,
                error: error.message
            });
        }
    }
);


// --------------------------------------------------
// Get Testnet account information
// --------------------------------------------------

app.get(
    "/api/testnet-account/:address",
    async (req, res) => {

        try {

            const address =
                String(
                    req.params.address || ""
                )
                    .trim()
                    .toUpperCase();

            if (
                !StellarSdk.StrKey
                    .isValidEd25519PublicKey(
                        address
                    )
            ) {

                return res.status(400).json({
                    ok: false,
                    error: "Invalid wallet address"
                });
            }

            const account =
                await server.loadAccount(
                    address
                );

            const nativeBalance =
                account.balances.find(
                    balance =>
                        balance.asset_type === "native"
                );

            res.json({
                ok: true,

                address,

                sequence:
                    account.sequence,

                balance:
                    nativeBalance?.balance || "0",

                subentry_count:
                    account.subentry_count,

                last_modified_ledger:
                    account.last_modified_ledger
            });

        } catch (error) {

            console.error(error);

            res.status(404).json({
                ok: false,
                error:
                    "Account was not found on Pi Testnet"
            });
        }
    }
);


// --------------------------------------------------
// Build harmless Testnet signing transaction
//
// Source: user's Testnet wallet
// Destination: same wallet
// Amount: 0.0000001 Test-Pi
//
// It is NOT submitted by this app.
// --------------------------------------------------

app.post(
    "/api/build-test-xdr",
    async (req, res) => {

        try {

            const walletAddress =
                String(
                    req.body.walletAddress || ""
                )
                    .trim()
                    .toUpperCase();

            if (
                !StellarSdk.StrKey
                    .isValidEd25519PublicKey(
                        walletAddress
                    )
            ) {

                return res.status(400).json({
                    ok: false,
                    error: "Invalid wallet address"
                });
            }


            // Load account from Pi Testnet
            const account =
                await server.loadAccount(
                    walletAddress
                );


            // Get current Testnet fee
            const baseFee =
                await server.fetchBaseFee();


            // Build transaction
            //
            // This is just a self-payment.
            // Nothing happens unless the signed XDR
            // is separately submitted.
            const transaction =
                new StellarSdk.TransactionBuilder(
                    account,
                    {
                        fee: baseFee.toString(),

                        networkPassphrase:
                            TESTNET_PASSPHRASE
                    }
                )

                    .addOperation(
                        StellarSdk.Operation.payment({
                            destination:
                                walletAddress,

                            asset:
                                StellarSdk.Asset.native(),

                            amount:
                                "0.0000001"
                        })
                    )

                    .addMemo(
                        StellarSdk.Memo.text(
                            "Pi XDR sign test"
                        )
                    )

                    .setTimeout(300)

                    .build();


            const xdr =
                transaction.toXDR();


            res.json({
                ok: true,

                network:
                    "Pi Testnet",

                horizon:
                    TESTNET_HORIZON,

                source:
                    walletAddress,

                destination:
                    walletAddress,

                amount:
                    "0.0000001",

                fee:
                    baseFee.toString(),

                sequence:
                    transaction.sequence,

                xdr
            });

        } catch (error) {

            console.error(
                "Build XDR error:",
                error
            );

            res.status(500).json({
                ok: false,

                error:
                    error?.response?.status === 404
                        ? "Wallet does not exist on Pi Testnet"
                        : error.message
            });
        }
    }
);


// --------------------------------------------------
// Verify the Pi Wallet signature
//
// This does NOT submit anything.
//
// It proves:
//
// authenticated Pi UID
//            +
// wallet G... address
//            +
// valid Ed25519 signature
//
// belong to the same session.
// --------------------------------------------------

app.post(
    "/api/verify-wallet-signature",
    async (req, res) => {

        try {

            const {
                accessToken,
                signedXdr
            } = req.body;

            const walletAddress =
                String(
                    req.body.walletAddress || ""
                )
                    .trim()
                    .toUpperCase();


            if (!accessToken) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Missing Pi access token"
                });
            }


            if (!signedXdr) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Missing signed XDR"
                });
            }


            if (
                !StellarSdk.StrKey
                    .isValidEd25519PublicKey(
                        walletAddress
                    )
            ) {

                return res.status(400).json({
                    ok: false,
                    error:
                        "Invalid wallet address"
                });
            }


            // First verify the Pi user
            const piUser =
                await verifyPiAccessToken(
                    accessToken
                );


            // Parse signed transaction
            const transaction =
                StellarSdk.TransactionBuilder
                    .fromXDR(
                        signedXdr,
                        TESTNET_PASSPHRASE
                    );


            // Calculate transaction hash
            const transactionHash =
                transaction.hash();


            // Public key whose ownership
            // we want to prove
            const wallet =
                StellarSdk.Keypair
                    .fromPublicKey(
                        walletAddress
                    );


            const signatures =
                transaction.signatures || [];


            let walletSignatureFound = false;


            for (const decoratedSignature of signatures) {

                try {

                    const signature =
                        decoratedSignature.signature();

                    const valid =
                        wallet.verify(
                            transactionHash,
                            signature
                        );

                    if (valid) {

                        walletSignatureFound = true;

                        break;
                    }

                } catch {
                    // Ignore invalid/nonmatching
                    // signatures.
                }
            }


            if (!walletSignatureFound) {

                return res.status(400).json({
                    ok: false,

                    verified:
                        false,

                    error:
                        "The XDR is signed, but no valid signature from the supplied wallet address was found."
                });
            }


            // Success:
            // authenticated UID + wallet ownership proven
            res.json({
                ok: true,

                verified:
                    true,

                uid:
                    piUser.uid,

                username:
                    piUser.username,

                walletAddress,

                network:
                    "Pi Testnet",

                transactionHash:
                    Buffer
                        .from(transactionHash)
                        .toString("hex"),

                signatures:
                    signatures.length
            });

        } catch (error) {

            console.error(
                "Signature verification error:",
                error
            );

            res.status(400).json({
                ok: false,
                verified: false,
                error: error.message
            });
        }
    }
);


// --------------------------------------------------
// Root
// --------------------------------------------------

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


// --------------------------------------------------
// Local server
// Vercel imports the Express application directly.
// --------------------------------------------------

if (!process.env.VERCEL) {

    app.listen(
        PORT,
        () => {

            console.log(
                `Server running on http://localhost:${PORT}`
            );

        }
    );
}


export default app;