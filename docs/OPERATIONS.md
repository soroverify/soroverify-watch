# Operations

## Deployment

Deploy the service as a standard Node.js application alongside a PostgreSQL database.

The application is stateless beyond the database and its private key.

## Keys and Identity

You must manage the `WATCHER_PRIVATE_KEY` securely. If left unset, the service generates an ephemeral identity per boot. The watcher ID will change across restarts, rendering old records unverifiable by the new identity, though they remain mathematically valid for the old identity.

## Rate Limiting

The `POST /watch` endpoint requires a valid verification record from the upstream verifier. Rate limiting is applied, but this verification precondition is the primary defence against abuse.
