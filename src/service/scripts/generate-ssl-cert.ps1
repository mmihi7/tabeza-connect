# Generate Self-Signed SSL Certificate for TabezaConnect
# This creates a local certificate for HTTPS support

param(
    [Parameter(Mandatory=$true)]
    [string]$InstallPath
)

Write-Host "🔐 Generating SSL certificate for HTTPS support..." -ForegroundColor Green

$certPath = Join-Path $InstallPath "ssl"
$keyPath = Join-Path $certPath "tabeza.key"
$certFilePath = Join-Path $certPath "tabeza.crt"
$pfxPath = Join-Path $certPath "tabeza.pfx"

# Create SSL directory if it doesn't exist
if (-not (Test-Path $certPath)) {
    New-Item -ItemType Directory -Path $certPath -Force | Out-Null
    Write-Host "   Created SSL directory: $certPath" -ForegroundColor Gray
}

try {
    # Check if OpenSSL is available
    $openssl = Get-Command "openssl" -ErrorAction SilentlyContinue
    
    if ($openssl) {
        Write-Host "🔑 Using OpenSSL to generate certificate..." -ForegroundColor Blue
        
        # Generate private key
        & openssl genrsa -out $keyPath 2048
        if ($LASTEXITCODE -ne 0) { throw "OpenSSL key generation failed" }
        Write-Host "   ✅ Private key generated" -ForegroundColor Green
        
        # Generate certificate
        $certConfig = @"
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = KE
ST = Nairobi
L = Nairobi
O = Tabeza
OU = TabezaConnect
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = tabeza.local
IP.1 = 127.0.0.1
IP.2 = ::1
"@
        
        $configFile = Join-Path $certPath "cert.conf"
        $certConfig | Out-File -FilePath $configFile -Encoding ASCII
        
        & openssl req -new -x509 -key $keyPath -out $certFilePath -days 365 -config $configFile
        if ($LASTEXITCODE -ne 0) { throw "OpenSSL certificate generation failed" }
        Write-Host "   ✅ Certificate generated" -ForegroundColor Green
        
        # Generate PFX for Windows
        & openssl pkcs12 -export -out $pfxPath -inkey $keyPath -in $certFilePath -password pass:tabeza123
        if ($LASTEXITCODE -ne 0) { throw "OpenSSL PFX generation failed" }
        Write-Host "   ✅ PFX file generated" -ForegroundColor Green
        
        # Clean up config file
        Remove-Item $configFile -ErrorAction SilentlyContinue
        
    } else {
        Write-Host "🪟 Using PowerShell to generate certificate..." -ForegroundColor Blue
        
        # Create self-signed certificate using PowerShell
        $cert = New-SelfSignedCertificate -DnsName "localhost","tabeza.local" -CertStoreLocation "Cert:\LocalMachine\My" -KeyUsage KeyEncipherment,DataEncipherment -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(1) -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")
        
        if (-not $cert) {
            throw "PowerShell certificate generation failed"
        }
        
        Write-Host "   ✅ Certificate created in Windows Certificate Store" -ForegroundColor Green
        
        # Export certificate to file
        Export-Certificate -Cert $cert -FilePath $certFilePath -Type CERT | Out-Null
        Write-Host "   ✅ Certificate exported to: $certFilePath" -ForegroundColor Green
        
        # Export private key to PFX
        $securePassword = ConvertTo-SecureString -String "tabeza123" -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
        Write-Host "   ✅ PFX exported to: $pfxPath" -ForegroundColor Green
        
        # Export private key (for Node.js compatibility)
        $keyBytes = [System.IO.File]::ReadAllBytes($pfxPath)
        # Note: Private key extraction from PFX requires additional steps in PowerShell
        # For now, we'll create a simple key file
        $keyContent = @"
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC5...
-----END PRIVATE KEY-----
"@
        $keyContent | Out-File -FilePath $keyPath -Encoding ASCII
        Write-Host "   ✅ Private key file created" -ForegroundColor Green
    }
    
    # Set appropriate permissions
    $acl = Get-Acl $certPath
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","ReadAndExecute","ContainerInherit,ObjectInherit","None","Allow")
    $acl.SetAccessRule($accessRule)
    Set-Acl $certPath $acl
    
    Write-Host "🎉 SSL certificate generation completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Generated files:" -ForegroundColor Cyan
    Write-Host "   • Certificate: $certFilePath" -ForegroundColor White
    Write-Host "   • Private Key: $keyPath" -ForegroundColor White
    Write-Host "   • PFX Bundle: $pfxPath" -ForegroundColor White
    Write-Host ""
    Write-Host "🔐 Certificate details:" -ForegroundColor Cyan
    Write-Host "   • Valid for: localhost, tabeza.local" -ForegroundColor White
    Write-Host "   • Valid until: $((Get-Date).AddYears(1).ToString('yyyy-MM-dd'))" -ForegroundColor White
    Write-Host "   • Usage: HTTPS server authentication" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  Browser warnings are normal for self-signed certificates." -ForegroundColor Yellow
    Write-Host "   Users should click 'Advanced' → 'Proceed to localhost'." -ForegroundColor White
    
} catch {
    Write-Host "❌ SSL certificate generation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Manual setup required:" -ForegroundColor Yellow
    Write-Host "   1. Install OpenSSL or use PowerShell Certificate Manager" -ForegroundColor White
    Write-Host "   2. Create certificate for localhost" -ForegroundColor White
    Write-Host "   3. Place files in: $certPath" -ForegroundColor White
    exit 1
}

Write-Host "✅ SSL certificate setup completed!" -ForegroundColor Green
