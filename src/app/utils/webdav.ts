import { s3Client } from '../constants/aws';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import config from '../config';
import { Request, Response } from 'express';
import { PassThrough, Readable } from 'stream';

const BUCKET = config.aws.bucket as string;

// The public WebDAV URL is keyed by a friendly username, while S3 is isolated
// by the immutable company id:
// /api/v1/webdav/comp_acme/Project_A/photo.jpg
// -> workphotos/<companyId>/Project_A/photo.jpg
function pathToS3Key(reqPath: string, webdavUsername: string, companyId: string): string {
  const stripped = reqPath.replace(/^\/api\/v1\/webdav\/?/, '').replace(/^\/+|\/+$/g, '');
  const segments = stripped.split('/').filter(Boolean);

  if (segments[0] === webdavUsername) segments.shift();

  const relativePath = segments.join('/');
  return relativePath
    ? `workphotos/${companyId}/${relativePath}`
    : `workphotos/${companyId}`;
}

function s3KeyToWebDAVPath(
  s3Key: string,
  companyId: string,
  webdavUsername: string,
): string {
  const companyPrefix = `workphotos/${companyId}/`;
  const relativePath = s3Key.startsWith(companyPrefix)
    ? s3Key.slice(companyPrefix.length)
    : '';

  return `/api/v1/webdav/${webdavUsername}/${relativePath}`;
}

// Build a PROPFIND multi-status XML response
function buildPropfind(entries: { href: string; isDir: boolean; size: number; mtime: Date | null }[]): string {
  const items = entries.map((e) => {
    const modified = e.mtime ? e.mtime.toUTCString() : new Date(0).toUTCString();
    const resourceType = e.isDir ? '<D:collection/>' : '';
    const contentLength = e.isDir ? '' : `<D:getcontentlength>${e.size}</D:getcontentlength>`;
    return `
  <D:response>
    <D:href>${e.href}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${e.href.split('/').filter(Boolean).pop() || '/'}</D:displayname>
        <D:resourcetype>${resourceType}</D:resourcetype>
        <D:getlastmodified>${modified}</D:getlastmodified>
        ${contentLength}
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${items}
</D:multistatus>`;
}

export async function handleWebDAV(req: Request, res: Response): Promise<void> {
  const method = req.method.toUpperCase();
  const reqPath = req.path;
  const companyId = (req as any).webdavCompanyId as string;
  const webdavUsername = (req as any).webdavUsername as string;

  if (!companyId || !webdavUsername) {
    res.status(403).send('WebDAV tenant context is missing');
    return;
  }

  const s3Key = pathToS3Key(reqPath, webdavUsername, companyId);
  const basePath = reqPath.endsWith('/') ? reqPath : reqPath + '/';

  // WebDAV required headers on all responses
  res.setHeader('DAV', '1, 2');
  res.setHeader('MS-Author-Via', 'DAV');
  res.setHeader('Allow', 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, COPY, MOVE, LOCK, UNLOCK');

  // ─── OPTIONS ─────────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ─── PROPFIND (Directory / File Listing) ─────────────────────────────────
  if (method === 'PROPFIND') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');

    try {
      const depth = String(req.headers.depth ?? 'infinity').toLowerCase();
      const prefix = s3Key.endsWith('/') ? s3Key : s3Key + '/';
      const entries: { href: string; isDir: boolean; size: number; mtime: Date | null }[] = [];

      // Include the requested directory itself
      entries.push({ href: basePath, isDir: true, size: 0, mtime: null });

      // Depth: 0 is a capability/property probe. Returning descendants here
      // violates WebDAV semantics and Windows WebClient rejects the mount.
      if (depth !== '0') {
        const listCmd = new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: prefix,
          Delimiter: '/',
        });

        const data = await s3Client.send(listCmd);

        // Immediate sub-folders
        if (data.CommonPrefixes) {
          for (const cp of data.CommonPrefixes) {
            if (cp.Prefix) {
              entries.push({
                href: s3KeyToWebDAVPath(cp.Prefix, companyId, webdavUsername),
                isDir: true,
                size: 0,
                mtime: null,
              });
            }
          }
        }

        // Immediate files
        if (data.Contents) {
          for (const obj of data.Contents) {
            if (obj.Key && obj.Key !== prefix) {
              entries.push({
                href: s3KeyToWebDAVPath(obj.Key, companyId, webdavUsername),
                isDir: false,
                size: obj.Size || 0,
                mtime: obj.LastModified || null,
              });
            }
          }
        }
      }

      const xml = buildPropfind(entries);
      res.status(207).send(xml);
    } catch (err: any) {
      console.error('[WebDAV PROPFIND error]', err);
      res.status(500).send('Internal Server Error');
    }
    return;
  }

  // ─── GET (Stream file from S3) ────────────────────────────────────────────
  if (method === 'GET' || method === 'HEAD') {
    if (!s3Key) {
      res.status(404).end();
      return;
    }
    try {
      const headCmd = new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key });
      const meta = await s3Client.send(headCmd);

      res.setHeader('Content-Type', meta.ContentType || 'application/octet-stream');
      res.setHeader('Content-Length', meta.ContentLength || 0);
      if (meta.LastModified) res.setHeader('Last-Modified', meta.LastModified.toUTCString());

      if (method === 'HEAD') {
        res.status(200).end();
        return;
      }

      const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
      const obj = await s3Client.send(getCmd);
      if (obj.Body instanceof Readable) {
        obj.Body.pipe(res);
      } else {
        Readable.from(obj.Body as any).pipe(res);
      }
    } catch (err: any) {
      if (err.name === 'NoSuchKey') {
        res.status(404).end();
      } else {
        console.error('[WebDAV GET error]', err);
        res.status(500).end();
      }
    }
    return;
  }

  // ─── PUT (Upload file to S3) ───────────────────────────────────────────────
  if (method === 'PUT') {
    if (!s3Key) {
      res.status(400).end();
      return;
    }
    try {
      const passThrough = new PassThrough();
      req.pipe(passThrough);

      const uploader = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET,
          Key: s3Key,
          Body: passThrough,
          ContentType: req.headers['content-type'] || 'application/octet-stream',
        },
      });
      await uploader.done();
      res.status(201).end();
    } catch (err: any) {
      console.error('[WebDAV PUT error]', err);
      res.status(500).end();
    }
    return;
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────
  if (method === 'DELETE') {
    if (!s3Key) {
      res.status(400).end();
      return;
    }
    try {
      const delCmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key });
      await s3Client.send(delCmd);
      res.status(204).end();
    } catch (err: any) {
      console.error('[WebDAV DELETE error]', err);
      res.status(500).end();
    }
    return;
  }

  // ─── MKCOL (Create folder) ────────────────────────────────────────────────
  if (method === 'MKCOL') {
    // S3 is flat; simulate MKCOL success
    res.status(201).end();
    return;
  }

  // ─── LOCK / UNLOCK (required by Windows WebClient) ───────────────────────
  if (method === 'LOCK') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(`<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:timeout>Second-3600</D:timeout>
      <D:locktoken><D:href>urn:uuid:${Date.now()}</D:href></D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`);
    return;
  }

  if (method === 'UNLOCK') {
    res.status(204).end();
    return;
  }

  res.status(405).end();
}
