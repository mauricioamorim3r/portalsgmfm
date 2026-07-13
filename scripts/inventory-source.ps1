param(
    [string]$SourceRoot = "C:\MPFM\NOVO\Painel_Operador",
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\docs\inventory")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
    throw "Source directory not found: $SourceRoot"
}

$source = (Resolve-Path -LiteralPath $SourceRoot).Path.TrimEnd("\")
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path

$files = Get-ChildItem -LiteralPath $source -Recurse -Force -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($source.Length).TrimStart("\")
    $segments = $relativePath -split "\\"
    $topLevel = if ($segments.Count -gt 1) { $segments[0] } else { "[root]" }
    $extension = if ($_.Extension) { $_.Extension.ToLowerInvariant() } else { "[none]" }
    $category = switch -Regex ($extension) {
        '^\.html?$' { "html"; break }
        '^\.(js|jsx|ts|tsx)$' { "javascript-typescript"; break }
        '^\.(css|scss|sass|less)$' { "styles"; break }
        '^\.(png|jpe?g|gif|webp|bmp|ico)$' { "image"; break }
        '^\.svg$' { "svg"; break }
        '^\.(xlsx|xlsm|xlsb|xls)$' { "excel"; break }
        '^\.jsonl?$' { "json"; break }
        '^\.csv$' { "csv"; break }
        '^\.(pdf|docx?|pptx?|msg|txt|md)$' { "document"; break }
        '^\.(zip|7z|rar)$' { "archive"; break }
        default { "other" }
    }

    [PSCustomObject]@{
        RelativePath = $relativePath
        Name = $_.Name
        Extension = $extension
        Category = $category
        TopLevel = $topLevel
        SizeBytes = $_.Length
        LastWriteTime = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        SourcePath = $_.FullName
    }
}

$inventoryPath = Join-Path $output "source-files.csv"
$files | Sort-Object RelativePath | Export-Csv -LiteralPath $inventoryPath -NoTypeInformation -Encoding utf8

$hashCandidates = $files |
    Where-Object {
        $_.RelativePath -notmatch '(^|\\)(\.git|node_modules|dist|__pycache__)(\\|$)'
    } |
    Group-Object SizeBytes |
    Where-Object Count -gt 1 |
    ForEach-Object { $_.Group }

$duplicates = $hashCandidates | ForEach-Object {
    [PSCustomObject]@{
        Hash = (Get-FileHash -LiteralPath $_.SourcePath -Algorithm SHA256).Hash
        SizeBytes = $_.SizeBytes
        RelativePath = $_.RelativePath
        LastWriteTime = $_.LastWriteTime
    }
} | Group-Object Hash | Where-Object Count -gt 1 | ForEach-Object {
    $groupId = $_.Name.Substring(0, 12)
    $_.Group | ForEach-Object {
        [PSCustomObject]@{
            DuplicateGroup = $groupId
            SHA256 = $_.Hash
            SizeBytes = $_.SizeBytes
            RelativePath = $_.RelativePath
            LastWriteTime = $_.LastWriteTime
        }
    }
}

$duplicatesPath = Join-Path $output "exact-duplicates.csv"
$duplicates | Sort-Object DuplicateGroup, RelativePath | Export-Csv -LiteralPath $duplicatesPath -NoTypeInformation -Encoding utf8

$categoryRows = $files | Group-Object Category | Sort-Object Count -Descending
$topLevelRows = $files | Group-Object TopLevel | ForEach-Object {
    [PSCustomObject]@{
        Name = $_.Name
        Count = $_.Count
        Bytes = ($_.Group | Measure-Object SizeBytes -Sum).Sum
    }
} | Sort-Object Bytes -Descending

$summary = @(
    "# Inventario da fonte Painel_Operador"
    ""
    "Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
    ""
    "Fonte (somente leitura): ``$source``"
    ""
    "Total de arquivos: **$($files.Count)**"
    ""
    "## Categorias"
    ""
    "| Categoria | Arquivos |"
    "|---|---:|"
)

$summary += $categoryRows | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$summary += @(
    ""
    "## Maiores grupos de primeiro nivel"
    ""
    "| Grupo | Arquivos | Tamanho (MiB) |"
    "|---|---:|---:|"
)
$summary += $topLevelRows | Select-Object -First 30 | ForEach-Object {
    "| $($_.Name.Replace('|', '\|')) | $($_.Count) | $([math]::Round($_.Bytes / 1MB, 2)) |"
}
$summary += @(
    ""
    "## Duplicidades"
    ""
    "Duplicidades exatas fora de ``.git``, ``node_modules``, ``dist`` e ``__pycache__``: **$(@($duplicates | Select-Object -ExpandProperty DuplicateGroup -Unique).Count) grupos**."
    ""
    "Arquivos detalhados: ``source-files.csv`` e ``exact-duplicates.csv``."
)

$summary | Set-Content -LiteralPath (Join-Path $output "README.md") -Encoding utf8

Write-Output "Inventory: $inventoryPath"
Write-Output "Duplicates: $duplicatesPath"
Write-Output "Summary: $(Join-Path $output 'README.md')"
