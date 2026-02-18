#!/bin/bash

# Test the parse-receipt Edge Function with your actual receipt
# First insert the receipt, then test parsing

echo "🧪 Testing with your POPOS receipt format..."

# Step 1: Insert the raw receipt
echo "📝 Inserting raw receipt..."
curl -X POST \
  "https://bkaigyrrzsqbfscyznzw.supabase.co/rest/v1/raw_pos_receipts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2" \
  -H "Prefer: return=minimal" \
  -d '{
    "bar_id": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
    "device_id": "driver-MIHI-PC",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "text": "           CAPTAIN'\''S ORDER\n        POPOS LOUNGE & GRILL\n--------------------------------\nTable No: \nCaptain: John\nDate: 07-Feb-2026\nTime: 8:45 PM\n--------------------------------\n\nQTY   ITEM\n--------------------------------\n3     Tusker Lager 500ml Kes 250, Kes 750\n2     Smirnoff Vodka 250ml Kes 450, Kes 900\n1     Nyama Choma (Goat) 1kg Kes 780\n1     Kachumbari Kes 100\n--------------------------------\n\nTotal: Kes 2530\n\n--------------------------------\nOrder Type: DINE-IN\n--------------------------------\n\nSignature (Captain): ___________\n--------------------------------"
  }'

echo ""
echo "⏳ Waiting 2 seconds for trigger to fire..."
sleep 2

# Step 2: Check if parsing worked
echo "🔍 Checking parsed results..."
curl -X GET \
  "https://bkaigyrrzsqbfscyznzw.supabase.co/rest/v1/pos_receipts?bar_id=eq.438c80c1-fe11-4ac5-8a48-2fc45104ba31&order=created_at.desc&limit=1" \
  -H "Authorization: Bearer sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2"

echo ""
echo "✅ Test complete! Check the results above."
echo "📊 Expected: status=PARSED, total=2530, items=4"
