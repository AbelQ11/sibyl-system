# Get the directory where the script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Define absolute paths
$DbFile = Join-Path $ScriptDir "citizen.db"
$BackupDir = Join-Path $ScriptDir "backups"

# Create backup directory if it doesn't exist
if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# Generate timestamp (Format: YYYYMMDD_HHMMSS)
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Backup filename
$BackupFile = Join-Path $BackupDir "citizen_$Timestamp.db"

# Check if database file exists and copy
if (Test-Path -Path $DbFile) {
    Copy-Item -Path $DbFile -Destination $BackupFile -Force
    Write-Output "Backup created successfully at $BackupFile"
} else {
    Write-Error "Error: $DbFile not found."
    exit 1
}
