# Friction log (Arkiv)

Honest notes from building on SDK 1.0.1 / Rabdi, 2026-11-06.

1. **Typed predicates on system fields.** `gt("$expiresAt", 0n)` throws `InvalidPredicateError: "$expiresAt" is a u64, but the value is a u256`. You need `u64(0)`. The error message is excellent; the README example could show it.
2. **A query needs a filter.** `client.select(...).limit(3).fetch()` with no `where`/`from`/`ownedBy` throws during `toString()`, so it isn't obvious that a bare select isn't allowed.
3. **Access key in the URL path.** It's a sensible choice, but it means a browser app *must* proxy RPC to keep the key private. We wrote `/api/arkiv-rpc` with a method allowlist. A first-party "browser-safe read key" or CORS-enabled keyless read tier would remove this step.
4. **Smart accounts don't fit.** Native ops require the EOA to send the transaction, so thirdweb gas sponsorship (4337/7702) can't be used. We added a faucet-relay route that funds new users with tGLM. A paymaster-like "sponsored native op" would make consumer onboarding much smoother.
5. **Block-based expiry vs wall-clock UX.** Users pick "24 hours"; Arkiv thinks in blocks (2 s nominal). We store an indexed `expiresAtMs` too, and filter on it, so the UI and the doctor view agree to the second.
6. **Funding for verification.** The faucet is browser-only, so CI/agents can't self-fund a test key; write-path verification had to wait for a human.
