# CrossRiver Development Proxy Setup

## Overview
This project uses a development proxy to eliminate CORS issues during local development while keeping production behavior unchanged.

## How it Works

### Development Mode (`npm start`)
- All API calls use **same-origin paths** (no CORS)
- JSON API calls (`/api/*`) are proxied to AWS API Gateway
- Streaming calls (`/agent/stream`) are proxied to AWS Lambda Function URL
- No CORS preflight requests needed ✅

### Production Mode (`npm run build`)
- Uses direct AWS URLs with proper CORS configuration
- API Gateway handles JSON endpoints with CORS headers
- Function URL handles streaming with CORS headers

## Architecture

```
DEVELOPMENT (localhost:3000)
├── /api/auth/* → API Gateway (https://zm66uq3qmi.execute-api.us-east-1.amazonaws.com)
├── /api/agent/* → API Gateway (https://zm66uq3qmi.execute-api.us-east-1.amazonaws.com)
└── /agent/stream → Function URL (https://fucnyzp25mvxae64uome6qjthy0mmlts.lambda-url.us-east-1.on.aws)

PRODUCTION (deployed build)
├── Direct API Gateway calls with CORS
└── Direct Function URL calls with CORS
```

## Configuration Files

### `src/setupProxy.js`
Create React App proxy configuration:
- Routes `/api/*` to API Gateway
- Routes `/agent/stream` to Function URL (rewritten to `/`)
- Preserves query strings and headers

### `src/config/api.ts`
Automatic environment detection:
- Development: Uses relative paths (`/api/*`, `/agent/stream`)
- Production: Uses direct AWS URLs

## Verification Steps

### 1. Start Development Server
```bash
cd client
npm start
```

### 2. Check Network Tab in DevTools
- All requests go to `http://localhost:3000/*`
- No CORS errors in console ✅
- No OPTIONS preflight requests (or handled by proxy)

### 3. Test API Endpoints
```bash
# Login (should work via proxy)
curl -i http://localhost:3000/api/auth/login

# Stream (should work via proxy with rewrite)
curl -i -N "http://localhost:3000/agent/stream?message=hello&conversationId=123"
```

### 4. Verify Production Build
```bash
npm run build
# Deployed build uses direct AWS URLs with CORS
```

## Updating CDK Outputs

When CDK outputs change, update these files:
1. `src/setupProxy.js` - Update `HTTP_API_BASE` and `FUNCTION_URL`
2. `src/config/api.ts` - Update `PRODUCTION_CONFIG` URLs

Current values from CDK:
- **HTTP API Gateway**: `https://zm66uq3qmi.execute-api.us-east-1.amazonaws.com`
- **Function URL**: `https://fucnyzp25mvxae64uome6qjthy0mmlts.lambda-url.us-east-1.on.aws/`

## Troubleshooting

### CORS Errors in Development
- Check `src/setupProxy.js` has correct target URLs
- Restart development server after proxy changes
- Verify console shows proxy logs: `[PROXY] GET /api/... → https://...`

### Production CORS Issues
- Ensure AWS Lambda has proper CORS configuration
- Check API Gateway CORS preflight settings
- Verify `src/config/api.ts` production URLs are correct

### Streaming Issues
- Function URL expects root path `/`, proxy rewrites `/agent/stream` → `/`
- Query string must be preserved (`?message=...&conversationId=...`)
- Headers must include `authorization` and `accept: text/event-stream`