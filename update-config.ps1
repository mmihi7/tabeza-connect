$config = @{  
  barId = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'  
  driverId = 'driver-MIHI-PC'  
  apiUrl = 'https://staff.tabeza.co.ke'  
  bridge = @{  
    enabled = $true  
    printerName = 'EPSON L3210 Series'  
    captureFolder = 'C:\TabezaPrints'  
    tempFolder = 'C:\TabezaPrints\temp'  
    autoConfigure = $true  
  }  
  service = @{  
    port = 8765  
  }  
}  
$config | ConvertTo-Json -Depth 5 | Out-File -FilePath 'C:\ProgramData\Tabeza\config.json' -Encoding UTF8 -Force  
Write-Host 'Config updated successfully' -ForegroundColor Green 
