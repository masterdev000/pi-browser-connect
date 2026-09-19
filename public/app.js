(() => {
  const connectBtn = document.getElementById("connectBtn");
  const status = document.getElementById("status");
  const account = document.getElementById("account");
  const username = document.getElementById("username");
  const uid = document.getElementById("uid");
  const walletAddress = document.getElementById("walletAddress");

  function setStatus(message) {
    status.textContent = message;
  }

  function onIncompletePaymentFound(payment) {
    console.warn("Incomplete Pi payment found:", payment);
    // We are not creating payments in this first version.
  }

  if (!window.Pi) {
    setStatus("Pi SDK did not load. Open this page in Pi Browser and check your connection.");
    connectBtn.disabled = true;
    return;
  }

  // Normal Pi Browser mode.
  // The Pi Testnet/Mainnet choice comes from the app you register in the Developer Portal.
  // Set sandbox: true only when intentionally using sandbox.minepi.com.
  Pi.init({
    version: "2.0",
    sandbox: false,
  });

  connectBtn.addEventListener("click", async () => {
    connectBtn.disabled = true;
    account.style.display = "none";
    setStatus("Waiting for Pi Browser authorization…");

    try {
      const auth = await Pi.authenticate(
        ["username", "wallet_address"],
        onIncompletePaymentFound
      );

      if (!auth?.accessToken || !auth?.user?.uid) {
        throw new Error("Pi Browser returned an incomplete authentication response.");
      }

      // Verify the access token server-side. Do not trust frontend identity alone.
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: auth.accessToken,
        }),
      });

      const verified = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(
          verified?.error || "Server could not verify the Pi authentication token."
        );
      }

      username.textContent = verified.username || auth.user.username || "(not returned)";
      uid.textContent = verified.uid || auth.user.uid;
      walletAddress.textContent =
        auth.user.wallet_address || "(wallet address not returned by Pi)";

      account.style.display = "grid";
      setStatus("Connected and verified successfully.");
    } catch (error) {
      console.error(error);
      setStatus(
        error?.message
          ? `Connection failed: ${error.message}`
          : "Connection was cancelled or failed."
      );
    } finally {
      connectBtn.disabled = false;
    }
  });
})();
