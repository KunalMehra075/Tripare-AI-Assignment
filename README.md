# Hotel Rate Comparator (Powered by Temporal Workflows)

## 🎬 Demo

Checkout the demo video here: https://youtu.be/RgCfEpcda-A
This video is also available in root directory.

> **Note:** The `Demo-Video.mov` file is included in the repository root. Open it locally to see the full walkthrough of all 10 assignment scenarios.

A full-stack, fault-tolerant hotel rate comparison application built with **Node.js**, **TypeScript**, **Temporal SDK**, **Express.js**, and **React** styled with **shadcn/ui** and **Tailwind CSS**.

The system searches and compares hotel rates across multiple mock suppliers in parallel, orchestrating real-world failure modes, retry policies, timeouts (>5s cancellation), and graceful mid-flight cancellation via Temporal Workflows.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.0.0 (Tested on Node 20)
- **npm** >= 9.0.0
- **Docker & Docker Compose** (for running local Temporal Server) OR **Temporal CLI** (`brew install temporal`)

---

### 1. Install Dependencies

From the project root:
```bash
npm run install:all
```
Or install in each directory:
```bash
cd backend && npm install
cd ../frontend && npm install
```

---

### 2. Start Temporal Server

#### Option A: Using Docker Compose (Recommended)
```bash
docker compose up -d
```
This starts:
- Temporal Server at `localhost:7233`
- Temporal Web UI at `http://localhost:8080`

#### Option B: Using Temporal CLI
```bash
brew install temporal
temporal server start-dev
```

---

### 3. Start Backend & Temporal Worker

In two separate terminal tabs (or run from root):

**Terminal 1 (Backend API & Mock Suppliers):**
```bash
cd backend
npm run dev
```
*Backend runs on `http://localhost:3001` with mock endpoints `/supplierA/hotels` and `/supplierB/hotels`.*

**Terminal 2 (Temporal Worker):**
```bash
cd backend
npm run worker
```
*Temporal worker listens on task queue `hotel-search-queue`.*

---

### 4. Start Frontend

**Terminal 3 (React + shadcn UI):**
```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:3000` (or `5173`).*

---

## 🏗 System Architecture

```
                                    +------------------------------+
                                    |    React + shadcn Frontend   |
                                    |    (Vite / Tailwind CSS)     |
                                    +--------------+---------------+
                                                   |
                                 POST /api/search-hotels (HTTP)
                                 POST /api/search-hotels/:id/cancel
                                                   v
                                    +------------------------------+
                                    |      Express Backend API     |
                                    |  (Client & Workflow starter) |
                                    +--------------+---------------+
                                                   |
                                       Starts Workflow Execution
                                                   v
                               +---------------------------------------+
                               |     Temporal Orchestration Engine     |
                               |          (Task Queue & History)       |
                               +-------------------+-------------------+
                                                   |
                                          Dispatches Tasks
                                                   v
                               +---------------------------------------+
                               |       Temporal Worker Process         |
                               |    (hotelSearchWorkflow orchestrator) |
                               +---------+-------------------+---------+
                                         |                   |
                        Parallel Activity|                   |Parallel Activity
                         fetchSupplierA  |                   |fetchSupplierB
                                         v                   v
                               +-------------------+ +-------------------+
                               |  Mock Supplier A  | |  Mock Supplier B  |
                               | /supplierA/hotels | | /supplierB/hotels |
                               +-------------------+ +-------------------+
```

### Key Workflow Highlights
- **Parallel Supplier Execution**: Queries Supplier A and Supplier B concurrently.
- **Strict 5-Second Response Limit**: If a supplier takes longer than 5s, the workflow cancels the slow activity via Temporal `CancellationScope` and proceeds with the available result.
- **Flaky Supplier Resiliency**: Employs Temporal's exponential retry policy (`maximumAttempts: 3`) to seamlessly handle transient supplier network/server failures.
- **Deterministic Rate Selection**: Finds the lowest price across both suppliers, breaking ties in favor of Supplier A deterministically.
- **Graceful Mid-Way Cancellation**: Responds to client cancellation requests cleanly without leaving zombie workflows or dangling HTTP connections.

---

## 📋 Scenarios Covered

| # | Scenario | Expected Outcome | Temporal Mechanism |
|---|----------|------------------|---------------------|
| 1 | **Supplier A cheaper** | Returns Supplier A's rate | Workflow selects lowest rate across responses |
| 2 | **Supplier B cheaper** | Returns Supplier B's rate | Workflow selects lowest rate across responses |
| 3 | **Both return same rate** | Deterministically picks Supplier A | Tie-breaker logic prioritizes Supplier A |
| 4 | **Supplier A fails, B succeeds** | Returns Supplier B's rate | Handles individual activity error, falls back to available supplier |
| 5 | **Both suppliers fail** | Returns error response | Aggregates supplier errors and marks workflow status as `ERROR` |
| 6 | **One returns empty** | Uses available result | Filters non-empty response and returns best rate |
| 7 | **Both return empty** | Returns *"No hotels found"* | Distinguishes between errors and zero results (`NO_HOTELS_FOUND`) |
| 8 | **One supplier takes >5s** | Cancels slow activity, proceeds with one result | `CancellationScope` + `sleep(5000)` aborts slow activity via `AbortSignal` |
| 9 | **Supplier A fails 2x before success** | Succeeds within retry policy | Temporal Activity Retry Policy (`maximumAttempts: 3`) automatically retries |
| 10 | **User cancels mid-way** | Workflow stops gracefully | Catches `isCancellation(err)` and returns `CANCELLED` status |

---

## 🧪 Running Automated Scenario Tests

The test suite runs with `@temporalio/testing` (`TestWorkflowEnvironment`) with **time-skipping**. This executes all 10 scenario tests in seconds without requiring an external Temporal server!

```bash
cd backend
npm test
```

### Sample Test Output:
```
 PASS  src/__tests__/hotelSearchWorkflow.test.ts
  Hotel Rate Comparator Workflow - Scenario Tests
    ✓ Scenario 1: Supplier A cheaper -> Return A's result (210 ms)
    ✓ Scenario 2: Supplier B cheaper -> Return B's result (185 ms)
    ✓ Scenario 3: Both return same rate -> Pick deterministically (Supplier A) (179 ms)
    ✓ Scenario 4: Supplier A fails, B succeeds -> Return B's result (192 ms)
    ✓ Scenario 5: Both fail -> Return error (180 ms)
    ✓ Scenario 6: One returns empty -> Use available result (184 ms)
    ✓ Scenario 7: Both return empty -> Return "No hotels found" (175 ms)
    ✓ Scenario 8: One supplier takes >5s to respond -> Cancel slow activity, proceed with one result (220 ms)
    ✓ Scenario 9: Supplier A fails 2x before success -> Still succeeds if within retry policy (310 ms)
    ✓ Scenario 10: User cancels request mid-way -> Workflow stops gracefully (165 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

---

## 📡 API Reference

### `POST /api/search-hotels`
Initiates the hotel search workflow and awaits rate comparison.

**Request Body:**
```json
{
  "city": "Paris",
  "checkIn": "2026-09-10",
  "checkOut": "2026-09-15",
  "scenario": "normal"
}
```

**Response (Success - 200 OK):**
```json
{
  "workflowId": "hotel-search-b45d2f...",
  "status": "SUCCESS",
  "bestHotel": {
    "hotelId": "hotel-paris-1",
    "name": "Paris Luxury Suites",
    "price": 176,
    "currency": "USD",
    "supplier": "SupplierB"
  },
  "comparison": {
    "supplierA": {
      "supplier": "SupplierA",
      "status": "SUCCESS",
      "hotels": [...]
    },
    "supplierB": {
      "supplier": "SupplierB",
      "status": "SUCCESS",
      "hotels": [...]
    }
  },
  "message": "Successfully compared rates across both suppliers. Winner: SupplierB",
  "timestamp": "2026-09-03T09:45:00.000Z"
}
```

### `POST /api/search-hotels/:workflowId/cancel`
Cancels an ongoing search workflow mid-flight.

### Mock Supplier Endpoints
- `GET /supplierA/hotels?city=Paris&checkIn=...&checkOut=...&scenario=...`
- `GET /supplierB/hotels?city=Paris&checkIn=...&checkOut=...&scenario=...`
- `POST /mock/reset`

---

## 🛠 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── __tests__/
│   │   │   └── hotelSearchWorkflow.test.ts # All 10 scenario tests with @temporalio/testing
│   │   ├── activities/
│   │   │   └── supplierActivities.ts       # Temporal activities calling supplier APIs
│   │   ├── mockSuppliers/
│   │   │   └── supplierRouter.ts           # Mock Supplier A & B HTTP endpoints
│   │   ├── types/
│   │   │   └── hotel.ts                    # TypeScript types and schemas
│   │   ├── workflows/
│   │   │   └── hotelSearchWorkflow.ts      # Core Temporal workflow orchestration
│   │   ├── server.ts                       # Express API & route handlers
│   │   └── worker.ts                       # Temporal Worker listening on task queue
│   ├── jest.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                         # Minimalist shadcn/ui components
│   │   │   │   ├── alert.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   └── select.tsx
│   │   │   ├── ComparisonResult.tsx        # Best rate display & side-by-side comparison
│   │   │   ├── Header.tsx                  # Clean header with connection status
│   │   │   └── HotelSearchForm.tsx         # Search form & scenario simulator
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── Demo-Video.mov                          # Full demo walkthrough
├── docker-compose.yml                      # Local Temporal server & web UI
├── package.json                            # Root scripts
└── README.md
```

---

## 🔍 Assumptions & Known Limitations

1. **Exchange Rates**: Suppliers are assumed to quote in USD; multi-currency FX conversion is omitted for simplicity.
2. **Synchronous Search API**: `/api/search-hotels` awaits the workflow result and returns the final comparison synchronously in one HTTP round-trip (standard for hotel search widgets). An asynchronous polling pattern or WebSocket could be used for long-running workflows spanning minutes.
3. **Cancellation Scope**: When cancellation occurs mid-flight, activities use Node's `AbortSignal` via Axios to abort the underlying socket immediately, preventing lingering supplier calls.
4. **Mock Supplier State**: Attempt counters for the retry scenario are stored in-memory in the mock supplier service, keyed by search request ID.
5. **[WARN] Activity failed messages**: These are **expected** during failure/retry simulation scenarios (Scenarios 4, 5, 9). They are Temporal's retry mechanism working correctly, not crashes.
