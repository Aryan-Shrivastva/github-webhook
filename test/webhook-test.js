const crypto = require('crypto');
const https = require('https');
const http = require('http');

/**
 * Test utility to send webhook requests to your server
 */
class WebhookTester {
  constructor(serverUrl = 'http://localhost:3000', secret = null) {
    this.serverUrl = serverUrl;
    this.secret = secret;
  }

  /**
   * Generate GitHub webhook signature
   */
  generateSignature(payload, secret) {
    if (!secret) return null;
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return `sha256=${signature}`;
  }

  /**
   * Send a test webhook request
   */
  async sendWebhook(eventType, payload, options = {}) {
    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString, this.secret);
    
    const url = new URL(`${this.serverUrl}/webhook`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString),
        'X-GitHub-Event': eventType,
        'X-GitHub-Delivery': crypto.randomUUID(),
        'User-Agent': 'GitHub-Hookshot/webhook-tester',
        ...options.headers
      }
    };

    if (signature) {
      requestOptions.headers['X-Hub-Signature-256'] = signature;
    }

    return new Promise((resolve, reject) => {
      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null
            };
            resolve(response);
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data,
              parseError: error.message
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(payloadString);
      req.end();
    });
  }

  /**
   * Create a sample push event payload
   */
  createPushPayload(options = {}) {
    const defaults = {
      repository: 'testuser/test-repo',
      branch: 'main',
      pusher: 'testuser',
      files: ['index.html', 'src/app.js']
    };
    
    const config = { ...defaults, ...options };
    
    return {
      ref: `refs/heads/${config.branch}`,
      before: "0000000000000000000000000000000000000000",
      after: "1234567890abcdef1234567890abcdef12345678",
      repository: {
        id: 123456789,
        node_id: "MDEwOlJlcG9zaXRvcnkxMjM0NTY3ODk=",
        name: config.repository.split('/')[1],
        full_name: config.repository,
        private: false,
        owner: {
          name: config.repository.split('/')[0],
          email: "test@example.com",
          login: config.repository.split('/')[0]
        },
        html_url: `https://github.com/${config.repository}`,
        clone_url: `https://github.com/${config.repository}.git`,
        default_branch: config.branch
      },
      pusher: {
        name: config.pusher,
        email: "test@example.com"
      },
      sender: {
        login: config.pusher,
        id: 12345678,
        type: "User"
      },
      commits: [
        {
          id: "1234567890abcdef1234567890abcdef12345678",
          tree_id: "abcdef1234567890abcdef1234567890abcdef12",
          distinct: true,
          message: "Test commit message",
          timestamp: new Date().toISOString(),
          url: `https://github.com/${config.repository}/commit/1234567890abcdef1234567890abcdef12345678`,
          author: {
            name: config.pusher,
            email: "test@example.com",
            username: config.pusher
          },
          committer: {
            name: config.pusher,
            email: "test@example.com",
            username: config.pusher
          },
          added: config.files.filter((_, i) => i % 3 === 0),
          removed: config.files.filter((_, i) => i % 3 === 1),
          modified: config.files.filter((_, i) => i % 3 === 2)
        }
      ],
      head_commit: {
        id: "1234567890abcdef1234567890abcdef12345678",
        tree_id: "abcdef1234567890abcdef1234567890abcdef12",
        distinct: true,
        message: "Test commit message",
        timestamp: new Date().toISOString(),
        url: `https://github.com/${config.repository}/commit/1234567890abcdef1234567890abcdef12345678`,
        author: {
          name: config.pusher,
          email: "test@example.com",
          username: config.pusher
        },
        committer: {
          name: config.pusher,
          email: "test@example.com",
          username: config.pusher
        },
        added: config.files.filter((_, i) => i % 3 === 0),
        removed: config.files.filter((_, i) => i % 3 === 1),
        modified: config.files.filter((_, i) => i % 3 === 2)
      }
    };
  }
}

/**
 * Run basic tests
 */
async function runTests() {
  console.log('🧪 Starting webhook tests...\n');
  
  // Test configuration
  const serverUrl = process.env.TEST_SERVER_URL || 'http://localhost:3000';
  const secret = process.env.WEBHOOK_SECRET || null;
  
  const tester = new WebhookTester(serverUrl, secret);
  
  console.log(`Testing server: ${serverUrl}`);
  console.log(`Using secret: ${secret ? 'Yes' : 'No'}\n`);
  
  // Test 1: Health check
  try {
    console.log('📊 Test 1: Health check');
    const healthResponse = await tester.sendWebhook('ping', {}, {
      headers: { 'X-GitHub-Event': 'ping' }
    });
    
    // Override to test health endpoint
    const healthUrl = new URL(`${serverUrl}/health`);
    const healthReq = await fetch(healthUrl.toString()).catch(() => null);
    
    if (healthReq && healthReq.status === 200) {
      console.log('✅ Health check passed\n');
    } else {
      console.log('❌ Health check failed\n');
    }
  } catch (error) {
    console.log(`❌ Health check error: ${error.message}\n`);
  }
  
  // Test 2: Push event with index.html
  try {
    console.log('📊 Test 2: Push event with index.html');
    const pushPayload = tester.createPushPayload({
      files: ['index.html', 'package.json', 'src/app.js']
    });
    
    const response = await tester.sendWebhook('push', pushPayload);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));
    
    if (response.statusCode === 200) {
      console.log('✅ Push event test passed\n');
    } else {
      console.log('❌ Push event test failed\n');
    }
  } catch (error) {
    console.log(`❌ Push event test error: ${error.message}\n`);
  }
  
  // Test 3: Invalid signature (if secret is configured)
  if (secret) {
    try {
      console.log('📊 Test 3: Invalid signature test');
      const testerBadSecret = new WebhookTester(serverUrl, 'wrong_secret');
      const pushPayload = tester.createPushPayload();
      
      const response = await testerBadSecret.sendWebhook('push', pushPayload);
      
      console.log(`Status: ${response.statusCode}`);
      
      if (response.statusCode === 401) {
        console.log('✅ Invalid signature test passed\n');
      } else {
        console.log('❌ Invalid signature test failed\n');
      }
    } catch (error) {
      console.log(`❌ Invalid signature test error: ${error.message}\n`);
    }
  }
  
  // Test 4: Non-push event
  try {
    console.log('📊 Test 4: Non-push event (should be ignored)');
    const issuePayload = {
      action: 'opened',
      issue: {
        id: 1,
        title: 'Test issue',
        body: 'This is a test issue'
      }
    };
    
    const response = await tester.sendWebhook('issues', issuePayload);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));
    
    if (response.statusCode === 200 && response.body.processed === false) {
      console.log('✅ Non-push event test passed\n');
    } else {
      console.log('❌ Non-push event test failed\n');
    }
  } catch (error) {
    console.log(`❌ Non-push event test error: ${error.message}\n`);
  }
  
  // Test 5: Invalid JSON
  try {
    console.log('📊 Test 5: Invalid JSON test');
    const response = await tester.sendWebhook('push', 'invalid json');
    
    console.log(`Status: ${response.statusCode}`);
    
    if (response.statusCode === 400) {
      console.log('✅ Invalid JSON test passed\n');
    } else {
      console.log('❌ Invalid JSON test failed\n');
    }
  } catch (error) {
    console.log(`❌ Invalid JSON test error: ${error.message}\n`);
  }
  
  console.log('🏁 Tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { WebhookTester, runTests };