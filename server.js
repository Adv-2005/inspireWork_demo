require("dotenv").config();
const express = require("express");
const plivo = require("plivo");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = new plivo.Client(
  process.env.PLIVO_AUTH_ID,
  process.env.PLIVO_AUTH_TOKEN
);

const BASE_URL         = process.env.BASE_URL;
const PLIVO_NUMBER     = process.env.PLIVO_PHONE_NUMBER;
const ASSOCIATE_NUMBER = process.env.ASSOCIATE_NUMBER;
const PORT             = process.env.PORT || 3000;

// ─── HARDCODED OTP ────────────────────────────────────────────────────────────
// Your birthdate in DDMM format. Change this to your own birthdate.
// Example: March 15 → "1503"
const CORRECT_OTP = "1503";

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Plivo IVR Demo is running."));

// ─── POST /call — Trigger Outbound Call ───────────────────────────────────────
app.post("/call", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Missing 'to' phone number." });

  try {
    // Step 1: Send OTP via SMS first
    await client.messages.create(
      PLIVO_NUMBER,   // from
      to,             // to
      `Your InspireWorks verification code is: ${CORRECT_OTP}. You will receive a call shortly.`
    );
    console.log(`[SMS] OTP sent to ${to}`);

    // Step 2: Place the call
    const response = await client.calls.create(
      PLIVO_NUMBER,
      to,
      `${BASE_URL}/ivr/otp`,
      { answerMethod: "POST" }
    );

    console.log(`[CALL] Initiated to ${to} | UUID: ${response.requestUuid}`);
    res.json({ message: "OTP sent via SMS. Call initiated.", requestUuid: response.requestUuid });
  } catch (err) {
    console.error("[ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /ivr/otp — Prompt caller to enter 4-digit OTP ──────────────────────
app.post("/ivr/otp", (req, res) => {
  console.log("[OTP] Prompting caller for OTP");

  const response = new plivo.Response();
  const getInput = response.addGetDigits({
    action: `${BASE_URL}/ivr/otp/verify`,
    method: "POST",
    timeout: 10,
    numDigits: 4,
    retries: 1,
  });

  getInput.addSpeak(
    "Welcome to InspireWorks. Please enter your 4-digit authentication code to continue.",
    { language: "en-US" }
  );

  response.addSpeak("No input received. Goodbye.", { language: "en-US" });
  response.addHangup();

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── POST /ivr/otp/verify — Validate OTP, retry on failure ───────────────────
app.post("/ivr/otp/verify", (req, res) => {
  const digits = req.body.Digits;
  console.log(`[OTP] Received: ${digits}`);

  const response = new plivo.Response();

  if (digits === CORRECT_OTP) {
    console.log("[OTP] Correct — proceeding to language selection");
    response.addSpeak("Authentication successful. Welcome.", { language: "en-US" });
    response.addRedirect(`${BASE_URL}/ivr/language`, { method: "POST" });
  } else {
    console.log(`[OTP] Incorrect: ${digits} — re-prompting`);
    response.addSpeak("Incorrect code. Please try again.", { language: "en-US" });
    response.addRedirect(`${BASE_URL}/ivr/otp`, { method: "POST" });
  }

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── POST /ivr/language — Level 1: Language Selection ────────────────────────
app.post("/ivr/language", (req, res) => {
  console.log("[IVR] Level 1 — Language selection");

  const response = new plivo.Response();
  const getInput = response.addGetDigits({
    action: `${BASE_URL}/ivr/language/route`,
    method: "POST",
    timeout: 10,
    numDigits: 1,
    retries: 3,
  });

  getInput.addSpeak("Press 1 for English. Press 2 for Spanish.", { language: "en-US" });

  response.addSpeak("We did not receive your input. Goodbye.", { language: "en-US" });
  response.addHangup();

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── POST /ivr/language/route — Route based on language choice ───────────────
app.post("/ivr/language/route", (req, res) => {
  const digit = req.body.Digits;
  console.log(`[LANGUAGE] User pressed: ${digit}`);

  const response = new plivo.Response();

  if (digit === "1") {
    response.addRedirect(`${BASE_URL}/ivr/menu/english`, { method: "POST" });
  } else if (digit === "2") {
    response.addRedirect(`${BASE_URL}/ivr/menu/spanish`, { method: "POST" });
  } else {
    response.addSpeak("Invalid input. Please try again.", { language: "en-US" });
    response.addRedirect(`${BASE_URL}/ivr/language`, { method: "POST" });
  }

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── POST /ivr/menu/english — Level 2: English Options ───────────────────────
app.post("/ivr/menu/english", (req, res) => {
  console.log("[MENU] English menu");

  const response = new plivo.Response();
  const getInput = response.addGetDigits({
    action: `${BASE_URL}/ivr/action/english`,
    method: "POST",
    timeout: 10,
    numDigits: 1,
    retries: 3,
  });

  getInput.addSpeak(
    "Press 1 to hear a message. Press 2 to connect to an associate.",
    { language: "en-US" }
  );

  response.addSpeak("We did not receive your input. Goodbye.", { language: "en-US" });
  response.addHangup();

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── POST /ivr/menu/spanish — Level 2: Spanish Options ───────────────────────
app.post("/ivr/menu/spanish", (req, res) => {
  console.log("[MENU] Spanish menu");

  const response = new plivo.Response();
  const getInput = response.addGetDigits({
    action: `${BASE_URL}/ivr/action/spanish`,
    method: "POST",
    timeout: 10,
    numDigits: 1,
    retries: 3,
  });

  getInput.addSpeak(
    "Presione 1 para escuchar un mensaje. Presione 2 para hablar con un asociado.",
    { language: "es-ES" }
  );

  response.addSpeak("No recibimos su entrada. Adios.", { language: "es-ES" });
  response.addHangup();

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── POST /ivr/action/english — Handle English menu input ────────────────────
app.post("/ivr/action/english", (req, res) => {
  const digit = req.body.Digits;
  console.log(`[ACTION/EN] User pressed: ${digit}`);

  const response = new plivo.Response();

  if (digit === "1") {
    response.addSpeak("Here is your message.", { language: "en-US" });
    response.addPlay("https://samplelib.com/lib/preview/mp3/sample-3s.mp3");
    response.addSpeak("Thank you for listening. Goodbye.", { language: "en-US" });
    response.addHangup();
  } else if (digit === "2") {
    console.log(`[ACTION/EN] Forwarding to: ${ASSOCIATE_NUMBER}`);
    response.addSpeak("Connecting you to an associate. Please hold.", { language: "en-US" });
    const dial = response.addDial();
    dial.addNumber(ASSOCIATE_NUMBER);
  } else {
    response.addSpeak("Invalid input. Please try again.", { language: "en-US" });
    response.addRedirect(`${BASE_URL}/ivr/menu/english`, { method: "POST" });
  }

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── POST /ivr/action/spanish — Handle Spanish menu input ────────────────────
app.post("/ivr/action/spanish", (req, res) => {
  const digit = req.body.Digits;
  console.log(`[ACTION/ES] User pressed: ${digit}`);

  const response = new plivo.Response();

  if (digit === "1") {
    response.addSpeak("Aqui esta su mensaje.", { language: "es-ES" });
    response.addPlay("https://samplelib.com/lib/preview/mp3/sample-3s.mp3");
    response.addSpeak("Gracias por escuchar. Adios.", { language: "es-ES" });
    response.addHangup();
  } else if (digit === "2") {
    console.log(`[ACTION/ES] Forwarding to: ${ASSOCIATE_NUMBER}`);
    response.addSpeak("Conectandote con un asociado. Por favor espera.", { language: "es-ES" });
    const dial = response.addDial();
    dial.addNumber(ASSOCIATE_NUMBER);
  } else {
    response.addSpeak("Entrada invalida. Por favor intente de nuevo.", { language: "es-ES" });
    response.addRedirect(`${BASE_URL}/ivr/menu/spanish`, { method: "POST" });
  }

  res.set("Content-Type", "application/xml");
  res.send(response.toXML());
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Plivo IVR Demo running on port ${PORT}`);
  console.log(`   BASE_URL   : ${BASE_URL}`);
  console.log(`   FROM       : ${PLIVO_NUMBER}`);
  console.log(`   ASSOCIATE  : ${ASSOCIATE_NUMBER}`);
  console.log(`   OTP        : ${CORRECT_OTP} (change to your DDMM birthdate)\n`);
});
