# Terraform resolves dependencies independently of file order; data sources are
# kept first here for readability.
data "aws_caller_identity" "current" {}

# --- Customer-managed KMS key for S3 encryption (all app buckets) ------
resource "aws_kms_key" "s3" {
  description             = "Customer-managed key for S3 bucket encryption in ${var.project_name}-${var.environment}."
  enable_key_rotation     = true
  deletion_window_in_days = 7

  tags = {
    Name = "${var.project_name}-${var.environment}-s3"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.project_name}-${var.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# --- Бакет для изображений -------------------------------------------------
# Приватный бакет. Публичный доступ закрыт на уровне Public Access Block.
# Публичная раздача статики должна идти через CloudFront + OAC (см. ниже
# заготовку политики), сам бакет при этом остаётся приватным.
resource "aws_s3_bucket" "images" {
  bucket = "${var.project_name}-${var.environment}-images-${data.aws_caller_identity.current.account_id}"

  # Позволяет terraform destroy удалять бакет с объектами.
  force_destroy = true

  tags = {
    Name = "${var.project_name}-${var.environment}-images"
  }
}

# --- Public Access Block (все 4 флага включены) ---------------------------
# Блокирует ACL-политику, публичные bucket policies и публичные списки объектов.
resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- Ownership controls ----------------------------------------------------
# Отключаем ACL-и и делаем бакет owner-enforced — стандарт AWS с 2023 года.
resource "aws_s3_bucket_ownership_controls" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# --- Шифрование по умолчанию (SSE-S3) -------------------------------------
# Если нужен SSE-KMS с управляемым ключом — заменить aws:kms и добавить kms_master_key_id.
resource "aws_s3_bucket_server_side_encryption_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

# --- Версионирование -------------------------------------------------------
resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id

  versioning_configuration {
    status = "Enabled"
  }
}

# --- Логирование доступа в отдельный бакет ---------------------------------
# Создаём отдельный приватный бакет для access-логов.
resource "aws_s3_bucket" "images_logs" {
  bucket        = "${var.project_name}-${var.environment}-images-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-${var.environment}-images-logs"
  }
}

resource "aws_s3_bucket_public_access_block" "images_logs" {
  bucket = aws_s3_bucket.images_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "images_logs" {
  bucket = aws_s3_bucket.images_logs.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "images_logs" {
  bucket = aws_s3_bucket.images_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "images_logs" {
  bucket = aws_s3_bucket.images_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Политика на целевой бакет логов — разрешает сервису S3 писать логи.
resource "aws_s3_bucket_policy" "images_logs" {
  bucket = aws_s3_bucket.images_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "S3ServerAccessLogsPolicy"
        Effect    = "Allow"
        Principal = { Service = "logging.s3.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.images_logs.arn}/access-logs/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
          ArnLike = {
            "aws:SourceArn" = aws_s3_bucket.images.arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_logging" "images" {
  bucket = aws_s3_bucket.images.id

  target_bucket = aws_s3_bucket.images_logs.id
  target_prefix = "access-logs/"
}

# --- Bucket policy ---------------------------------------------------------
# Бакет по умолчанию закрыт для анонимного доступа. Публичная раздача
# должна идти через CloudFront + OAC. Приведённая ниже политика —
# безопасная заготовка, разрешающая чтение только сервису CloudFront
# из конкретного distribution (см. переменную cloudfront_distribution_arn).
#
# Чтобы включить — задайте переменную cloudfront_distribution_arn
# (её значение можно получить из aws_cloudfront_distribution.arn).
resource "aws_s3_bucket_policy" "images_cloudfront_oac" {
  count  = var.cloudfront_distribution_arn != "" ? 1 : 0
  bucket = aws_s3_bucket.images.id

  depends_on = [aws_s3_bucket_public_access_block.images]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOACReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.images.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = var.cloudfront_distribution_arn
          }
          Bool = {
            "aws:SecureTransport" = "true"
          }
        }
      }
    ]
  })
}
