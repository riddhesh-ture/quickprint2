# QuickPrint Core Workflow

A zero-login walk-in kiosk service connecting customers to print stations with direct realtime file streaming and single 4-digit pickup PINs.

---

## 1. Station Discovery (`/`)
* **QR Scan**: Camera scanner resolves counter station URL directly.
* **4-Digit Shop Code**: User types 4-digit numeric code (e.g. `8421` with fixed `QP-` UI prefix).
* **Live Presence**: Station online/offline status is pre-warmed and verified via Realtime Relay.

## 2. Document Specs & Direct Relay (`/print`)
* **Upload**: Up to 25MB documents (PDF, DOCX, images) with client-side page counting.
* **Configuration**: Color mode (B&W / Color), Duplex (Single / Double-sided), copies, and dynamic pricing.
* **Direct Transfer**: Document stream relays directly to merchant workstation (zero cloud storage reliance).

## 3. Active-Checked 4-Digit Pickup PIN (`/payment`)
* **Collision-Free PIN**: System checks station's active queue and assigns an unused 4-digit PIN (`1000`–`9999`), guaranteeing 0% active collision.
* **Payment Method**: User chooses Cash at counter or UPI (with pre-filled UPI Intent link).
* **Order Created**: Job registered in Supabase; Realtime Relay instantly pings merchant dashboard.

## 4. Live Receipt & Verbal Counter Call (`/receipt/pending`)
* **Single Code**: User receives `#<pin>` (e.g., `#8421`).
* **Verbal Prompt**: *"Tell the attendant: 8421 or show this screen."*
* **Realtime Listener**: Listens via Supabase CDC for instant in-place status flip.

## 5. Merchant Station & Prepress Studio (`/merchant/dashboard`)
* **Incoming Queue**: Job appears with `#<pin>`, file specs, billable pages, and amount in a single active queue.
* **Prepress Studio & Inspection**: Merchant clicks "Edit & View" to inspect documents with zero latency (native PDF preview, image orientation, page range extraction, high-contrast Xerox mode, and real-time cost calculation).
* **Silent Print Transition**: Clicking "Print" or "Save & Ready for Print" updates status to `printed` without intrusive browser `window.print()` dialogs, ready for local Node print server spooling.
* **Memory Safety**: Chunks stored in merchant browser IndexedDB are purged immediately on job completion.

## 6. Payment & Atomic Completion
* **Payment**: Customer pays cash or shows UPI screenshot at the counter.
* **Done (Paid)**: Merchant clicks complete, invoking atomic RPC `confirm_payment_and_update_stats`:
  * Marks job `status = 'completed'` and sets `paid_at = NOW()`.
  * Atomically increments merchant's daily and monthly prints & earnings.
* **Instant Green Flip**: User's receipt flips green (*"Print Completed & Ready!"*). Physical document handed over.
