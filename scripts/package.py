from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
extension = root / "extension"
manifest = json.loads((extension / "manifest.json").read_text())
assert manifest["manifest_version"] == 3
assert "nativeMessaging" not in manifest["permissions"]
assert not manifest.get("host_permissions")
for resource in [manifest["background"]["service_worker"], *manifest["icons"].values(), "help.html", "direct-share.js", "routing.js", "privacy.html", "image.js", "style.css"]:
    assert (extension / resource).is_file(), resource
archives = []
for name, base in [(f"save-image-to-photos-{manifest['version']}.zip", extension), (f"save-image-to-photos-source-{manifest['version']}.zip", root)]:
    destination = root.parent / name
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(base.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts and ".DS_Store" not in path.parts:
                archive.write(path, path.relative_to(base))
    archives.append(destination)
    print(f"Created {destination.name} ({destination.stat().st_size} bytes)")
(root.parent / "SHA256SUMS.txt").write_text("".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n" for path in archives))
