import requests
import os

USER = "colombo0718"
PASS = input("Neocities 密碼: ")

REMOTE_DIR = "graphicalGYM/games"
LOCAL_DIR  = "games"

# 取得遠端檔案清單
r = requests.get("https://neocities.org/api/list",
                 auth=(USER, PASS),
                 params={"path": REMOTE_DIR})
r.raise_for_status()

files = r.json().get("files", [])

downloaded = 0
skipped    = 0

for f in files:
    if f["is_directory"]:
        continue

    remote_path = f["path"]                          # e.g. graphicalGYM/games/Maze2D_emoji/index.html
    rel_path    = remote_path[len(REMOTE_DIR)+1:]    # e.g. Maze2D_emoji/index.html
    local_path  = os.path.join(LOCAL_DIR, rel_path)  # e.g. games/Maze2D_emoji/index.html

    if os.path.exists(local_path):
        print(f"[skip] {rel_path}")
        skipped += 1
        continue

    url = f"https://{USER}.neocities.org/{remote_path}"
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    content = requests.get(url)
    content.raise_for_status()
    with open(local_path, "wb") as fp:
        fp.write(content.content)

    print(f"[down] {rel_path}")
    downloaded += 1

print(f"\n完成：下載 {downloaded} 個，跳過 {skipped} 個")
