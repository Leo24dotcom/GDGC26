const express = require("express");
const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Initialize Firebase Admin SDK
if (!getApps().length) {
  const localKeyPath = path.join(__dirname, "serviceAccountKey.json");

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Automatically uses path specified in GOOGLE_APPLICATION_CREDENTIALS
    initializeApp();
  } else if (fs.existsSync(localKeyPath)) {
    // Uses local service account file if present in backend/
    const serviceAccount = require(localKeyPath);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Fall back to Application Default Credentials (e.g. gcloud auth ADC)
    initializeApp();
  }
}

const db = getFirestore();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/listings", async (_req, res) => {
  try {
    const snapshot = await db.collection("listings").get();
    const listings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(listings);
  } catch (error) {
    console.error("Error fetching listings from Firestore:", error);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

app.post("/api/listings", async (req, res) => {
  try {
    const { title, servings } = req.body || {};

    if (typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({
        error: "Title must be a non-empty string",
      });
    }

    if (typeof servings !== "number" || !Number.isInteger(servings) || servings <= 0) {
      return res.status(400).json({
        error: "Servings must be a positive whole number",
      });
    }

    const docRef = await db.collection("listings").add({
      title: title.trim(),
      servings,
      status: "available",
      createdAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("Error creating listing in Firestore:", error);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`FreshLoop API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
