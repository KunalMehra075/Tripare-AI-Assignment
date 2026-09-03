Title: Hotel Rate Comparator using Temporal Workflows
Type: Full Stack (Node.js + TypeScript + Temporal SDK + React/Next.js)

Goal: Build a full-stack app where users can search hotels, with the backend powered by Temporal workflows to fetch and compare hotel rates from two suppliers.
Background
You are building a hotel search engine that finds the best rate by calling two external supplier APIs. These suppliers can have delays or errors. Use Temporal.io to orchestrate the process reliably — fetching, comparing, and returning the best rate.
You will also build a simple React frontend for submitting the search and showing results.

Requirements
1. Frontend (React or Next.js)
A page with a form:


City


Check-in Date


Check-out Date


Submit triggers a backend call.


Show a loading state.


On success: display hotel name, price, supplier.


On failure: show a clear error message.


Use TypeScript. Minimal styling is fine

2. Backend (Node.js + Temporal)
Use Temporal SDK (TypeScript).


Backend endpoint: /api/search-hotels


Workflow logic:


Call Supplier A and Supplier B (in parallel).


Handle errors/timeouts from suppliers.


Select the cheapest result.


Return it to the client.



3. Mock Supplier APIs
Build two endpoints: /supplierA/hotels, /supplierB/hotels


Return hotel list with hotelId, name, price


Simulate varying behaviors:


Delays


Timeouts


Empty responses


Server errors



Scenario Tests
Write unit tests and workflow tests for the following scenarios:
Basic Scenarios
Scenario
Expected Outcome
Supplier A cheaper
Return A’s result
Supplier B cheaper
Return B’s result
Both return same rate
Pick deterministically (e.g., Supplier A)
Supplier A fails, B succeeds
Return B’s result
Both fail
Return error
One returns empty
Use available result
Both return empty
Return "No hotels found"

Advanced Scenarios
Scenario
Expected Behavior
One supplier takes >5s to respond
Cancel slow activity, proceed with one result
Supplier A fails 2x before success
Still succeeds if within retry policy
User cancels the request mid-way 
Workflow should stop gracefully



Submission Instructions
GitHub repo with read access granted to kaushal@tripare.com


Must include:


README.md with setup instructions


Scripts for running frontend, backend, and Temporal Worker


Tests with clear coverage of scenarios


Any known limitations or assumptions



Stack Constraints
Layer
Tech Stack
Frontend
React  (TypeScript)
Backend
Node.js (TypeScript), Temporal SDK
Testing
Jest / Playwright / Your choice
Server APIs
Express.js or any framework you prefer


