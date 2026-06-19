#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Define absolute paths
DB_FILE="$SCRIPT_DIR/citizen.db"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp (Format: YYYYMMDD_HHMMSS)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Backup filename
BACKUP_FILE="$BACKUP_DIR/citizen_$TIMESTAMP.db"

# Check if database file exists
if [ -f "$DB_FILE" ]; then
    # Try using sqlite3 for a clean online backup
    if command -v sqlite3 >/dev/null 2>&1; then
        if sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'" 2>/dev/null; then
            echo "SQLite backup created successfully at $BACKUP_FILE"
            exit 0
        fi
    fi
    
    # Fallback to copy if sqlite3 is not installed or fails
    cp "$DB_FILE" "$BACKUP_FILE"
    echo "Backup created successfully via copy at $BACKUP_FILE"
else
    echo "Error: $DB_FILE not found at $DB_FILE."
    exit 1
fi

