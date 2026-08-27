variable "subscription_id" {
  description = "Azure subscription id (personal 'Pago por uso' subscription)"
  type        = string
}

variable "resource_group_name" {
  description = "Existing resource group to deploy into"
  type        = string
  default     = "CoachResources"
}

variable "container_app_name" {
  description = "Container App name (becomes part of the public FQDN)"
  type        = string
  default     = "rffm-api"
}

variable "container_app_environment_name" {
  type    = string
  default = "rffm-env"
}

variable "log_analytics_workspace_name" {
  type    = string
  default = "rffm-logs"
}

variable "container_image" {
  description = "Full GHCR image reference, e.g. ghcr.io/lhorcajada/rffm-api:latest"
  type        = string
  default     = "ghcr.io/lhorcajada/rffm-api:latest"
}

variable "ghcr_username" {
  type    = string
  default = "lhorcajada"
}

variable "ghcr_pat" {
  description = "GitHub PAT with read:packages scope, used by the Container App to pull the private image"
  type        = string
  sensitive   = true
}

variable "jwt_key" {
  type      = string
  sensitive = true
}

variable "jwt_issuer" {
  type    = string
  default = "FutbolBaseAPI"
}

variable "jwt_audience" {
  type    = string
  default = "FutbolBaseAPIUsers"
}

variable "frontend_secret" {
  type      = string
  sensitive = true
}

variable "db_connection_string" {
  type      = string
  sensitive = true
}

variable "smtp_host" {
  type    = string
  default = "smtp.gmail.com"
}

variable "smtp_port" {
  type    = string
  default = "587"
}

variable "smtp_user" {
  type    = string
  default = "futbolbase.notify@gmail.com"
}

variable "smtp_password" {
  type      = string
  sensitive = true
}

variable "smtp_from_email" {
  type    = string
  default = "futbolbase.notify@gmail.com"
}

variable "smtp_from_name" {
  type    = string
  default = "Futbol Base"
}

variable "admin_email" {
  type    = string
  default = "futbolbase.notify@gmail.com"
}

variable "supabase_url" {
  type    = string
  default = "https://kecqsiidmkmnekltlpol.supabase.co"
}

variable "supabase_service_key" {
  type      = string
  sensitive = true
}

variable "front_url_base" {
  description = "Frontend URL (Netlify) - unrelated to the API deployment, kept for CORS/email links"
  type        = string
  default     = "https://rffm.netlify.app"
}

variable "cors_allowed_origins" {
  type = list(string)
  default = [
    "https://rffm.netlify.app",
    "https://mayflower-suffering-swivel.ngrok-free.dev"
  ]
}
