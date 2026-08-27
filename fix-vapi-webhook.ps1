# PowerShell script to update Vapi assistant with webhook configuration

$apiKey = "ce4cf2fa-49d2-4ff7-b08a-6926d24f0624"
$assistantId = "3f72fb26-85e3-453d-880d-cedd3df88c93"
$webhookUrl = "https://expire-salad-lukewarm.ngrok-free.dev/api/webhooks/voice"

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

$body = @{
    "serverUrl" = $webhookUrl
    "serverUrlSecret" = "Yadav@2009"
} | ConvertTo-Json

Write-Host "Updating Vapi assistant with webhook URL..." -ForegroundColor Yellow
Write-Host "Assistant ID: $assistantId" -ForegroundColor Cyan
Write-Host "Webhook URL: $webhookUrl" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "https://api.vapi.ai/assistant/$assistantId" -Method PATCH -Headers $headers -Body $body
    Write-Host "`n✅ SUCCESS! Webhook URL updated!" -ForegroundColor Green
    Write-Host "Server URL: $($response.serverUrl)" -ForegroundColor Green
    Write-Host "`nNow test a call - webhooks should work!" -ForegroundColor Yellow
} catch {
    Write-Host "`n❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}
