# Owner claims and SANVIC Pro

## Enable on the existing Supabase + Vercel deployment

1. In the **sanvic-ph** Supabase project's SQL Editor, run `docs/owners-setup.sql` once. It adds owner tables, a private Storage bucket, an approval transaction, and two optional columns on `places`. It does not publish or replace any imported location.
2. Keep the existing Vercel variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), and the server-only `SUPABASE_SECRET_KEY`.
3. In Supabase Authentication, enable Email and configure SMTP for business-owner sign-in emails. Add the exact production `/owners` callback URL to the allowed redirect URLs and set the production site URL. Default magic-link emails work; no custom OTP template is required.
4. Deploy the code. Open a public location profile → **Claim or manage this location**, or visit `/owners`.
5. Use **Content Studio → Owners & Pro** for claims, proposed edits, managers and payments. Review notes are shown to owners. Pending and rejected evidence never enters the public gallery.

## Publishing and payments

- Claims identify the person by verified email but **do not prove ownership**. Admin independently verifies authority using known business contacts or private documents before approval.
- A callback must use an independently verified business number/contact, not merely the claimant's submission. For on-site evidence, the admin supplies a fresh challenge code directly; this first release does not automate challenges, phone OTP, document authenticity checks or verification callbacks.
- Owners edit only places for which they have an active manager membership. Drafts stay private. Owners can submit proposed changes, but they cannot grant access, change publication status, mark themselves verified, activate Pro, or edit another location.
- Profile approval is one transaction. A stale baseline is rejected instead of overwriting intervening admin changes. Admin can select individual fields; approve cover and gallery together when changing the cover.
- Owners can upload several images/videos directly to private Supabase Storage (80 MB maximum each). Evidence/receipts accept images or PDF, maximum 10 MB. SVG/HTML and arbitrary executables are not accepted. Supported formats appear next to each picker. The daily allocation is capped at 60 uploads per account; this is an application guard, not a substitute for production platform rate limiting.
- New gallery uploads become publicly accessible only after approval and only while attached to a published location. Evidence and receipts use short-lived signed previews. Previously issued gallery preview links can remain valid until their short expiry after unpublishing.
- Removed gallery entries disappear only when that profile change is approved. Unused, unsubmitted uploads may be soft-deleted; submitted evidence is retained for audit. Storage retention cleanup is an admin responsibility in this release.
- **SANVIC Pro · Founding Member Rate: PHP 300/month per location.** The supplied GCash QR is unchanged at `public/gcash-sanvic-pro.jpeg`. The browser can save it for same-device GCash gallery scanning. No fabricated QR or recipient data is used.
- Owner submits the transaction reference and receipt. Admin must check receipt of funds in the actual payment account. An uploaded receipt does not activate Pro. Direct arrangements use `merqatodigital@proton.me`; admins record them with a unique reference and then review them.
- Approval adds one calendar month from the later of current expiry or approval time. Duplicate active payment references and duplicate pending submissions are prevented in the database. Re-review cannot charge or extend twice.
- Paid featuring is computed from `pro_until` at request time; it does not alter editorial `featured` flags or publish a draft. Expired paid placements no longer receive the Pro badge/priority on the next content refresh. No recurring debit, gateway integration, automatic refund or lifetime pricing commitment is implied.

## Before accepting real owners

Verify sign-in delivery, private evidence access, denied cross-owner access, both claim approval/rejection, stale profile updates, media moderation and confirmed payment expiry against the actual SANVIC database. Replace development-only admin access with production admin authentication before collecting sensitive ownership documents. Keep receipts and ownership documents out of Git and public media storage.

No live database schema or Vercel environment change is performed simply by committing this code.
