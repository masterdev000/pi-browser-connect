const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/auth/verify", async (req, res) => {
  try {
    const { accessToken } = req.body || {};

    if (!accessToken || typeof accessToken !== "string") {
      return res.status(400).json({ error: "Missing access token" });
    }

    const response = await fetch("https://api.minepi.com/v2/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Pi authentication verification failed",
        details: data,
      });
    }

    // Only return the Pi-verified identity fields we actually need.
    return res.json({
      uid: data.uid,
      username: data.username,
    });
  } catch (error) {
    console.error("Auth verification error:", error);
    return res.status(500).json({ error: "Server error verifying Pi user" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Pi Browser demo listening on port ${PORT}`);
});
