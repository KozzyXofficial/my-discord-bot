import os
import re
import json

# Configuration
BOT_ROOT = './src'
WEB_ROOT = '.'
HTML_FILES = ['website/index.html', 'website/kozzyxbotmain.html']

# Categories mapping
DIR_TO_CAT = {
    'general': 'utility',
    'fun': 'fun'
}

def extract_commands():
    commands = []
    
    slash_root = os.path.join(BOT_ROOT, 'slashCommands')
    if not os.path.exists(slash_root):
        return commands

    for category in os.listdir(slash_root):
        cat_path = os.path.join(slash_root, category)
        if not os.path.isdir(cat_path):
            continue
            
        cat_label = DIR_TO_CAT.get(category, 'utility')
        
        for file in os.listdir(cat_path):
            if file.endswith('.js'):
                with open(os.path.join(cat_path, file), 'r') as f:
                    content = f.read()
                    # Simple regex to find name and description in export default
                    name_match = re.search(r'name:\s*"([^"]+)"', content)
                    desc_match = re.search(r'description:\s*"([^"]+)"', content)
                    
                    if name_match and desc_match:
                        commands.append({
                            "cmd": f"/{name_match.group(1)}",
                            "args": "",
                            "desc": desc_match.group(1),
                            "cat": cat_label,
                            "popular": False
                        })
    return commands

def update_html_files(commands):
    # Convert commands to a pretty JS array string
    js_array = "const COMMANDS = " + json.dumps(commands, indent=12) + ";"
    
    # Fix the bracket formatting slightly for aesthetic consistency
    js_array = js_array.replace('const COMMANDS = [', 'const COMMANDS = [\n            // Automatically Synced Commands')
    
    marker_begin = '/*COMMANDS-DATA-BEGIN*/'
    marker_end = '/*COMMANDS-DATA-END*/'
    
    for filename in HTML_FILES:
        filepath = os.path.join(WEB_ROOT, filename)
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, 'r') as f:
            content = f.read()
            
        # Find markers
        start_idx = content.find(marker_begin)
        end_idx = content.find(marker_end)
        
        if start_idx == -1 or end_idx == -1:
            print(f"Markers not found in {filename}")
            continue
            
        # Replace content between markers
        new_content = (
            content[:start_idx + len(marker_begin)] +
            f"\n        {js_array}\n        " +
            content[end_idx:]
        )
        
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filename}")

if __name__ == "__main__":
    cmds = extract_commands()
    if cmds:
        update_html_files(cmds)
        print(f"Successfully synced {len(cmds)} commands.")
    else:
        print("No commands found to sync.")
