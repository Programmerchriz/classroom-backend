import arcjet, { shield, detectBot } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";

if (!process.env.ARCJET_KEY) {
  throw new Error("ARCJET_KEY is not set in .env file");
}

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:PREVIEW",
      ],
    }),
  ],
});

export default aj;
