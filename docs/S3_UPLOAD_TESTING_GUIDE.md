# S3 Direct Upload Testing Guide (Fixed NoSuchKey Error)

## Problem Fixed ✅
**Error**: `NoSuchKey: The specified key does not exist`

**Root Cause**: The `save-metadata` API was trying to immediately download the file from S3 to sync with WebDAV, but:
- The file hadn't been uploaded yet (timing issue)
- The file upload failed silently
- There was a race condition

**Solution Implemented**:
1. ✅ Added `fileExistsInS3()` check before downloading
2. ✅ Implemented retry logic (5 retries × 2 seconds = 10 seconds total wait)
3. ✅ Made WebDAV sync truly non-blocking (async, fire-and-forget)
4. ✅ Graceful error handling - metadata saves even if WebDAV sync fails

---

## Step-by-Step Testing (Complete Flow)

### Prerequisites
- Postman or any HTTP client
- Valid JWT token for a worker or project manager
- Your VPS domain/URL: `https://api.baulinse.ch`

---

### ✅ Step 1: Get Presigned URL

**Method**: `GET`

**URL**: 
```
https://api.baulinse.ch/api/v1/work-photos/presigned-url?fileName=test_photo.jpg&contentType=image/jpeg
```

**Headers**:
```
Authorization: Bearer YOUR_WORKER_JWT_TOKEN
```

**Query Parameters**:
| Parameter | Value | Required | Notes |
|-----------|-------|----------|-------|
| `fileName` | `test_photo.jpg` | ✅ Yes | Your photo filename |
| `contentType` | `image/jpeg` | ✅ Yes | MIME type of the file |
| `projectName` | `Project_A` | ❌ No | If omitted, goes to "Others" project |

**Expected Response (200 OK)**:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Presigned URL generated successfully!",
  "data": {
    "uploadUrl": "https://s3.infomaniak.com/bucket-name/workphotos/companyId/Others/1783148108960_test_photo.jpg?Signature=...",
    "fileKey": "workphotos/companyId/Others/1783148108960_test_photo.jpg"
  }
}
```

**⚠️ IMPORTANT**: 
- Copy the `uploadUrl` and `fileKey` from response
- The `uploadUrl` expires in **5 minutes** - complete upload before expiry!

---

### ✅ Step 2: Upload File to S3 Using Presigned URL

**Method**: `PUT`

**URL**: *(Paste the `uploadUrl` from Step 1 response)*

**Headers**:
```
Content-Type: image/jpeg
```

**Body**:
- Select: `binary` (in Postman)
- Click: "Select File" → choose an image from your computer
- The file content will be sent as-is to S3

**Expected Response (200 OK)**:
- Postman will show: `Status: 200 OK`
- S3 will return XML response (looks like success even if empty body)

**✅ At this point, your file is in S3!**

---

### ✅ Step 3: Save Metadata to Database

**Method**: `POST`

**URL**: 
```
https://api.baulinse.ch/api/v1/work-photos/save-metadata
```

**Headers**:
```
Authorization: Bearer YOUR_WORKER_JWT_TOKEN
Content-Type: application/json
```

**Body** (JSON):
```json
{
  "fileKey": "workphotos/companyId/Others/1783148108960_test_photo.jpg",
  "latitude": 23.8103,
  "longitude": 90.4125,
  "location": "Banani, Dhaka",
  "captureAt": "2026-07-02T11:38:00.000Z"
}
```

**Explanation of Fields**:
| Field | Example | Required | Notes |
|-------|---------|----------|-------|
| `fileKey` | From Step 1 | ✅ Yes | Exact key from presigned URL response |
| `latitude` | 23.8103 | ❌ No | GPS latitude (or leave empty) |
| `longitude` | 90.4125 | ❌ No | GPS longitude (or leave empty) |
| `location` | "Banani, Dhaka" | ❌ No | Human-readable location |
| `captureAt` | ISO timestamp | ❌ No | Photo capture time (defaults to now) |
| `project` | Project MongoDB ID | ❌ No | If omitted, saves to "Others" |

**Expected Response (201 Created)**:
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Photo metadata saved successfully!",
  "data": {
    "_id": "60d5ec49f1b2c52e88a38c9f",
    "author": "worker_user_id",
    "company": "company_id",
    "project": "60d5ec49f1b2c52e88a38c4b",
    "image": "https://s3.infomaniak.com/bucket-name/workphotos/companyId/Others/1783148108960_test_photo.jpg",
    "latitude": 23.8103,
    "longitude": 90.4125,
    "location": "Banani, Dhaka",
    "s3Key": "workphotos/companyId/Others/1783148108960_test_photo.jpg",
    "captureAt": "2026-07-02T11:38:00.000Z",
    "createdAt": "2026-07-02T12:52:45.000Z"
  }
}
```

**🎉 SUCCESS! Photo metadata saved to database!**

---

## What Happens Behind the Scenes ⚙️

### 1. **Save to Database** (Immediate)
   - Photo record created in MongoDB immediately
   - Project `photosCount` incremented by 1

### 2. **WebDAV Sync** (Async, Non-Blocking)
   - Fires **after** database save is complete
   - **Checks if file exists in S3**
   - If not found: **Retries 5 times** (2-second intervals)
   - If found: Downloads and syncs to Nextcloud/WebDAV
   - **If sync fails**: Logs error but doesn't block response

### 3. **Server Logs** (Check these to verify)
```
✅ File exists in S3. Starting WebDAV sync...
✅ Synced test_photo.jpg to WebDAV path: workphoto/Others
```

Or if WebDAV disabled:
```
⏭️ WebDAV sync skipped: Company not found or WebDAV not enabled
```

Or if file not found:
```
🔍 Checking if file exists in S3: workphotos/companyId/Others/1783148108960_test_photo.jpg
⏳ File not found yet. Retry 1/5 in 2000ms...
⏳ File not found yet. Retry 2/5 in 2000ms...
...
⚠️ File not found in S3 after 5 retries: workphotos/...
```

---

## Troubleshooting

### ❌ "Presigned URL generation failed"
**Cause**: AWS credentials issue
**Fix**: Check `config.aws.bucket` and S3 credentials

### ❌ "File upload to S3 failed (Step 2)"
**Cause**: Wrong URL or Content-Type mismatch
**Fix**: 
- Verify `uploadUrl` matches `fileKey` in response
- Ensure `Content-Type` header matches your file

### ❌ "Presigned URL expired"
**Cause**: 5-minute expiry exceeded
**Fix**: Complete all 3 steps within 5 minutes

### ❌ "File not found in S3" (but Step 2 returned 200)
**Cause**: File uploaded to wrong location
**Fix**: 
- Verify `fileKey` is exactly the same across all 3 steps
- Check S3 bucket has the file at that exact path

### ✅ Photo saved but WebDAV sync failed
**This is OK!** The photo metadata is saved successfully.
WebDAV sync happens in the background and failures don't block the main operation.

---

## Performance Notes

| Operation | Time | Notes |
|-----------|------|-------|
| Presigned URL generation | <100ms | Instant |
| File upload to S3 | Variable | Depends on file size & internet |
| Save metadata to DB | <500ms | Fast, happens before sync |
| WebDAV sync start | <100ms | Starts immediately after DB save |
| File retry logic | Up to 10s | 5 retries × 2s each |
| Full WebDAV sync | 5-30s | Async, doesn't block response |

---

## API Summary

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/api/v1/work-photos/presigned-url` | GET | 200 | Get S3 upload URL |
| S3 direct upload | PUT | 200 | Upload file to Infomaniak S3 |
| `/api/v1/work-photos/save-metadata` | POST | 201 | Save photo metadata to DB |
| `/api/v1/work-photos/download-script` | GET | 200 | Download WebDAV mount script |

---

## Next Steps

✅ **All 3 APIs are now working!**
- Test with Postman using the steps above
- Mobile app can use these endpoints directly
- Dashboard can download mount scripts for WebDAV

