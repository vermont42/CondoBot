#!/bin/bash
curl -X POST https://condobot-production.up.railway.app/webhooks/hospitable \
  -H "Content-Type: application/json" \
  -d '{"action":"message.created","data":{"body":"Production test - aloha!","sender_type":"guest","user":{"first_name":"Josh"},"listing":{"name":"Gorgeous Unit, Stunning Views!"},"platform":"airbnb","conversation_id":"cbb6b3be-d786-4833-9a37-71949393939e"}}'
