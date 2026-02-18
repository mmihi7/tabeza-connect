#!/bin/bash

# Test the parse-receipt Edge Function directly
# This simulates the database trigger calling the function

curl -X POST \
  "https://bkaigyrrzsqbfscyznzw.supabase.co/functions/v1/parse-receipt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2" \
  -d '{
    "receipt_id": "test-receipt-id"
  }'

echo ""
echo "Check the response above for parsing results"
echo "Then check the database for parsed results:"
