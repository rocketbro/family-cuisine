// Headers on every response. The CSP is what makes a poisoned recipe harmless: even if text from
// a hostile page reached the screen as markup, no script runs and no picture loads from elsewhere.
import { secureHeaders } from 'hono/secure-headers';

export function securityHeaders() {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // React sets inline styles through the DOM, which CSP allows; no style attributes or tags.
      styleSrc: ["'self'"],
      // blob: is photo previews before upload and recordings kept on the phone.
      imgSrc: ["'self'", 'https://images.unsplash.com', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    // Not Hono's no-referrer: that makes browsers send "Origin: null" on form posts, which the
    // access page uses. This still gives other sites nothing.
    referrerPolicy: 'same-origin',
    // Self-hosters may be on plain http on a LAN, and HSTS would outlive any change of mind.
    strictTransportSecurity: false,
    xFrameOptions: 'DENY',
  });
}
