const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Database setup - PostgreSQL for production, SQLite for development
let db;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // PostgreSQL for production (Render)
  db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
  });
  
  db.connect().then(() => {
    console.log('Connected to PostgreSQL database');
    initializeDatabase();
  }).catch(err => {
    console.error('Database connection error:', err);
  });
} else {
  // SQLite for development
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('subscriptions.db');
  initializeDatabase();
}

// Initialize database tables
async function initializeDatabase() {
  try {
    if (isProduction) {
      // PostgreSQL table creation
      await db.query(`CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        client_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await db.query(`CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        subscription_id TEXT UNIQUE NOT NULL,
        client_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        price DECIMAL(10,2) NOT NULL,
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NOT NULL,
        next_billing_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients (client_id)
      )`);

      await db.query(`CREATE TABLE IF NOT EXISTS billing_history (
        id SERIAL PRIMARY KEY,
        billing_id TEXT UNIQUE NOT NULL,
        subscription_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        billing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_method TEXT,
        transaction_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions (subscription_id),
        FOREIGN KEY (client_id) REFERENCES clients (client_id)
      )`);
      
      console.log('PostgreSQL tables initialized');
    } else {
      // SQLite table creation (development)
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subscription_id TEXT UNIQUE NOT NULL,
          client_id TEXT NOT NULL,
          plan_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          price DECIMAL(10,2) NOT NULL,
          billing_cycle TEXT NOT NULL DEFAULT 'monthly',
          start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_date DATETIME NOT NULL,
          next_billing_date DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (client_id) REFERENCES clients (client_id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS billing_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          billing_id TEXT UNIQUE NOT NULL,
          subscription_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          billing_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          payment_method TEXT,
          transaction_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (subscription_id) REFERENCES subscriptions (subscription_id),
          FOREIGN KEY (client_id) REFERENCES clients (client_id)
        )`);
      });
      console.log('SQLite tables initialized');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Database query helpers
const dbQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    if (isProduction) {
      db.query(query, params)
        .then(result => resolve(result.rows))
        .catch(err => reject(err));
    } else {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
};

const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    if (isProduction) {
      db.query(query, params)
        .then(result => resolve({ changes: result.rowCount, lastID: result.insertId }))
        .catch(err => reject(err));
    } else {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    }
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    if (isProduction) {
      db.query(query, params)
        .then(result => resolve(result.rows[0] || null))
        .catch(err => reject(err));
    } else {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }
  });
};

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware for API authentication
const authenticateAPI = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  
  const validApiKey = process.env.API_KEY || 'your-api-key';
  
  if (apiKey === validApiKey || (authHeader && authHeader.startsWith('Bearer '))) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Helper functions
const generateId = () => uuidv4();

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

// API Routes

// Create a new client
app.post('/api/clients', authenticateAPI, async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    
    const clientId = generateId();
    
    const query = isProduction 
      ? 'INSERT INTO clients (client_id, email, name) VALUES ($1, $2, $3)'
      : 'INSERT INTO clients (client_id, email, name) VALUES (?, ?, ?)';
    
    const result = await dbRun(query, [clientId, email, name]);
    
    res.status(201).json({
      message: 'Client created successfully',
      client: { client_id: clientId, email, name }
    });
  } catch (err) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
      return res.status(400).json({ error: 'Client with this email already exists' });
    }
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Create a subscription for a client
app.post('/api/subscriptions', authenticateAPI, async (req, res) => {
  try {
    const { client_id, plan_name, price, billing_cycle = 'monthly' } = req.body;
    
    if (!client_id || !plan_name || !price) {
      return res.status(400).json({ error: 'client_id, plan_name, and price are required' });
    }
    
    const subscriptionId = generateId();
    const startDate = new Date();
    const endDate = addMonths(startDate, billing_cycle === 'yearly' ? 12 : 1);
    const nextBillingDate = new Date(endDate);
    
    // First check if client exists
    const clientQuery = isProduction 
      ? 'SELECT client_id FROM clients WHERE client_id = $1' 
      : 'SELECT client_id FROM clients WHERE client_id = ?';
    
    const client = await dbGet(clientQuery, [client_id]);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Create subscription
    const subscriptionQuery = isProduction
      ? `INSERT INTO subscriptions 
         (subscription_id, client_id, plan_name, price, billing_cycle, end_date, next_billing_date) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`
      : `INSERT INTO subscriptions 
         (subscription_id, client_id, plan_name, price, billing_cycle, end_date, next_billing_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    await dbRun(subscriptionQuery, [
      subscriptionId, client_id, plan_name, price, billing_cycle, 
      endDate.toISOString(), nextBillingDate.toISOString()
    ]);
    
    res.status(201).json({
      message: 'Subscription created successfully',
      subscription: {
        subscription_id: subscriptionId,
        client_id,
        plan_name,
        price,
        billing_cycle,
        status: 'active',
        end_date: endDate.toISOString(),
        next_billing_date: nextBillingDate.toISOString()
      }
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Check subscription status (main API endpoint)
app.get('/api/subscriptions/:client_id/status', async (req, res) => {
  try {
    const { client_id } = req.params;
    
    const query = `SELECT s.*, c.email, c.name 
                   FROM subscriptions s 
                   JOIN clients c ON s.client_id = c.client_id 
                   WHERE s.client_id = ${isProduction ? '$1' : '?'} AND s.status = 'active'
                   ORDER BY s.created_at DESC LIMIT 1`;
    
    const subscription = await dbGet(query, [client_id]);
    
    if (!subscription) {
      return res.json({
        valid: false,
        message: 'No active subscription found'
      });
    }
    
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    const isValid = now <= endDate && subscription.status === 'active';
    
    res.json({
      valid: isValid,
      subscription: {
        subscription_id: subscription.subscription_id,
        client_id: subscription.client_id,
        client_name: subscription.name,
        client_email: subscription.email,
        plan_name: subscription.plan_name,
        status: subscription.status,
        end_date: subscription.end_date,
        next_billing_date: subscription.next_billing_date,
        days_remaining: isValid ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : 0
      }
    });
  } catch (err) {
    console.error('Check subscription status error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all clients
app.get('/api/clients', authenticateAPI, async (req, res) => {
  try {
    const query = `SELECT c.*, s.subscription_id, s.plan_name, s.status, s.end_date, s.next_billing_date
                   FROM clients c 
                   LEFT JOIN subscriptions s ON c.client_id = s.client_id 
                   WHERE s.status = 'active' OR s.status IS NULL
                   ORDER BY c.created_at DESC`;
    
    const clients = await dbQuery(query, []);
    
    res.json({ clients });
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get billing history
app.get('/api/billing-history/:client_id?', authenticateAPI, async (req, res) => {
  try {
    const { client_id } = req.params;
    
    let query = `
      SELECT bh.*, c.name, c.email, s.plan_name 
      FROM billing_history bh
      JOIN clients c ON bh.client_id = c.client_id
      JOIN subscriptions s ON bh.subscription_id = s.subscription_id
    `;
    
    let params = [];
    
    if (client_id) {
      query += ` WHERE bh.client_id = ${isProduction ? '$1' : '?'}`;
      params.push(client_id);
    }
    
    query += ' ORDER BY bh.billing_date DESC';
    
    const billingHistory = await dbQuery(query, params);
    
    res.json({ billing_history: billingHistory });
  } catch (err) {
    console.error('Get billing history error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancel subscription
app.put('/api/subscriptions/:subscription_id/cancel', authenticateAPI, async (req, res) => {
  try {
    const { subscription_id } = req.params;
    
    const result = await dbRun(
      `UPDATE subscriptions SET status = ${isProduction ? '$1' : '?'}, updated_at = CURRENT_TIMESTAMP WHERE subscription_id = ${isProduction ? '$2' : '?'}`,
      ['cancelled', subscription_id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json({ message: 'Subscription cancelled successfully' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Monthly billing process
const processBilling = async () => {
  console.log('Processing monthly billing...');
  
  try {
    const now = new Date();
    
    // Find subscriptions due for billing
    const query = `SELECT s.*, c.email, c.name 
                   FROM subscriptions s 
                   JOIN clients c ON s.client_id = c.client_id 
                   WHERE s.status = 'active' AND ${isProduction ? 's.next_billing_date <= $1' : 'datetime(s.next_billing_date) <= datetime(?)'}`;
    
    const subscriptions = await dbQuery(query, [now.toISOString()]);
    
    for (const subscription of subscriptions) {
      const billingId = generateId();
      
      // Create billing record
      await dbRun(
        `INSERT INTO billing_history 
         (billing_id, subscription_id, client_id, amount, status) 
         VALUES (${isProduction ? '$1, $2, $3, $4, $5' : '?, ?, ?, ?, ?'})`,
        [billingId, subscription.subscription_id, subscription.client_id, subscription.price, 'processed']
      );
      
      // Update next billing date
      const nextBilling = addMonths(new Date(subscription.next_billing_date), 
                                   subscription.billing_cycle === 'yearly' ? 12 : 1);
      const newEndDate = new Date(nextBilling);
      
      await dbRun(
        `UPDATE subscriptions 
         SET next_billing_date = ${isProduction ? '$1' : '?'}, end_date = ${isProduction ? '$2' : '?'}, updated_at = CURRENT_TIMESTAMP 
         WHERE subscription_id = ${isProduction ? '$3' : '?'}`,
        [nextBilling.toISOString(), newEndDate.toISOString(), subscription.subscription_id]
      );
      
      console.log(`Billed client ${subscription.name} (${subscription.email}) - ${subscription.price}`);
    }
    
    console.log(`Billing completed. Processed ${subscriptions.length} subscriptions.`);
  } catch (err) {
    console.error('Billing process error:', err);
  }
};

// Schedule monthly billing (runs on the 1st of every month at 9 AM)
cron.schedule('0 9 1 * *', processBilling);

// Manual trigger for billing (for testing)
app.post('/api/process-billing', authenticateAPI, async (req, res) => {
  try {
    await processBilling();
    res.json({ message: 'Billing process triggered successfully' });
  } catch (err) {
    console.error('Manual billing trigger error:', err);
    res.status(500).json({ error: 'Failed to process billing' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Subscription management server running on port ${PORT}`);
  console.log('\nAPI Endpoints:');
  console.log('POST   /api/clients                     - Create new client');
  console.log('POST   /api/subscriptions              - Create subscription');
  console.log('GET    /api/subscriptions/:id/status   - Check subscription status');
  console.log('GET    /api/clients                    - Get all clients');
  console.log('GET    /api/billing-history/:id?       - Get billing history');
  console.log('PUT    /api/subscriptions/:id/cancel   - Cancel subscription');
  console.log('POST   /api/process-billing            - Manually trigger billing');
  console.log('GET    /api/health                     - Health check');
  console.log('\nUse API key "your-api-key" in X-API-Key header for authentication');
});
