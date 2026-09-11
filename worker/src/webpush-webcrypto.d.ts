declare module 'webpush-webcrypto' {
  export class ApplicationServerKeys {
    static generate(): Promise<ApplicationServerKeys>
    static fromJSON(json: {
      publicKey: string
      privateKey: string
    }): Promise<ApplicationServerKeys>
    toJSON(): Promise<{ publicKey: string; privateKey: string }>
  }

  export function setWebCrypto(crypto: Crypto): void

  export function generatePushHTTPRequest(options: {
    applicationServerKeys: ApplicationServerKeys
    payload: string
    target: {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }
    adminContact: string
    ttl: number
    urgency?: string
  }): Promise<{
    headers: HeadersInit
    body: ArrayBuffer
    endpoint: string
  }>
}
