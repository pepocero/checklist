import { webcrypto } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { ApplicationServerKeys, setWebCrypto } from 'webpush-webcrypto'

setWebCrypto(webcrypto)

const keys = await ApplicationServerKeys.generate()
const json = await keys.toJSON()

const subject = 'mailto:contacto@carlinitools.com'
const forWrangler = {
  VAPID_PUBLIC_KEY: json.publicKey,
  VAPID_PRIVATE_KEY: json.privateKey,
  VAPID_SUBJECT: subject,
}

writeFileSync(
  new URL('../.dev.vars.json', import.meta.url),
  `${JSON.stringify(forWrangler, null, 2)}\n`,
)

const dotenv = [
  `VAPID_PUBLIC_KEY=${json.publicKey}`,
  `VAPID_PRIVATE_KEY=${json.privateKey}`,
  `VAPID_SUBJECT=${subject}`,
  '',
].join('\n')

writeFileSync(new URL('../.dev.vars', import.meta.url), dotenv)

console.log('Claves VAPID generadas en worker/.dev.vars y .dev.vars.json (no las subas al repo).')
console.log('')
console.log('Pública:')
console.log(json.publicKey)
console.log('')
console.log('Configura secretos:')
console.log('  npx wrangler secret put VAPID_PUBLIC_KEY')
console.log('  npx wrangler secret put VAPID_PRIVATE_KEY')
console.log('')
console.log('En Cloudflare Pages define:')
console.log(`  VITE_PUSH_API_URL=https://checklist-reminders.<subdominio>.workers.dev`)
console.log(`  VITE_VAPID_PUBLIC_KEY=${json.publicKey}`)
