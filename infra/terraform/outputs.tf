output "api_base_url" {
  description = "Public URL of the deployed API"
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "container_app_environment_default_domain" {
  value = azurerm_container_app_environment.main.default_domain
}
