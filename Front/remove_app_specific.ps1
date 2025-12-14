Set-Location 'C:/Proyects/MisProyectos/RFFM/Front'
$paths = @( 
 'src/apps/coach/components/ui/AppHeader/AppHeader.tsx',
 'src/apps/coach/components/ui/AppHeader/AppHeader.module.css',
 'src/apps/coach/components/ui/BaseLayout/BaseLayout.tsx',
 'src/apps/coach/components/ui/BaseLayout/BaseLayout.module.css',
 'src/apps/federation/components/ui/AppHeader/AppHeader.tsx',
 'src/apps/federation/components/ui/AppHeader/AppHeader.module.css',
 'src/apps/federation/components/ui/BaseLayout/BaseLayout.tsx',
 'src/apps/federation/components/ui/BaseLayout/BaseLayout.module.css',
 'src/apps/federation/components/ui/Footer/Footer/Footer.tsx',
 'src/apps/federation/components/ui/Footer/Footer/Footer.module.css'
)
foreach($p in $paths){
 if(Test-Path $p){ Remove-Item -Path $p -Force; Write-Host "Deleted: $p" } else { Write-Host "Not found: $p" }
}
# remove empty directories (bottom-up)
$dirs = @( 
 'src/apps/coach/components/ui/AppHeader',
 'src/apps/coach/components/ui/BaseLayout',
 'src/apps/coach/components/ui',
 'src/apps/coach/components',
 'src/apps/coach',
 'src/apps/federation/components/ui/AppHeader',
 'src/apps/federation/components/ui/BaseLayout',
 'src/apps/federation/components/ui/Footer/Footer',
 'src/apps/federation/components/ui/Footer',
 'src/apps/federation/components/ui',
 'src/apps/federation/components',
 'src/apps/federation'
)
foreach($d in $dirs){
 if(Test-Path $d -PathType Container){
   if((Get-ChildItem -Path $d -Recurse -Force | Measure-Object).Count -eq 0){
     Remove-Item -Path $d -Force -Recurse; Write-Host "Removed empty dir: $d"
   }
 }
}
# run build
npm run build
