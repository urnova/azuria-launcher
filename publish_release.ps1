$token = if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } else { "" }
$repo = "urnova/azuria-launcher"
$tagName = "1.1.98"
$releaseName = "Azuria Launcher 1.1.98"
$body = "Mise a jour (1.1.98) : Correction du crash AZ-008 (GL_OUT_OF_MEMORY) pour tous les joueurs en optimisant les parametres graphiques."
$repoUrl = "https://api.github.com/repos/$repo/releases"

$headers = @{
    Authorization = "token $token"
    Accept = "application/vnd.github.v3+json"
}

# --- Créer la release (Draft = false, Prerelease = false) ---
$releaseData = @{
    tag_name = $tagName
    name = $releaseName
    body = $body
    draft = $false
    prerelease = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $repoUrl -Method Post -Headers $headers -Body $releaseData -ContentType "application/json" -Proxy $null
} catch {
    Write-Host "Release already exists, fetching..."
    $response = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$repo/releases/tags/$tagName" -Headers $headers -Proxy $null
}

$uploadUrl = $response.upload_url -replace '\{.*\}', ''
Write-Host "Upload URL is $uploadUrl"
Write-Host "Release created!"

$filesToUpload = @(
    "F:\code\azuria\azuriav3\azuria-launcher\release_build5\AzuriaSetup-$tagName.exe",
    "F:\code\azuria\azuriav3\azuria-launcher\release_build5\latest.yml",
    "F:\code\azuria\azuriav3\mods-v3.zip"
)

foreach ($file in $filesToUpload) {
    if (Test-Path $file) {
        $name = [System.IO.Path]::GetFileName($file)
        $uri = "${uploadUrl}?name=$name"
        Write-Host "Uploading $name with Invoke-RestMethod..."
        Write-Host ">>>$uri<<<"
        $uploadHeaders = @{
            Authorization = "token $token"
            Accept = "application/vnd.github.v3+json"
            "Content-Type" = "application/octet-stream"
        }
        Invoke-RestMethod -Uri $uri -Method Post -Headers $uploadHeaders -InFile $file -Proxy $null
    } else {
        Write-Host "File not found: $file"
    }
}
Write-Host "Release published!"
