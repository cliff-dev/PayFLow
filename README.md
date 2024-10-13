# Stellar USSD Service

A USSD-based financial service built with **Deno**, **Supabase**, and **Stellar SDKs**. This service allows users to register, check their Stellar account balances, and send money using Stellar assets.

## Table of Contents

- [Features](#features)
- [Tech Stack & Implementation](#tech-stack--implementation)
  - [Deno Edge Functions](#deno-edge-functions)
  - [Supabase](#supabase)
  - [Stellar SDK](#stellar-sdk)
  - [Africa's Talking](#africas-talking)
- [Packages Used](#packages-used)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Running the Service](#running-the-service)
- [USSD Flow](#ussd-flow)
- [Security Considerations](#security-considerations)

## Features

### User Registration
- **Register** with phone number and set a PIN.
- **Generates** a Stellar keypair for the user.
- **Funds** the Stellar account with XLM via Friendbot.

### Existing User Functions
- **Check Balance**: View XLM, USDC, or EURC balances.
- **Send Money**: Transfer XLM, USDC, or EURC to other registered users.
- **Exit**: Terminate the USSD session.

## Tech Stack & Implementation

### Deno Edge Functions
- **Usage**: Utilized Deno's runtime to deploy edge functions that handle incoming USSD requests.
- **Implementation**: The `serve` function from Deno's standard library listens for HTTP requests from Africa's Talking, processes the USSD logic, and responds accordingly.

### Supabase
- **Usage**: Acts as the backend database to store user information, including phone numbers, Stellar public keys, wallet balances, and PINs.
- **Implementation**: The `@supabase/supabase-js@2` client manages database operations such as inserting new users and querying existing user data.

### Stellar SDK
- **Usage**: Facilitates interactions with the Stellar Testnet, enabling account creation, funding, and asset transactions (XLM, USDC, EURC).
- **Implementation**:
  - **Keypair Generation**: Creates unique Stellar keypairs for each user upon registration.
  - **Account Funding**: Uses Friendbot to fund user accounts with XLM.
  - **Asset Management**: Defines and manages custom assets (USDC, EURC) for transactions.

### Africa's Talking
- **Usage**: Serves as the USSD gateway, enabling users to interact with the service via their mobile phones using USSD codes (e.g., `*123#`).
- **Implementation**: Africa's Talking sends HTTP POST requests to the Deno edge functions with user inputs, which are then processed to perform the desired actions.

## Packages Used

1. **Deno Standard Library (`std/http/server.ts`)**
   - **Purpose**: Handles incoming HTTP requests to process USSD interactions.

2. **Supabase JS Client (`@supabase/supabase-js@2`)**
   - **Purpose**: Manages database operations such as inserting new users and querying existing user data.

3. **Stellar SDK (`stellar-sdk@10.1.0`)**
   - **Purpose**: Handles Stellar network interactions, including keypair generation, account funding, and processing transactions.

## Prerequisites

- **Deno Installed**: [Install Deno](https://deno.land/#installation)
- **Supabase Account**: Sign up and create a new project at [Supabase](https://supabase.com/)
- **Stellar Testnet Account**: Use [Friendbot](https://www.stellar.org/developers/tools/friendbot.html) to fund Stellar accounts on the Testnet.
- **USSD Gateway**: Set up with a provider like [Africa's Talking](https://africastalking.com/) to handle USSD requests.

## Setup

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/stellar-ussd-service.git
   cd stellar-ussd-service
