// Browser: keeps every card's status dot (`[data-ping-url]`, from EntryCard) fresh. The package owns
// the loop; this site chooses who asks:
//  - via the Worker (default): GET /api/ping, which asks from Cloudflare. Public hosts only.
//  - via the browser (`data-ping-via="browser"`): the visitor's own browser, the only way to reach
//    LAN / homelab hosts (opaque response: up/down and timing, not the status code).
import { pingViaBrowser, pingViaEndpoint, startPingRefresh } from '@zkevinly/ui/lib/ping-refresh';

const viaWorker = pingViaEndpoint('/api/ping');
const viaBrowser = pingViaBrowser();

startPingRefresh({
  check: (url, card) => (card.dataset.pingVia === 'browser' ? viaBrowser(url) : viaWorker(url)),
  key: (url, card) => `${card.dataset.pingVia === 'browser' ? 'browser' : 'worker'} ${url}`,
});
