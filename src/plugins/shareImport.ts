import { registerPlugin } from '@capacitor/core'

export interface ShareImportPlugin {
  getPendingSharedText(): Promise<{ text: string | null }>
  clearPendingSharedText(): Promise<void>
}

export const ShareImport = registerPlugin<ShareImportPlugin>('ShareImport')
