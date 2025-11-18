import crypto from 'crypto'
import config from '../config'

const ALGORITHM = 'aes-256-cbc'
const KEY = crypto.createHash('sha256').update(config.encryption_key!).digest() // 32 bytes
const IV_LENGTH = 16 // AES block size

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export const decrypt = (hash: string): string => {
  const [iv, encryptedText] = hash.split(':')
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString()
}