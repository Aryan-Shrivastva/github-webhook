# GitHub Webhook Server

A comprehensive Node.js/Express server for handling GitHub webhook events with signature validation, file change detection, and comprehensive logging.

## Features

- 🔐 **Secure**: GitHub signature validation with HMAC-SHA256
- 📁 **Smart File Detection**: Automatically detects changes to specific files (index.html, package.json, config files, Dockerfiles)
- 📝 **Comprehensive Logging**: Winston-based logging with file and console outputs
- 🛡️ **Error Handling**: Robust error handling with appropriate HTTP status codes
- 🧪 **Testing**: Built-in test utilities for webhook validation
- ⚡ **Performance**: Efficient payload parsing and processing
- 🔧 **Configurable**: Environment-based configuration

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

## API Endpoints

### POST /webhook
Main webhook endpoint for GitHub events.

**Headers Required**:
- `X-GitHub-Event`: Event type (e.g., "push")
- `X-Hub-Signature-256`: HMAC signature for validation
- `X-GitHub-Delivery`: Unique delivery ID

**Response Codes**:
- `200`: Success
- `401`: Invalid signature
- `400`: Invalid JSON payload
- `500`: Server error

### GET /health
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "uptime": 3600
}
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

## Security Best Practices

### 1. Webhook Secret
- **Always** use a strong webhook secret in production
- Generate using: `openssl rand -hex 32`
- Keep it secure and don't commit to version control

### 2. HTTPS
- Use HTTPS in production
- Validate SSL certificates
- Consider using a reverse proxy (nginx, CloudFlare)

### 3. Rate Limiting
- Implement rate limiting for production deployments
- Use services like CloudFlare or nginx rate limiting

### 4. Input Validation
- The server validates all incoming payloads
- Invalid JSON is rejected with 400 status
- Missing signatures are rejected with 401 status

### 5. Logging
- Monitor logs for suspicious activity
- Set up alerts for failed signature validations
- Rotate log files regularly

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

## Logging

Logs are written to:
- `logs/combined.log`: All logs
- `logs/error.log`: Error logs only
- Console: Colored output for development

### Log Levels
- `error`: Errors and failures
- `warn`: Warnings and potential issues
- `info`: General information
- `debug`: Detailed debugging information

### Sample Log Entry
```json
{
  "level": "info",
  "message": "Push event processed",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "service": "github-webhook",
  "repository": "username/repo",
  "branch": "main",
  "modifiedFiles": ["index.html"],
  "filesOfInterest": {
    "indexHtml": true
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Webhook Not Triggered

**Symptoms**: No logs when pushing to GitHub

**Solutions**:
- Check GitHub webhook delivery status in repository settings
- Verify webhook URL is accessible (use ngrok for local development)
- Check server is running and listening on correct port
- Verify firewall/security group settings

#### 2. 401 Unauthorized Errors

**Symptoms**: `Invalid signature` errors in logs

**Solutions**:
- Verify `WEBHOOK_SECRET` matches GitHub webhook secret exactly
- Check webhook is configured to send JSON payload
- Ensure secret is properly set in environment variables

#### 3. 400 Bad Request Errors

**Symptoms**: `Invalid JSON payload` errors

**Solutions**:
- Verify GitHub webhook is set to `application/json` content type
- Check for network issues corrupting payload
- Review request body in logs

#### 4. Server Not Starting

**Symptoms**: Application crashes on startup

**Solutions**:
```bash
# Check logs for specific error
npm start

# Common fixes:
# - Install dependencies: npm install
# - Check port availability: netstat -an | grep 3000
# - Verify Node.js version: node --version (requires 14+)
# - Check .env file syntax
```

#### 5. GitHub Webhook Delivery Failed

**Symptoms**: Red X in GitHub webhook deliveries

**Solutions**:
- Check server accessibility from internet
- Verify SSL certificate (if using HTTPS)
- Review GitHub webhook delivery details
- Check server logs for incoming requests

### Debug Mode

Enable debug logging:
```bash
# Set in .env
LOG_LEVEL=debug

# Or temporarily
LOG_LEVEL=debug npm start
```

### Network Testing

```bash
# Test server accessibility
curl -I http://your-server.com:3000/health

# Test from GitHub's perspective (if public)
# Use online tools like webhook.site for testing
```

## Advanced Configuration

### Custom File Detection

Modify `server.js` to detect additional file types:

```javascript
function checkFilesOfInterest(modifiedFiles) {
  return {
    // Existing detections...
    reactComponents: modifiedFiles.some(file => 
      file.includes('.jsx') || file.includes('.tsx')
    ),
    styles: modifiedFiles.some(file => 
      file.includes('.css') || file.includes('.scss')
    ),
    migrations: modifiedFiles.some(file => 
      file.includes('migrations/')
    )
  };
}
```

### Integration Examples

#### Slack Notifications

```javascript
// Add to processPushEvent function
if (filesOfInterest.indexHtml) {
  await sendSlackNotification(`🚀 Frontend deployed! ${repository} on ${branch}`);
}

async function sendSlackNotification(message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message })
  });
}
```

#### Deployment Triggers

```javascript
// Add deployment logic
if (filesOfInterest.dockerfiles) {
  logger.info('Triggering container rebuild...');
  exec('docker build -t myapp . && docker restart myapp', (error, stdout, stderr) => {
    if (error) {
      logger.error('Deployment failed', { error: error.message });
    } else {
      logger.info('Deployment successful');
    }
  });
}
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Update documentation as needed
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review server logs
3. Test with the built-in test suite
4. Create an issue with detailed logs and configuration

---

**🚀 Happy webhook handling!**