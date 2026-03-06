#!/bin/bash
# REQ-109: HTTPS/TLS 설정을 위한 Let's Encrypt 인증서 초기 발급 스크립트
# 사용법: ./scripts/init-letsencrypt.sh example.com admin@example.com
#
# 사전 조건:
#   1. 도메인의 DNS A 레코드가 이 서버 IP를 가리켜야 함
#   2. docker-compose.prod.yml 이 사용 가능해야 함
#   3. nginx/prod_https.conf 의 "도메인" 을 실제 도메인으로 변경해야 함

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"
COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF="nginx/prod_https.conf"
DATA_PATH="./certbot"

echo "=== Let's Encrypt 인증서 발급: $DOMAIN ==="

# 1. nginx 설정에서 "도메인" → 실제 도메인으로 치환
if grep -q "도메인" "$NGINX_CONF"; then
  echo "[1/5] nginx 설정의 도메인 치환: $DOMAIN"
  sed -i "s/도메인/$DOMAIN/g" "$NGINX_CONF"
else
  echo "[1/5] nginx 설정에 이미 도메인이 설정되어 있습니다."
fi

# 2. docker-compose에서 nginx 설정 파일을 HTTPS용으로 변경
if grep -q "nginx/default.conf" "$COMPOSE_FILE"; then
  echo "[2/5] docker-compose nginx 설정을 HTTPS용으로 변경"
  sed -i "s|./nginx/default.conf|./nginx/prod_https.conf|g" "$COMPOSE_FILE"
else
  echo "[2/5] docker-compose에 이미 prod_https.conf가 설정되어 있습니다."
fi

# 3. 먼저 HTTP만으로 nginx 시작 (인증서 없이)
echo "[3/5] 임시 자체서명 인증서 생성 (nginx 부팅용)"
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint "" certbot sh -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost' 2>/dev/null &&
  mkdir -p /etc/letsencrypt &&
  cat > /etc/letsencrypt/options-ssl-nginx.conf <<'SSLEOF'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers \"ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384\";
SSLEOF
  openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048 2>/dev/null
"

# 4. nginx 시작
echo "[4/5] nginx 컨테이너 시작"
docker compose -f "$COMPOSE_FILE" up -d nginx

# 5. 실제 인증서 발급
echo "[5/5] Let's Encrypt 인증서 발급 중..."
docker compose -f "$COMPOSE_FILE" run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$EMAIL" \
  --domain "$DOMAIN" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

# nginx 재시작으로 실제 인증서 적용
echo "=== nginx 재시작 ==="
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo "=== 완료! HTTPS가 활성화되었습니다: https://$DOMAIN ==="
