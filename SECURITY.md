# Security Policy

## Supported Versions

Only the current major version is supported with security updates.

## Reporting a Vulnerability

There is **no dedicated security contact set up for this project yet**.

Please do not open a public issue for a security vulnerability. Instead, report it privately via the GitHub Security Advisories tab
(https://github.com/soroverify/soroverify-watch/security/advisories/new) so it reaches the maintainers without being public.

We will acknowledge receipt of the report and provide an estimated timeline for resolution.

## Scope

The parts of this repo that handle untrusted input are:

- **`POST /watch`, `DELETE /watch/:contractId`**: accept a `contractId` and `network` from any caller, and gate retirement on a `manageToken` that must match the one issued at creation.
- **Soroban RPC responses**: the service polls RPC endpoints for the current Wasm hash of a watched contract; a malformed or unexpected response must not crash the checker.
- **soroverify-verifier API responses**: the service resolves a contract's last-verified Wasm hash from the upstream verifier and treats it as third-party input, not as trusted without validation.
- **Read endpoints** (`GET /watch/:contractId`, `GET /drift/:wasmHash`, `GET /drift/by-contract/:contractId`, `GET /stats`) are public and unauthenticated by design; do not report their lack of authentication as a vulnerability, that is the intended trust model for read-only monitoring data.
