# Simple PowerShell script to create placeholder icon files
# These are just empty files - you'll need to replace with actual PNG icons

$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
    $filename = "icons\icon-$size.png"
    
    # Create a simple text file as placeholder
    # In real usage, you'd want actual PNG files
    "SwiftPath Icon ${size}x${size}" | Out-File -FilePath $filename -Encoding ASCII
    
    Write-Host "Created placeholder: $filename"
}

Write-Host "Icon placeholders created! Replace these with actual PNG files."