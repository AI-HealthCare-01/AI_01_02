set -eo pipefail

COLOR_GREEN=$(tput setaf 2)
COLOR_BLUE=$(tput setaf 4)
COLOR_RED=$(tput setaf 1)
COLOR_NC=$(tput sgr0)

cd "$(dirname "$0")/../.."

if [ -f .env ]; then
  set -a
  # .env created on Windows can contain CRLF, which breaks `source` in bash.
  source <(sed -e 's/\r$//' .env)
  set +a
fi

UV_CMD=
if command -v uv >/dev/null 2>&1; then
  UV_CMD=uv
elif command -v uv.exe >/dev/null 2>&1; then
  UV_CMD=uv.exe
fi

if [ -z "$UV_CMD" ] || ! "$UV_CMD" --version >/dev/null 2>&1; then
  echo "${COLOR_RED}✖ uv command not found or not executable.${COLOR_NC}"
  exit 1
fi

echo "${COLOR_BLUE}Find Tests${COLOR_NC}"

HAS_TESTS=false
MYSQL_CONTAINER_NAME=mysql

if [ -d "./app/tests" ] && find ./app/tests -name 'test_*.py' -print -quit | read ; then
  HAS_TESTS=true
fi

echo "Has tests: $HAS_TESTS"

if [ "$HAS_TESTS" = true ]; then
  if docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER_NAME}$"; then
    echo "${COLOR_BLUE}→ MySQL container found. Granting privileges...${COLOR_NC}"

    docker exec -i ${MYSQL_CONTAINER_NAME} \
    mysql -u root -p${DB_ROOT_PASSWORD}<<EOF
      GRANT ALL PRIVILEGES ON *.* TO '${DB_USER}'@'%' WITH GRANT OPTION;
      FLUSH PRIVILEGES;
EOF

    echo "${COLOR_BLUE}Run Pytest with Coverage${COLOR_NC}"

    if ! "$UV_CMD" run coverage run -m pytest app; then
      echo ""
      echo "${COLOR_RED}✖ Pytest failed.${COLOR_NC}"
      echo "${COLOR_RED}→ Fix the test failures above and re-run.${COLOR_NC}"
      exit 1
    fi

    echo "${COLOR_BLUE}Coverage Report${COLOR_NC}"
    if ! "$UV_CMD" run coverage report -m ; then
      echo "${COLOR_RED}✖ Coverage check failed.${COLOR_NC}"
      exit 1
    fi
  else
    echo "${COLOR_RED} MySQL Docker Container Not Found. Run docker compose up mysql.${COLOR_NC}"
  fi
else
  echo "${COLOR_BLUE}No tests found. Skipping tests.${COLOR_NC}"
fi
