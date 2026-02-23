# Contributing to Open Query

Thank you for your interest in contributing! This document explains how to get involved.

## Ways to Contribute

- **Bug reports** — Open an issue with steps to reproduce
- **Feature requests** — Open an issue describing the use case
- **Code contributions** — Fork, branch, and open a pull request
- **Documentation** — Improvements to README, docs/, or code comments

## Development Setup

```bash
git clone https://github.com/jonathanlarav/open-query.git
cd open-query
pnpm install

# Copy env and set MASTER_KEY
cp apps/api/.env.example apps/api/.env

# Apply DB migrations
pnpm db:migrate

# Start dev servers (web on :3000, api on :3001)
pnpm dev
```

## Before Submitting a PR

1. **Run typechecks** — `pnpm typecheck` must pass with no new errors
2. **Run lint** — `pnpm lint` must pass
3. **Run tests** — `pnpm test` must pass
4. **Stay within 200 lines per file** — split helpers if needed
5. **Follow existing patterns** — see [CLAUDE.md](CLAUDE.md) for conventions

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- Reference any related issues (`Closes #123`)
- Add or update documentation if behavior changes

## Reporting Bugs

Please include:
- Steps to reproduce
- Expected vs actual behavior
- OS, Node version, browser (if frontend)
- Relevant logs or error messages

For security vulnerabilities, see [SECURITY.md](SECURITY.md) — do not open a public issue.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
