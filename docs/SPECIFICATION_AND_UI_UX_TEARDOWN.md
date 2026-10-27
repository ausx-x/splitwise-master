# Splitwise: App Development Specification & UI/UX Teardown

This document provides a comprehensive engineering, product, and design breakdown of **Splitwise**. It covers the complete feature matrix from an application development perspective, underlying algorithmic and data modeling considerations, visual design systems (UI), and interaction design patterns (UX).

---

## 1. Architectural & Feature Breakdown (App Development Perspective)

Splitwise operates as a **collaborative ledger and debt-simplification network**. From an engineering standpoint, it sits between a relational transaction management system, a social graph, and a directed graph optimization engine.

```
                      +-----------------------------+
                      |       Client Layer          |
                      |  (iOS, Android, Web/PWA)    |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |       API Gateway           |
                      | (Auth, Rate Limiting, CORS) |
                      +--------------+--------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +-------------------+       +-------------------+
|  Expense Engine  |       | Debt Solver Engine|       | Sync & Push Notif |
| (Splits, Taxes,  |       | (Graph Netting &  |       | (APNs, FCM,       |
| Multi-Currency)  |       |  Simplification)  |       |  WebSockets)      |
+--------+---------+       +---------+---------+       +---------+---------+
         |                           |                           |
         +---------------------------+---------------------------+
                                     |
                                     v
                      +-----------------------------+
                      |      Data Layer (RDBMS)     |
                      | (ACID Ledger, Users, Groups)|
                      +-----------------------------+
```

---

### 1.1 User & Identity Management
*   **Authentication & Federation:**
    *   Email/Password with OAuth2 / OpenID Connect (Sign in with Apple, Google OAuth).
    *   JWT/Session Token management with refresh rotation.
*   **Profile & Graph Identity:**
    *   Contact sync (reading address book via native permission to find registered friends via hashed phone numbers/emails).
    *   User settings: Default currency (ISO 4217), locale/timezone, notification threshold preferences.
*   **Friend Graph Management:**
    *   Direct bilateral relationship (`User_A <-> User_B`).
    *   Direct balance tracker outside of groups (bilateral ledgers).
    *   Invite flow (SMS/Deep-link generation with tokenized attribution).

---

### 1.2 Group Management Subsystem
*   **Group Data Model:**
    *   Metadata: Name, category (Apartment, Trip, Couple, Other), custom group avatar.
    *   Membership: Dynamic multi-user groups with flexible join/leave semantics.
    *   Group states: Active, Archived, or Soft-Deleted.
*   **Security & Permissions:**
    *   Decentralized trust model: Any member can add, edit, or delete expenses by default (audit logged).
    *   Invite links with join tokens / QR codes.
*   **Group Balances:**
    *   Aggregated net position of each member within the group scope:
      $$\sum \text{Paid} - \sum \text{Owed} = \text{Net Position}$$
    *   Group-specific debt simplification toggles.

---

### 1.3 Expense Management Engine (Core Ledger)

The expense engine is an ACID-compliant double-entry ledger that converts high-level user inputs into balanced atomic transaction entries.

```
+--------------------------------------------------------------+
|                          EXPENSE                             |
|  ID: 101 | Total: $120.00 | PaidBy: User A | Group: Trip    |
+--------------------------------------------------------------+
                               |
               Split Strategy: EQUAL (3 Users)
                               |
       +-----------------------+-----------------------+
       |                       |                       |
       v                       v                       v
+---------------+       +---------------+       +---------------+
| SplitItem     |       | SplitItem     |       | SplitItem     |
| User: A       |       | User: B       |       | User: C       |
| Share: $40.00 |       | Share: $40.00 |       | Share: $40.00 |
+---------------+       +---------------+       +---------------+
```

#### Split Computation Strategies
1.  **Equal Split:**
    *   Formula: $\text{Base} = \lfloor \frac{\text{Total}}{N \times 10^{-2}} \rfloor \times 10^{-2}$
    *   *Penny Allocation Logic:* When $\text{Total} \pmod N \neq 0$, distribute the remainder cents randomly or deterministically (e.g., to the payer or first indexed members) so that:
      $$\sum_{i=1}^{N} \text{Share}_i = \text{Total}$$
2.  **Unequal Split (Exact Amounts):**
    *   User specifies arbitrary amounts.
    *   Validation requirement: $\sum \text{Amounts} == \text{Total}$ (enforced on client and API before commit).
3.  **Percentage Split:**
    *   User specifies percentages.
    *   Validation: $\sum \text{Percentages} == 100.00\%$.
    *   Rounding discrepancy handling for multi-decimal divisions.
4.  **Shares / Weighted Split:**
    *   User assigns integers (e.g., Person A = 2 shares, Person B = 1 share).
    *   $\text{Share}_i = \text{Total} \times \left(\frac{W_i}{\sum W}\right)$.
5.  **Adjustment-Based Split:**
    *   Base equal split plus fixed offsets (e.g., "Everyone splits equally, but User A pays \$10 more for their cocktail").

#### Advanced Expense Features
*   **Multi-Payer Transactions:** Support for multiple people funding a single expense (e.g., User A paid \$60, User B paid \$40 on a \$100 bill).
*   **Itemized Receipt Splitting (OCR Integration):**
    *   Mobile camera capture -> OCR processing (Tesseract/Cloud Vision API).
    *   Parsing line items, tax, and tip.
    *   Assigning specific line items to individual users, with proportional distribution of tax and tip.
*   **Recurring Expenses:**
    *   Cron/Worker scheduled jobs (weekly, bi-weekly, monthly, yearly).
    *   Automatic draft creation or immediate ledger posting.
*   **Multi-Currency Support:**
    *   Transactions recorded in native currency.
    *   Daily exchange rate ingestion via FX API.
    *   Settlement conversion options (settle in local currency vs. original currency).

---

### 1.4 Debt Simplification Engine (Graph Optimization)

One of Splitwise’s signature features is **"Simplify Debts"**. It converts a cyclic, highly connected debt graph into a directed acyclic graph (DAG) with minimal edges, reducing the total number of monetary transfers required to balance the room.

```
WITHOUT SIMPLIFICATION (Complex Web)
    [User A] ---- owes $20 ----> [User B]
       ^                           |
       |                           |
   owes $20                     owes $20
       |                           |
       +--------- [User C] <-------+

WITH SIMPLIFICATION (Greedy Cash Flow Algorithm)
    All debts cancel out completely: Net transfers = $0
```

#### The Greedy Min-Cash-Flow Algorithm
1.  Compute net balance $B_u$ for every user $u \in U$:
    $$B_u = \sum \text{Credits}_u - \sum \text{Debits}_u$$
2.  Partition users into two heaps:
    *   **Debtors** ($B_u < 0$)
    *   **Creditors** ($B_u > 0$)
    *(Users with $B_u = 0$ are dismissed).*
3.  Extract maximum debtor (owes the most) and maximum creditor (is owed the most).
4.  Settle an edge of weight:
    $$\text{Amount} = \min(|B_{\text{debtor}}|, B_{\text{creditor}})$$
5.  Update balances and re-insert into heaps if non-zero.
6.  Terminates in at most $N - 1$ transactions (where $N$ is the number of users).

---

### 1.5 Settlement & Payment Rail Integration
*   **Cash / External Settlement ("Record a Payment"):**
    *   Virtual transaction creating a negative debt equal to the balance between two users.
*   **Integrated Payment Gateways:**
    *   Deep-linking via URL schemes or SDK integration to native apps:
        *   **US:** Venmo (`venmo://paycharge`), PayPal, Zelle.
        *   **India:** UPI Intent (`upi://pay?pa=...&am=...`).
        *   **Europe:** SEPA / Payconiq.
*   **Automated Payment Reconciliation:**
    *   Webhook listeners to verify settlement completion before marking the ledger cleared.

---

### 1.6 Auditability, Storage & Sync Infrastructure
*   **Immutable Transaction Log (Event Sourcing Pattern):**
    *   Edits and deletes do not hard-mutate historical rows silently; they register a new revision with `parent_expense_id`.
    *   Full change history: "User X edited the amount from \$40 to \$50 on [Date]".
*   **Restore Functionality:** Soft-deleted items can be restored, triggering a recalculation of the user's running total.
*   **Offline-First & Conflict Resolution:**
    *   Local SQLite/Room/CoreData persistence for offline caching.
    *   Queue for outgoing mutations.
    *   Last-Write-Wins (LWW) or version vector validation on the server to prevent race conditions when two group members edit an expense concurrently.
*   **Export Subsystem:**
    *   Asynchronous job worker generating CSV/XLSX spreadsheets with full transaction history and running member balances.

---

### 1.7 Splitwise Pro (Monetization Engine)
*   **Receipt Scanning:** Serverless pipeline running OCR + NLP parser for line-item extraction.
*   **Currency Conversion Engine:** On-the-fly currency conversion using historical exchange rates.
*   **Expense Search & Advanced Charts:** ElasticSearch / OpenSearch ingestion for full-text receipt search, paired with spending categorizations and budget graphs.
*   **In-App Purchase (IAP) Subscriptions:** Apple StoreKit 2 & Google Play Billing integration with entitlement checks.

---

## 2. Core Data Models (Relational Entity Architecture)

```
+------------------+         +------------------+         +------------------+
|      users       |         |      groups      |         |  group_members   |
+------------------+         +------------------+         +------------------+
| id (PK)          |         | id (PK)          |         | id (PK)          |
| email            |         | name             |         | group_id (FK)    |
| name             |         | type             |----+    | user_id (FK)     |
| default_currency |         | simplify_by_def  |    |    | joined_at        |
+------------------+         +------------------+    |    +------------------+
         |                            |              |              |
         +----------------------------+--------------+--------------+
                                      |
                                      v
                             +------------------+
                             |     expenses     |
                             +------------------+
                             | id (PK)          |
                             | group_id (FK)    |
                             | description      |
                             | total_amount     |
                             | currency         |
                             | created_by (FK)  |
                             | split_type       |
                             | is_payment       |
                             +------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+------------------------+                        +------------------------+
|      expense_users     |                        |    expense_comments    |
+------------------------+                        +------------------------+
| id (PK)                |                        | id (PK)                |
| expense_id (FK)        |                        | expense_id (FK)        |
| user_id (FK)           |                        | user_id (FK)           |
| paid_share (decimal)   |                        | comment_text           |
| owed_share (decimal)   |                        | created_at             |
+------------------------+                        +------------------------+
```

---

## 3. UI (User Interface) Architecture & Visual Design

Splitwise follows a **utility-first, functional minimalist** design system. Because money-tracking carries cognitive friction and social tension, the UI relies on restrained colors with high-contrast semantic cues.

### 3.1 Design System & Visual Foundations

| Element | Specification | Rationale |
| :--- | :--- | :--- |
| **Primary Brand Color** | Teal / Mint (`#1CC29F`) | Connotes finance and freshness without the clinical sterility of bank blue. |
| **Positive State (Creditor)**| Vibrant Green (`#5BC5A7` / `#2ECC71`) | Denotes money incoming ("you are owed"). |
| **Negative State (Debtor)** | Orange / Red (`#FF652F` / `#E74C3C`) | Denotes money outgoing ("you owe"). Warm tone reduces anxiety compared to pure crimson. |
| **Neutral Surface** | Light: `#FFFFFF` & `#F6F6F6`<br>Dark: `#121212` & `#1E1E1E` | High readability for numeric tabular ledgers. |
| **Typography** | System Default (`SF Pro` on iOS, `Roboto` on Android) | Optimizes performance, zero font-download overhead, standard numeric tabular support. |

---

### 3.2 Information Architecture & Screen Navigation

The app is architected around a **Bottom Navigation Bar** with 4 primary destinations and a floating or persistent contextual action entry:

```
[Bottom Navigation Bar]
├── 1. Groups    --> [Group Detail] --> [Balances / Totals / Settings]
├── 2. Friends   --> [Direct 1-on-1 Ledger] --> [Settle Up / Remind]
├── 3. Activity  --> [Global Audit Feed] (Edits, payments, adds)
└── 4. Account   --> [Profile, Pro Subscription, FX Settings, Export]
                 * Persistent Action: [ + Add Expense ] *
```

---

### 3.3 Screen-by-Screen UI Teardown

#### A. The Dashboard (Groups & Friends Tab)
*   **Summary Card:** Sits at the top of the viewport. Summarizes the user’s net financial position across all ledgers in large typography:
    *   *Total Balance:* "Overall, you are owed **\$142.50**" (Green) or "You owe **\$35.00**" (Orange).
*   **Split-List Component:**
    *   List of groups or individual friends.
    *   Each row item displays: Avatar, Group/Friend Name, and Subtext with right-aligned status.
    *   Status states:
        *   `settled up` (Faint gray).
        *   `you owe $XX.XX` (Orange).
        *   `you are owed $XX.XX` (Green).

#### B. Group Detail Screen
*   **Header Area:** Title, Group Cover, "Settle Up" CTA, and "Balances" CTA.
*   **Tabbed Sub-Navigation:**
    *   *Expenses Tab:* Chronological feed of expense cards grouped by month/date.
    *   *Balances Tab:* Summarized matrix listing every user's net position within the group.
    *   *Totals Tab:* High-level statistics (Total group spend, your individual total spend).
*   **Expense Cell:**
    *   Left: Calendar date icon (e.g., "OCT 12").
    *   Center: Category icon + Expense Name (e.g., Grocery cart + "Trader Joe's").
    *   Right: Stacked amounts:
        *   Top: Total expense amount ("you paid \$90.00").
        *   Bottom (Bold): Your share ("you lent \$60.00").

#### C. Add Expense Flow (Modal Architecture)
The expense screen is designed as an interactive input flow:
1.  **Context Selector:** Payer/Group picker header ("With you and: [Select group or people]").
2.  **Description Field:** Text box with immediate auto-suggest for categories.
3.  **Amount Field:** Large numeric input field with a built-in calculator keypad supporting arithmetic operations (`+`, `-`, `*`, `/`).
4.  **Paid By / Split By Pills:**
    *   "Paid by **you** and split **equally**."
    *   Tapping opens a bottom-sheet selection modal (Equal, Unequal, Percent, Shares).
5.  **Metadata Drawer:** Date picker, group assignment, camera/receipt icon, and notes/comments field.

---

## 4. UX (User Experience) Breakdown & Product Psychology

Splitwise’s UX solves a delicate psychological problem: **interpersonal debt causes social anxiety and friction**. The UX is engineered to act as an objective, neutral third party, removing personal confrontation from financial accounting.

```
+--------------------------------------------------------------------------+
|                       THE SOCIAL UX STRATEGY                             |
+--------------------------------------------------------------------------+
| 1. Objective Intermediary  | "Splitwise says you owe", not "I say you owe"|
| 2. Frictionless Entry      | Log in seconds, refine details later        |
| 3. Asymmetric Settlement   | Debts cancel out invisibly behind the scenes |
| 4. Social Grace Reminders  | Automated notifications eliminate confrontation |
+--------------------------------------------------------------------------+
```

### 4.1 Reducing Input Friction (Velocity of Entry)
*   **Smart Defaults:**
    *   Splitwise remembers the last split configuration used with a specific group or friend.
    *   Defaults to "Paid by creator, split equally" (the 80% use case).
*   **Inline Arithmetic:** The amount field acts as a calculator. Users don't need to exit the app to add up tax or distinct receipts.
*   **Optimistic UI Updates:** When an expense is submitted, the transaction immediately appears in the feed with an optimistic update pattern; network sync happens in the background. If sync fails, a retry banner appears.

### 4.2 De-escalation of Interpersonal Tension
*   **The "Neutral Arbiter" Persona:** Notifications and activity feeds are worded impersonally: *"Alex added Dinner on Splitwise"* rather than *"Alex charged you"*.
*   **Polite Reminders (Nudges):** Instead of forcing a user to send an awkward direct message, Splitwise provides a "Send Reminder" button that delivers a neutral, system-generated push notification or email.
*   **The Mutual Settlement Magic:** The "Simplify Debts" UX makes complex multi-person repayments feel effortless. Users don't need to manually calculate intermediate debts; the UI displays a single, minimal instruction: *"Pay David \$15 to clear all debts in this group."*

### 4.3 Cognitive Load & Edge-Case Handling

```
Problem: Unequal Split with Leftover Cents
User divides $100.00 among 3 people. 100 / 3 = 33.3333...

Resolution:
Splitwise allocates:
- Person 1: $33.34
- Person 2: $33.33
- Person 3: $33.33
Total check = $100.00 (Prevents validation locks)
```

*   **Zero-Sum Enforcement:** The UI visually locks the "Save" action if an unequal split does not sum to the exact cent total. A dynamic badge indicates: `"$0.02 of $100.00 remaining"` or `"$1.50 over total"`.
*   **Undo Toast Pattern:** When an expense is deleted or modified, a 5-second `Snackbar`/`Toast` with an "Undo" button allows immediate recovery from accidental taps without requiring deep audit log navigation.
*   **Clear Visual Hierarchy in Asymmetric Debts:** If User A owes User B \$50 in Group 1, but User B owes User A \$30 in Group 2, the high-level friend view abstracts this into: *"User B owes you \$20.00"*, minimizing mental calculations.

---

## 5. Developer Implementation Checklist (Cloning Splitwise)

For an engineering team looking to build a Splitwise-like architecture, the project roadmap can be broken into six logical development milestones:

```
[Phase 1: Ledger Engine] ---> [Phase 2: Group Ledger] ---> [Phase 3: Graph Optimizer]
  - Double-entry ledger         - Group joins/invites       - Min-cash-flow algorithm
  - Penny-rounding math         - Dynamic splits            - Netting balances
            |                             |                             |
            v                             v                             v
[Phase 4: Sync & Offline] --> [Phase 5: Payments & OCR] -> [Phase 6: Native UI/UX]
  - Local SQLite cache          - Deep links (UPI/Venmo)     - Micro-interactions
  - Optimistic updates          - Receipt OCR pipeline       - Arithmetic keypad
```

1.  **Phase 1: Ledger & Balance Engine**
    *   Build atomic transaction models (never store net balance alone; store full transaction records and derive net balance).
    *   Implement rounding-remainder allocation algorithms.
2.  **Phase 2: Group & Social Graph**
    *   Implement invite link generation with tokenized payloads.
    *   Build role-agnostic group permission system.
3.  **Phase 3: Debt Simplification Graph Worker**
    *   Implement the Greedy Min-Cash-Flow algorithm.
    *   Provide toggles for intra-group simplification vs. global cross-group simplification.
4.  **Phase 4: Synchronization & Offline Support**
    *   Build client-side SQLite/Room database with optimistic updates.
    *   Implement an idempotency key mechanism on transaction posts to prevent double charges on unstable networks.
5.  **Phase 5: Integrations & Monitization**
    *   Hook up payment rail deep-links (Venmo, PayPal, UPI).
    *   Integrate OCR for automated receipt line-item assignment.
6.  **Phase 6: UI/UX Refinement**
    *   Build custom arithmetic keypad.
    *   Implement high-contrast semantic typography and color schemes.