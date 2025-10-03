const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'github-webhook' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Middleware to capture raw body for signature verification
app.use('/webhook', bodyParser.raw({ type: 'application/json' }));
app.use(express.json());

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - GitHub signature from headers
 * @returns {boolean} - True if signature is valid
 */
function verifyGitHubSignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    logger.warn('WEBHOOK_SECRET not configured - skipping signature verification');
    return true; // Allow in development, but warn
  }

  if (!signature) {
    logger.error('No signature provided in request headers');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');
  
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );

  if (!isValid) {
    logger.error('Invalid webhook signature detected');
  }

  return isValid;
}

/**
 * Extract modified files from push payload
 * @param {Object} payload - GitHub webhook payload
 * @returns {Array} - Array of modified file paths
 */
function extractModifiedFiles(payload) {
  const modifiedFiles = new Set();
  
  if (payload.commits && Array.isArray(payload.commits)) {
    payload.commits.forEach(commit => {
      // Add added files
      if (commit.added && Array.isArray(commit.added)) {
        commit.added.forEach(file => modifiedFiles.add(file));
      }
      
      // Add modified files
      if (commit.modified && Array.isArray(commit.modified)) {
        commit.modified.forEach(file => modifiedFiles.add(file));
      }
      
      // Add removed files
      if (commit.removed && Array.isArray(commit.removed)) {
        commit.removed.forEach(file => modifiedFiles.add(file));
      }
    });
  }
  
  return Array.from(modifiedFiles);
}

/**
 * Check if specific files of interest were modified
 * @param {Array} modifiedFiles - Array of modified file paths
 * @returns {Object} - Object containing flags for files of interest
 */
function checkFilesOfInterest(modifiedFiles) {
  const filesOfInterest = {
    indexHtml: modifiedFiles.some(file => file.includes('index.html')),
    packageJson: modifiedFiles.some(file => file.includes('package.json')),
    configFiles: modifiedFiles.some(file => 
      file.includes('.env') || 
      file.includes('config.') || 
      file.includes('.yml') || 
      file.includes('.yaml')
    ),
    dockerfiles: modifiedFiles.some(file => 
      file.toLowerCase().includes('dockerfile') || 
      file.includes('docker-compose')
    )
  };
  
  return filesOfInterest;
}

/**
 * Process GitHub push webhook
 * @param {Object} payload - GitHub webhook payload
 */
function processPushEvent(payload) {
  const repository = payload.repository.full_name;
  const pusher = payload.pusher.name;
  const ref = payload.ref;
  const branch = ref.replace('refs/heads/', '');
  
  const modifiedFiles = extractModifiedFiles(payload);
  const filesOfInterest = checkFilesOfInterest(modifiedFiles);
  
  logger.info('Push event processed', {
    repository,
    pusher,
    branch,
    commitCount: payload.commits.length,
    modifiedFilesCount: modifiedFiles.length,
    modifiedFiles: modifiedFiles.slice(0, 10), // Log first 10 files to avoid spam
    filesOfInterest
  });
  
  // Trigger specific actions based on files modified
  if (filesOfInterest.indexHtml) {
    logger.info('index.html was modified - triggering frontend deployment');
    // Add your custom logic here for index.html changes
  }
  
  if (filesOfInterest.packageJson) {
    logger.info('package.json was modified - triggering dependency update');
    // Add your custom logic here for package.json changes
  }
  
  if (filesOfInterest.configFiles) {
    logger.info('Configuration files were modified - triggering config reload');
    // Add your custom logic here for config file changes
  }
  
  if (filesOfInterest.dockerfiles) {
    logger.info('Docker files were modified - triggering container rebuild');
    // Add your custom logic here for Docker file changes
  }
  
  return {
    processed: true,
    repository,
    branch,
    modifiedFiles,
    filesOfInterest
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main webhook endpoint
app.post('/webhook', (req, res) => {
  try {
    const signature = req.get('X-Hub-Signature-256');
    const event = req.get('X-GitHub-Event');
    const delivery = req.get('X-GitHub-Delivery');
    
    logger.info('Webhook received', {
      event,
      delivery,
      hasSignature: !!signature,
      bodySize: req.body.length
    });
    
    // Verify signature
    if (!verifyGitHubSignature(req.body, signature)) {
      logger.error('Webhook signature verification failed');
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid signature' 
      });
    }
    
    // Parse payload
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch (parseError) {
      logger.error('Failed to parse webhook payload', { error: parseError.message });
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Invalid JSON payload' 
      });
    }
    
    // Handle only push events
    if (event !== 'push') {
      logger.info(`Ignoring ${event} event`);
      return res.status(200).json({ 
        message: `${event} event ignored`,
        processed: false
      });
    }
    
    // Process push event
    const result = processPushEvent(payload);
    
    res.status(200).json({
      message: 'Webhook processed successfully',
      delivery,
      ...result
    });
    
  } catch (error) {
    logger.error('Webhook processing error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to process webhook' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('404 - Route not found', { 
    url: req.url, 
    method: req.method,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({ 
    error: 'Not Found',
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`GitHub webhook server started on port ${PORT}`);
  logger.info('Environment:', {
    nodeEnv: process.env.NODE_ENV || 'development',
    hasWebhookSecret: !!WEBHOOK_SECRET,
    port: PORT
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});