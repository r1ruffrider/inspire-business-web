# Inspire Business Group — Launch Checklist

## Done

- [x] Domain registered (inspirebusinesstechnology.com, via Hostinger)
- [x] Email created and verified working
- [x] Real contact email swapped into ContactFooter.tsx
- [x] Nav overflow fixed (hamburger menu added, tested at 834px and 1280px+)
- [x] BackgroundPaths legibility fixed (radial scrim added)
- [x] Frame counts verified (150/150, consistent across disk/config/dev-server, verify-assets.mjs script added for future reuse)
- [x] Font loading fixed (moved from @import to <link> tags in index.html)
- [x] Lenis scrollbar-drag snap-back fixed (target re-sync on native scroll)
- [x] Hero headline overflow fixed (fitLines() dynamic scaling, tested narrow→wide and wide→narrow on real iOS/Android devices)
- [x] Purple headline contrast fixed (dark outline layered behind glow)
- [x] Deployed to Vercel via GitHub, DNS configured (apex 308-redirects to www, both valid)

## Remaining / optional (not blocking launch)

- [ ] Lighthouse performance pass
- [ ] Cross-browser testing (Safari/Firefox)
- [ ] Accessibility pass (prefers-reduced-motion, alt text, keyboard nav)
- [ ] Analytics setup
