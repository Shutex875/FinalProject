## Что и зачем
Починка рассинхрона стейта и кода + перевод деплоя на SSM.

## Изменения
- Удалены inline `ingress`/`egress` из `aws_security_group` (фикс `InvalidPermission.NotFound` при refresh/apply).
- Восстановлены `aws_vpc_security_group_ingress_rule.ssh` и `ssh_mentor` + переменные `ssh_ingress_cidr`/`ec2_key_name`.
- `backend.tf` — пустой `backend "s3" {}`, чтобы CI `-backend-config` реально применялся; убран `use_lockfile`, оставлен DynamoDB-lock.
- `ENVIRONMENT`/`TF_VAR_environment` по умолчанию `development` (совпадает с существующими `deck-market-development-*`).
- Добавлена IAM-политика `github-actions-deployer-additional-policy.json` (refresh-чтение, ECR push, SSM deploy).
- Деплой через SSM (`send-command`), рефактор `docker-compose.prod.yml` на ECR-образы, `deploy.sh`/`user-data.sh.tpl`.

## Проверки
- `terraform fmt -check` — OK
- `terraform validate` — OK

## ⚠️ Перед merge
- Прикрепить IAM-политику к `github-actions-deployer`.
- Задать GitHub Variable `ENVIRONMENT=development`.

## ⚠️ Внимание
PR смотрит на `master`, но текущий `release` job в `ci-cd.yml` триггерится на `main`/`master` — деплой выполнится только при push в `master` или `workflow_dispatch`. На этой ветке отработают `terraform-check`/`backend-check`/`frontend-check`.
