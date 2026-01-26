# How to Generate SALON_TOKEN_SECRET

## Quick Methods (Choose One)

### Method 1: Using Node.js (Recommended)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Output example:**
```
5774ce5712377e49106036cec54a309260a84ab5f5b20e7cba2063d29762e39e
```

### Method 2: Using OpenSSL
```bash
openssl rand -hex 32
```

**Output example:**
```
57036f69d78ae4959e0ce2adc2f9d9d0d0b15a5ed8f4c295fbb613b922ca309f
```

### Method 3: Using Python
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Output example:**
```
302a703965d1529dd0c1380301f4d79176bc920b307f714162b42a52fb4b80ad
```

### Method 4: Using Bash (if available)
```bash
cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1
```

## Add to Your Environment

### For Local Development (.env.local)
```bash
# Copy one of the generated keys above
SALON_TOKEN_SECRET=5774ce5712377e49106036cec54a309260a84ab5f5b20e7cba2063d29762e39e
```

### For Production (Vercel/Deployment Platform)
1. Go to your project settings
2. Navigate to Environment Variables
3. Add:
   - **Name**: `SALON_TOKEN_SECRET`
   - **Value**: (paste your generated secret)
   - **Environment**: Production, Preview, Development (as needed)

## Security Best Practices

1. **Never commit secrets to Git**
   - Already in `.gitignore` ✅
   - Use environment variables only

2. **Use different secrets for different environments**
   - Development: One secret
   - Staging: Different secret
   - Production: Unique secret

3. **Secret Length**
   - Minimum: 32 characters (16 bytes)
   - Recommended: 64 characters (32 bytes) or more
   - The examples above generate 64-character hex strings (32 bytes)

4. **Rotate secrets periodically**
   - Change secrets every 6-12 months
   - Or immediately if compromised

## Verification

After adding the secret, restart your development server:
```bash
npm run dev
```

The application will automatically use the secret for token generation. If the secret is missing, it will fallback to `CRON_SECRET` or a default (which should be changed in production).

## Quick Copy-Paste Commands

**Generate and add to .env.local in one command:**
```bash
echo "SALON_TOKEN_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env.local
```

**Or with OpenSSL:**
```bash
echo "SALON_TOKEN_SECRET=$(openssl rand -hex 32)" >> .env.local
```

**Note:** Make sure `.env.local` already exists or create it first:
```bash
touch .env.local
```

## Troubleshooting

**If you get "Invalid access token" errors:**
1. Check that `SALON_TOKEN_SECRET` is set in your environment
2. Restart your development server after adding the secret
3. Ensure the secret is the same across all instances (if using multiple servers)

**If tokens don't match:**
- Make sure you're using the same secret for generation and validation
- Check for typos in the environment variable name
- Verify the secret is loaded correctly (check server logs)
