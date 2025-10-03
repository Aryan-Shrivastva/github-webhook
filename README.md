# GitHub Webhook Server

A comprehensive Node.js/Express server for handling GitHub webhook events with signature validation, file change detection, and comprehensive logging.

## Quick Start

### 1. Installation

```bash
# Clone or create the project directory
git clone <your-repo-url> github-webhook
cd github-webhook

# Install dependencies
npm install
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# IMPORTANT: Set your webhook secret!
```

Example `.env` configuration:
```env
PORT=3000
NODE_ENV=development
WEBHOOK_SECRET=your_super_secret_key_here
LOG_LEVEL=info
```

### 3. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### 4. Configure GitHub Webhook

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks**
3. Click **Add webhook**
4. Configure:
   - **Payload URL**: `http://your-server.com:3000/webhook`
   - **Content type**: `application/json`
   - **Secret**: Same value as `WEBHOOK_SECRET` in your `.env`
   - **Events**: Select "Just the push event" or "Let me select individual events" → "Pushes"
5. Click **Add webhook**

## GitHub Webhook Configuration Guide

### Step-by-Step Setup

#### 1. Access Repository Settings
- Navigate to your GitHub repository
- Click on the **Settings** tab
- Scroll down to **Webhooks** in the left sidebar
- Click **Add webhook**

#### 2. Configure Webhook Settings

**Payload URL**:
- For local development: `http://your-ngrok-url.ngrok.io/webhook`
- For production: `https://your-domain.com/webhook`

**Content Type**:
- Select `application/json`

**Secret**:
- Generate a strong secret (recommended: 32+ characters)
- Use the same value in your `.env` file as `WEBHOOK_SECRET`
- Example: `openssl rand -hex 32`

**SSL Verification**:
- Enable SSL verification for production
- Disable only for local development with self-signed certificates

**Events**:
- Select "Let me select individual events"
- Check only "Pushes" for this webhook
- Uncheck "Active" if you want to disable temporarily

#### 3. Test the Webhook
- Click "Add webhook"
- GitHub will send a test ping
- Check your server logs for the ping event
- Make a test push to trigger the webhook

### Local Development with ngrok

For local testing, use ngrok to expose your local server:

```bash
# Install ngrok (if not already installed)
npm install -g ngrok

# Start your webhook server
npm run dev

# In another terminal, expose port 3000
ngrok http 3000

# Use the ngrok URL in GitHub webhook settings
# Example: https://abc123def.ngrok.io/webhook
```

## File Change Detection

The webhook automatically detects changes to important files:

- **index.html**: Frontend changes
- **package.json**: Dependency changes
- **Config files**: `.env`, `config.*`, `.yml`, `.yaml`
- **Docker files**: `Dockerfile`, `docker-compose.*`

### Example Response
```json
{
  "message": "Webhook processed successfully",
  "delivery": "abc123-def456-789",
  "processed": true,
  "repository": "username/repo-name",
  "branch": "main",
  "modifiedFiles": ["index.html", "src/app.js"],
  "filesOfInterest": {
    "indexHtml": true,
    "packageJson": false,
    "configFiles": false,
    "dockerfiles": false
  }
}
```

## Testing

### Run Built-in Tests

```bash
# Make sure your server is running
npm start

# In another terminal, run tests
npm test
```

### Manual Testing with curl

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test webhook endpoint (without signature - will work if no secret set)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -d '{"ref":"refs/heads/main","commits":[{"modified":["index.html"]}]}'
```

### Test with Signature

```bash
# Generate signature for testing
echo -n '{"test":"data"}' | openssl dgst -sha256 -hmac "your_secret" -binary | xxd -p

# Use in curl request
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=<generated_signature>" \
  -d '{"test":"data"}'
```

## Deployment

### Local Development

```bash
# Development with auto-restart
npm run dev

# Expose with ngrok for GitHub testing
ngrok http 3000
```

### Production Deployment

#### Option 1: VPS/Cloud Server

```bash
# Clone repository
git clone <your-repo-url>
cd github-webhook

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name github-webhook
pm2 save
pm2 startup
```

#### Option 2: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t github-webhook .
docker run -p 3000:3000 --env-file .env github-webhook
```

#### Option 3: Cloud Platforms

**Heroku**:
```bash
# Create Heroku app
heroku create your-webhook-app

# Set environment variables
heroku config:set WEBHOOK_SECRET=your_secret

# Deploy
git push heroku main
```

**Vercel/Netlify**: See platform-specific documentation for Node.js deployments.