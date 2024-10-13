
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

// Initialise Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialise Stellar server (Testnet)
const stellarServer = new Server("https://horizon-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;

// Define Assets
const XLM = Asset.native();

const USDC = new Asset(
  "USDC",
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
);

const EURC = new Asset(
  "EURC",
  "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO"
);

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

/**
 * Validates that the PIN is a 4 to 6-digit number.
 * @param pin - The PIN to validate.
 * @returns True if valid, false otherwise.
 */
function isValidPin(pin: string): boolean {
  const pinRegex = /^\d{4,6}$/;
  return pinRegex.test(pin);
}

/**
 * Retrieves the Asset object based on the currency code.
 * @param currency - The currency code (e.g., "XLM", "USDC", "EURC").
 * @returns The corresponding Asset object or null if unsupported.
 */
function getAsset(currency: string): Asset | null {
  switch (currency) {
    case "XLM":
      return XLM;
    case "USDC":
      return USDC;
    case "EURC":
      return EURC;
    default:
      return null;
  }
}

/**
 * Funds a Stellar Testnet account using Friendbot.
 * @param publicKey - The Stellar public key to fund.
 * @returns True if funding was successful, false otherwise.
 */
async function fundTestnetAccount(publicKey: string): Promise<boolean> {
  const friendbotUrl = `https://friendbot.stellar.org/?addr=${publicKey}`;
  try {
    const response = await fetch(friendbotUrl);
    if (response.ok) {
      console.log(`Successfully funded account: ${publicKey}`);
      return true;
    } else {
      console.error(`Failed to fund account: ${publicKey}`);
      return false;
    }
  } catch (error) {
    console.error(`Error funding account: ${error}`);
    return false;
  }
}

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

    // Initial Menu
    if (text === "") {
      response = `CON Welcome to Stellar USSD Service
1. Register
2. Existing User`;
    }
    // Registration Flow
    else if (textArray[0] === "1") {
      if (textArray.length === 1) {
        // Prompt for phone number
        response = `CON Enter your phone number (in format +1234567890):`;
      } else if (textArray.length === 2) {
        // Collect phone number and check if already registered
        const inputPhone = normalizePhoneNumber(textArray[1]);
        if (!isValidPhoneNumber(inputPhone)) {
          response = `END Invalid phone number format. Please try again.`;
        } else {
          // Check if user already exists
          const { data: existingUser, error } = await supabase
            .from("users")
            .select("phone_number")
            .eq("phone_number", inputPhone)
            .maybeSingle();

          if (error) {
            console.error("Error checking existing user:", error);
            response = `END An error occurred. Please try again later.`;
          } else if (existingUser) {
            response = `END User already registered. Please use the existing user option.`;
          } else {
            // Proceed to prompt for PIN
            response = `CON Set a 4 to 6-digit PIN for your account:`;
          }
        }
      } else if (textArray.length === 3) {
        // Collect PIN and validate
        const pin = textArray[2];
        if (!isValidPin(pin)) {
          response = `END Invalid PIN format. Please enter a 4 to 6-digit PIN.`;
        } else {
          // Generate Stellar keypair
          const keypair = Keypair.random();
          const publicKey = keypair.publicKey();
          const secretKey = keypair.secret();

          // Log the secret key (For Testnet Only)
          console.log(`Generated Keypair for ${normalizedPhoneNumber}:`);
          console.log(`Public Key: ${publicKey}`);
          console.log(`Secret Key: ${secretKey}`);

          // Initialise wallet_balance with zeroes
          const initialWalletBalance = {
            "XLM": "0",
            "USDC": "0",
            "EURC": "0"
          };

          // Insert new user into the database
          const { error: insertError } = await supabase
            .from("users")
            .insert([
              {
                phone_number: normalizedPhoneNumber,
                stellar_public_key: publicKey,
                preferred_currency: "XLM",
                wallet_balance: initialWalletBalance,
                pin: pin
              }
            ]);

          if (insertError) {
            console.error("Error inserting new user:", insertError);
            response = `END An error occurred during registration. Please try again later.`;
          } else {
            // Fund XLM via Friendbot
            const fundingSuccess = await fundTestnetAccount(publicKey);
            if (fundingSuccess) {
              response = `END Registration successful!
Your Stellar Public Key: ${publicKey}
Your account has been funded with XLM on Testnet. You can now use the service.`;
            } else {
              response = `END Registration successful!
Your Stellar Public Key: ${publicKey}
However, we couldn't fund your account automatically. Please fund it manually using the Stellar Laboratory.`;
            }
          }
        }
      }
    }
    // Existing User Flow
    else if (textArray[0] === "2") {
      if (textArray.length === 1) {
        // Prompt for phone number
        response = `CON Enter your registered phone number (in format +1234567890):`;
      } else if (textArray.length === 2) {
        // Verify existing user
        const existingPhone = normalizePhoneNumber(textArray[1]);
        if (!isValidPhoneNumber(existingPhone)) {
          response = `END Invalid phone number format. Please try again.`;
        } else {
          // Check if user exists
          const { data: userData, error } = await supabase
            .from("users")
            .select("pin")
            .eq("phone_number", existingPhone)
            .maybeSingle();

          if (error) {
            console.error("Error fetching user data:", error);
            response = `END An error occurred. Please try again later.`;
          } else if (!userData) {
            response = `END No account found for this phone number. Please register first.`;
          } else {
            // Proceed to prompt for PIN
            response = `CON Enter your PIN:`;
          }
        }
      } else if (textArray.length === 3) {
        // Validate PIN
        const inputPin = textArray[2];
        const existingPhone = normalizePhoneNumber(textArray[1]);

        const { data: userData, error } = await supabase
          .from("users")
          .select("pin")
          .eq("phone_number", existingPhone)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user data:", error);
          response = `END An error occurred. Please try again later.`;
        } else if (!userData) {
          response = `END No account found. Please register first.`;
        } else if (userData.pin !== inputPin) {
          response = `END Incorrect PIN. Please try again.`;
        } else {
          // PIN is correct; proceed to main menu
          response = `CON Welcome back!
1. Check Balance
2. Send Money
3. Exit`;
        }
      }
      // Main Menu for Existing Users after PIN verification
      else if (textArray.length >= 4) {
        const mainMenuOption = textArray[3];
        const existingPhone = normalizePhoneNumber(textArray[1]);
        if (mainMenuOption === "1") {
          // Check Balance
          if (textArray.length === 4) {
            // Prompt to select which balance to view
            response = `CON Select balance to view:
1. XLM
2. USDC
3. EURC`;
          } else if (textArray.length === 5) {
            const balanceChoice = textArray[4];
            const balances: Record<string, string> = { "1": "XLM", "2": "USDC", "3": "EURC" };
            const selectedBalance = balances[balanceChoice];

            if (!selectedBalance) {
              response = `END Invalid selection. Please try again.`;
            } else {
              // Fetch user's wallet balance
              const { data: userData, error } = await supabase
                .from("users")
                .select("wallet_balance")
                .eq("phone_number", existingPhone)
                .maybeSingle();

              if (error) {
                console.error("Error fetching user balance:", error);
                response = `END An error occurred while fetching your balance.`;
              } else if (!userData || !userData.wallet_balance) {
                response = `END No balance information found.`;
              } else {
                const balanceAmount = userData.wallet_balance[selectedBalance] || "0";
                response = `END Your ${selectedBalance} balance is ${balanceAmount}`;
              }
            }
          }
        } else if (mainMenuOption === "2") {
          // Send Money
          if (textArray.length === 4) {
            // Prompt for currency selection
            response = `CON Select currency to send:
1. XLM
2. USDC
3. EURC`;
          } else if (textArray.length === 5) {
            const currencyChoice = textArray[4];
            const currencies: Record<string, string> = { "1": "XLM", "2": "USDC", "3": "EURC" };
            const selectedCurrency = currencies[currencyChoice];

            if (!selectedCurrency) {
              response = `END Invalid currency selection. Please try again.`;
            } else {
              // Prompt for recipient's phone number
              response = `CON Enter recipient's phone number (in format +1234567890):`;
            }
          } else if (textArray.length === 6) {
            const recipientPhone = normalizePhoneNumber(textArray[5]);
            if (!isValidPhoneNumber(recipientPhone)) {
              response = `END Invalid phone number format. Please try again.`;
            } else {
              // Prompt for amount
              response = `CON Enter amount to send:`;
            }
          } else if (textArray.length === 7) {
            const amount = parseFloat(textArray[6]);
            if (!isValidAmount(amount)) {
              response = `END Invalid amount entered. Please try again.`;
            } else {
              // Confirm transaction
              response = `CON Confirm sending ${amount} to ${textArray[5]}?
1. Yes
2. No`;
            }
          } else if (textArray.length === 8) {
            const confirmation = textArray[7];
            if (confirmation === "1") {
              // Proceed with sending funds
              const currencyChoice = textArray[4];
              const currencies: Record<string, string> = { "1": "XLM", "2": "USDC", "3": "EURC" };
              const selectedCurrency = currencies[currencyChoice];
              const recipientPhone = normalizePhoneNumber(textArray[5]);
              const amount = parseFloat(textArray[6]);

              try {
                // Fetch sender and recipient data
                const { data: senderData, error: senderError } = await supabase
                  .from("users")
                  .select("stellar_public_key, wallet_balance")
                  .eq("phone_number", existingPhone)
                  .maybeSingle();

                const { data: recipientData, error: recipientError } = await supabase
                  .from("users")
                  .select("stellar_public_key")
                  .eq("phone_number", recipientPhone)
                  .maybeSingle();

                if (senderError || !senderData || !senderData.stellar_public_key) {
                  response = `END Sender account not found.`;
                } else if (recipientError || !recipientData || !recipientData.stellar_public_key) {
                  response = `END Recipient account not found.`;
                } else {
                  // Retrieve sender's secret key
                  const senderStellarSecret = Deno.env.get("STELLAR_SENDER_SECRET");
                  if (!senderStellarSecret) {
                    console.error("Sender's Stellar secret key not found in environment variables.");
                    response = `END An error occurred while processing your request.`;
                    return new Response(response, {
                      headers: { "Content-Type": "text/plain" },
                    });
                  }

                  // Derive public key and verify
                  const senderKeypair = Keypair.fromSecret(senderStellarSecret);
                  const derivedPublicKey = senderKeypair.publicKey();

                  if (derivedPublicKey !== senderData.stellar_public_key) {
                    console.error("Mismatch between derived public key and stored public key.");
                    response = `END Configuration error. Please contact support.`;
                    return new Response(response, {
                      headers: { "Content-Type": "text/plain" },
                    });
                  }

                  // Check if sender has sufficient balance
                  const currentBalance = parseFloat(senderData.wallet_balance[selectedCurrency] || "0");
                  if (currentBalance < amount) {
                    response = `END Insufficient ${selectedCurrency} balance.`;
                  } else {
                    // Determine asset based on currency
                    const asset = getAsset(selectedCurrency);
                    if (!asset) {
                      response = `END Unsupported currency.`;
                    } else {
                      // Load sender's Stellar account
                      const account = await stellarServer.loadAccount(derivedPublicKey);

                      // Fetch base fee
                      const fee = (await stellarServer.fetchBaseFee()).toString();

                      // Build transaction
                      const transaction = new TransactionBuilder(account, {
                        fee,
                        networkPassphrase,
                      })
                        .addOperation(
                          Operation.payment({
                            destination: recipientData.stellar_public_key,
                            asset: asset,
                            amount: amount.toString(),
                          })
                        )
                        .setTimeout(30)
                        .build();

                      // Sign transaction
                      transaction.sign(senderKeypair);

                      // Submit transaction
                      const txResult = await stellarServer.submitTransaction(transaction);
                      console.log("Transaction successful:", txResult.hash);

                      // Update sender's wallet balance
                      const updatedSenderBalance: Record<string, string> = { ...senderData.wallet_balance };
                      updatedSenderBalance[selectedCurrency] = (currentBalance - amount).toFixed(7);

                      const { error: updateError } = await supabase
                        .from("users")
                        .update({ wallet_balance: updatedSenderBalance })
                        .eq("phone_number", existingPhone);

                      if (updateError) {
                        console.error("Error updating wallet balance:", updateError);
                        response = `END Transaction successful, but failed to update your balance.`;
                      } else {
                        // Record the transaction
                        const { error: transactionError } = await supabase.from("transactions").insert([
                          {
                            from_phone_number: existingPhone,
                            to_phone_number: recipientPhone,
                            amount,
                            currency: selectedCurrency,
                            transaction_type: "send",
                            status: "completed",
                            tx_hash: txResult.hash,
                          },
                        ]);

                        if (transactionError) {
                          console.error("Error recording transaction:", transactionError);
                          response = `END Transaction successful, but failed to record it.`;
                        } else {
                          response = `END Transaction successful! Your new ${selectedCurrency} balance is ${updatedSenderBalance[selectedCurrency]}`;
                        }
                      }
                    }
                  }
                }
              } catch (stellarError) {
                console.error("Transaction failed:", stellarError);
                response = `END Transaction failed. Please try again.`;
              }
            } else if (confirmation === "2") {
              // User canceled transaction
              response = `END Transaction canceled.`;
            } else {
              response = `END Invalid input.`;
            }
          }
        } else if (mainMenuOption === "3") {
          // Exit
          response = `END Thank you for using Stellar USSD Service. Goodbye!`;
        } else {
          // Invalid option in main menu
          response = `END Invalid option. Please try again.`;
        }
      }
    }
    // Fallback for undefined flows
    else {
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
