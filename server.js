import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const FirebaseAccountjsonFileName = process.env.FIREBASE_SERVICE_ACCOUNT;
import(`./${FirebaseAccountjsonFileName}`, { assert: { type: 'json' } })
  .then(module => {
    const FirebaseAccountjsonFileData = module.default;
    
  })

const firebaseServiceAccount = JSON.parse(FirebaseAccountjsonFileData);
admin.initializeApp({
  credential: admin.credential.cert(firebaseServiceAccount),
});
const db = admin.firestore();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("TAP Backend running");
});

app.post("/chat", async (req, res) => {
  try {
    const { message, idToken } = req.body;

    if (!idToken) {
      return res.status(401).json({ error: "No Firebase ID token provided" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Fetch permanent user info from Firestore
    const userProfileDoc = await db.collection("users").doc(uid).get();
    let userProfileMessage = "";
    if (userProfileDoc.exists) {
      const data = userProfileDoc.data();
      userProfileMessage = `User info: Name: ${data.name || "unknown"}, Preferences: ${data.preferences || "none"}.`;
    }

    const systemMessage = { role: "system", content: userProfileMessage };

    // Fetch recent chat history
    const userChatDoc = db.collection("chats").doc(uid);
    const userChatData = await userChatDoc.get();
    let chatHistory = [];
    if (userChatData.exists) {
      chatHistory = userChatData.data().messages || [];
    }

    // Limit chat history to last 20 messages
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(chatHistory.length - 20);
    }

    // Add current user message
    chatHistory.push({ role: "user", content: message });

    // Prepend system message with permanent user info
    const messagesToSend = [systemMessage, ...chatHistory];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesToSend,
    });

    const reply = completion.choices[0].message.content;

    chatHistory.push({ role: "assistant", content: reply });

    await userChatDoc.set({ messages: chatHistory }, { merge: true });

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed or Firebase token invalid" });
  }
});

app.post("/save", async (req, res) => {
  try {
    const { collection, data } = req.body;
    const docRef = await db.collection(collection).add(data);
    res.json({ id: docRef.id });
  } catch (err) {
    res.status(500).json({ error: "Firestore request failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});













// Dynamic import (note: this returns a promise)

  
