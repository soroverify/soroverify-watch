# Architecture

Soroverify Watch is built to be simple, cheap to run, and easy to host independently.

It does not build source code, compile Wasm, or run arbitrary containers. It only monitors.

## Components

- **API**: A Fastify server exposing endpoints to add contracts and read drift records.
- **Database**: PostgreSQL storing watched contracts and an append only log of drift records.
- **Scheduler**: An in process loop that periodically checks watched contracts.
- **RPC Client**: Uses `@stellar/stellar-sdk` to resolve contract IDs to their currently deployed Wasm hashes.
- **Signer**: Signs drift records using an Ed25519 identity.

## Lifecycle of a Check

1. The scheduler selects candidate contracts that are due for a check. Candidates are ordered by priority and bounded by a strict RPC budget.
2. For each candidate, the service fetches its current Wasm hash from the Soroban RPC.
3. If the RPC fails, the failure count is incremented. At 3 consecutive failures, the contract is marked as unreachable.
4. If the RPC succeeds, the failure count is reset.
5. If the hash matches the verified hash, the interval is lengthened up to a configured ceiling.
6. If the hash differs, the service creates a signed drift record, saves it, and marks the contract as drifted. The check interval is reset to its default value.

An RPC failure is never reported as drift. Conflating unreachability with a hash mismatch is a critical error this architecture avoids.
