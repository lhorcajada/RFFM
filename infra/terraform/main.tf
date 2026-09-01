data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# Free tier: 5GB/month ingestion included. Daily cap keeps costs at $0 if traffic spikes.
resource "azurerm_log_analytics_workspace" "main" {
  name                = var.log_analytics_workspace_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 0.5
}

resource "azurerm_container_app_environment" "main" {
  name                       = var.container_app_environment_name
  location                   = data.azurerm_resource_group.main.location
  resource_group_name        = data.azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

resource "azurerm_container_app" "api" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = data.azurerm_resource_group.main.name
  revision_mode                = "Single"

  secret {
    name  = "ghcr-pat"
    value = var.ghcr_pat
  }
  secret {
    name  = "jwt-key"
    value = var.jwt_key
  }
  secret {
    name  = "frontend-secret"
    value = var.frontend_secret
  }
  secret {
    name  = "db-connection-string"
    value = var.db_connection_string
  }
  secret {
    name  = "smtp-password"
    value = var.smtp_password
  }
  secret {
    name  = "supabase-service-key"
    value = var.supabase_service_key
  }

  registry {
    server               = "ghcr.io"
    username             = var.ghcr_username
    password_secret_name = "ghcr-pat"
  }

  template {
    # Scale-to-zero: no traffic = no consumption/cost.
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "rffm-api"
      image  = var.container_image
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "ASPNETCORE_ENVIRONMENT"
        value = "Production"
      }
      env {
        name  = "ASPNETCORE_URLS"
        value = "http://+:8080"
      }
      # Self-referential: Container Apps assigns <name>.<environment default domain>,
      # known at plan time without depending on the app's own state.
      env {
        name  = "ApiBase"
        value = "https://${var.container_app_name}.${azurerm_container_app_environment.main.default_domain}"
      }
      env {
        name  = "FrontUrlBase"
        value = var.front_url_base
      }
      env {
        name  = "Jwt__Issuer"
        value = var.jwt_issuer
      }
      env {
        name  = "Jwt__Audience"
        value = var.jwt_audience
      }
      env {
        name        = "Jwt__Key"
        secret_name = "jwt-key"
      }
      env {
        name        = "Authentication__FrontendSecret"
        secret_name = "frontend-secret"
      }
      env {
        name        = "ConnectionStrings__FutbolBaseConnection"
        secret_name = "db-connection-string"
      }
      env {
        name  = "Smtp__Host"
        value = var.smtp_host
      }
      env {
        name  = "Smtp__Port"
        value = var.smtp_port
      }
      env {
        name  = "Smtp__User"
        value = var.smtp_user
      }
      env {
        name        = "Smtp__Password"
        secret_name = "smtp-password"
      }
      env {
        name  = "Smtp__FromEmail"
        value = var.smtp_from_email
      }
      env {
        name  = "Smtp__FromName"
        value = var.smtp_from_name
      }
      env {
        name  = "Seed__AdminEmail"
        value = var.admin_email
      }
      env {
        name  = "SupabaseStorage__Url"
        value = var.supabase_url
      }
      env {
        name        = "SupabaseStorage__ServiceKey"
        secret_name = "supabase-service-key"
      }
      env {
        name  = "Storage__UseLocal"
        value = "false"
      }

      dynamic "env" {
        for_each = { for idx, origin in var.cors_allowed_origins : tostring(idx) => origin }
        content {
          name  = "Cors__AllowedOrigins__${env.key}"
          value = env.value
        }
      }

      # Cold start (scale-to-zero) runs EF migrations + several seeds before Kestrel
      # starts listening, which can take longer than the default startup probe budget.
      # Give it a generous window via /liveness instead of failing on the default TCP probe.
      startup_probe {
        transport               = "HTTP"
        port                    = 8080
        path                    = "/liveness"
        interval_seconds        = 10
        timeout                 = 3
        failure_count_threshold = 10
      }
    }
  }

  ingress {
    external_enabled = true
    target_port       = 8080
    transport         = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  lifecycle {
    # The CD workflow deploys new images directly via `az containerapp update`;
    # Terraform should not fight that on every apply.
    ignore_changes = [
      template[0].container[0].image,
    ]
  }
}
