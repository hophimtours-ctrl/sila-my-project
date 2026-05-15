# BookMeNow
BookMeNow is a Next.js application for accommodation search and booking, with Firebase deployment and Firestore-backed synchronization.
## Getting Started
Run locally:
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.
Useful scripts:
```bash
npm run lint
npm run build
npm run db:push
npm run db:seed
```
## Firestore-First Verification (Booking Flow)
### Findings summary
The booking flow was verified against the deployed environment with Firestore inspection.
Observed behavior:
- Firestore booking documents are created during booking submission.
- A new booking document appeared in Firestore after the test booking attempt.
- In the tested run, payment failed (`פעולת התשלום נכשלה`), and the booking document status in Firestore became `CANCELED`.
- This confirms Firestore persistence is active for booking writes even when payment fails.
Example verified document path from the run:
- `projects/bookmenow-7f4f2/databases/(default)/documents/bookings/cmp6upu2t000us601gce5bfn0`
### Verification steps
1. Run the verification script:
```bash
npm run verify:firestore-booking
```
2. When prompted by the script, complete the booking flow in the deployed app:
   - Open `https://my-web-app--bookmenow-7f4f2.us-east4.hosted.app/register`
   - Register a fresh guest user
   - Search accommodations
   - Open a real hotel (non-mock)
   - Select dates and continue to payment page
   - Submit payment form with a tokenized value in `paymentToken`
3. Return to terminal and press Enter; the script will:
   - Re-query Firestore
   - Print newly created booking document paths
   - Print detected booking statuses
   - Print a direct console link to the latest document
4. Optional: override defaults (project/base URL/page size):
```bash
VERIFY_FIRESTORE_PROJECT_ID=bookmenow-7f4f2 VERIFY_APP_BASE_URL=https://my-web-app--bookmenow-7f4f2.us-east4.hosted.app VERIFY_FIRESTORE_PAGE_SIZE=300 npm run verify:firestore-booking
```
### Expected outcomes
- A new Firestore document appears under `bookings`.
- If payment fails, booking status is expected to be `CANCELED`.
- If payment succeeds with a valid gateway token, booking status should be `CONFIRMED`.
