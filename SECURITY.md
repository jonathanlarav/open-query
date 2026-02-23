# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately by emailing the maintainers or using [GitHub's private vulnerability reporting](https://github.com/jonathanlarav/open-query/security/advisories/new).

Include as much of the following as possible:

- Description of the vulnerability and potential impact
- Steps to reproduce or proof-of-concept
- Affected versions
- Any suggested mitigations

You can expect an acknowledgement within 48 hours and a resolution timeline within 7 days for critical issues.

## Security Considerations

Open Query is a self-hostable tool. When deploying:

- **`MASTER_KEY`** — Use a strong, randomly generated key (`openssl rand -base64 32`). This key encrypts all stored database credentials. Do not reuse keys across environments.
- **Database credentials** — Always use read-only database users. Open Query enforces read-only access in software, but a read-only DB user is an additional safety layer.
- **Network exposure** — The API server (port 3001) is not intended to be publicly exposed. Run it behind a reverse proxy with authentication if deploying beyond localhost.
- **LLM API keys** — Stored encrypted in the SQLite database. Protect the database file and the `MASTER_KEY`.

## Supported Versions

| Version | Supported |
|---|---|
| latest (`main`) | ✅ |
