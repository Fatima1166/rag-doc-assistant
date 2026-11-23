# OAuth Setup Guide (Google & GitHub)

Configure Google and GitHub social authentication for RAGDocs.

## 1. Google OAuth Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. Navigate to **APIs & Services** -> **OAuth consent screen** (User type: External).
3. Under **Credentials** -> **Create Credentials** -> **OAuth client ID** (Web application).
4. Add the following to **Authorized redirect URIs**:
   - http://localhost:8000/api/auth/oauth/google/callback
   - http://127.0.0.1:8000/api/auth/oauth/google/callback
5. Copy your **Client ID** and **Client Secret**.

## 2. GitHub OAuth Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/applications/new).
2. Set **Homepage URL** to http://localhost:3000.
3. Set **Authorization callback URL** to http://localhost:8000/api/auth/oauth/github/callback.
4. Register the app, then click **Generate a new client secret**. Copy both ID and Secret.

## 3. Configuration in backend/.env
Add your credentials to ackend/.env:
`env
FRONTEND_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
OAUTH_REDIRECT_BASE=http://localhost:8000
AUTH_REQUIRED=true
`
