# Direct S3 Upload & Self-Hosted WebDAV Gateway (Swiss-Made Architecture)

This documentation outlines the architecture and implementation details for integrating a native WebDAV network drive for PC clients (Windows/Mac) connecting directly to an Infomaniak S3 bucket, hosted entirely on your Node.js VPS backend (100% Swiss-Made Policy, No Cloudflare or external proxies).

---

## 1. Architectural Overview

Worker apps upload photos directly to the Infomaniak S3 Bucket using **S3 Presigned URLs** (0% VPS CPU/RAM/Bandwidth load for uploads). Project Managers connect to a **self-hosted WebDAV server** running inside the Express.js app. This server translates WebDAV requests (`PROPFIND`, `GET`, etc.) into S3 API calls on the fly, keeping all data traffic secure and confined within the Swiss Infomaniak ecosystem.

```
+------------------+                   1. Get Presigned URL               +----------------------+
|    Worker App    | ---------------------------------------------------> |  Node.js VPS Server  |
| (Mobile/Web App) | <--------------------------------------------------- |   (Express Backend)  |
+------------------+             2. Return Upload URL & Key               +----------------------+
         |                                                                    ^              ^
         | 3. HTTP PUT (Direct Binary Upload)                                 |              | 5. Mount Drive
         v                                                                    |              |    (Basic Auth)
+------------------+                                                          |              v
|  Infomaniak S3   | <--------------------------------------------------------+     +------------------+
|  Object Storage  |                 4. Stream Files / List Objects                 |Project Manager PC|
+------------------+                                                                | (Explorer/Finder)|
                                                                                    +------------------+
```

---

## 2. Step-by-Step Codebase Implementation

### A. Database Schema
Add WebDAV credentials to the user schema to authenticate Windows/Mac clients.
```typescript
// src/app/modules/user/user.model.ts
webdavUsername: { type: String },
webdavPassword: { type: String }, // Encrypted securely using decrypt/encrypt helpers
```

### B. AWS S3 Presigned URL Helper
```typescript
// src/app/utils/s3.ts
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const generatePresignedUrl = async (fileName: string, contentType: string): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: fileName,
    ContentType: contentType,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes expiry
};
```

### C. WebDAV S3 FileSystem & Server Middleware
```typescript
// src/app/utils/webdav.ts
import { v2 as webdav } from 'webdav-server';
import { s3Client } from '../constants/aws';
import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

export class S3FileSystem extends webdav.FileSystem {
  // Overrides stat, readdir, readStream, writeStream, delete using AWS SDK v3 commands.
  // Translates webdav path `/comp_username/Project/image.jpg` to S3 key `workphotos/comp_username/Project/image.jpg`
}

export const webdavServer = new webdav.WebDAVServer({ port: 0 });
webdavServer.setFileSystemSync('/', new S3FileSystem());
```

### D. Mount WebDAV in Express with Tenant Isolation
```typescript
// src/app.ts
import { v2 as webdav } from 'webdav-server';
import { webdavServer } from './app/utils/webdav';

app.use('/webdav', async (req, res, next) => {
  // 1. Validate Basic Auth (headers.authorization) using MongoDB User credentials
  // 2. Strict Tenant Authorization: Ensure req.path starts with the authenticated user's webdavUsername
  // 3. Handover request to WebDAV Server
  const webdavMiddleware = (webdav as any).extensions.express('/webdav', webdavServer);
  webdavMiddleware(req, res, next);
});
```

---

## ৩. মোবাইল অ্যাপ (Worker) ও ড্যাশবোর্ড (Project Manager) কাজের ধাপ ও API ইন্টিগ্রেশন

নিচে ফ্রন্টএন্ড এবং মোবাইল অ্যাপ ডেভেলপারদের জন্য বাংলায় বিস্তারিত গাইডলাইন দেওয়া হলো:

### ক. মোবাইল অ্যাপ (Worker App) কাজের ধাপসমূহ

মোবাইল অ্যাপ থেকে ছবি আপলোড করার জন্য ধাপে ধাপে নিচের ৩টি এপিআই কল করতে হবে:

#### ১. Presigned URL এবং S3 Key সংগ্রহ করা
ছবি তোলার সাথে সাথে অ্যাপ প্রথমে ব্যাকএন্ডের এই এপিআই-তে হিট করবে:
* **API Endpoint:** `GET /api/v1/work-photos/presigned-url`
* **Headers:** `Authorization: Bearer <Worker_JWT_Token>`
* **Query Parameters:**
  * `fileName`: ফাইলের নাম (যেমন: `work_photo_1.jpg`)
  * `contentType`: ফাইলের ফরম্যাট (যেমন: `image/jpeg` বা `image/png`)
  * `projectName`: প্রজেক্টের নাম (যেমন: `Bridge-Alpha`)
* **Expected Response (200 OK):**
  ```json
  {
    "statusCode": 200,
    "success": true,
    "message": "Presigned URL generated successfully!",
    "data": {
      "uploadUrl": "https://s3.infomaniak.com/bucket-name/workphotos/companyA/Bridge-Alpha/1700000000000_work_photo_1.jpg?Signature=...",
      "fileKey": "companyA/Bridge-Alpha/1700000000000_work_photo_1.jpg"
    }
  }
  ```

#### ২. সরাসরি S3-তে ইমেজ ফাইল আপলোড করা
অ্যাপ প্রথম ধাপের রেসপন্স থেকে `uploadUrl` লিঙ্কটি নিয়ে সরাসরি Infomaniak S3 সার্ভারে ফাইল সাবমিট করবে:
* **API Endpoint:** `<ধাপ ১ থেকে প্রাপ্ত uploadUrl>`
* **Method:** `PUT`
* **Headers:** `Content-Type: image/jpeg` (ধাপ ১ এ পাঠানো ফরম্যাটের সাথে মিলতে হবে)
* **Payload:** ইমেজ ফাইলের বাইনারি ডাটা (Blob, File বা Stream) সরাসরি বডিতে পাঠাতে হবে।
* **Expected Response:** `200 OK` (সরাসরি S3 সার্ভার থেকে আসবে)।

#### ৩. ব্যাকএন্ড ডাটাবেসে ইমেজ মেটাডাটা সেভ করা
আপলোড সম্পন্ন হলে, অ্যাপ ব্যাকএন্ডকে ছবির লোকেশনসহ সেভ করার জন্য রিকোয়েস্ট পাঠাবে:
* **API Endpoint:** `POST /api/v1/work-photos/save-metadata`
* **Headers:** 
  * `Authorization: Bearer <Worker_JWT_Token>`
  * `Content-Type: application/json`
* **Payload (JSON Body):**
  ```json
  {
    "fileKey": "companyA/Bridge-Alpha/1700000000000_work_photo_1.jpg",
    "project": "60d5ec49f1b2c52e88a38c4b", 
    "latitude": 23.8103,
    "longitude": 90.4125,
    "location": "Banani, Dhaka",
    "captureAt": "2026-07-02T11:38:00.000Z"
  }
  ```
* **Expected Response (201 Created):**
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
      "image": "https://s3.infomaniak.com/bucket-name/workphotos/companyA/Bridge-Alpha/1700000000000_work_photo_1.jpg",
      "latitude": 23.8103,
      "longitude": 90.4125,
      "location": "Banani, Dhaka",
      "locationUrl": "https://www.google.com/maps?q=23.8103,90.4125",
      "captureAt": "2026-07-02T11:38:00.000Z",
      "createdAt": "2026-07-02T12:52:45.000Z"
    }
  }
  ```

---

### খ. কাস্টমার পোর্টাল ও প্রজেক্ট ম্যানেজারের কাজের ধাপসমূহ

প্রজেক্ট ম্যানেজার ড্যাশবোর্ড থেকে সহজেই নিচের ধাপে ড্রাইভটি তার কম্পিউটারে কানেক্ট করে নিতে পারবে:

#### ১. ড্যাশবোর্ডে ক্রেডেনশিয়ালস শো করা
ম্যানেজার ড্যাশবোর্ডে লগইন করলে তার প্রোফাইল বা সেটিংস পেজে ডিক্রিপ্ট করা WebDAV ক্রেডেনশিয়াল দেখতে পাবে:
* **WebDAV URL:** `https://[YOUR-VPS-DOMAIN]/webdav/comp_companyA/`
* **Username:** `comp_companyA`
* **Password:** `decrypted_password` (ডাটাবেস থেকে ডিক্রিপ্ট করে কাস্টমার পোর্টালে দেখানো হবে)

#### ২. মাউন্ট স্ক্রিপ্ট ফাইল ডাউনলোড করা
ড্যাশবোর্ডের বাটনে ক্লিক করে অপারেটিং সিস্টেম অনুযায়ী স্ক্রিপ্ট ফাইলটি ডাউনলোড করতে হবে।
* **API Endpoint:** `GET /api/v1/work-photos/download-script`
* **Headers:** `Authorization: Bearer <Manager_JWT_Token>`
* **Query Parameters:**
  * `os`: `windows` অথবা `mac`
* **Expected Response:** 
  * উইন্ডোজের ক্ষেত্রে: `connect-drive.bat` ফাইল ডাউনলোড স্টার্ট হবে।
  * ম্যাকের ক্ষেত্রে: `mount-drive.scpt` ফাইল ডাউনলোড স্টার্ট হবে।
  * ডাইনামিক ক্রেডেনশিয়ালসহ ফাইলগুলোর ভেতর এই লিঙ্কটি সেট থাকবে: `https://[YOUR-VPS-DOMAIN]/webdav/comp_companyA/`

#### ৩. এক ক্লিকে ড্রাইভ ওপেন করা
* প্রজেক্ট ম্যানেজার জাস্ট ডাউনলোড করা ফাইলে ডাবল-ক্লিক করলেই ব্যাকএন্ডের এক্সপ্রেস মিডলওয়্যার হয়ে ইনফোম্যানিয়াক S3-এর সব ইমেজ লাইভ উইন্ডোজ ফাইল এক্সপ্লোরার বা ম্যাক ফাইন্ডারে সিঙ্ক হয়ে চলে আসবে। কোনো আলাদা সফটওয়্যার ইন্সটল বা ফাইল ডাউনলোড করতে হবে না।
