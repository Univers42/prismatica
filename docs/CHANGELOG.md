# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Test suite for Theme normalization and configuration logic
- Test suite for email typo correction (`editDistance` and `suggestedEmailDomain`)
- Vitest and happy-dom test framework configuration
- Baseline test suite for auth validation logic (`checkPasswordStrength` and `passwordRuleResults`)

### Changed
- Extracted pure Theme configuration logic from `main.ts` into `src/lib/theme-config.ts`.
- Extracted email format validation from `main.ts` to `src/lib/email-validation.ts` decoupled from the DOM.
- Extracted pure authentication validation logic from `src/scripts/main.ts` and `src/scripts/password-strength.ts` into `src/lib/auth-validation.ts` to enable testing in isolation.
