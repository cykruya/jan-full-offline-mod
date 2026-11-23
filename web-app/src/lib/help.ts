import { getServiceHub } from '@/hooks/useServiceHub'
import { openExternalUrl } from '@/lib/externalLink'

/**
 * Opens a page of the bundled help file, named by its path inside the file
 * (e.g. `desktop/quickstart.html`). Only the Windows installer carries the
 * file; elsewhere the same page opens on the documentation site.
 */
export function openHelp(topic: string): void {
  if (!IS_WINDOWS) return openExternalUrl(`https://www.jan.ai/docs/${topic.replace('.html', '')}`)
  void getServiceHub().core().invoke('open_help', { topic }).catch((error) => console.error('Failed to open the help file:', error))
}
