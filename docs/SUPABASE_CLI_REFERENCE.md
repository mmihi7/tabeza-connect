# PostgreSQL CLI Container Reference

This guide shows how to use the PostgreSQL CLI container for local development.

## Starting the Container

The PostgreSQL CLI container starts automatically when you run:

```bash
docker-compose up -d
```

## Running Commands

### Interactive Shell

Enter the container to run multiple commands:

```bash
docker exec -it tabeza-psql-cli sh
```

Inside the container:
```bash
# You're now in /workspace (mapped to your Tabz directory)
psql --help
psql -c "SELECT version();"
psql -c "\dt"  # List all tables
```

### One-off Commands

Run commands without entering the container:

```bash
docker exec tabeza-psql-cli psql -c "YOUR SQL QUERY"
```

## Common Tasks

### Database Queries

```bash
# List all tables
docker exec tabeza-psql-cli psql -c "\dt"

# Describe a table structure
docker exec tabeza-psql-cli psql -c "\d+ printer_drivers"

# Run a SELECT query
docker exec tabeza-psql-cli psql -c "SELECT * FROM bars LIMIT 5;"

# Count records
docker exec tabeza-psql-cli psql -c "SELECT COUNT(*) FROM tabs WHERE status = 'open';"
```

### Database Migrations

```bash
# Apply a migration file
docker exec -i tabeza-psql-cli psql < database/migrations/add_printer_drivers.sql

# Apply multiple migrations
for file in database/migrations/*.sql; do
  docker exec -i tabeza-psql-cli psql < "$file"
done

# Check if a table exists
docker exec tabeza-psql-cli psql -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'printer_drivers');"
```

### Database Access

```bash
# Connect to PostgreSQL using psql (interactive)
docker exec -it tabeza-psql-cli psql

# Run a SQL file
docker exec -i tabeza-psql-cli psql < database/migrations/your-migration.sql

# Run a SQL command
docker exec tabeza-psql-cli psql -c "SELECT * FROM bars LIMIT 5;"

# Export query results to CSV
docker exec tabeza-psql-cli psql -c "COPY (SELECT * FROM bars) TO STDOUT WITH CSV HEADER" > bars.csv
```

### Seeding Data

```bash
# Create a seed file in database/seeds/test-data.sql
# Then run it:
docker exec -i tabeza-psql-cli psql < database/seeds/test-data.sql
```

## Testing TabezaConnect Integration

### 1. Create Test Bar

```bash
docker exec tabeza-psql-cli psql -c "
INSERT INTO bars (id, name, slug, venue_mode, authority_mode, pos_integration_enabled, printer_required)
VALUES (
  'test-bar-id',
  'Test Bar',
  'test-bar',
  'venue',
  'pos',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;
"
```

### 2. Check Printer Heartbeats

```bash
# View printer drivers
docker exec tabeza-psql-cli psql -c "
SELECT * FROM printer_drivers ORDER BY last_heartbeat DESC;
"

# View raw receipts
docker exec tabeza-psql-cli psql -c "
SELECT id, bar_id, device_id, timestamp, created_at 
FROM raw_pos_receipts 
ORDER BY created_at DESC 
LIMIT 10;
"
```

### 3. Monitor Real-time Updates

```bash
# Watch for new printer heartbeats
docker exec tabeza-psql-cli psql -c "
SELECT bar_id, driver_id, status, last_heartbeat 
FROM printer_drivers 
WHERE bar_id = 'test-bar-id';
"
```

## Troubleshooting

### Container Not Running

```bash
# Check container status
docker-compose ps tabeza-psql-cli

# View logs
docker-compose logs tabeza-psql-cli

# Restart container
docker-compose restart tabeza-psql-cli
```

### Database Connection Issues

```bash
# Check if database is healthy
docker-compose ps db

# View database logs
docker-compose logs db

# Test connection
docker exec tabeza-psql-cli psql -c "SELECT version();"
```

### Permission Issues

If you get permission errors accessing files:

```bash
# On Windows, ensure Docker Desktop has access to your drive
# Settings > Resources > File Sharing > Add your project directory
```

## Environment Variables

The CLI container has these environment variables set:

- `SUPABASE_DB_URL`: Connection string to local PostgreSQL
- `SUPABASE_API_URL`: Local Kong API gateway URL
- `SUPABASE_ANON_KEY`: Anonymous key for API access
- `SUPABASE_SERVICE_KEY`: Service role key for admin access

## File Locations

Inside the container:
- `/workspace` - Your Tabz project directory
- `/workspace/migrations` - Database migrations
- `/workspace/database` - Database files

## Advanced Usage

### Running SQL Scripts

```bash
# Create a script file: database/scripts/test-query.sql
# Then run it:
docker exec -i supabase-db psql -U postgres -d postgres < database/scripts/test-query.sql
```

### Backup Database

```bash
# Backup to file
docker exec supabase-db pg_dump -U postgres -d postgres > backup.sql

# Restore from file
docker exec -i supabase-db psql -U postgres -d postgres < backup.sql
```

### View Table Schema

```bash
docker exec supabase-db psql -U postgres -d postgres -c "\d+ printer_drivers"
docker exec supabase-db psql -U postgres -d postgres -c "\d+ raw_pos_receipts"
```

## Quick Reference

| Task | Command |
|------|---------|
| Enter CLI container | `docker exec -it supabase-cli sh` |
| Apply migrations | `docker exec supabase-cli supabase db push` |
| Generate types | `docker exec supabase-cli supabase gen types typescript --local` |
| Connect to DB | `docker exec -it supabase-db psql -U postgres -d postgres` |
| Run SQL file | `docker exec -i supabase-db psql -U postgres -d postgres < file.sql` |
| View logs | `docker-compose logs -f supabase-cli` |
| Restart services | `docker-compose restart` |
| Stop all | `docker-compose down` |
| Reset DB | `docker-compose down -v && docker-compose up -d` |

## Next Steps

1. Start Docker Compose: `docker-compose up -d`
2. Verify services are running: `docker-compose ps`
3. Access Supabase Studio: http://localhost:3010
4. Test database connection: `docker exec supabase-cli psql -h db -U postgres -d postgres -c "SELECT 1;"`
5. Apply migrations if needed
6. Start your apps: `pnpm dev`
