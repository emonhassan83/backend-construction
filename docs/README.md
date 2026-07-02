# Serverless WebDAV to Infomaniak S3 Integration (Zero VPS Resource Architecture)

This documentation outlines the step-by-step implementation plan for integrating a native WebDAV network drive for PC clients (Windows/Mac) that connects directly to an Infomaniak S3 bucket, bypassing the main Node.js VPS resources (0% VPS CPU/RAM/Bandwidth load) for file transfers.

---

## 1. Architectural Overview

Instead of buffering files through the Express.js server, files are uploaded directly to the Infomaniak S3 Bucket from the worker's mobile/web app via **S3 Presigned URLs**. For Project Managers, a **Cloudflare Worker** acts as a serverless WebDAV-to-S3 gateway, allowing Windows Explorer and macOS Finder to mount the bucket natively as a network drive.

```
+------------------+                   1. Get Presigned URL               +----------------------+
|    Worker App    | ---------------------------------------------------> |  Node.js VPS Server  |
| (Mobile/Web App) | <--------------------------------------------------- |                      |
+------------------+             2. Return Upload URL & Key               +----------------------+
         |                                                                           ^
         | 3. HTTP PUT (Direct Binary Upload)                                        | 4. Save Record
         v                                                                           v
+------------------+                                                      +----------------------+
|  Infomaniak S3   | <--------------------------------------------------+ |       MongoDB        |
|  Object Storage  |                                                      +----------------------+
+------------------+                                                                 
         ^                                                                           
         | 6. Get/List Files via S3 API                                              
         v                                                                           
+------------------+                                                                 
|Cloudflare Worker | <--------------------------------------------------+            
| (WebDAV Gateway) |                                                      |          
+------------------+                                                      |          
         ^                                                                |          
         | 5. Native WebDAV Connection                                    | 3rd-Party Auth       
         v                                                                | (Via Token/Basic Auth)
+------------------+                                                      |          
|Project Manager PC| -----------------------------------------------------+          
| (Explorer/Finder)|                                                                 
+------------------+                                                                 
```

---

## 2. Step 1: Backend Implementation (Node.js/Express)

### A. Database Schema Update
Add the WebDAV credentials to the user schema for authentication at the gateway level.

```typescript
// src/app/modules/user/user.model.ts
companyWebdavUsername: {
  type: String,
  unique: true,
  sparse: true,
},
companyWebdavPassword: {
  type: String, // Encrypted securely in the database
},
```

### B. AWS S3 Presigned URL Helper
Install the required package:
```bash
npm install @aws-sdk/s3-request-presigner
```

Implement the signed URL generator:
```typescript
// src/app/utils/s3.ts
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../constants/aws";
import config from "../config";

export const generatePresignedUrl = async (
  fileName: string,
  contentType: string
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: fileName,
    ContentType: contentType,
  });

  // Generates an upload link valid for 5 minutes (300 seconds)
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  return uploadUrl;
};
```

### C. Create Backend API Endpoints

#### 1. Generate Presigned URL
* **Endpoint:** `GET /api/v1/work-photos/presigned-url`
* **Controller Logic:**
  ```typescript
  const getUploadUrl = catchAsync(async (req, res) => {
    const { fileName, contentType, projectName } = req.query;
    const companyId = req.user.companyId; // Derived from auth middleware
    
    // Generate a unique S3 key inside the company's workspace
    const sanitizedProject = (projectName as string).replace(/[^a-zA-Z0-9-_]/g, '_');
    const s3Key = `workphotos/${companyId}/${sanitizedProject}/${Date.now()}_${fileName}`;
    
    const uploadUrl = await generatePresignedUrl(s3Key, contentType as string);
    
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      data: { uploadUrl, fileKey: s3Key }
    });
  });
  ```

#### 2. Save Metadata After Upload
* **Endpoint:** `POST /api/v1/work-photos/save-metadata`
* **Controller Logic:**
  ```typescript
  const saveMetadata = catchAsync(async (req, res) => {
    const { fileKey, latitude, longitude, location, project } = req.body;
    const author = req.user._id;
    const company = req.user.companyId;

    const imageUrl = `${config.aws.s3BaseUrl}/${fileKey}`;
    const locationUrl = latitude && longitude ? `https://www.google.com/maps?q=${latitude},${longitude}` : undefined;

    const workPhoto = await WorkPhoto.create({
      author,
      company,
      project,
      image: imageUrl,
      latitude,
      longitude,
      location,
      locationUrl,
      captureAt: new Date().toISOString()
    });

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Work photo metadata saved successfully!',
      data: workPhoto
    });
  });
  ```

---

## 3. Step 2: Client/Mobile App Implementation

When the worker captures a photo and uploads it:

1. **Request Upload Link:**
   Call `/api/v1/work-photos/presigned-url` with `fileName` and `contentType`. Get `uploadUrl` and `fileKey` in response.

2. **Direct Upload (Binary PUT):**
   Upload the image directly to S3 via the `uploadUrl`.
   * **Note:** Use a standard HTTP `PUT` request with binary body content, **not** multipart form-data.
   ```javascript
   // Axios Example:
   await axios.put(uploadUrl, imageBlob, {
     headers: {
       'Content-Type': 'image/jpeg', // Must match the contentType sent in step 1
     },
   });
   ```

3. **Confirm Metadata:**
   Once S3 upload is complete, call `/api/v1/work-photos/save-metadata` with `fileKey`, GPS coordinates, and project details to finalize the database record.

---

## 4. Step 3: Cloudflare Workers WebDAV-to-S3 Setup

Deploy a Cloudflare Worker to serve as the WebDAV gateway interface. This worker acts as a translator between native OS WebDAV requests and S3 API calls.

### Cloudflare Worker Configuration:
Create a Cloudflare Worker and configure the following environment variables:
* `S3_ENDPOINT`: S3 endpoint URL (e.g., `https://s3.infomaniak.com`)
* `S3_BUCKET`: Your bucket name
* `S3_ACCESS_KEY_ID`: S3 Access Key ID
* `S3_SECRET_ACCESS_KEY`: S3 Secret Access Key

### Worker Code Pattern:
```javascript
// Cloudflare Worker handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // 1. Authenticate Request (Basic Authentication)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Company S3 WebDAV"' }
      });
    }

    const [username, password] = parseBasicAuth(authHeader);
    const isValid = await verifyCredentialsWithDB(username, password); // Verify against backend
    if (!isValid) {
      return new Response('Forbidden', { status: 403 });
    }

    // 2. Map WebDAV Methods to S3 API calls
    switch (method) {
      case 'PROPFIND':
        return await handlePropfind(request, env, username); // Lists directory files from S3 XML response
      case 'GET':
        return await handleGet(request, env, username);      // Streams file from S3 to Client
      case 'OPTIONS':
        return handleOptions();                             // Handshake for Win/Mac compatibility
      default:
        return new Response('Method Not Allowed', { status: 405 });
    }
  }
};
```

---

## 5. Step 4: PC Network Drive Mount Automation

Provide downloable automation scripts in the Customer Portal under the **"PC Setup"** section.

### A. Windows Batch Script (`connect-drive.bat`)
When clicked, this maps the WebDAV path directly to Windows Explorer as the `Z:` drive.
```batch
@echo off
echo Connecting your company photo drive...
net use Z: "https://webdav-gateway.yourdomain.ch/%TENANT_USERNAME%/" /user:%TENANT_USERNAME% %TENANT_PASSWORD% /persistent:yes
echo Done! Your drive Z: is now ready in Windows Explorer.
pause
```

### B. macOS AppleScript (`mount-drive.scpt`)
When run, this mounts the folder directly under the "Locations" sidebar in Apple Finder.
```applescript
try
    tell application "Finder"
        mount volume "https://webdav-gateway.yourdomain.ch/%TENANT_USERNAME%/" as user name "%TENANT_USERNAME%" with password "%TENANT_PASSWORD%"
    end tell
    display dialog "Success! Your company photo drive is now connected in Finder." buttons {"OK"} default button "OK" with icon note
on error error_message
    display dialog "Connection failed. Please check your credentials. Error: " & error_message buttons {"OK"} default button "OK" with icon stop
end try
```

---

## 6. Advantages of This Architecture
1. **Unburdened VPS (0% File Transfer Load):** High-bandwidth uploads and downloads are handled directly between S3, Cloudflare, and the clients.
2. **Instant Directory Listings:** Project Managers view images via WebDAV dynamically (On-Demand), avoiding local storage costs.
3. **No Software Needed:** Utilizes native OS capabilities. A single click maps the drive.
