$token = "YOUR_GITHUB_TOKEN"
$repo = "urnova/azuria-launcher"
$tag = "v1.1.47"

$headers = @{
    Authorization = "token $token"
    Accept = "application/vnd.github.v3+json"
}

# 1. Get the release ID
$releases = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers
$release = $releases | Where-Object { $_.tag_name -eq $tag } | Select-Object -First 1

if (-not $release) {
    Write-Host "Release not found!"
    exit
}

$releaseId = $release.id
Write-Host "Found release $releaseId"

# 2. Delete existing assets (latest.yml and AzuriaSetup-1.1.47.exe)
foreach ($asset in $release.assets) {
    if ($asset.name -eq "AzuriaSetup-1.1.47.exe" -or $asset.name -eq "latest.yml") {
        Write-Host "Deleting old asset: $($asset.name) (ID: $($asset.id))"
        Invoke-RestMethod -Method Delete -Uri "https://api.github.com/repos/$repo/releases/assets/$($asset.id)" -Headers $headers
    }
}

# 3. Upload new assets
$uploadUrl = "https://uploads.github.com/repos/$repo/releases/$releaseId/assets"

$files = @(
    "F:\code\azuria\azuriav3\azuria-launcher\release\AzuriaSetup-1.1.47.exe",
    "F:\code\azuria\azuriav3\azuria-launcher\release\latest.yml"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $name = [System.IO.Path]::GetFileName($file)
        $uri = "{0}?name={1}" -f $uploadUrl, $name
        Write-Host "Uploading $name to $uri ..."
        Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -InFile $file -ContentType "application/octet-stream" -TimeoutSec 600
        Write-Host "Uploaded $name!"
    } else {
        Write-Host "File not found: $file"
    }
}
Write-Host "Update completed successfully!"
