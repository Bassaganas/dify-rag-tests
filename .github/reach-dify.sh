#!/usr/bin/env bash
# Checks that GitHub can reach DIFY_BASE_URL before any test runs.
# Any HTTP answer (even 401) proves the address is right and Dify is up.
# The URL itself is never printed: the logs of a public repository are public.
set -u
code=0
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "${DIFY_BASE_URL%/}/chat-messages") || code=$?
if [ "$code" != 0 ] || [ "$status" = "000" ]; then
  case "$code" in
    3)     why="DIFY_BASE_URL is not a valid URL. It must look like https://dify-<your-instance>.testingfantasy.com/v1" ;;
    6)     why="the host name in DIFY_BASE_URL does not exist. Check it for typos" ;;
    7)     why="the host refused the connection. Check the URL and that Dify is running" ;;
    28)    why="nothing answered within 20 seconds. Check that your Dify instance is running and that DIFY_BASE_URL is your current instance" ;;
    35|60) why="the HTTPS certificate was rejected. DIFY_BASE_URL must start with https://" ;;
    *)     why="curl error $code" ;;
  esac
  echo "::error title=Cannot reach Dify::GitHub cannot reach DIFY_BASE_URL: $why. Update the secret in Settings → Secrets and variables → Actions."
  exit 1
fi
case "$status" in
  301|302|307|308) echo "::error title=Use https::DIFY_BASE_URL redirects (HTTP $status). Use the https:// address: a redirect drops your API key."; exit 1 ;;
esac
echo "Dify is reachable (HTTP $status)"
