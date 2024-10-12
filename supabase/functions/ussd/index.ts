// index.ts
import { serve } from "https://deno.land/std@0.178.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Keypair,
  Server,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
} from "npm:stellar-sdk@10.1.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Stellar server (Testnet)
const stellarServer = new Server("https://horizon-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;

// Start serving the USSD function
serve(async (req) => {
  try {
    // Parse the form data sent by Africa's Talking
    const body = await req.formData();
    const sessionId = body.get("sessionId")?.toString() || "";
    const serviceCode = body.get("serviceCode")?.toString() || "";
    const phoneNumber = body.get("phoneNumber")?.toString() || "";
    const text = body.get("text")?.toString() || "";

    // Log incoming request data for debugging
    console.log("USSD Request Received:");
    console.log("Session ID:", sessionId);
    console.log("Service Code:", serviceCode);
    console.log("Phone Number:", phoneNumber);
    console.log("Text:", text);

    // Normalize the phone number
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    // Split the text input into an array for navigation
    const textArray = text === "" ? [] : text.split("*");
    const userResponse = textArray[textArray.length - 1];

    console.log("Text Array:", textArray);
    console.log("User Response:", userResponse);

    let response = "";

    if (text === "") {
      // This is the first request. Present the user with the menu
      response = `CON Welcome to Your Service
1. Check Balance
2. Send Money`;
    } else if (text === "1") {
      // User selected 'Check Balance'
      console.log("User selected 'Check Balance'");

      // Fetch user's Stellar public key from the database
      const { data: userData, error } = await supabase
        .from("users")
        .select("stellar_public_key")
        .eq("phone_number", normalizedPhoneNumber)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user data:", error);
        response = `END An error occurred while fetching your balance.`;
      } else if (!userData || !userData.stellar_public_key) {
        console.log("No account found for phone number:", normalizedPhoneNumber);
        response = `END No account found for this phone number.`;
      } else {
        try {
          // Load user's Stellar account
          const account = await stellarServer.loadAccount(userData.stellar_public_key);
          const balances = account.balances;
          const nativeBalance = balances.find(
            (balance: any) => balance.asset_type === "native"
          );

          const balanceAmount = nativeBalance ? nativeBalance.balance : "0";
          response = `END Your balance is ${balanceAmount} XLM`;
        } catch (stellarError) {
          console.error("Error fetching Stellar account:", stellarError);
          response = `END An error occurred while fetching your balance.`;
        }
      }
    } else if (text.startsWith("2")) {
      // User selected 'Send Money'
      console.log("User selected 'Send Money'");
      if (textArray.length === 1) {
        // Prompt for recipient's phone number
        response = `CON Enter recipient's phone number (in format +1234567890):`;
      } else if (textArray.length === 2) {
        // Validate recipient's phone number
        const recipientPhone = normalizePhoneNumber(textArray[1]);
        if (!isValidPhoneNumber(recipientPhone)) {
          response = `END Invalid phone number format. Please try again.`;
        } else {
          // Prompt for amount
          response = `CON Enter amount to send:`;
        }
      } else if (textArray.length === 3) {
        // Validate amount
        const amount = parseFloat(textArray[2]);
        if (!isValidAmount(amount)) {
          response = `END Invalid amount entered. Please try again.`;
        } else {
          // Confirm the transaction
          const recipientPhone = normalizePhoneNumber(textArray[1]);
          response = `CON Confirm sending ${amount} XLM to ${recipientPhone}?
1. Yes
2. No`;
        }
      } else if (textArray.length === 4) {
        const recipientPhone = normalizePhoneNumber(textArray[1]);
        const amount = parseFloat(textArray[2]);
        const confirmation = textArray[3];

        if (confirmation === "1") {
          // User confirmed transaction
          console.log("User confirmed transaction");

          // Fetch sender and recipient from the database
          const { data: senderData, error: senderError } = await supabase
            .from("users")
            .select("stellar_public_key")
            .eq("phone_number", normalizedPhoneNumber)
            .maybeSingle();

          const { data: recipientData, error: recipientError } = await supabase
            .from("users")
            .select("stellar_public_key")
            .eq("phone_number", recipientPhone)
            .maybeSingle();

          if (senderError) {
            console.error("Error fetching sender data:", senderError);
            response = `END An error occurred while processing your request.`;
          } else if (recipientError) {
            console.error("Error fetching recipient data:", recipientError);
            response = `END An error occurred while processing your request.`;
          } else if (!senderData || !senderData.stellar_public_key) {
            console.log(
              "Sender account not found or missing Stellar credentials:",
              normalizedPhoneNumber
            );
            response = `END Sender account not found or credentials missing.`;
          } else if (!recipientData || !recipientData.stellar_public_key) {
            console.log("Recipient account not found:", recipientPhone);
            response = `END Recipient not found.`;
          } else {
            // Retrieve sender's secret key from environment variable
            const senderStellarSecret = Deno.env.get("STELLAR_SENDER_SECRET");
            if (!senderStellarSecret) {
              console.error(
                "Sender's Stellar secret key not found in environment variables."
              );
              response = `END An error occurred while processing your request.`;
              return new Response(response, {
                headers: { "Content-Type": "text/plain" },
              });
            }

            // Derive the public key from the secret key
            const senderKeypair = Keypair.fromSecret(senderStellarSecret);
            const derivedPublicKey = senderKeypair.publicKey();
            console.log("Derived Public Key:", derivedPublicKey);
            console.log("Stored Public Key:", senderData.stellar_public_key);

            // Verify that the derived public key matches the stored public key
            if (derivedPublicKey !== senderData.stellar_public_key) {
              console.error(
                "Mismatch between derived public key and stored public key."
              );
              response = `END Configuration error. Please contact support.`;
              return new Response(response, {
                headers: { "Content-Type": "text/plain" },
              });
            }

            try {
              // Load sender's Stellar account
              const account = await stellarServer.loadAccount(derivedPublicKey);

              // Fetch base fee and convert it to string
              const fee = (await stellarServer.fetchBaseFee()).toString();

              // Build the transaction
              const transaction = new TransactionBuilder(account, {
                fee,
                networkPassphrase,
              })
                .addOperation(
                  Operation.payment({
                    destination: recipientData.stellar_public_key,
                    asset: Asset.native(),
                    amount: amount.toString(),
                  })
                )
                .setTimeout(30)
                .build();

              // Sign the transaction
              transaction.sign(senderKeypair);

              // Submit the transaction
              const txResult = await stellarServer.submitTransaction(transaction);
              console.log("Transaction successful:", txResult.hash);

              // Record the transaction
              const { error: transactionError } = await supabase.from("transactions").insert([
                {
                  from_phone_number: normalizedPhoneNumber,
                  to_phone_number: recipientPhone,
                  amount,
                  tx_hash: txResult.hash,
                },
              ]);

              if (transactionError) {
                console.error("Error recording transaction:", transactionError);
                response = `END Transaction successful, but failed to record it.`;
              } else {
                response = `END Transaction successful!`;
              }
            } catch (stellarError) {
              console.error("Transaction failed:", stellarError);
              response = `END Transaction failed. Please try again.`;
            }
          }
        } else if (confirmation === "2") {
          // User canceled transaction
          response = `END Transaction canceled.`;
        } else {
          response = `END Invalid input.`;
        }
      } else {
        response = `END Invalid option.`;
      }
    } else {
      response = `END Invalid option.`;
    }

    // Log the response for debugging
    console.log("USSD Response:", response);

    return new Response(response, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    const response = `END An unexpected error occurred. Please try again later.`;
    return new Response(response, {
      headers: { "Content-Type": "text/plain" },
    });
  }
});

// Helper Functions

/**
 * Validates the phone number format.
 * Expected format: + followed by 10 to 15 digits.
 * @param phone - The phone number string to validate.
 * @returns True if valid, false otherwise.
 */
function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(phone);
}

/**
 * Normalizes the phone number by ensuring it starts with '+' and contains only digits.
 * @param phone - The phone number string to normalize.
 * @returns The normalized phone number.
 */
function normalizePhoneNumber(phone: string): string {
  // Remove any non-digit characters and ensure it starts with '+'
  const digits = phone.replace(/\D/g, '');
  return '+' + digits;
}

/**
 * Validates that the amount is a positive number.
 * @param amount - The amount to validate.
 * @returns True if valid, false otherwise.
 */
function isValidAmount(amount: number): boolean {
  return !isNaN(amount) && amount > 0;
}
