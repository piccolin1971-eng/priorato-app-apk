# Firma gli exe di Priorato con un certificato di questo PC
# e lo marca come attendibile, così SmartScreen non li blocca.

$ErrorActionPreference = "Stop"
$subject = "CN=Priorato Accoglienza"
$friendly = "Priorato Accoglienza"

function Get-PrioratoCert {
  $existing = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
    Where-Object { $_.FriendlyName -eq $friendly -or $_.Subject -eq $subject } |
    Select-Object -First 1
  if ($existing) { return $existing }

  Write-Host "Creo certificato di firma per questo PC..."
  return New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $subject `
    -FriendlyName $friendly `
    -KeyUsage DigitalSignature `
    -HashAlgorithm SHA256 `
    -CertStoreLocation Cert:\CurrentUser\My `
    -NotAfter (Get-Date).AddYears(15)
}

function Trust-PrioratoCert([System.Security.Cryptography.X509Certificates.X509Certificate2]$cert) {
  $cer = Join-Path $env:TEMP "priorato-codesign.cer"
  Export-Certificate -Cert $cert -FilePath $cer | Out-Null
  foreach ($storeName in @("TrustedPublisher", "Root")) {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, "CurrentUser")
    $store.Open("ReadWrite")
    $store.Add($cert)
    $store.Close()
  }
  $destCer = Join-Path $env:USERPROFILE "Desktop\app\priorato\Priorato-certificato.cer"
  $dir = Split-Path $destCer -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Copy-Item $cer $destCer -Force
}

function Sign-Exe([string]$path, $cert) {
  if (-not (Test-Path -LiteralPath $path)) { return }
  Unblock-File -LiteralPath $path -ErrorAction SilentlyContinue
  $sig = Get-AuthenticodeSignature -LiteralPath $path
  if ($sig.Status -eq "Valid") {
    Write-Host "Gia firmato: $path"
    return
  }
  Write-Host "Firmo: $path"
  $params = @{
    FilePath    = $path
    Certificate = $cert
    HashAlgorithm = "SHA256"
  }
  try {
    $null = Set-AuthenticodeSignature @params -TimestampServer "http://timestamp.digicert.com"
  } catch {
    $null = Set-AuthenticodeSignature @params
  }
  $after = Get-AuthenticodeSignature -LiteralPath $path
  Write-Host "  stato: $($after.Status)"
}

$cert = Get-PrioratoCert
Trust-PrioratoCert $cert

$paths = @(
  (Join-Path $env:USERPROFILE "Desktop\app\priorato\Priorato Accoglienza.exe"),
  (Join-Path $env:USERPROFILE "Desktop\app\priorato\Priorato Accoglienza Setup.exe"),
  (Join-Path $env:USERPROFILE "Desktop\Priorato Accoglienza.exe"),
  (Join-Path $env:LOCALAPPDATA "Programs\Priorato Accoglienza\Priorato Accoglienza.exe"),
  (Join-Path $env:LOCALAPPDATA "Programs\priorato-app\Priorato Accoglienza.exe")
)
Get-ChildItem (Join-Path (Get-Location) "release") -Filter "*.exe" -ErrorAction SilentlyContinue |
  ForEach-Object { $paths += $_.FullName }

$paths | Select-Object -Unique | ForEach-Object { Sign-Exe $_ $cert }

try {
  Add-MpPreference -ExclusionPath (Join-Path $env:USERPROFILE "Desktop\app\priorato") -ErrorAction Stop
  Add-MpPreference -ExclusionPath (Join-Path $env:LOCALAPPDATA "Programs\Priorato Accoglienza") -ErrorAction Stop
  Write-Host "Esclusione Defender aggiunta."
} catch {
  Write-Host "Esclusione Defender non aggiunta (servono diritti amministratore)."
}

Write-Host "Fatto. Chiudi Priorato se e aperto, poi riapri l'app."
