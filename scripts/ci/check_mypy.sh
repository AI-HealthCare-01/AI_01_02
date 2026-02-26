set -eo pipefail

COLOR_GREEN=$(tput setaf 2)
COLOR_BLUE=$(tput setaf 4)
COLOR_RED=$(tput setaf 1)
COLOR_NC=$(tput sgr0)

cd "$(dirname "$0")/../.."

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

echo "${COLOR_BLUE}Run Mypy${COLOR_NC}"
if ! "$UV_CMD" run mypy . ; then
  echo ""
  echo "${COLOR_RED}✖ Mypy found issues.${COLOR_NC}"
  echo "${COLOR_RED}→ Please fix the issues above manually and re-run the command.${COLOR_NC}"
  exit 1
fi

echo "${COLOR_GREEN}Successfully Ended.${COLOR_NC}"
