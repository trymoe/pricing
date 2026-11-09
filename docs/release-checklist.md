# Release checklist

1. Confirm the target is the independent public repository `trymoe/pricing`, never the private application repository. Do not copy a `.git` directory or import old history.
2. Keep only the explicit file list in `scripts/release-files.json`. Review every file and any history being published. No database, user submissions, deployment configurations, credential files, screenshots or real provider datasets.
3. Review dependency licenses and registry integrity. Runtime dependencies must stay empty unless deliberately reviewed. Do not ship `node_modules`.
4. Run `npm ci`, `npm run check`, `npm run demo:build`, and `npm run test:package`. The final command verifies exact tarball contents, a fresh consumer, and a clean source install using an empty npm cache.
5. `npm run scan` checks known secret patterns, forbidden paths, release file whitelist, dependencies and all local Git history. It is a useful guard, not proof that arbitrary secrets cannot exist. Manual review is still required.
6. Inspect the actual demo on desktop and mobile, including invalid input, promotion expiry, tier boundaries, repeated changes and reset. Verify it makes no remote data requests.
7. Commit only reviewed files into a fresh history. Rerun the scan after committing. Verify the exact remote SHA and CI for that SHA before claiming publication is complete.
8. Package-registry publication is separate from a public GitHub repository. Do not say an npm version exists until its registry publication is verified. Do not copy credentials into a repository, shell history or CI configuration.

The package intentionally excludes live quotes and third-party assets. The demo's outbound TryMoe and GitHub links are navigation only; calculation is local.
