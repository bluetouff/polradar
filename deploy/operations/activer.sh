#!/bin/sh
# Run as the regular operator on the serving Debian host.
set -eu
umask 077
release_commit=''
release_gsc=''
release_amd64=''
release_arm64=''
component=${1:-}
revision=${2:-$release_commit}
digest=${3:-}
if { [ "$#" -ne 1 ] && [ "$#" -ne 3 ]; } || [ "$(id -u)" -eq 0 ]; then
  echo "Usage sur Zen, depuis le compte opérateur : sh activer.sh gsc|mcp [COMMIT SHA256_DU_PAQUET]" >&2
  exit 2
fi
case "$component" in
  mcp)
    arch=$(dpkg --print-architecture)
    case "$arch" in
      amd64) digest=${digest:-$release_amd64} ;;
      arm64) digest=${digest:-$release_arm64} ;;
      *) echo "Architecture MCP indisponible." >&2; exit 1 ;;
    esac
    package="polradar-mcp-linux-$arch.tar.gz" ;;
  gsc) package=polradar-gsc.tar.gz; digest=${digest:-$release_gsc} ;;
  *) exit 2 ;;
esac
case "$revision$digest" in *[!0123456789abcdef]*) exit 2 ;; esac
[ "${#revision}" -eq 40 ] && [ "${#digest}" -eq 64 ] || exit 2

work=$(mktemp -d /tmp/polradar-operateur.XXXXXXXX)
cd "$work"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --max-time 120 --output "$package" \
  "https://github.com/bluetouff/polradar/releases/download/services-$revision/$package"
printf '%s  %s\n' "$digest" "$package" | sha256sum --check -

# Google exposes only public certificates here. Match the DER bytes, not the subject or a guessed key ID.
stage="$HOME/.polradar-gsc-enrollment"
if [ "$component" = gsc ] && [ -f "$stage/reader.json" ]; then
  curl --fail --silent --show-error --proto '=https' --max-time 20 --output certificates.json \
    'https://www.googleapis.com/service_accounts/v1/metadata/x509/polradar-gsc-reader%40polradar.iam.gserviceaccount.com'
  kid=$(/usr/bin/python3 -I - "$stage/public-cert.pem" certificates.json <<'PY'
import json, re, ssl, sys
from pathlib import Path
cert = ssl.PEM_cert_to_DER_cert(Path(sys.argv[1]).read_text())
keys = json.loads(Path(sys.argv[2]).read_bytes())
matches = [k for k, v in keys.items() if re.fullmatch('[a-f0-9]{40}', k) and ssl.PEM_cert_to_DER_cert(v) == cert]
if len(matches) != 1:
    raise SystemExit("Google ne publie pas encore le certificat préparé sur Zen. Importez le certificat public dans Google IAM, puis relancez cette commande.")
print(matches[0])
PY
)
fi
sudo -v
root_stage=$(sudo mktemp -d /run/polradar-paquet.XXXXXXXX)
cleanup() {
  sudo find "$root_stage" -mindepth 1 -maxdepth 1 -type f -delete
  sudo rmdir "$root_stage"
}
trap cleanup EXIT
sudo install -o root -g root -m 0600 "$work/$package" "$root_stage/paquet.tar.gz"
printf '%s  %s\n' "$digest" "$root_stage/paquet.tar.gz" | sudo sha256sum --check --status -
sudo tar --extract --gzip --file "$root_stage/paquet.tar.gz" --directory "$root_stage" --no-same-owner --no-same-permissions
if [ "$component" = gsc ]; then
  if ! /usr/bin/python3 -I -c 'from google.auth import crypt, jwt' 2>/dev/null; then
    sudo apt-get install --no-install-recommends -y python3-google-auth
  fi
  if [ -n "${kid:-}" ]; then
    sudo /usr/bin/python3 -I "$root_stage/install.py" gsc --enroll "$kid" < "$stage/reader.json"
    # The root-owned credential has passed a real Search Console call.
    rm -- "$stage/reader.json"
  else
    sudo /usr/bin/python3 -I "$root_stage/install.py" gsc
  fi
else
  sudo /usr/bin/python3 -I "$root_stage/install.py" mcp
fi
