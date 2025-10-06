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

1.  **Configure API Key**: The application requires a Google AI (Gemini) API key. This key must be provided as an environment variable named `API_KEY` during the build or execution process. It is used directly in `services/geminiService.ts`.
2.  **Serve the Application**: Open the `index.html` file in your browser. For best results and to avoid potential issues with browser security policies, it's recommended to use a local web server (like Python's `http.server` or the `Live Server` VS Code extension).
3.  **Log In**: Use one of the dummy user credentials provided on the login screen (e.g., `admin` / `adminpass`).
4.  **Configure Meraki Settings**: After logging in, you will be prompted to add a network configuration. In the settings modal, provide your Meraki API Key and Organization ID to connect the assistant to your network devices.

## Webex Integration (Optional)

You can optionally configure the application to send messages to a Webex space. In the Settings modal for a network configuration, provide your Webex Bot Token and Space ID. After verifying the connection, the assistant will post its responses and user queries to the configured space.
