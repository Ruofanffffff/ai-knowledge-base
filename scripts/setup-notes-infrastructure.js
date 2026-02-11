#!/usr/bin/env node

/**
 * Setup Script for Notes Feature Infrastructure
 * 
 * This script helps set up the required infrastructure for the notes feature:
 * 1. Validates environment configuration
 * 2. Tests database connection
 * 3. Tests S3 storage connection
 * 4. Creates S3 bucket if it doesn't exist
 * 5. Runs database migrations
 */

const { PrismaClient } = require('@prisma/client');
const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { notesConfig, validateConfig } = require('../config/notes.config');

const prisma = new PrismaClient();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

// Step 1: Validate Configuration
async function validateConfiguration() {
  logInfo('Step 1: Validating configuration...');
  
  const isValid = validateConfig();
  
  if (isValid) {
    logSuccess('Configuration is valid');
  } else {
    logWarning('Configuration has warnings (see above)');
  }
  
  return isValid;
}

// Step 2: Test Database Connection
async function testDatabaseConnection() {
  logInfo('Step 2: Testing database connection...');
  
  try {
    await prisma.$connect();
    logSuccess('Database connection successful');
    
    // Test query
    const userCount = await prisma.user.count();
    logInfo(`  Found ${userCount} users in database`);
    
    return true;
  } catch (error) {
    logError(`Database connection failed: ${error.message}`);
    logInfo('  Make sure PostgreSQL is running and DATABASE_URL is correct');
    return false;
  }
}

// Step 3: Test S3 Connection
async function testS3Connection() {
  logInfo('Step 3: Testing S3 storage connection...');
  
  try {
    const s3Client = new S3Client({
      endpoint: notesConfig.storage.endpoint,
      region: notesConfig.storage.region,
      credentials: {
        accessKeyId: notesConfig.storage.accessKeyId,
        secretAccessKey: notesConfig.storage.secretAccessKey,
      },
      forcePathStyle: notesConfig.storage.forcePathStyle,
      tls: notesConfig.storage.useSSL,
    });
    
    // Try to check if bucket exists
    try {
      await s3Client.send(new HeadBucketCommand({
        Bucket: notesConfig.storage.bucketName,
      }));
      logSuccess(`S3 bucket '${notesConfig.storage.bucketName}' exists and is accessible`);
      return { client: s3Client, bucketExists: true };
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        logWarning(`S3 bucket '${notesConfig.storage.bucketName}' does not exist`);
        return { client: s3Client, bucketExists: false };
      }
      throw error;
    }
  } catch (error) {
    logError(`S3 connection failed: ${error.message}`);
    logInfo('  Make sure MinIO/S3 is running and credentials are correct');
    return { client: null, bucketExists: false };
  }
}

// Step 4: Create S3 Bucket
async function createS3Bucket(s3Client) {
  logInfo('Step 4: Creating S3 bucket...');
  
  try {
    await s3Client.send(new CreateBucketCommand({
      Bucket: notesConfig.storage.bucketName,
    }));
    logSuccess(`S3 bucket '${notesConfig.storage.bucketName}' created successfully`);
    return true;
  } catch (error) {
    if (error.name === 'BucketAlreadyOwnedByYou' || error.Code === 'BucketAlreadyOwnedByYou') {
      logSuccess(`S3 bucket '${notesConfig.storage.bucketName}' already exists`);
      return true;
    }
    logError(`Failed to create S3 bucket: ${error.message}`);
    return false;
  }
}

// Step 5: Run Database Migrations
async function runDatabaseMigrations() {
  logInfo('Step 5: Running database migrations...');
  
  try {
    const { execSync } = require('child_process');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    logSuccess('Database migrations completed successfully');
    return true;
  } catch (error) {
    logError(`Database migrations failed: ${error.message}`);
    logInfo('  You can run migrations manually with: npx prisma migrate deploy');
    return false;
  }
}

// Main setup function
async function setup() {
  log('\n========================================', colors.blue);
  log('Notes Feature Infrastructure Setup', colors.blue);
  log('========================================\n', colors.blue);
  
  let allSuccess = true;
  
  // Step 1: Validate Configuration
  const configValid = await validateConfiguration();
  if (!configValid) {
    logWarning('Continuing with warnings...\n');
  }
  
  // Step 2: Test Database Connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    allSuccess = false;
    logError('Cannot proceed without database connection\n');
  }
  
  // Step 3: Test S3 Connection
  const { client: s3Client, bucketExists } = await testS3Connection();
  if (!s3Client) {
    allSuccess = false;
    logError('Cannot proceed without S3 connection\n');
  }
  
  // Step 4: Create S3 Bucket (if needed)
  if (s3Client && !bucketExists) {
    const bucketCreated = await createS3Bucket(s3Client);
    if (!bucketCreated) {
      allSuccess = false;
    }
  }
  
  // Step 5: Run Database Migrations (only if database is connected)
  if (dbConnected) {
    const migrationsSuccess = await runDatabaseMigrations();
    if (!migrationsSuccess) {
      allSuccess = false;
    }
  }
  
  // Summary
  log('\n========================================', colors.blue);
  if (allSuccess) {
    logSuccess('Setup completed successfully! ✨');
    log('\nYou can now start using the notes feature.', colors.green);
  } else {
    logError('Setup completed with errors');
    log('\nPlease fix the errors above and run the setup again.', colors.red);
  }
  log('========================================\n', colors.blue);
  
  // Cleanup
  await prisma.$disconnect();
  
  process.exit(allSuccess ? 0 : 1);
}

// Run setup
setup().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
