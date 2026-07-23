$token = "YOUR_GITHUB_TOKEN"
$repo = "urnova/azuria-launcher"
$tag = "v1.1.75"

$releaseBody = @{
    tag_name = $tag
    name = "Mise a jour 1.1.75"
    body = "- Correctifs crash inventaire`n- Metier Aventurier: Progression et Homes gratuits/payants`n- Raccourci touche R (Menu Rapide)"
    draft = $false
    prerelease = $false
} | ConvertTo-Json

$headers = @{
    Authorization = "token $token"
    Accept = "application/vnd.github.v3+json"
}

try {
    $releaseRes = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Body $releaseBody -ContentType "application/json"
} catch {
    Write-Host "Release already exists, fetching..."
    $releaseRes = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$repo/releases/tags/$tag" -Headers $headers
}
$uploadUrl = $releaseRes.upload_url.Split('{')[0]
Write-Host "Upload URL is $uploadUrl"
Write-Host "Release created!"

$files = @(
    "F:\code\azuria\azuriav3\azuria-launcher\release5\AzuriaSetup-1.1.75.exe",
    "F:\code\azuria\azuriav3\azuria-launcher\release5\latest.yml",
    "F:\code\azuria\azuriav3\mods-v3-update.zip"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $name = [System.IO.Path]::GetFileName($file)
        $uri = "$uploadUrl?name=$name"
        Write-Host "Uploading $name with curl..."
        $curlArgs = "-L", "-X", "POST", "-H", "Accept: application/vnd.github+json", "-H", "Authorization: Bearer $token", "-H", "X-GitHub-Api-Version: 2022-11-28", "-H", "Content-Type: application/octet-stream", "$uri", "--data-binary", "@$file"
        & curl.exe $curlArgs
    } else {
        Write-Host "File not found: $file"
    }
}
Write-Host "Release published!"
