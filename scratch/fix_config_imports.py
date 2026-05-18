import os
import re

ROOT_DIR = os.getcwd()

def process_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return False

    # Replace sub-paths with top-level package
    # Be careful with order to avoid partial replacements like @cusown/config.public
    new_content = content.replace('@cusown/config/env.public', '@cusown/config')
    new_content = new_content.replace('@cusown/config.public', '@cusown/config')
    new_content = new_content.replace('@cusown/config/env', '@cusown/config')
    new_content = new_content.replace('@cusown/config/constants', '@cusown/config')

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

search_dirs = [
    os.path.join(ROOT_DIR, 'apps/app'),
    os.path.join(ROOT_DIR, 'apps/marketing'),
    os.path.join(ROOT_DIR, 'packages/shared/src')
]

updated_count = 0
for search_dir in search_dirs:
    if not os.path.exists(search_dir):
        continue
    for root, _, files in os.walk(search_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    updated_count += 1
                    print(f"Updated: {os.path.relpath(filepath, ROOT_DIR)}")

print(f"Total files updated: {updated_count}")
