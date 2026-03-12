# Supabase Local Development Setup

This guide explains how to run Tabeza with a local Supabase instance using Docker.

## Prerequisites

- Docker Desktop installed and running
- Node.js 18+ and pnpm installed

## Quick Start

### 1. Set Up Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and update the values if needed. The defaults work for local development.

### 2. Start Supabase

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** on `localhost:5432`
- **Supabase Studio** on `http://localhost:3010`
- **Kong API Gateway** on `http://localhost:8000`
- **Auth, Storage, Realtime** services
- **Supabase CLI** container (for running migrations and commands)

### 3. Using PostgreSQL CLI

A PostgreSQL CLI container is available for running database commands:

```bash
# Enter the CLI container
docker exec -it tabeza-psql-cli sh

# Inside the container, you can run psql commands
psql --help
psql -c "SELECT version();"
```

Or run commands directly without entering the container:

```bash
# Run a SQL query
docker exec tabeza-psql-cli psql -c "SELECT * FROM bars LIMIT 5;"

# Run a SQL file
docker exec -i tabeza-psql-cli psql < database/migrations/your-migration.sql

# Check database tables
docker exec tabeza-psql-cli psql -c "\dt"
```

### 4. Apply Migrations

```bash
# Apply a specific migration file
docker exec -i tabeza-psql-cli psql < database/migrations/your-migration.sql

# Or enter the container and run multiple commands
docker exec -it tabeza-psql-cli sh
# Then inside: psql -f /workspace/database/migrations/your-migration.sql
```

### 5. Start the Apps

```bash
# Start all apps
pnpm dev

# Or start individually
pnpm dev:customer  # Port 3002
pnpm dev:staff     # Port 3003
```

## Access Points

- **Supabase Studio**: http://localhost:3010
- **API Gateway**: http://localhost:8000
- **PostgreSQL**: `postgresql://postgres:your-password@localhost:5432/postgres`
- **Customer App**: http://localhost:3002
- **Staff App**: http://localhost:3003

## Useful Commands

### PostgreSQL CLI Commands

```bash
# Enter the CLI container interactively
docker exec -it tabeza-psql-cli sh

# Run SQL queries
docker exec tabeza-psql-cli psql -c "SELECT * FROM bars LIMIT 5;"

# Apply migrations
docker exec -i tabeza-psql-cli psql < database/migrations/your-migration.sql

# List all tables
docker exec tabeza-psql-cli psql -c "\dt"

# Describe a table
docker exec tabeza-psql-cli psql -c "\d+ printer_drivers"

# Check database size
docker exec tabeza-psql-cli psql -c "SELECT pg_size_pretty(pg_database_size('postgres'));"
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f db
docker-compose logs -f auth
docker-compose logs -f realtime
```

### Stop Services

```bash
docker-compose down
```

### Reset Database

```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Access PostgreSQL

```bash
# Using psql
psql -h localhost -U postgres -d postgres

# Using Supabase Studio
# Open http://localhost:3010
```

## Testing TabezaConnect Integration

### 1. Create a Test Bar

```sql
INSERT INTO bars (id, name, slug, venue_mode, authority_mode, pos_integration_enabled, printer_required)
VALUES (
  'test-bar-id',
  'Test Bar',
  'test-bar',
  'venue',
  'pos',
  true,
  true
);
```

### 2. Configure TabezaConnect

Set these environment variables in TabezaConnect:

```
TABEZA_BAR_ID=test-bar-id
TABEZA_API_URL=http://localhost:3003
CAPTURE_MODE=spooler
```

### 3. Test Heartbeat

TabezaConnect should send heartbeats to:
```
POST http://localhost:3003/api/printer/heartbeat
```

Check the `printer_drivers` table:
```sql
SELECT * FROM printer_drivers WHERE bar_id = 'test-bar-id';
```

## Troubleshooting

### Port Already in Use

If ports are already in use, edit `docker-compose.yml` and change the port mappings:

```yaml
ports:
  - 5433:5432  # Change 5432 to 5433
```

### Database Connection Failed

Check if PostgreSQL is running:
```bash
docker-compose ps db
```

View logs:
```bash
docker-compose logs db
```

### Migrations Not Applied

Manually apply migrations:
```bash
docker exec -i supabase-db psql -U postgres -d postgres < database/migrations/your-migration.sql
```

### Reset Everything

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove database data
rm -rf supabase/db-data

# Start fresh
docker-compose up -d
```

## Production vs Local

### Local Development
- Uses Docker Compose
- Data stored in `./supabase/db-data`
- No SSL/TLS
- Default JWT secrets (insecure)

### Production (Supabase Cloud)
- Managed infrastructure
- Automatic backups
- SSL/TLS enabled
- Secure JWT secrets
- CDN for storage

## Next Steps

1. Apply your database migrations
2. Seed test data
3. Test the printer heartbeat API
4. Test receipt capture and parsing
5. Test staff dashboard with local data

## Resources

- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
