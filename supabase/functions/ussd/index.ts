// index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

// Main handler function
serve(async (req) => {
  // Parse the form data sent by Africa's Talking
  const body = await req.formData();
  const sessionId = body.get("sessionId")?.toString() || "";
  const serviceCode = body.get("serviceCode")?.toString() || "";
  const phoneNumber = body.get("phoneNumber")?.toString() || "";
  const text = body.get("text")?.toString() || "";

  // Split the text input into an array for navigation
  const textArray = text.split("*");
  const userResponse = textArray[textArray.length - 1];

  let response = "";

  if (text === "") {
    // This is the first request. Present the user with the menu
    response = `CON Welcome to Your Service
1. Check Balance
2. Send Money`;
  } else if (text === "1") {
    // User selected 'Check Balance'
    // For now, we can return a static balance
    response = `END Your balance is $100`;
  } else if (text.startsWith("2")) {
    // User selected 'Send Money'
    if (textArray.length === 2) {
      // Prompt for recipient's phone number
      response = `CON Enter recipient's phone number:`;
    } else if (textArray.length === 3) {
      // Prompt for amount
      response = `CON Enter amount to send:`;
    } else if (textArray.length === 4) {
      // Confirm the transaction
      const recipientPhone = textArray[2];
      const amount = textArray[3];
      response = `CON Confirm sending $${amount} to ${recipientPhone}?
1. Yes
2. No`;
    } else if (textArray.length === 5) {
      if (userResponse === "1") {
        // User confirmed transaction
        // Here, you would process the transaction
        response = `END Transaction successful!`;
      } else if (userResponse === "2") {
        // User canceled transaction
        response = `END Transaction canceled.`;
      } else {
        response = `END Invalid input.`;
      }
    } else {
      response = `END Invalid input.`;
    }
  } else {
    response = `END Invalid option.`;
  }

  return new Response(response, {
    headers: { "Content-Type": "text/plain" },
  });
});
