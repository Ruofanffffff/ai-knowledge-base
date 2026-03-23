import os

file_path = "/Users/ruofanfeng/Documents/trae_projects/Note-taking app frontend（V2.0）/src/app/pages/SiChain.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "{mainTab === 'note' && (" in line:
        start_idx = i
        break

if start_idx != -1:
    for i in range(start_idx, len(lines)):
        if lines[i].strip() == ")}":
            if lines[i+1].strip() == "</div>":
                end_idx = i
                break

if start_idx != -1 and end_idx != -1:
    del lines[start_idx:end_idx+1]
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"Deleted lines {start_idx} to {end_idx}")
else:
    print("Could not find block to delete.")
