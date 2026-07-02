// @ts-nocheck
import { v2 as webdav } from 'webdav-server';
import { s3Client } from '../constants/aws';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import config from '../config';
import { Readable, Writable } from 'stream';

// Custom S3 File System to bridge webdav-server with Infomaniak S3
export class S3FileSystem extends webdav.FileSystem {
  private bucket: string;

  constructor() {
    super(new webdav.LocalLockManager(), new webdav.LocalPropertyManager());
    this.bucket = config.aws.bucket as string;
  }

  protected _stat(
    path: webdav.Path, 
    ctx: webdav.FSInfo, 
    callback: webdav.SimpleCallback<webdav.ResourceHelper>
  ) {
    const key = this.getKey(path);
    if (!key || key === '') {
      // Root folder
      callback(null, {
        type: webdav.ResourceType.Directory,
        creationDate: 0,
        lastModifiedDate: 0,
        size: 0
      });
      return;
    }

    // Check if key behaves like a folder (List objects under prefix)
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: key + '/',
      MaxKeys: 1
    });

    s3Client.send(listCommand).then((data) => {
      if (data.Contents && data.Contents.length > 0) {
        callback(null, {
          type: webdav.ResourceType.Directory,
          creationDate: 0,
          lastModifiedDate: 0,
          size: 0
        });
      } else {
        // It's a file
        const headCommand = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key
        });
        s3Client.send(headCommand).then((metadata) => {
          callback(null, {
            type: webdav.ResourceType.File,
            creationDate: metadata.LastModified ? metadata.LastModified.getTime() : 0,
            lastModifiedDate: metadata.LastModified ? metadata.LastModified.getTime() : 0,
            size: metadata.ContentLength || 0
          });
        }).catch(() => {
          // If S3 head fails, check if we can list it as a folder without ending slash
          const checkFolderCommand = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: key + '/',
            MaxKeys: 1
          });
          s3Client.send(checkFolderCommand).then((dataFolder) => {
            if (dataFolder.Contents && dataFolder.Contents.length > 0) {
              callback(null, {
                type: webdav.ResourceType.Directory,
                creationDate: 0,
                lastModifiedDate: 0,
                size: 0
              });
            } else {
              callback(new Error('Resource not found'));
            }
          }).catch((err) => {
            callback(err);
          });
        });
      }
    }).catch((err) => {
      callback(err);
    });
  }

  protected _readdir(
    path: webdav.Path, 
    ctx: webdav.FSInfo, 
    callback: webdav.SimpleCallback<string[] | webdav.Path[]>
  ) {
    const key = this.getKey(path);
    const prefix = key ? key + '/' : '';

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: '/'
    });

    s3Client.send(command).then((data) => {
      const results: string[] = [];

      // Folders
      if (data.CommonPrefixes) {
        for (const p of data.CommonPrefixes) {
          if (p.Prefix) {
            const folderName = p.Prefix.slice(prefix.length, -1);
            if (folderName) results.push(folderName);
          }
        }
      }

      // Files
      if (data.Contents) {
        for (const c of data.Contents) {
          if (c.Key && c.Key !== prefix) {
            const fileName = c.Key.slice(prefix.length);
            if (fileName) results.push(fileName);
          }
        }
      }

      callback(null, results);
    }).catch((err) => {
      callback(err);
    });
  }

  protected _openReadStream(
    path: webdav.Path, 
    ctx: webdav.FSInfo, 
    callback: webdav.SimpleCallback<Readable>
  ) {
    const key = this.getKey(path);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    s3Client.send(command).then((data) => {
      if (data.Body instanceof Readable) {
        callback(null, data.Body);
      } else {
        // Handle stream conversion if body is not directly readable (depends on runtime environment)
        const nodeReadable = Readable.from(data.Body as any);
        callback(null, nodeReadable);
      }
    }).catch((err) => {
      callback(err);
    });
  }

  protected _openWriteStream(
    path: webdav.Path, 
    ctx: webdav.FSInfo, 
    callback: webdav.SimpleCallback<Writable>
  ) {
    const key = this.getKey(path);
    const passThrough = new (require('stream').PassThrough)();

    const uploader = new Upload({
      client: s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: passThrough
      }
    });

    uploader.done().then(() => {
      console.log(`[WebDAV] Uploaded successfully: ${key}`);
    }).catch((err) => {
      console.error(`[WebDAV] Upload error: ${err.message}`);
    });

    callback(null, passThrough);
  }

  protected _delete(
    path: webdav.Path, 
    ctx: webdav.FSInfo, 
    callback: webdav.SimpleCallback<boolean>
  ) {
    const key = this.getKey(path);
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    s3Client.send(command).then(() => {
      callback(null, true);
    }).catch((err) => {
      callback(err);
    });
  }

  private getKey(path: webdav.Path): string {
    const cleanPath = path.toString().replace(/^\//, '');
    return cleanPath ? `workphotos/${cleanPath}` : '';
  }
}

// Instantiate S3 File System and WebDAV Server middleware
const s3FileSystem = new S3FileSystem();
export const webdavServer = new webdav.WebDAVServer({
  port: 0 // middleware mode
});

// Mount filesystem on root
webdavServer.setFileSystemSync('/', s3FileSystem);
