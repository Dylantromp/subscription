# Subscription Management API

A comprehensive subscription management system with automated billing, client tracking, and subscription status API.

## Features

- **Client Management**: Create and track clients with unique IDs
- **Subscription Management**: Handle different plans, pricing, and billing cycles
- **Automated Billing**: Monthly billing process with cron jobs
- **Status API**: Check subscription validity
- **Billing History**: Track all transactions
- **Database Support**: SQLite for development, PostgreSQL for production

## Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## API Endpoints

### Public Endpoint
- `GET /api/subscriptions/{client_id}/status` - Check subscription status

### Protected Endpoints (require API key)
- `POST /api/clients` - Create new client
- `POST /api/subscriptions` - Create subscription
- `GET /api/clients` - Get all clients
- `GET /api/billing-history/{client_id}` - Get billing history
- `PUT /api/subscriptions/{id}/cancel` - Cancel subscription
- `POST /api/process-billing` - Manually trigger billing

## Local Development

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd subscription-management-api
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your values
```

3. **Start development server:**
```bash
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port | No (default: 3000) |
| `DATABASE_URL` | PostgreSQL connection string (production) | Production only |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `API_KEY` | API key for protected endpoints | Yes |

## Usage Examples

### Create a Client
```bash
curl -X POST https://your-app.onrender.com/api/clients \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"email": "john@example.com", "name": "John Doe"}'
```

### Create a Subscription
```bash
curl -X POST https://your-app.onrender.com/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "client_id": "client-uuid-here",
    "plan_name": "Premium",
    "price": 29.99,
    "billing_cycle": "monthly"
  }'
```

### Check Subscription Status
```bash
curl https://your-app.onrender.com/api/subscriptions/client-uuid-here/status
```

Response:
```json
{
  "valid": true,
  "subscription": {
    "subscription_id": "sub-uuid",
    "client_id": "client-uuid",
    "client_name": "John Doe",
    "plan_name": "Premium",
    "status": "active",
    "end_date": "2024-12-01T00:00:00.000Z",
    "days_remaining": 30
  }
}
```

## Billing Process

The system automatically processes billing on the 1st of each month at 9 AM UTC. You can also trigger billing manually:

```bash
curl -X POST https://your-app.onrender.com/api/process-billing \
  -H "X-API-Key: your-api-key"
```

## Database Schema

### Clients Table
- `id` - Primary key
- `client_id` - Unique client identifier (UUID)
- `email` - Client email (unique)
- `name` - Client name
- `created_at` - Creation timestamp

### Subscriptions Table
- `id` - Primary key
- `subscription_id` - Unique subscription identifier (UUID)
- `client_id` - Foreign key to clients table
- `plan_name` - Subscription plan name
- `status` - Subscription status (active/cancelled)
- `price` - Monthly/yearly price
- `billing_cycle` - monthly or yearly
- `end_date` - Subscription end date
- `next_billing_date` - Next billing date

### Billing History Table
- `id` - Primary key
- `billing_id` - Unique billing record identifier
- `subscription_id` - Foreign key to subscriptions
- `client_id` - Foreign key to clients
- `amount` - Billed amount
- `status` - Billing status
- `billing_date` - When the billing occurred

## License

MIT