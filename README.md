# Soroverify Watch

Soroverify Watch is a monitoring service for Soroban contracts. It continuously polls contracts that have a known verification result, detecting when their deployed Wasm hash changes. When drift is detected, it publishes a signed record stating that the prior verification no longer applies.

This service does not re-verify anything, does not build source, and does not run containers.

## Running locally

This service requires Node.js 22 LTS.

```bash
npm install
npm run build
```

This service does not auto load `.env` files. You must start it using Node's built in flag:

```bash
node --env-file=.env dist/index.js
```

Note on DNS resolution: On some networks, Node's default DNS resolution to Soroban RPC endpoints fails even when tools like `curl` succeed. If you encounter network timeouts or resolution errors when calling the RPC, start the service with `--dns-result-order=ipv4first`:

```bash
node --env-file=.env --dns-result-order=ipv4first dist/index.js
```

## API Endpoints

- `POST /watch`: Start watching a contract. Requires `contractId` and `network`. A verification record must exist on the upstream verifier. Rate limited.
- `GET /watch/:contractId`: Returns current monitoring status and intervals.
- `DELETE /watch/:contractId`: Sets status to retired.
- `GET /drift/:wasmHash`: Returns signed drift records matching the previous Wasm hash.
- `GET /drift/by-contract/:contractId`: Resolves the contract to a Wasm hash, then returns matching drift records.
- `GET /stats`: Returns system statistics.
- `GET /health`: Returns service liveness.

Read endpoints allow CORS from any origin. Write endpoints do not.

## Operations and Architecture

Refer to the documents in `docs/` for details on the architecture, operations, and threat model.
