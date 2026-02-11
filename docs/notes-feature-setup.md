# Notes Feature Infrastructure Setup Guide

This guide will help you set up the infrastructure required for the notes feature, including PostgreSQL database and S3-compatible object storage.

## Prerequisites

Before setting up the notes feature, ensure you have the following installed:

1. **Node.js** (v16 or higher)
2. **PostgreSQL** (v13 or higher)
3. **MinIO** or AWS S3 (for object storage)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `@aws-sdk/client-s3` - AWS SDK for S3 operations
- `@prisma/client` - Prisma ORM client
- Other existing dependencies

### 2. Configure Environment Variables

Copy the example environment file and update it with your settings:

```bash
cp .env.example .env
```

Edit `.env` and configure the following sections:

#### Database Configuration

```env
DATABASE_URL="postgresql://username:password@localhost:5432/knowledge_base?schema=public"
```

Replace `username` and `password` with your PostgreSQL credentials.

#### S3 Storage Configuration

For **MinIO** (local development):

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=notes-attachments
S3_REGION=us-east-1
S3_USE_SSL=false
```

For **AWS S3** (production):

```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY_ID=your_aws_access_key
S3_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your-bucket-name
S3_REGION=us-east-1
S3_USE_SSL=true
```

#### LLM Configuration

```env
QWEN_API_KEY=your_qwen_api_key_here
MULTIMODAL_LLM_PROVIDER=qwen
MULTIMODAL_LLM_MODEL=qwen-vl-plus
TEXT_LLM_PROVIDER=qwen
TEXT_LLM_MODEL=qwen-max
```

### 3. Set Up PostgreSQL Database

#### Option A: Using Docker

```bash
docker run --name postgres-notes \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=knowledge_base \
  -p 5432:5432 \
  -d postgres:15
```

#### Option B: Local Installation

1. Install PostgreSQL from https://www.postgresql.org/download/
2. Create a database:

```sql
CREATE DATABASE knowledge_base;
```

### 4. Set Up MinIO (for local development)

#### Using Docker

```bash
docker run --name minio-notes \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -d minio/minio server /data --console-address ":9001"
```

Access MinIO Console at http://localhost:9001

#### Using Binary

Download and run MinIO from https://min.io/download

```bash
minio server /data --console-address ":9001"
```

### 5. Run Setup Script

Run the automated setup script to initialize the infrastructure:

```bash
node scripts/setup-notes-infrastructure.js
```

This script will:
1. ✓ Validate environment configuration
2. ✓ Test database connection
3. ✓ Test S3 storage connection
4. ✓ Create S3 bucket if it doesn't exist
5. ✓ Run database migrations

### 6. Verify Setup

After successful setup, you should see:

```
========================================
Notes Feature Infrastructure Setup
========================================

✓ Configuration is valid
✓ Database connection successful
✓ S3 bucket 'notes-attachments' exists and is accessible
✓ Database migrations completed successfully

========================================
✓ Setup completed successfully! ✨

You can now start using the notes feature.
========================================
```

## Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Generate Prisma Client

```bash
npx prisma generate
```

### 2. Run Database Migrations

```bash
npx prisma migrate deploy
```

Or for development:

```bash
npx prisma migrate dev --name add_notes_feature
```

### 3. Create S3 Bucket

Using AWS CLI:

```bash
aws s3 mb s3://notes-attachments --region us-east-1
```

Using MinIO Client (mc):

```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/notes-attachments
```

## Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solution**:
1. Verify PostgreSQL is running: `pg_isready`
2. Check DATABASE_URL in `.env`
3. Ensure PostgreSQL accepts connections from your host

### S3 Connection Issues

**Error**: `S3 connection failed`

**Solution**:
1. Verify MinIO/S3 is running
2. Check S3 credentials in `.env`
3. For MinIO, ensure ports 9000 and 9001 are not in use

### Migration Issues

**Error**: `Migration failed`

**Solution**:
1. Check database permissions
2. Ensure database is empty or compatible
3. Try resetting: `npx prisma migrate reset` (⚠️ This will delete all data)

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection URL | - | Yes |
| `S3_ENDPOINT` | S3 endpoint URL | http://localhost:9000 | Yes |
| `S3_ACCESS_KEY_ID` | S3 access key | minioadmin | Yes |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | minioadmin | Yes |
| `S3_BUCKET_NAME` | S3 bucket name | notes-attachments | Yes |
| `S3_REGION` | S3 region | us-east-1 | Yes |
| `S3_USE_SSL` | Use SSL for S3 | false | No |
| `QWEN_API_KEY` | Qwen API key | - | Yes |
| `MULTIMODAL_LLM_PROVIDER` | Multi-modal LLM provider | qwen | No |
| `MULTIMODAL_LLM_MODEL` | Multi-modal LLM model | qwen-vl-plus | No |
| `TEXT_LLM_PROVIDER` | Text LLM provider | qwen | No |
| `TEXT_LLM_MODEL` | Text LLM model | qwen-max | No |

### Attachment Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `NOTES_MAX_ATTACHMENT_SIZE` | 10485760 (10MB) | Maximum file size |
| `NOTES_ALLOWED_IMAGE_TYPES` | jpeg,png,gif,webp | Allowed image types |
| `NOTES_ALLOWED_DOCUMENT_TYPES` | pdf,doc,docx,txt | Allowed document types |
| `NOTES_ALLOWED_TABLE_TYPES` | xls,xlsx,csv | Allowed table types |

## Next Steps

After successful setup:

1. Start the development server: `npm run dev`
2. Test the API endpoints (see API documentation)
3. Implement frontend components
4. Run tests: `npm test`

## Production Deployment

For production deployment:

1. Use managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
2. Use AWS S3 or equivalent cloud storage
3. Set `S3_USE_SSL=true`
4. Use strong credentials
5. Enable database backups
6. Set up monitoring and alerts
7. Configure CORS and security headers

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the requirements.md and design.md in `.kiro/specs/notes-feature/`
- Contact the development team

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [AWS S3 SDK Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
