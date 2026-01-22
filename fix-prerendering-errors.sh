#!/bin/bash
# Script to add 'export const dynamic = "force-dynamic"' to all admin pages that use useState/useContext

ADMIN_DIR="/Users/m4-dev/Development/AUDION/apps/web/app/admin"

echo "🔧 Fixing prerendering errors in admin pages..."
echo ""

# Find all page.tsx files in admin directory that use useState or useContext
find "$ADMIN_DIR" -name "page.tsx" -type f | while read -r file; do
    # Skip if already has dynamic export
    if grep -q "export const dynamic" "$file"; then
        echo "⏭️  Skipping $file (already has dynamic export)"
        continue
    fi
    
    # Check if file uses useState or useContext
    if grep -q "useState\|useContext" "$file"; then
        echo "🔨 Fixing $file"
        
        # Check if file starts with "use client"
        if head -n 1 "$file" | grep -q '"use client"'; then
            # Add dynamic export after "use client" directive
            sed -i.bak '1a\
\
// Disable static generation to prevent prerendering issues with useState/useContext\
export const dynamic = '\''force-dynamic'\'';
' "$file"
            rm -f "${file}.bak"
        else
            # Add dynamic export at the beginning
            sed -i.bak '1i\
// Disable static generation to prevent prerendering issues with useState/useContext\
export const dynamic = '\''force-dynamic'\'';\
\
' "$file"
            rm -f "${file}.bak"
        fi
        echo "✅ Fixed $file"
    fi
done

echo ""
echo "✅ Done!"
