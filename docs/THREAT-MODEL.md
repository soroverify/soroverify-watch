# Threat Model

## Trust Model

Soroverify Watch operates independently of the verifier. It does not share a database with the verifier, nor does it possess write access to the verifier's records.

Multiple instances of this watcher can run independently. Their collective agreement serves as a stronger signal of drift.

## Potential Threats

- **RPC Spoofing**: If the RPC endpoint returns incorrect hashes, the watcher could falsely report drift. This is mitigated by using trusted RPC endpoints and the multi-watcher design.
- **Resource Exhaustion**: The `POST /watch` endpoint could be spammed. This is mitigated by strictly rate limiting the endpoint and requiring a valid verification record from the upstream verifier before any database insert.
- **Key Compromise**: If the `WATCHER_PRIVATE_KEY` is compromised, an attacker can sign fake drift records. Private keys must be kept secure.

An RPC failure must never be reported as drift. A failure to connect or read from the network does not prove that the code running on chain has changed.
