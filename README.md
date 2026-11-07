# 🖨️ QuickPrint

> **Next-Generation Zero-Login Walk-In Kiosk & Merchant Prepress Station**  
> Direct peer-to-station realtime file streaming, zero cloud storage reliance, collision-free 4-digit pickup PINs, and an integrated in-browser prepress document studio.

---

## 📌 Table of Contents
- [Overview](#-overview)
- [Why QuickPrint? (The Problem)](#-why-quickprint-the-problem)
- [What QuickPrint Does (The Solution)](#-what-quickprint-does-the-solution)
- [How It Works (User & Merchant Workflow)](#-how-it-works-user--merchant-workflow)
- [Key Features](#-key-features)
- [System Architecture & Data Flow](#-system-architecture--data-flow)
- [Technology Stack](#-technology-stack)
- [Database & Schema](#-database--schema)
- [Getting Started](#-getting-started)
- [Security & Privacy Guarantees](#-security--privacy-guarantees)

---

## 🌟 Overview

**QuickPrint** is an on-demand, zero-login print kiosk platform designed for print shops, college campuses, cyber cafés, and commercial xerox centers. It bridges the gap between walk-in customers wanting to print documents directly from their mobile phones and print station operators running busy counters.

Customers require **no app download and no account creation**. They simply scan a counter QR code or enter a 4-digit station code (`QP-XXXX`), select print options, and transmit their files directly to the merchant workstation over high-speed WebSockets—never storing sensitive files on third-party cloud servers.

---

## ❓ Why QuickPrint? (The Problem)

Walk-in printing in everyday retail environments suffers from severe friction and security vulnerabilities:

1. **Severe Privacy & Data Leaks**:
   - Customers routinely share government IDs (Aadhaar, PAN, Passport), bank statements, and private legal documents over WhatsApp or open shop Gmail accounts.
   - Files remain permanently stored in shop PC download folders and WhatsApp chat histories, creating huge privacy liabilities.
2. **Slow Counter Bottlenecks & Long Queues**:
   - Manually calculating page counts, duplex vs. single-sided rates, and color pricing creates confusion and slows down lines.
3. **Manual, Clunky Prepress Software**:
   - When customers need a passport photo grid or Aadhaar crop, operators juggle Adobe Photoshop, Acrobat, or MS Paint, causing further delays.
4. **Order Verification Confusion**:
   - "Whose PDF is this?" Customers and shopkeepers often mix up print jobs when multiple people are emailing files at the same time.

---

## 💡 What QuickPrint Does (The Solution)

QuickPrint re-architects the walk-in printing experience from the ground up:

* **Zero-Login Kiosk (Customer-Side)**: Customers walk up, scan or enter the station code, and immediately print without creating passwords, sharing emails, or saving phone numbers.
* **Direct Realtime File Relay (Zero-Cloud Storage)**: Documents are streamed directly from customer device to merchant browser via Cloudflare Worker Durable Objects. Files never hit permanent cloud storage buckets.
* **Collision-Free 4-Digit Pickup PIN (`#XXXX`)**: The system actively inspects the merchant's current queue to allocate an unused 4-digit PIN (`1000`–`9999`), eliminating collision and customer mix-ups.
* **In-Browser Prepress & Xerox Studio**: Operators can crop passport photos, Aadhaar/ID cards, rotate pages, delete blank sheets, binarize dirty scans with a 1-tap Xerox filter, and assemble PDFs directly inside the browser—no third-party apps required.
* **Silent Printing & Atomic Accounting**: One-click job spooling updates shop metrics, calculates page pricing automatically, and atomically records revenue.

---

## 🔄 How It Works (User & Merchant Workflow)

```
[Customer Mobile]                                [Merchant Dashboard]
       |                                                  |
       |--- 1. Scan QR / Enter Shop Code (QP-XXXX) ------>| (Presence Verified)
       |                                                  |
       |--- 2. Upload Document & Set Print Specs -------->| (Client-side Page Count)
       |                                                  |
       |--- 3. Direct WebSocket Relay (Cloudflare DO) --->| (Received in IndexedDB)
       |                                                  |
       |--- 4. Active-Checked 4-Digit PIN Assigned (#XXXX)| (Queued in Realtime)
       |                                                  |
       |--- 5. Verbal Counter Call ("Order #8421") ------>| (Prepress & Silent Print)
       |                                                  |
       |<-- 6. Instant Green Flip ("Ready!") -------------| (Atomic Payment Confirmation)
```

### Customer Journey
1. **Station Discovery (`/`)**: Scan counter QR code or enter 4-digit shop code (e.g., `QP-8421`).
2. **Document Specs & Direct Relay (`/print`)**: Upload PDF, Word, or Image files (up to 25MB). System calculates billable pages, allows color/duplex selection, and displays dynamic transparent pricing.
3. **Pickup PIN & Payment (`/payment`)**: System dynamically queries active queue and assigns a collision-free 4-digit PIN (`#XXXX`). Customer selects Cash or UPI.
4. **Live Receipt (`/receipt/pending`)**: Customer receives an interactive digital receipt with instructions: *"Tell the attendant: 8421 or show this screen."*
5. **Instant Fulfillment Flip**: As soon as the merchant finishes, the receipt instantly turns green (*"Print Completed & Ready!"*).

### Merchant Journey
1. **Live Queue Monitoring (`/merchant/dashboard`)**: Incoming print jobs appear instantly via Supabase Realtime CDC, labeled with `#<PIN>`, specs, and price.
2. **In-Browser Prepress Studio**: Operator clicks "Edit & View" to inspect documents, adjust contrast (high-contrast Xerox binarization), reorder/delete PDF pages, or crop IDs.
3. **Silent Print Spooling**: Clicking "Print" sends the job directly to the local printer driver without blocking browser dialogs.
4. **Atomic Payment & Purge**: Clicking "Done (Paid)" triggers an atomic database transaction that updates daily/monthly statistics and immediately purges document chunks from local browser memory.

---

## ⚡ Key Features

- **🚀 Instant Zero-Login Walk-In Experience**: Mobile-first responsive UI built with high outdoor contrast and touch-friendly targets.
- **🛡️ Ephemeral Zero-Cloud Storage**: Files stream P2P/relay and reside strictly in memory/IndexedDB until printed, then get immediately shredded.
- **🎨 Built-in Prepress Studio**:
  - **Image Studio**: Preset ratios (`Passport 3.5×4.5cm`, `Stamp`, `Aadhaar / ID Card 8.5×5.4cm`, `4×6 Photo`, `A4`), 90°/180° rotations, mirror, and real-time Xerox B&W binarization filter.
  - **PDF Studio**: Interactive thumbnail rail, page deletion, reordering, zoom, and live in-browser PDF reassembly via `pdf-lib`.
- **🔢 Active-Checked Collision-Free PINs**: Single `#XXXX` pickup code guaranteed unique against concurrent active station jobs.
- **📊 Merchant Business Analytics**: Real-time revenue tracking, daily/monthly print counts, and cash vs. UPI breakdown.
- **⏱️ Automated Free-Tier Keepalive**: Scheduled GitHub Action cron pings prevent Supabase database dormancy.

---

## 🏗️ System Architecture & Data Flow

```
┌─────────────────────────┐               ┌──────────────────────────┐
│     Customer Client     │               │    Merchant Dashboard    │
│  (Mobile Web / React)   │               │   (Desktop Web / React)  │
└────────────┬────────────┘               └─────────────┬────────────┘
             │                                          │
             │           WebSocket Stream Chunks        │
             ├─────────────────────────────────────────►│ (Saved to IndexedDB)
             │      (Cloudflare Durable Object)         │
             │                                          │
             │             Job Metadata / PIN           │
             ▼                                          ▼
     ┌─────────────────────────────────────────────────────────┐
     │                   Supabase Cloud Backend                │
     │  - PostgreSQL Database (Orders, Merchants, Metrics)     │
     │  - Realtime CDC (Instant Queue & Status Updates)        │
     │  - Row-Level Security (RLS) & Atomic RPC Stored Procs   │
     └─────────────────────────────────────────────────────────┘
```

---

## 💻 Technology Stack

| Layer | Technologies | Purpose |
|---|---|---|
| **Frontend Framework** | **React 18**, **Vite** | Lightning-fast SPA bundle and reactive client UI |
| **UI & Design System** | **Material UI (MUI v9)**, **Emotion**, **Plus Jakarta Sans** | Modern utilitarian touch-friendly kiosk design system |
| **Realtime File Relay** | **Cloudflare Workers**, **Durable Objects**, **WebSockets** | High-speed, zero-cloud transient document chunk streaming |
| **Database & Realtime** | **Supabase (PostgreSQL)**, **Realtime CDC** | Structured order management, live queue sync, and atomic metrics |
| **Document Processing**| **pdf-lib**, **react-pdf**, **Canvas API** | In-browser PDF reassembly, page rendering, and Xerox binarization |
| **Scanner & Codes** | **html5-qrcode**, **qrcode.react** | Fast counter QR scanner and dynamic QR generator |
| **Authentication** | **Firebase Authentication** | Secure Google & Email authentication for merchants only |
| **Analytics & Charts** | **Recharts** | Merchant revenue and page analytics visualizations |

---

## 🗄️ Database & Schema

QuickPrint uses a streamlined PostgreSQL schema configured in `supabase/current.sql`:
- **`merchants`**: Store settings, pricing tiers (`price_per_page_bw`, `price_per_page_color`, `price_per_page_duplex`), unique 4-digit `shop_code`, UPI ID, and shop name.
- **`print_jobs`**: Job ID, merchant association, collision-free `pincode`, billable pages, color mode, sides, total cost, and status transitions (`pending` → `paymentClaimed` → `printing` → `completed`).
- **Atomic RPC (`confirm_payment_and_update_stats`)**: Executes status completion, timestamps payment (`paid_at = NOW()`), and atomically updates merchant earnings and page counters.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** or **yarn**

### 2. Clone the Repository
```bash
git clone https://github.com/riddhesh-ture/QuickPrint.git
cd QuickPrint
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your credentials:
```env
# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Firebase (Merchant Auth)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Cloudflare Realtime Relay (WebSocket)
VITE_RELAY_SERVER_URL=wss://your-cloudflare-worker.workers.dev
```

### 5. Run Locally
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 6. Build for Production
```bash
npm run build
```

---

## 🔒 Security & Privacy Guarantees

- **No Permanent Cloud Storage**: Customer files are never written to Amazon S3, Google Cloud Storage, or Supabase Storage buckets.
- **Encrypted Transient Streaming**: Document chunks pass through memory-only WebSocket relays directly into the merchant's sandboxed browser IndexedDB.
- **Immediate Local Shredding**: Memory and IndexedDB buffers are purged automatically upon job completion.
- **Zero Customer Tracking**: No phone numbers, account passwords, or identity verification required for customers.

---

## 📄 License
This project is licensed under the MIT License.
