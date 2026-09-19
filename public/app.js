// --------------------------------------------------
// Pi SDK initialization
// --------------------------------------------------

Pi.init({
    version: "3.0",
    sandbox: false
});


// --------------------------------------------------
// State
// --------------------------------------------------

let accessToken = null;
let authenticatedUser = null;
let verifiedUser = null;


// --------------------------------------------------
// DOM
// --------------------------------------------------

const connectButton =
    document.getElementById(
        "connectButton"
    );

const discoverWalletButton =
    document.getElementById(
        "discoverWalletButton"
    );

const checkWalletButton =
    document.getElementById(
        "checkWalletButton"
    );

const buildButton =
    document.getElementById(
        "buildButton"
    );

const signButton =
    document.getElementById(
        "signButton"
    );

const verifySignatureButton =
    document.getElementById(
        "verifySignatureButton"
    );


const authStatus =
    document.getElementById(
        "authStatus"
    );

const userInfo =
    document.getElementById(
        "userInfo"
    );

const username =
    document.getElementById(
        "username"
    );

const uid =
    document.getElementById(
        "uid"
    );

const authWallet =
    document.getElementById(
        "authWallet"
    );


const walletMethods =
    document.getElementById(
        "walletMethods"
    );

const walletAddressInput =
    document.getElementById(
        "walletAddress"
    );

const walletStatus =
    document.getElementById(
        "walletStatus"
    );


const unsignedXdr =
    document.getElementById(
        "unsignedXdr"
    );

const signingStatus =
    document.getElementById(
        "signingStatus"
    );

const rawSignResult =
    document.getElementById(
        "rawSignResult"
    );

const signedXdrInput =
    document.getElementById(
        "signedXdr"
    );


const verificationStatus =
    document.getElementById(
        "verificationStatus"
    );

const verifiedBox =
    document.getElementById(
        "verifiedBox"
    );

const verifiedUid =
    document.getElementById(
        "verifiedUid"
    );

const verifiedWallet =
    document.getElementById(
        "verifiedWallet"
    );


// --------------------------------------------------
// Helpers
// --------------------------------------------------

function setStatus(
    element,
    message,
    type = ""
) {

    element.textContent =
        message;

    element.className =
        "status";

    if (type) {
        element.classList.add(type);
    }
}


function normalizeAddress(
    value
) {

    return String(value || "")
        .trim()
        .toUpperCase();
}


function looksLikePiAddress(
    value
) {

    return /^G[A-Z2-7]{55}$/
        .test(
            normalizeAddress(value)
        );
}


// --------------------------------------------------
// Recursively search an SDK response
// for G... public keys
// --------------------------------------------------

function findWalletAddresses(
    value,
    found = new Set(),
    seen = new WeakSet()
) {

    if (
        typeof value === "string"
    ) {

        const matches =
            value.match(
                /\bG[A-Z2-7]{55}\b/g
            );

        if (matches) {

            for (
                const address
                of matches
            ) {

                found.add(address);
            }
        }

        return found;
    }


    if (
        !value ||
        typeof value !== "object"
    ) {

        return found;
    }


    if (seen.has(value)) {
        return found;
    }


    seen.add(value);


    if (Array.isArray(value)) {

        for (
            const item
            of value
        ) {

            findWalletAddresses(
                item,
                found,
                seen
            );
        }

        return found;
    }


    for (
        const item
        of Object.values(value)
    ) {

        findWalletAddresses(
            item,
            found,
            seen
        );
    }


    return found;
}


// --------------------------------------------------
// Find XDR in unknown Pi Wallet result shape
// --------------------------------------------------

function extractSignedXdr(
    result
) {

    if (
        typeof result === "string"
    ) {

        if (
            result.length > 120
        ) {

            return result.trim();
        }

        return null;
    }


    if (
        !result ||
        typeof result !== "object"
    ) {

        return null;
    }


    const preferredKeys = [

        "signedXdr",

        "signed_xdr",

        "xdr",

        "transactionXdr",

        "transaction_xdr",

        "envelopeXdr",

        "envelope_xdr"

    ];


    for (
        const key
        of preferredKeys
    ) {

        if (
            typeof result[key] === "string" &&
            result[key].length > 120
        ) {

            return result[key].trim();
        }
    }


    for (
        const value
        of Object.values(result)
    ) {

        const found =
            extractSignedXdr(value);

        if (found) {
            return found;
        }
    }


    return null;
}


// --------------------------------------------------
// Show Wallet API capabilities
// --------------------------------------------------

function inspectWalletApi() {

    if (!Pi.Wallet) {

        walletMethods.textContent =
            "Pi.Wallet is not available.";

        return [];
    }


    const names =
        new Set();


    try {

        for (
            const name
            of Object.getOwnPropertyNames(
                Pi.Wallet
            )
        ) {

            names.add(name);
        }

    } catch {
    }


    try {

        const proto =
            Object.getPrototypeOf(
                Pi.Wallet
            );

        if (proto) {

            for (
                const name
                of Object.getOwnPropertyNames(
                    proto
                )
            ) {

                names.add(name);
            }
        }

    } catch {
    }


    // Also explicitly test methods
    // we are interested in.

    const interesting = [

        "signTransaction",

        "submitTransaction",

        "getUserWalletAddresses",

        "getUserMigratedWalletAddresses"

    ];


    for (
        const name
        of interesting
    ) {

        if (
            typeof Pi.Wallet[name]
            === "function"
        ) {

            names.add(name);
        }
    }


    const sorted =
        [...names]
            .filter(
                name =>
                    name !== "constructor"
            )
            .sort();


    walletMethods.textContent =
        sorted.length
            ? sorted.join("\n")
            : "Pi.Wallet exists, but its methods are not enumerable.";


    return sorted;
}


// --------------------------------------------------
// Incomplete payment callback
// --------------------------------------------------

function onIncompletePaymentFound(
    payment
) {

    console.warn(
        "Incomplete Pi payment:",
        payment
    );
}


// --------------------------------------------------
// Authentication
// --------------------------------------------------

connectButton.addEventListener(
    "click",
    async () => {

        try {

            setStatus(
                authStatus,
                "Opening Pi authentication..."
            );


            const auth =
                await Pi.authenticate(

                    [
                        "username",
                        "wallet_address"
                    ],

                    onIncompletePaymentFound

                );


            console.log(
                "Raw authentication result:",
                auth
            );


            authenticatedUser =
                auth.user;

            accessToken =
                auth.accessToken;


            // Verify token with backend
            const response =
                await fetch(
                    "/api/verify",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                accessToken
                            })
                    }
                );


            const result =
                await response.json();


            if (!result.ok) {

                throw new Error(
                    result.error ||
                    "Backend verification failed"
                );
            }


            verifiedUser =
                result.user;


            username.textContent =
                authenticatedUser.username ||
                verifiedUser.username ||
                "(not returned)";


            uid.textContent =
                verifiedUser.uid;


            const returnedWallet =
                normalizeAddress(
                    authenticatedUser.wallet_address ||
                    verifiedUser.wallet_address ||
                    ""
                );


            authWallet.textContent =
                returnedWallet ||
                "(not returned by Pi)";


            if (returnedWallet) {

                walletAddressInput.value =
                    returnedWallet;
            }


            userInfo.classList.remove(
                "hidden"
            );


            discoverWalletButton.disabled =
                false;


            buildButton.disabled =
                false;


            inspectWalletApi();


            setStatus(
                authStatus,
                `Authenticated and verified.\nUID: ${verifiedUser.uid}`,
                "success"
            );


            if (!returnedWallet) {

                setStatus(
                    walletStatus,

                    "Pi authentication did not return wallet_address.\n\n" +

                    "Use Try Pi Wallet Discovery, or paste your existing Testnet G... address manually.",

                    "warning"
                );
            }

        } catch (error) {

            console.error(error);

            setStatus(
                authStatus,
                error.message ||
                String(error),
                "error"
            );
        }
    }
);


// --------------------------------------------------
// Attempt SDK wallet discovery
// --------------------------------------------------

discoverWalletButton
    .addEventListener(
        "click",
        async () => {

            try {

                if (!Pi.Wallet) {

                    throw new Error(
                        "Pi.Wallet is unavailable."
                    );
                }


                inspectWalletApi();


                const methods = [

                    "getUserWalletAddresses",

                    "getUserMigratedWalletAddresses"

                ];


                const addresses =
                    new Set();


                const output = [];


                for (
                    const methodName
                    of methods
                ) {

                    if (
                        typeof Pi.Wallet[
                            methodName
                        ] !== "function"
                    ) {

                        output.push(
                            `${methodName}: unavailable`
                        );

                        continue;
                    }


                    try {

                        const result =
                            await Pi.Wallet[
                                methodName
                            ]();


                        console.log(
                            `${methodName}:`,
                            result
                        );


                        output.push(
                            `${methodName}:\n` +
                            JSON.stringify(
                                result,
                                null,
                                2
                            )
                        );


                        const discovered =
                            findWalletAddresses(
                                result
                            );


                        for (
                            const address
                            of discovered
                        ) {

                            addresses.add(
                                address
                            );
                        }

                    } catch (error) {

                        output.push(
                            `${methodName} error: ${error.message || error}`
                        );
                    }
                }


                if (
                    addresses.size > 0
                ) {

                    const first =
                        [...addresses][0];


                    walletAddressInput.value =
                        first;


                    setStatus(
                        walletStatus,

                        "Wallet discovered:\n" +
                        [...addresses].join(
                            "\n"
                        ),

                        "success"
                    );

                } else {

                    setStatus(
                        walletStatus,

                        output.join(
                            "\n\n"
                        ) +

                        "\n\nNo wallet address was automatically discovered.\nPaste your Testnet G... address manually.",

                        "warning"
                    );
                }

            } catch (error) {

                console.error(error);

                setStatus(
                    walletStatus,
                    error.message ||
                    String(error),
                    "error"
                );
            }
        }
    );


// --------------------------------------------------
// Check wallet on Testnet
// --------------------------------------------------

checkWalletButton
    .addEventListener(
        "click",
        async () => {

            try {

                const address =
                    normalizeAddress(
                        walletAddressInput.value
                    );


                if (
                    !looksLikePiAddress(
                        address
                    )
                ) {

                    throw new Error(
                        "Enter a valid G... address."
                    );
                }


                setStatus(
                    walletStatus,
                    "Checking Pi Testnet..."
                );


                const response =
                    await fetch(
                        `/api/testnet-account/${address}`
                    );


                const result =
                    await response.json();


                if (!result.ok) {

                    throw new Error(
                        result.error
                    );
                }


                walletAddressInput.value =
                    result.address;


                setStatus(
                    walletStatus,

                    "Found on Pi Testnet\n\n" +

                    `Address: ${result.address}\n` +

                    `Balance: ${result.balance} Test-Pi\n` +

                    `Sequence: ${result.sequence}\n` +

                    `Subentries: ${result.subentry_count}\n` +

                    `Last ledger: ${result.last_modified_ledger}`,

                    "success"
                );


                buildButton.disabled =
                    false;

            } catch (error) {

                console.error(error);

                setStatus(
                    walletStatus,
                    error.message ||
                    String(error),
                    "error"
                );
            }
        }
    );


// --------------------------------------------------
// Build unsigned XDR
// --------------------------------------------------

buildButton.addEventListener(
    "click",
    async () => {

        try {

            const walletAddress =
                normalizeAddress(
                    walletAddressInput.value
                );


            if (
                !looksLikePiAddress(
                    walletAddress
                )
            ) {

                throw new Error(
                    "Enter your Testnet G... wallet address first."
                );
            }


            unsignedXdr.value = "";

            signedXdrInput.value = "";

            rawSignResult.value = "";

            signButton.disabled =
                true;

            verifySignatureButton.disabled =
                true;


            setStatus(
                signingStatus,
                "Building Testnet XDR..."
            );


            const response =
                await fetch(
                    "/api/build-test-xdr",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                walletAddress
                            })
                    }
                );


            const result =
                await response.json();


            if (!result.ok) {

                throw new Error(
                    result.error
                );
            }


            unsignedXdr.value =
                result.xdr;


            signButton.disabled =
                false;


            setStatus(
                signingStatus,

                "Unsigned XDR ready.\n\n" +

                `Network: ${result.network}\n` +

                `Source: ${result.source}\n` +

                `Sequence: ${result.sequence}\n` +

                `Fee: ${result.fee}\n\n` +

                "Nothing has been submitted.",

                "success"
            );

        } catch (error) {

            console.error(error);

            setStatus(
                signingStatus,
                error.message ||
                String(error),
                "error"
            );
        }
    }
);


// --------------------------------------------------
// Sign XDR through Pi Wallet
// --------------------------------------------------

signButton.addEventListener(
    "click",
    async () => {

        try {

            const xdr =
                unsignedXdr.value.trim();


            if (!xdr) {

                throw new Error(
                    "There is no unsigned XDR."
                );
            }


            if (
                !Pi.Wallet
            ) {

                throw new Error(
                    "Pi.Wallet is unavailable in this Pi Browser."
                );
            }


            if (
                typeof Pi.Wallet
                    .signTransaction
                !== "function"
            ) {

                inspectWalletApi();

                throw new Error(

                    "Pi.Wallet.signTransaction() is not exposed by this Pi Browser SDK version.\n\n" +

                    "Check the detected Wallet methods shown above."

                );
            }


            setStatus(
                signingStatus,
                "Opening Pi Wallet signing flow..."
            );


            console.log(
                "Unsigned XDR:",
                xdr
            );


            const result =
                await Pi.Wallet
                    .signTransaction(
                        xdr
                    );


            console.log(
                "Pi.Wallet.signTransaction result:",
                result
            );


            if (
                typeof result === "string"
            ) {

                rawSignResult.value =
                    result;

            } else {

                rawSignResult.value =
                    JSON.stringify(
                        result,
                        null,
                        2
                    );
            }


            const signedXdr =
                extractSignedXdr(
                    result
                );


            if (!signedXdr) {

                setStatus(
                    signingStatus,

                    "Pi Wallet returned a result, but the app could not automatically locate the signed XDR inside it.\n\nCheck the raw response below.",

                    "warning"
                );

                return;
            }


            signedXdrInput.value =
                signedXdr;


            verifySignatureButton.disabled =
                false;


            setStatus(
                signingStatus,

                "XDR signed successfully.\n\nIt has NOT been submitted.",

                "success"
            );

        } catch (error) {

            console.error(error);

            setStatus(
                signingStatus,
                error.message ||
                String(error),
                "error"
            );
        }
    }
);


// --------------------------------------------------
// Cryptographically verify wallet signature
// --------------------------------------------------

verifySignatureButton
    .addEventListener(
        "click",
        async () => {

            try {

                const walletAddress =
                    normalizeAddress(
                        walletAddressInput.value
                    );


                const signedXdr =
                    signedXdrInput.value.trim();


                if (!accessToken) {

                    throw new Error(
                        "Authenticate with Pi first."
                    );
                }


                if (!signedXdr) {

                    throw new Error(
                        "No signed XDR available."
                    );
                }


                setStatus(
                    verificationStatus,
                    "Verifying wallet signature..."
                );


                const response =
                    await fetch(
                        "/api/verify-wallet-signature",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    accessToken,
                                    walletAddress,
                                    signedXdr
                                })
                        }
                    );


                const result =
                    await response.json();


                if (
                    !result.ok ||
                    !result.verified
                ) {

                    throw new Error(
                        result.error ||
                        "Signature verification failed."
                    );
                }


                verifiedUid.textContent =
                    result.uid;


                verifiedWallet.textContent =
                    result.walletAddress;


                verifiedBox.classList.remove(
                    "hidden"
                );


                setStatus(
                    verificationStatus,

                    "SUCCESS\n\n" +

                    `Username: ${result.username}\n` +

                    `UID: ${result.uid}\n` +

                    `Wallet: ${result.walletAddress}\n` +

                    `Network: ${result.network}\n` +

                    `Signatures: ${result.signatures}\n` +

                    `Transaction hash: ${result.transactionHash}`,

                    "success"
                );

            } catch (error) {

                console.error(error);

                verifiedBox.classList.add(
                    "hidden"
                );


                setStatus(
                    verificationStatus,
                    error.message ||
                    String(error),
                    "error"
                );
            }
        }
    );


// --------------------------------------------------
// Re-enable XDR build when user manually
// enters a wallet.
// --------------------------------------------------

walletAddressInput
    .addEventListener(
        "input",
        () => {

            if (
                accessToken &&
                looksLikePiAddress(
                    walletAddressInput.value
                )
            ) {

                buildButton.disabled =
                    false;
            }
        }
    );