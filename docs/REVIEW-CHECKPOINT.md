# Review checkpoint

## Resume here

We paused the line-by-line Terraform lesson at `infra/terraform/providers.tf`.
Covered: AWS provider configuration, region from `var.aws_region` (CI supplies
`TF_VAR_aws_region`), default tags, availability-zone data source, and the
Canonical Ubuntu AMI ID read from SSM Parameter Store. Resume with questions
about those data sources, then continue to `backend.tf` and `bootstrap/`.

## Pre-interview fixes

- Remove the obsolete `.github/workflows/ci.yml`; keep `ci-cd.yml`.
- Align CI checks with the Docker images on Node 24.
- Run existing backend tests and fail if frontend tests disappear.
- Check each deployment shell script individually.
- Remove Telegram credential defaults from Terraform; read
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from GitHub Actions Secrets.
- Check `/healthz` and successful HTTP status in deployment scripts.
- Accept the SHA-attempt release tags produced by CI.
- Pass `COMPOSE_PROJECT_NAME` in SSH deployment as well as SSM deployment.
- Update lock-file entries for critical transitive dependencies: `proxy-addr`,
  `form-data`, `shell-quote`, and `websocket-driver`, preserving parent-package
  version constraints. Keep remaining audit findings for a separate review.
- Fail CI on new critical dependency audit findings.

## Required external action

Revoke the previously committed Telegram bot token and set its replacement in
GitHub Actions Secrets before the next production release. Set
`TELEGRAM_CHAT_ID` there as well. Removing a secret from the current source does
not remove it from Git history, existing Terraform state, or deployed Lambda
configuration. Do not paste credentials into this document or the chat.

The user confirmed that both GitHub Actions Secrets are already configured.
Revocation/replacement of the previously exposed token still needs to be
confirmed separately.

## Verification on 2026-10-30

- Terraform formatting and validation passed for the application module.
- Deployment Bash syntax checks passed.
- Workflow YAML parsed successfully.
- Backend clean install, explicit Prisma Client generation, and 22 tests passed.
- Client clean install, production build, and 57 tests passed in Linux/Node 24.
- `npm audit --omit=dev` reports zero Critical findings in both lock files;
  High findings remain and are not claimed to be resolved.
- No Terraform apply, production deployment, or Git push was performed as part
  of these fixes. Workflow removal takes effect on GitHub only after publishing
  the changes; historical workflow runs are intentionally retained.

## Deferred review

These changes are not a complete security audit. Still review image uploads
(currently saved to a client directory absent from the server container),
dependency audit findings, the intentional mentor SSH rule, RDS deletion and
backup settings, SNS/KMS delivery permissions, and publication of S3 `current`
before release success. Do not change access rules or apply infrastructure
without reviewing their intended operational impact.
