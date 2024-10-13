Stellar USSD Service
A USSD-based financial service built with Deno, Supabase, and Stellar SDKs. This service allows users to register, check their Stellar account balances, and send money using Stellar assets.

Table of Contents
Features
Tech Stack
Packages Used
Prerequisites
Setup
Environment Variables
Database Schema
Running the Service
USSD Flow
Security Considerations
Features
User Registration:

Register with phone number and set a PIN.
Generates a Stellar keypair for the user.
Funds the Stellar account with XLM via Friendbot.
Existing User Functions:

Check Balance: View XLM, USDC, or EURC balances.
Send Money: Transfer XLM, USDC, or EURC to other registered users.
Exit: Terminate the USSD session.
Tech Stack
Deno: A secure runtime for JavaScript and TypeScript, used to run the server handling USSD requests.
Supabase: An open-source Firebase alternative, used for managing user data and authentication.
Stellar SDK: Facilitates interactions with the Stellar network, enabling account creation, funding, and transactions.
Packages Used
Deno Standard Library (std/http/server.ts):

Handles incoming HTTP requests to process USSD interactions.
Supabase JS Client (@supabase/supabase-js@2):

Manages database operations such as inserting new users and querying existing user data.
Stellar SDK (stellar-sdk@10.1.0):

Handles Stellar network interactions, including keypair generation, account funding, and processing transactions.
Prerequisites
Deno Installed: Install Deno
Supabase Account: Sign up and create a new project at Supabase
Stellar Testnet Account: Use Friendbot to fund Stellar accounts on the Testnet.
USSD Gateway: Set up with a provider like Africa's Talking to handle USSD requests.
Setup
Clone the Repository:

bash
Copy code
git clone https://github.com/yourusername/stellar-ussd-service.git
cd stellar-ussd-service
Install Dependencies:

Deno manages dependencies via URLs, so no traditional npm install is required. Ensure you have an active internet connection when running the service.

Environment Variables
Create a .env file in the root directory and add the following variables:

env
Copy code
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
Notes:

Replace your_supabase_url and your_supabase_service_role_key with your actual Supabase project credentials.
Ensure .env is added to .gitignore to prevent sensitive information from being committed.
Database Schema
Ensure your Supabase users table includes the following fields:

phone_number (string, unique): User's phone number.
stellar_public_key (string): User's Stellar public key.
preferred_currency (string): User's preferred currency.
wallet_balance (json): Contains balances for XLM, USDC, and EURC.
pin (string): User's PIN for authentication.
Example:

json
Copy code
{
  "phone_number": "+1234567890",
  "stellar_public_key": "GABCDEF1234567890...",
  "preferred_currency": "XLM",
  "wallet_balance": {
    "XLM": "100",
    "USDC": "100",
    "EURC": "100"
  },
  "pin": "1234"
}
Running the Service
Start the Deno server with the necessary permissions:

bash
Copy code
deno run --allow-net --allow-env index.ts
Flags:

--allow-net: Grants network access.
--allow-env: Allows access to environment variables.
For production deployments, consider using serverless platforms like Supabase Functions or Deno Deploy.

USSD Flow
1. Registration
Initiate Registration:

Dial the USSD code (e.g., *123#).
Select option 1 to Register.
Provide Phone Number:

Enter your phone number in the format +1234567890.
Set PIN:

Enter a 4 to 6-digit PIN.
Registration Confirmation:

Receive a confirmation message with your Stellar Public Key and XLM funding status.
vbnet
Copy code
END Registration successful!
Your Stellar Public Key: GABCDEF1234567890...
Your account has been funded with XLM on Testnet. You can now use the service.
2. Existing User Functions
Login:

Dial the USSD code.
Select option 2 for Existing User.
Enter your registered phone number.
Enter your PIN.
Main Menu:

1. Check Balance: View balances for XLM, USDC, or EURC.
2. Send Money: Transfer XLM, USDC, or EURC to other users.
3. Exit: Terminate the session.
Security Considerations
Sensitive Data Storage:
Stellar Public Keys: Stored in Supabase for transaction purposes.
PINs: Currently stored in plain text. Recommendation: Implement hashing (e.g., bcrypt) for enhanced security.
Environment Variables:
Keep Supabase credentials secure and do not expose them in the codebase.
Error Handling:
Ensure that sensitive error details are not exposed to users. Log errors securely for debugging.
Permissions:
Run the Deno server with the minimal necessary permissions to enhance securit
