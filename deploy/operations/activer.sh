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
root_stage=''
cleanup() {
  if [ -n "$root_stage" ]; then
    sudo find "$root_stage" -mindepth 1 -maxdepth 1 -type f -delete
    sudo rmdir "$root_stage"
  fi
  cd /
  find "$work" -mindepth 1 -maxdepth 1 -type f -delete
  rmdir "$work"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
cd "$work"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --max-time 120 --max-filesize 16777216 --output "$package" \
  "https://github.com/bluetouff/polradar/releases/download/services-$revision/$package"
printf '%s  %s\n' "$digest" "$package" | sha256sum --check -

# The bundle is public. Sigstore checks its identity against the fixed workflow and source.
command -v gh >/dev/null || { echo "GitHub CLI avec attestation verify est requis." >&2; exit 1; }
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --max-time 60 --max-filesize 4194304 --output services.sigstore.json \
  "https://github.com/bluetouff/polradar/releases/download/services-$revision/services.sigstore.json"
gh attestation verify "$package" --bundle services.sigstore.json --repo bluetouff/polradar \
  --signer-workflow bluetouff/polradar/.github/workflows/services.yml --source-ref refs/heads/main \
  --source-digest "$revision" --deny-self-hosted-runners

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
sudo install -o root -g root -m 0600 "$work/$package" "$root_stage/paquet.tar.gz"
printf '%s  %s\n' "$digest" "$root_stage/paquet.tar.gz" | sudo sha256sum --check --status -
sudo /usr/bin/python3 -I - "$root_stage" "$component" <<'PYTHON_ARCHIVE'
import gzip, io, sys, tarfile
from pathlib import Path
root = Path(sys.argv[1])
expected = {'manifest.json', 'LICENSE', 'install.py'}
expected.update({'apache.conf', 'polradar-mcp', 'polradar-mcp.service', 'polradar-mcp.socket'} if sys.argv[2] == 'mcp'
                else {'gsc_collect.py', 'gsc_view.py', 'polradar-gsc.service', 'polradar-gsc.timer', 'index.html', 'viewer.css', 'viewer.mjs'})
cap = 32 << 20
with gzip.open(root / 'paquet.tar.gz', 'rb') as stream:
    raw = stream.read(cap + 1)
if len(raw) > cap:
    raise SystemExit('Archive décompressée trop grande')
with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
    seen = set()
    for member in archive:
        if member.name not in expected or member.name in seen or member.type != tarfile.REGTYPE or member.pax_headers:
            raise SystemExit('Membre du paquet inattendu')
        if member.size <= 0 or member.size > (24 << 20 if member.name == 'polradar-mcp' else 512 << 10):
            raise SystemExit('Taille de membre invalide')
        seen.add(member.name)
    if seen != expected:
        raise SystemExit('Paquet incomplet')
    for name in sorted(seen):
        with (root / name).open('xb') as out:
            out.write(archive.extractfile(name).read())
PYTHON_ARCHIVE
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
