# Work Photo Upload এবং WebDAV PC Setup — বাংলা Integration Guide

এই ডকুমেন্টটি দুই ধরনের integration-এর জন্য:

1. Mobile App Developer — Worker কীভাবে সরাসরি Infomaniak S3-তে work photo upload করবে
2. Frontend Developer — Project Manager কীভাবে WebDAV credentials দেখবে এবং Windows/Mac setup script download করবে

## ১. সাধারণ তথ্য

### Base URL

Production:

```text
https://api.baulinse.ch/api/v1
```

এই guide-এর উদাহরণে:

```text
{{baseUrl}} = https://api.baulinse.ch/api/v1
```

### Authentication

Backend API-তে JWT token পাঠাতে হবে:

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

তবে presigned `uploadUrl` ব্যবহার করে S3-তে PUT করার সময় কোনো JWT, Bearer token বা Basic Auth পাঠানো যাবে না।

### Standard JSON response format

সফল response সাধারণত:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": {}
}
```

ব্যর্থ response সাধারণত:

```json
{
  "success": false,
  "message": "Error message",
  "errorSources": [
    {
      "path": "",
      "message": "Error message"
    }
  ],
  "err": {
    "statusCode": 400
  },
  "stack": null
}
```

---

# Part A — Mobile App: Worker Work Photo Upload

## ২. সম্পূর্ণ upload flow

প্রতিটি ছবির জন্য এই তিনটি step ধারাবাহিকভাবে সম্পন্ন করতে হবে:

```text
GET presigned-url
        ↓
PUT raw image binary to uploadUrl
        ↓ (শুধু PUT সফল হলে)
POST save-metadata
```

একটি ছবির জন্য `/presigned-url` একবারই call করা উচিত। একই response-এর `uploadUrl` এবং `fileKey` পরবর্তী দুই step-এ ব্যবহার করতে হবে।

## ৩. আগে project নির্বাচন করা

Worker-এর company ID সাধারণত login/profile response থেকে পাওয়া যাবে। Project list প্রয়োজন হলে:

### API

```http
GET {{baseUrl}}/projects/company/<COMPANY_ID>
```

### Roles

- `worker`
- `project_manager`
- `admin`

### Headers

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Example

```http
GET {{baseUrl}}/projects/company/69fee011855b1a402865f0cb
```

Project response থেকে নির্বাচিত project-এর:

- `_id` → Step 3-এর `project`
- `name` → Step 1-এর `projectName`

এই দুই value একই project-এর হতে হবে।

---

## ৪. Step 1 — Presigned upload URL নেওয়া

### API

```http
GET {{baseUrl}}/work-photos/presigned-url
```

### Roles

- `worker`
- `project_manager`

### Headers

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

এই request-এ JSON body নেই।

### Query parameters

| Parameter | Type | Required | Example | ব্যাখ্যা |
|---|---:|---:|---|---|
| `fileName` | string | হ্যাঁ | `site_photo.jpg` | Original filename; backend unsafe character sanitize করবে |
| `contentType` | string | হ্যাঁ | `image/jpeg` | Allowed: `image/jpeg`, `image/png`; `image/jpg` দিলে backend `image/jpeg` করবে |
| `projectName` | string | না | `Project A` | না দিলে `Others`; backend space-কে `_` করবে |

### Example request

```http
GET {{baseUrl}}/work-photos/presigned-url?fileName=site_photo.jpg&contentType=image/jpeg&projectName=Project%20A
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Success response — `200 OK`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Presigned URL generated successfully!",
  "data": {
    "uploadUrl": "https://s3.pub1.infomaniak.cloud/baulinse-workphotos/workphotos/69fee011855b1a402865f0cb/Project_A/1783235752530_site_photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
    "fileKey": "workphotos/69fee011855b1a402865f0cb/Project_A/1783235752530_site_photo.jpg",
    "contentType": "image/jpeg",
    "uploadHeaders": {
      "Content-Type": "image/jpeg"
    }
  }
}
```

### Response fields

| Field | ব্যবহার |
|---|---|
| `data.uploadUrl` | Step 2-এর PUT URL; পাঁচ মিনিটের জন্য valid |
| `data.fileKey` | Step 3-এর metadata body-তে পাঠাতে হবে |
| `data.contentType` | Backend-normalized MIME type |
| `data.uploadHeaders` | Step 2-এ exact headers হিসেবে ব্যবহার করতে হবে |

`uploadUrl` log, database বা analytics-এ স্থায়ীভাবে save করা উচিত নয়। এটি temporary credential-এর মতো sensitive।

---

## ৫. Step 2 — সরাসরি Infomaniak S3-তে ছবি upload

এই request BauLinse backend-এ যাবে না। Step 1 থেকে পাওয়া complete `uploadUrl`-এ যাবে।

### Request

```http
PUT <data.uploadUrl>
Content-Type: <data.uploadHeaders.Content-Type>
```

### Authentication

```text
No Auth
```

এখানে নিচের কোনো header পাঠাবেন না:

- `Authorization`
- JWT token
- `x-amz-checksum-crc32`
- `x-amz-sdk-checksum-algorithm`
- Multipart boundary

### Body

Body হবে image-এর raw binary bytes:

```text
Blob / File / byte array
```

`multipart/form-data`, JSON বা base64 string পাঠানো যাবে না।

### Postman configuration

1. Method: `PUT`
2. URL: Step 1-এর full `uploadUrl`
3. Authorization tab: `No Auth`
4. Header: `Content-Type: image/jpeg` অথবা response-এর exact value
5. Body → `binary` → image file select

### Success response

সাধারণত:

```text
HTTP 200 OK
```

Response body empty হতে পারে। Empty body মানে failure নয়; HTTP status check করতে হবে।

### বাধ্যতামূলক client rule

```ts
if (!uploadResponse.ok) {
  // Error দেখান/retry করুন। save-metadata call করবেন না।
  throw new Error(await uploadResponse.text())
}
```

### TypeScript/React Native-style example

```ts
const presigned = await api.get('/work-photos/presigned-url', {
  params: {
    fileName: file.name,
    contentType: file.type,
    projectName: selectedProject.name,
  },
})

const { uploadUrl, fileKey, uploadHeaders } = presigned.data.data

const imageResponse = await fetch(file.uri)
const imageBlob = await imageResponse.blob()

const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  headers: uploadHeaders,
  body: imageBlob,
})

if (!uploadResponse.ok) {
  const s3Error = await uploadResponse.text()
  throw new Error(`S3 upload failed: ${uploadResponse.status} ${s3Error}`)
}
```

> React Native library অনুযায়ী URI থেকে Blob তৈরির implementation আলাদা হতে পারে। মূল নিয়ম: PUT body raw file bytes হতে হবে।

---

## ৬. Step 3 — MongoDB-তে metadata save করা

Step 2 থেকে `200 OK` পাওয়ার পরেই এই API call করতে হবে।

### API

```http
POST {{baseUrl}}/work-photos/save-metadata
```

### Roles

- `worker`
- `project_manager`

### Headers

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
```

### JSON body

```json
{
  "fileKey": "workphotos/69fee011855b1a402865f0cb/Project_A/1783235752530_site_photo.jpg",
  "project": "6a0aa0f7f53591e911143422",
  "latitude": 23.8103,
  "longitude": 90.4125,
  "location": "Banani, Dhaka",
  "captureAt": "2026-07-05T06:40:38.000Z"
}
```

### Body fields

| Field | Type | Required | ব্যাখ্যা |
|---|---:|---:|---|
| `fileKey` | string | হ্যাঁ | Step 1 থেকে পাওয়া exact `data.fileKey`; নিজে বানানো যাবে না |
| `project` | MongoDB ObjectId string | না | নির্বাচিত Project document-এর `_id`; company ID নয় |
| `latitude` | number | হ্যাঁ | GPS latitude; string হিসেবে পাঠানো যাবে না |
| `longitude` | number | হ্যাঁ | GPS longitude; string হিসেবে পাঠানো যাবে না |
| `location` | string | হ্যাঁ | Human-readable location |
| `captureAt` | string | হ্যাঁ | ISO-8601 timestamp ব্যবহার করুন |

`project` বাদ দিলে backend company-এর `Others` project resolve করার চেষ্টা করবে। Step 1-এও সেক্ষেত্রে `projectName` বাদ দিন বা `Others` দিন।

### Success response — `201 Created`

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Photo metadata saved successfully!",
  "data": {
    "_id": "6a4a04cec72ab27a38488f35",
    "author": "WORKER_USER_ID",
    "company": "69fee011855b1a402865f0cb",
    "project": "6a0aa0f7f53591e911143422",
    "image": "https://s3.pub1.infomaniak.cloud/baulinse-workphotos/workphotos/69fee011855b1a402865f0cb/Project_A/1783235752530_site_photo.jpg",
    "latitude": 23.8103,
    "longitude": 90.4125,
    "location": "Banani, Dhaka",
    "locationUrl": "https://www.google.com/maps?q=23.8103,90.4125",
    "captureAt": "2026-07-05T06:40:38.000Z",
    "s3Key": "workphotos/69fee011855b1a402865f0cb/Project_A/1783235752530_site_photo.jpg",
    "createdAt": "2026-07-05T06:41:10.000Z",
    "updatedAt": "2026-07-05T06:41:10.000Z"
  }
}
```

### সম্ভাব্য errors

#### File S3-তে নেই — `400`

```json
{
  "success": false,
  "message": "File not found in S3: workphotos/..."
}
```

কারণ:

- Step 2 call হয়নি
- PUT response success ছিল না
- Expired/পুরোনো upload URL ব্যবহার হয়েছে
- অন্য presigned response-এর `fileKey` পাঠানো হয়েছে

#### অন্য company-এর fileKey — `403`

```json
{
  "success": false,
  "message": "Invalid file key for this company!"
}
```

---

## ৭. Mobile upload-এর complete example

```ts
async function uploadWorkPhoto({ file, project, location }) {
  // Step 1
  const presignedResponse = await api.get('/work-photos/presigned-url', {
    params: {
      fileName: file.name,
      contentType: file.type,
      projectName: project?.name ?? 'Others',
    },
  })

  const { uploadUrl, fileKey, uploadHeaders } = presignedResponse.data.data

  // Step 2
  const localFileResponse = await fetch(file.uri)
  const blob = await localFileResponse.blob()
  const s3Response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: blob,
  })

  if (!s3Response.ok) {
    throw new Error(`S3 upload failed (${s3Response.status})`)
  }

  // Step 3
  const metadataResponse = await api.post('/work-photos/save-metadata', {
    fileKey,
    project: project?._id,
    latitude: location.latitude,
    longitude: location.longitude,
    location: location.name,
    captureAt: new Date(file.captureTime ?? Date.now()).toISOString(),
  })

  return metadataResponse.data.data
}
```

### Retry policy

- Step 1 fail → Step 1 retry করা যায়
- Step 2 fail → URL expire না হলে একই `uploadUrl` দিয়ে retry করা যায়
- URL expire হলে → নতুন Step 1 call করে নতুন `uploadUrl/fileKey` pair নিতে হবে
- Step 2 success কিন্তু Step 3 network fail → একই `fileKey` দিয়ে Step 3 retry করুন; নতুন presigned URL নেবেন না
- একই button press থেকে duplicate flow যেন না চলে; loading/submit lock ব্যবহার করুন

---

## ৮. Backend fallback upload API

Direct-to-S3 flow troubleshoot করতে temporary fallback হিসেবে:

```http
POST {{baseUrl}}/work-photos/upload-direct
```

### Headers

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: multipart/form-data
```

### Form-data

| Key | Type | Required |
|---|---|---:|
| `image` | File | হ্যাঁ |
| `projectName` | Text | না |
| `latitude` | Text/number | না |
| `longitude` | Text/number | না |
| `location` | Text | না |
| `captureAt` | Text | না |

এই endpoint-এ file VPS/backend হয়ে S3-তে যায়। Production mobile flow হিসেবে তিন-step direct upload ব্যবহার করাই recommended।

---

# Part B — Frontend Dashboard: Company WebDAV/PC Setup

## ৯. Architecture পরিষ্কারভাবে বোঝা

PC Setup-এর custom WebDAV gateway সরাসরি company-এর S3 prefix পড়ে:

```text
workphotos/<companyId>/<projectName>/<fileName>
```

তাই PC drive mount করার জন্য `/users/connect-nextcloud` বাধ্যতামূলক নয়। Nextcloud connection একটি optional external mirror integration।

## ১০. PC Setup page load হলে profile নেওয়া

### API

```http
GET {{baseUrl}}/users/my-profile
```

### Roles

- `project_manager`
- `worker`
- `admin`

PC Setup page শুধু `project_manager`-কে দেখানো উচিত।

### Headers

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Success response — `200 OK`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "My profile fetched successfully!",
  "data": {
    "_id": "69fee011855b1a402865f0cb",
    "name": "Jane Smith",
    "username": "janesmit3",
    "company": {
      "_id": "69fee011855b1a402865f0cb",
      "name": "Jane Smith"
    },
    "role": "project_manager",
    "webdavUsername": "comp_janesmit3",
    "webdavPassword": "EXAMPLE_PASSWORD"
  }
}
```

### Frontend-এ তৈরি করা WebDAV URL

```ts
const webdavUrl = `${API_ORIGIN}/api/v1/webdav/${profile.webdavUsername}/`
```

Production example:

```text
https://api.baulinse.ch/api/v1/webdav/comp_janesmit3/
```

### PC Setup UI-তে দেখাবেন

- WebDAV URL
- Username
- Password masked অবস্থায়
- Show/Hide password button
- Copy button
- Download Windows Script
- Download Mac Script

### Security rules

- `webdavPassword` localStorage/sessionStorage-এ save করবেন না
- console, analytics বা error-reporting tool-এ log করবেন না
- default অবস্থায় password masked রাখুন
- page unmount হলে sensitive state clear করুন
- script response cache করবেন না

---

## ১১. Windows setup script download

### API

```http
GET {{baseUrl}}/work-photos/download-script?os=windows
```

### Role

- শুধু `project_manager`

### Headers

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Accept: application/octet-stream
```

### Query parameters

| Parameter | Required | Value |
|---|---:|---|
| `os` | হ্যাঁ | `windows` |

### Response

```http
HTTP 200 OK
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="connect-drive.bat"
```

Response JSON নয়; এটি binary/text file download response।

### Browser fetch example

```ts
async function downloadWindowsScript(token: string) {
  const response = await fetch(
    `${API_BASE_URL}/work-photos/download-script?os=windows`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/octet-stream',
      },
    },
  )

  if (!response.ok) throw new Error('Windows script download failed')

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = 'connect-drive.bat'
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}
```

### Windows user instruction

1. File-এর নাম নিশ্চিত করুন: `connect-drive.bat`, `.bat.txt` নয়
2. File-টি **Run as administrator করবেন না**
3. সাধারণভাবে double-click করুন
4. Windows UAC prompt এলে `Yes` দিন
5. Script প্রয়োজনীয় WebClient configuration elevated subprocess-এ করবে
6. Z: drive normal user session-এ mount হবে

---

## ১২. macOS setup script download

### API

```http
GET {{baseUrl}}/work-photos/download-script?os=mac
```

### Role

- শুধু `project_manager`

### Headers

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Accept: text/plain
```

### Response

```http
HTTP 200 OK
Content-Type: text/plain
Content-Disposition: attachment; filename="mount-drive.scpt"
```

### Frontend download

Windows example-এর মতো blob download করবেন, শুধু filename হবে:

```text
mount-drive.scpt
```

### macOS user instruction

1. `mount-drive.scpt` double-click করুন
2. Script Editor খুললে Run চাপুন
3. macOS permission prompt এলে allow করুন
4. Mounted drive Finder sidebar/Locations-এ দেখা যাবে

---

## ১৩. Optional Nextcloud connection

এটি custom S3-backed PC WebDAV drive-এর prerequisite নয়। Company যদি `https://cloud.baulinse.ch` account-এ আলাদা copy রাখতে চায়, তখন ব্যবহার হবে।

### Connect Nextcloud

```http
POST {{baseUrl}}/users/connect-nextcloud
Authorization: Bearer <PROJECT_MANAGER_JWT>
Content-Type: application/json
```

Body:

```json
{
  "username": "nextcloud_username",
  "password": "nextcloud_app_password"
}
```

Success response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Nextcloud connected successfully!",
  "data": {
    "message": "Nextcloud connected successfully!",
    "nextcloudUrl": "https://cloud.baulinse.ch",
    "nextcloudUsername": "nextcloud_username",
    "nextcloudConnected": true
  }
}
```

### Connection status

```http
GET {{baseUrl}}/users/nextcloud-status
Authorization: Bearer <PROJECT_MANAGER_JWT>
```

Example response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Nextcloud status retrieved!",
  "data": {
    "connected": true,
    "url": "https://cloud.baulinse.ch",
    "username": "nextcloud_username",
    "connectedAt": "2026-07-05T07:00:00.000Z"
  }
}
```

### Disconnect Nextcloud

```http
POST {{baseUrl}}/users/disconnect-nextcloud
Authorization: Bearer <PROJECT_MANAGER_JWT>
```

Body প্রয়োজন নেই।

---

## ১৪. WebDAV behaviour এবং refresh

- WebDAV gateway S3 থেকে project folder এবং image list করে
- Image double-click করলে gateway S3 object stream করে
- Windows Explorer directory listing cache করতে পারে
- নতুন image সঙ্গে সঙ্গে না দেখালে `F5`, folder reopen বা drive reconnect লাগতে পারে
- Standard WebDAV real-time push notification দেয় না
- সত্যিকারের background desktop sync প্রয়োজন হলে dedicated sync client প্রয়োজন

---

## ১৫. API summary

| ব্যবহারকারী | Method | Endpoint | Auth | কাজ |
|---|---|---|---|---|
| Mobile | GET | `/projects/company/:companyId` | Bearer | Project list |
| Mobile | GET | `/work-photos/presigned-url` | Bearer | Temporary S3 upload URL |
| Mobile → S3 | PUT | `data.uploadUrl` | No Auth | Raw image upload |
| Mobile | POST | `/work-photos/save-metadata` | Bearer | MongoDB record save |
| Mobile fallback | POST | `/work-photos/upload-direct` | Bearer | Backend-mediated upload |
| Dashboard | GET | `/users/my-profile` | Bearer | WebDAV credentials |
| Dashboard | GET | `/work-photos/download-script?os=windows` | Bearer | `.bat` download |
| Dashboard | GET | `/work-photos/download-script?os=mac` | Bearer | `.scpt` download |
| Dashboard optional | POST | `/users/connect-nextcloud` | Bearer | Nextcloud mirror connect |
| Dashboard optional | GET | `/users/nextcloud-status` | Bearer | Nextcloud status |
| Dashboard optional | POST | `/users/disconnect-nextcloud` | Bearer | Nextcloud disconnect |

## ১৬. Final implementation checklist

### Mobile App

- [ ] একই photo-এর জন্য presigned API duplicate call হচ্ছে না
- [ ] Step 2-এ No Auth
- [ ] Response-এর exact `uploadHeaders` ব্যবহার করা হচ্ছে
- [ ] PUT body raw binary; FormData নয়
- [ ] PUT `200` না হলে metadata API call হচ্ছে না
- [ ] Step 1-এর exact `fileKey` Step 3-এ যাচ্ছে
- [ ] `project` হিসেবে Project `_id` যাচ্ছে; company ID নয়
- [ ] latitude/longitude number
- [ ] captureAt ISO-8601 string

### Frontend Dashboard

- [ ] PC Setup page শুধু project manager-এর জন্য
- [ ] WebDAV password masked এবং log/cache করা হচ্ছে না
- [ ] Download response blob হিসেবে handle হচ্ছে
- [ ] Windows filename `.bat`, `.bat.txt` নয়
- [ ] User-কে normal double-click করতে বলা হচ্ছে
- [ ] Mac filename `.scpt`
- [ ] Nextcloud optional হিসেবে দেখানো হচ্ছে
