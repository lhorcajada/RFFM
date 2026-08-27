# Infraestructura — Azure Container Apps

Provisiona el entorno de despliegue de `Back/ExtractionApi` en Azure Container Apps
(plan Consumption, scale-to-zero). El coste esperado es ~$0/mes dentro de la capa
gratuita (Container Apps Consumption + Log Analytics con `daily_quota_gb` limitado).

No se gestiona con CI: se aplica manualmente desde este equipo (state local, ver
`.gitignore`). El CD de GitHub Actions (`.github/workflows/back-cd.yml`) solo
construye la imagen, la publica en GHCR y actualiza la revisión del Container App
ya existente vía `az containerapp update` — no toca Terraform.

## Primer despliegue

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # y rellena los valores reales
terraform init
terraform plan
terraform apply
```

## Tras aplicar

1. Anota el `api_base_url` de salida.
2. Verifica que las plantillas de email (`ConfirmUserTemplate.html` vía `ApiBase`)
   apuntan a esa URL — Terraform ya fija `ApiBase` automáticamente al dominio del
   Container App, no requiere paso manual.
3. Construye y publica la primera imagen a GHCR (o dispara manualmente el workflow
   `CD - ExtractionApi Deploy to Azure Container Apps` vía `workflow_dispatch`) para
   que el Container App tenga una revisión real además del `container_image` inicial.

## Cambiar un secreto (JWT key, SMTP, etc.)

Edita `terraform.tfvars` y vuelve a ejecutar `terraform apply` — no hace falta tocar
GitHub Actions para esto, ya que esos secretos viven en el Container App, no en el CD.
