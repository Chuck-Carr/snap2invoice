#!/usr/bin/env node

/**
 * Admin Testing Script for Snap2Invoice
 * 
 * Usage:
 *   node scripts/admin-test.js upgrade user@example.com
 *   node scripts/admin-test.js downgrade user@example.com
 *   node scripts/admin-test.js reset-usage user@example.com
 */

const https = require('https');

const ADMIN_SECRET = 'snap2invoice-admin-test-key-2024';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const url = new URL(`${BASE_URL}/api/admin/upgrade-user`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const client = url.protocol === 'https:' ? https : require('http');
    
    const req = client.request(options, (res) => {
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseBody);
          resolve({ statusCode: res.statusCode, data: response });
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  const [,, action, userEmail] = process.argv;

  if (!action || !userEmail) {
    console.log(`
🔧 Snap2Invoice Admin Testing Script

Usage:
  node scripts/admin-test.js <action> <user-email>

Actions:
  upgrade      - Upgrade user to premium
  downgrade    - Downgrade user to free
  reset-usage  - Reset monthly usage count

Examples:
  node scripts/admin-test.js upgrade test@example.com
  node scripts/admin-test.js downgrade test@example.com
  node scripts/admin-test.js reset-usage test@example.com

Environment:
  BASE_URL: ${BASE_URL}
    `);
    process.exit(1);
  }

  const validActions = ['upgrade', 'downgrade', 'reset-usage'];
  if (!validActions.includes(action)) {
    console.error(`❌ Invalid action: ${action}`);
    console.error(`Valid actions: ${validActions.join(', ')}`);
    process.exit(1);
  }

  console.log(`🚀 Performing ${action} for user: ${userEmail}`);

  try {
    const { statusCode, data } = await makeRequest({
      adminSecret: ADMIN_SECRET,
      userEmail,
      action
    });

    if (statusCode === 200) {
      console.log(`✅ ${data.message}`);
      console.log(`📊 Updated profile:`, {
        plan: data.profile.subscription_plan,
        expires: data.profile.subscription_expires_at,
        usage: data.profile.invoices_this_month,
        month: data.profile.month_year
      });
    } else {
      console.error(`❌ Error (${statusCode}): ${data.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    console.error(`💡 Make sure your development server is running at ${BASE_URL}`);
    process.exit(1);
  }
}

main();