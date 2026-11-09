# Contributing

Use Node.js 22+ with full ICU support. Run `npm ci`, `npm run check`, `npm run demo:build`, and `npm run test:package` before submitting a change.

Keep the runtime dependency-free and deterministic when `now` is supplied. Add fixed-time synthetic tests for all changed boundaries. Avoid silently supporting a billing rule whose meaning has not been specified. New currencies, progressive tiers, caching and exact-decimal settlement require explicit API design.

Do not submit production data, credentials, API keys, personal information, provider catalogs or copied third-party material. Use invented prices and generic labels. Report security issues without placing secret values in public issues. For an accidentally exposed credential, revoke it with the issuing service immediately; deleting a commit is not revocation.
