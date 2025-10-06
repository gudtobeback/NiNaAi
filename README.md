# NetOps AI Assistant

This is an AI-powered assistant for managing network devices, featuring a React-based frontend and direct integration with the Google Gemini API. Users can interact with a chat-based AI to perform network operations, such as changing switch port VLANs on Meraki devices.

## Architecture

The application is a standalone frontend application built with React and TypeScript that runs entirely in the user's browser. It handles:
*   The user interface.
*   Direct, secure calls to the Meraki Dashboard API.
*   Direct calls to the Google Gemini API for chat intelligence.
*   Local storage of user and network configurations in the browser's IndexedDB.

This architecture is simple to deploy, requiring no backend server.

## Setup and Running Locally

1.  **Configure API Key**: The application requires a Google AI (Gemini) API key. You can provide this in two ways:
    *   **In the UI (Recommended)**: After logging in, go to Settings, select or create a network configuration, and enter your Gemini API key in the dedicated field. This key is stored securely in your browser's local database (IndexedDB) and is associated with that specific network configuration.
    *   **As an Environment Variable**: As a fallback, the key can be provided as an environment variable named `API_KEY`. When running locally, you can create a `.env` file in the root of the project with `API_KEY=YOUR_GEMINI_API_KEY`. When deploying, this must be set in the project's environment variable settings. The key from the UI will always take precedence.
2.  **Serve the Application**: Open the `index.html` file in your browser. For best results and to avoid potential issues with browser security policies, it's recommended to use a local web server (like Python's `http.server` or the `Live Server` VS Code extension).
3.  **Log In**: Use one of the dummy user credentials provided on the login screen (e.g., `admin` / `adminpass`).
4.  **Configure Meraki Settings**: After logging in, you will be prompted to add a network configuration. In the settings modal, provide your Meraki API Key and Organization ID to connect the assistant to your network devices.

## Webex Integration (Optional)

You can optionally configure the application to send messages to a Webex space. In the Settings modal for a network configuration, provide your Webex Bot Token and Space ID. After verifying the connection, the assistant will post its responses and user queries to the configured space.