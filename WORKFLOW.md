# QuickPrint Core Workflow

This document outlines the end-to-end user and merchant lifecycle for QuickPrint.

---

## 1. Shop Access & Discovery
- **Action**: User visits the website (`/`).
- **Entry Method**:
  - **Scan QR Code**: Camera scanner resolves shop URL/code directly.
  - **Enter 4-Digit Shop Code**: User inputs the merchant's 4-digit shop code (e.g., `8421` or `QP-8421`).
- **Destination**: Redirects user to `/print?merchantId=<shop_id>`.

---

## 2. Document Selection & Print Options
- **Action**: User selects files and configures print preferences (`/print`).
- **Options**:
  - **Color Mode**: Black & White or Color.
  - **Sides**: Single-Sided or Double-Sided (Duplex).
  - **Copies & Page Range**: Custom range or all pages.
- **Pricing**: Dynamic real-time calculation based on merchant's per-page rates.

---

## 3. Transfer & 4-Digit OTP Generation
- **Action**: User sends/uploads the document.
- **Transfer**: Direct real-time stream / cloud fallback.
- **Unique Code / OTP**:
  - System generates a unique 4-digit OTP / Token (e.g. `8421` / `#14-8421`).
- **Customer View**: Moves to payment selection (`/payment`), then to pending receipt (`/receipt/pending`).

---

## 4. Merchant Print Queue
- **Action**: Merchant monitors incoming orders on dashboard (`/merchant/dashboard`).
- **Real-time Alert**: New print job appears in the queue with:
  - 4-Digit OTP / Token
  - File name, billable page counts, color/duplex specs
  - Total bill amount
- **Print Action**: Merchant clicks **"Accept & Print"** to send document directly to physical printer.

---

## 5. Payment & Settlement
- **After Printing**:
  - **Cash Option**: User pays cash directly at the counter.
  - **UPI Option**: User scans merchant QR / pays via UPI and shows payment screenshot to merchant.

---

## 6. Fulfillment & Handover
- **Action**: Merchant verifies payment and clicks **"Done (Paid)"**.
- **Real-time Update**: User's receipt screen updates instantly to green (**"Print Completed & Ready!"**).
- **Handover**: Merchant hands physical printed document to user.
