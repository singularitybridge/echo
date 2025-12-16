#!/usr/bin/env python3
"""
Fix corrupted script.json by removing base64 frame data
"""
import json
import os
import re
import sys
from pathlib import Path

SCRIPT_PATH = Path("stories/yossis-cobol-crisis-2025/script.json")
FRAMES_DIR = Path("public/frames/yossis-cobol-crisis-2025")

def fix_corrupted_script():
    print(f"🔧 Attempting to fix {SCRIPT_PATH}...")

    # Read raw content
    with open(SCRIPT_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    print(f"  File size: {len(content) / 1024 / 1024:.2f} MB")

    # Try to find and remove base64 data URLs
    # Pattern: "firstFrameDataUrl": "data:image/png;base64,..." or "lastFrameDataUrl": "data:image/png;base64,..."

    # Count base64 data URLs
    base64_pattern = r'"(first|last)FrameDataUrl"\s*:\s*"data:image/[^"]*"'
    matches = list(re.finditer(base64_pattern, content))
    print(f"  Found {len(matches)} base64 frame data URLs")

    if len(matches) == 0:
        print("  No base64 data found, checking if file is valid JSON...")
        try:
            data = json.loads(content)
            print("  ✅ File is valid JSON, no fix needed")
            return True
        except json.JSONDecodeError as e:
            print(f"  ❌ File is corrupted but no base64 data found: {e}")
            return False

    # Replace base64 data with file paths
    def replace_frame_url(match):
        frame_type = match.group(1)  # 'first' or 'last'

        # Try to extract scene ID from context (look backwards)
        context_start = max(0, match.start() - 500)
        context = content[context_start:match.start()]

        # Find scene ID
        scene_id_match = re.search(r'"id"\s*:\s*"([^"]+)"', context)
        if scene_id_match:
            scene_id = scene_id_match.group(1)
            frame_path = f"/frames/yossis-cobol-crisis-2025/{scene_id}-{frame_type}.png"
            return f'"{frame_type}FrameDataUrl": "{frame_path}"'
        else:
            # Can't find scene ID, just remove the base64 data
            return f'"{frame_type}FrameDataUrl": null'

    # Replace all base64 data URLs
    fixed_content = re.sub(base64_pattern, replace_frame_url, content)

    print(f"  After replacement: {len(fixed_content) / 1024:.2f} KB")

    # Try to parse the fixed content
    try:
        data = json.loads(fixed_content)
        print("  ✅ Fixed content is valid JSON")

        # Create backup
        backup_path = f"{SCRIPT_PATH}.backup-corrupted"
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ Backup created: {backup_path}")

        # Write fixed content
        with open(SCRIPT_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"  ✅ Fixed script saved")

        return True

    except json.JSONDecodeError as e:
        print(f"  ❌ Fixed content is still not valid JSON: {e}")

        # Try more aggressive fix - truncate at the error position
        print("  🔧 Attempting aggressive fix...")

        # Find the last valid closing brace before the error
        truncate_pos = min(e.pos if hasattr(e, 'pos') else len(fixed_content), len(fixed_content))

        # Search backwards for the last valid scene closing
        search_content = fixed_content[:truncate_pos]

        # Find all complete scenes
        scene_pattern = r'\{\s*"id"\s*:.*?\}\s*(?=,|\])'
        scenes = list(re.finditer(scene_pattern, search_content, re.DOTALL))

        if scenes:
            print(f"  Found {len(scenes)} complete scenes")

            # Reconstruct JSON with valid scenes
            try:
                # Extract project metadata from beginning
                meta_end = search_content.find('"scenes"')
                if meta_end > 0:
                    metadata = search_content[:meta_end]

                    # Build new JSON
                    reconstructed = metadata + '"scenes": [\n'
                    for i, scene_match in enumerate(scenes):
                        if i > 0:
                            reconstructed += ',\n'
                        reconstructed += scene_match.group(0)
                    reconstructed += '\n]\n}'

                    # Validate
                    data = json.loads(reconstructed)

                    # Create backup
                    backup_path = f"{SCRIPT_PATH}.backup-corrupted"
                    with open(backup_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  ✅ Backup created: {backup_path}")

                    # Write fixed content
                    with open(SCRIPT_PATH, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                    print(f"  ✅ Aggressively fixed script saved ({len(data['scenes'])} scenes)")

                    return True
            except Exception as e2:
                print(f"  ❌ Aggressive fix failed: {e2}")

        return False

if __name__ == '__main__':
    success = fix_corrupted_script()
    sys.exit(0 if success else 1)
