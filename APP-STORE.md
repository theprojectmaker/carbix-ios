# Carbix - App Store submission notes

Bundle ID `com.solyapps.carbix`, EAS project `@solomonsasson/carbix`. No build has been run yet.

## Before you can submit (things only you can do)
1. Apple Developer membership must finish verifying ("no team associated" today). No TestFlight/App Store build works until then.
2. Deploy `motordex/public/privacy.html` so `https://motordex.pages.dev/privacy.html` is live (the app links to it in Settings).
3. Decide the support email. Reports go to `SUPPORT_EMAIL` in `src/lib/moderation.ts` (currently your Gmail).
4. Run builds only when you say so (EAS free plan is 15 iOS builds a month shared by 3 apps):
   `npx eas-cli build --platform ios --profile production`, then `npx eas-cli submit --platform ios`.

## Store text (draft)
- Name: Carbix
- Subtitle: Spot real cars. Fill your Bix.
- Promo: Point your camera at cars you see, identify them, and collect them in a pixel-art garage of thousands of models.
- Keywords: cars,car spotting,collection,garage,pixel,automotive,vehicle,identify,spotter,racing
- Category: Games (or Entertainment). Age rating: 4+ if user names are moderated by block/report; otherwise 12+ for infrequent user-generated content.

## App Review notes (paste into the review notes box)
- Carbix is a native iOS app (React Native / Expo), not a web wrapper. All screens are native; game logic runs on device.
- No account or sign-in is required. A spotter name is typed locally. There is no third-party login, so Sign in with Apple does not apply (guideline 4.8).
- Camera: used only when the user taps Capture, to photograph a car. That one photo is sent to our server to identify the make and model and is not kept.
- Location (optional, "when in use"): pins where a car was spotted on the user's own map. Never sent to other users.
- User-generated content (names, catch posts, live sessions): each name in the feed, leaderboard and live sessions has BLOCK and REPORT. Settings lists blocked spotters and has a "Report a problem" button. Reports go to the support email.
- Original art: all sprites, icons and UI are original to this app. It is not affiliated with any other app named MotorDex.
- Demo: open the app, tap Scan, Upload a car photo. The identify animation and Catch card appear. No login needed.

## Known gaps before a real release
- Push notifications, phone home-screen icon packs, gifts and Season Rewind are not ported.
- Sprites and API come from motordex.pages.dev; if that site is down the Bix art and scanning do not load.
- Nothing here has been run on a real iPhone by the author; test on device before submitting.
