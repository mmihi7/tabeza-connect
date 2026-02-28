# simple_structure.py - Shows basic folder structure only
from pathlib import Path
import os

def show_structure(path="."):
    """Show simple directory structure"""
    base_path = Path(path) if path else Path(".")
    
    # Items to completely ignore
    ignore_dirs = {
        'node_modules', '.git', '.next', 'dist', 'build',
        '.vscode', '.idea', '.DS_Store', 'coverage',
        'database', 'deployment', 'dev-tools', 'supabase',
        '.vercel', '.github', '__pycache__', '.cache'
    }
    
    ignore_files = {
        '.gitignore', '.env', 'package-lock.json', 'pnpm-lock.yaml',
        '*.log', '*.tmp', '*.md', '*.txt', '*.sql', '*.py',
        '*.bat', '*.ps1', '*.sh', '*.json', '*.yml', '*.yaml',
        '*.test.ts', '*.test.js', '*.spec.ts', '*.html', '*.ico',
        '*.png', '*.jpg', '*.svg', '*.map'
    }
    
    def should_ignore(item_path):
        """Check if item should be ignored"""
        name = item_path.name
        
        # Check directory names
        if name in ignore_dirs:
            return True
            
        # Check file patterns
        for pattern in ignore_files:
            if pattern.startswith('*'):
                if name.endswith(pattern[1:]):
                    return True
            elif name == pattern:
                return True
        
        return False
    
    print(f"📁 {os.path.basename(base_path)}/")
    print("=" * 50)
    
    def print_tree(directory, prefix="", max_depth=3):
        """Recursively print directory tree"""
        try:
            items = sorted(directory.iterdir())
        except PermissionError:
            return
        
        dirs = []
        files = []
        
        for item in items:
            if should_ignore(item):
                continue
                
            if item.is_dir():
                dirs.append(item)
            else:
                files.append(item)
        
        # Print directories first
        for d in dirs:
            print(f"{prefix}📁 {d.name}/")
            if max_depth > 0:
                print_tree(d, prefix + "  ", max_depth - 1)
        
        # Print files
        for f in files:
            print(f"{prefix}📄 {f.name}")
    
    # Print tree structure
    print_tree(base_path)

if __name__ == "__main__":
    show_structure()
