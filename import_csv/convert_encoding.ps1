param(
    [string]$src,
    [string]$dst,
    [int]$enc = 874
)
try {
    $srcEnc = [System.Text.Encoding]::GetEncoding($enc)
    $text   = [System.IO.File]::ReadAllText($src, $srcEnc)
    $utf8   = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($dst, $text, $utf8)
    Write-Host "OK:$($text.Length)"
    exit 0
} catch {
    Write-Host "ERR:$_"
    exit 1
}