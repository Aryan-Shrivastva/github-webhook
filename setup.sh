#!/bin/bash

echo "GitHub Webhook Server Setup"
echo "==============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 14+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
echo "Node.js version: $NODE_VERSION"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating environment configuration..."
    cp .env.example .env
    
    # Generate a random secret
    if command -v openssl &> /dev/null; then
        RANDOM_SECRET=$(openssl rand -hex 32)
        sed -i "s/your_webhook_secret_here/$RANDOM_SECRET/g" .env
        echo "Generated random webhook secret"
    else
        echo "Please set WEBHOOK_SECRET in .env file manually"
    fi
    
    echo "Created .env file"
else
    echo ".env file already exists"
fi

# Create logs directory
mkdir -p logs
echo "Created logs directory"

echo ""
echo "Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run 'npm start' to start the server"
echo "3. Configure GitHub webhook with URL: http://localhost:3001/webhook"
echo ""
echo "For ngrok setup (local testing):"
echo "1. Install ngrok: npm install -g ngrok"
echo "2. Run: ngrok http 3001"
echo "3. Use the ngrok URL in GitHub webhook settings"