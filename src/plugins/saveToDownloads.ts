import { registerPlugin } from '@capacitor/core'

export interface SaveToDownloadsResult {
  uri: string
  fileName: string
}

export interface SaveToDownloadsPlugin {
  saveTextFile(options: {
    fileName: string
    content: string
  }): Promise<SaveToDownloadsResult>
}

export const SaveToDownloads = registerPlugin<SaveToDownloadsPlugin>('SaveToDownloads')
