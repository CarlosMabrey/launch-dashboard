#!/usr/bin/env python3
"""
Setup script to add 'launcher' command to Windows terminal
This script creates a batch file and adds it to the system PATH
"""

import os
import sys
import subprocess
from pathlib import Path

def create_launcher_batch():
    """Create a batch file to launch the application"""
    script_dir = Path(__file__).parent.absolute()
    batch_content = f"""@echo off
cd /d "{script_dir}"
npm run electron-dev
"""
    
    batch_path = script_dir / "launcher.bat"
    with open(batch_path, 'w') as f:
        f.write(batch_content)
    
    return batch_path

def add_to_path(batch_path):
    """Add the batch file directory to system PATH"""
    try:
        import winreg
        
        # Get current PATH from registry
        key = winreg.HKEY_LOCAL_MACHINE
        subkey = r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
        
        with winreg.OpenKey(key, subkey, 0, winreg.KEY_READ) as registry_key:
            path_value, _ = winreg.QueryValueEx(registry_key, "PATH")
        
        # Check if our directory is already in PATH
        script_dir = str(batch_path.parent)
        if script_dir not in path_value:
            # Add our directory to PATH
            new_path = path_value + ";" + script_dir
            
            # Write back to registry
            with winreg.OpenKey(key, subkey, 0, winreg.KEY_SET_VALUE) as registry_key:
                winreg.SetValueEx(registry_key, "PATH", 0, winreg.REG_EXPAND_SZ, new_path)
            
            # Broadcast environment change
            subprocess.run(["rundll32.exe", "user32.dll,UpdatePerUserSystemParameters"], check=False)
            
            print(f"Added {script_dir} to system PATH")
            return True
        else:
            print(f"{script_dir} is already in PATH")
            return True
            
    except Exception as e:
        print(f"Failed to modify PATH: {e}")
        return False

def create_user_path_alias():
    """Create a user-level alias in PowerShell profile"""
    try:
        script_dir = Path(__file__).parent.absolute()
        
        # Get PowerShell profile path
        result = subprocess.run(["powershell", "-Command", "echo $PROFILE"], 
                              capture_output=True, text=True)
        profile_path = result.stdout.strip()
        
        if profile_path:
            # Create profile directory if it doesn't exist
            profile_dir = Path(profile_path).parent
            profile_dir.mkdir(parents=True, exist_ok=True)
            
            # Add aliases to profile
            launch_alias = f'Set-Alias -Name launch -Value "{script_dir}\\launcher.bat"\n'
            code_alias = f'Set-Alias -Name launch-code -Value "{script_dir}\\code-preview.bat"\n'
            
            # Read existing profile
            profile_content = ""
            if Path(profile_path).exists():
                with open(profile_path, 'r') as f:
                    profile_content = f.read()
            
            # Check and add launch alias
            if "Set-Alias -Name launch " not in profile_content:
                with open(profile_path, 'a') as f:
                    f.write(f"\n# JellyOS Launcher Alias\n{launch_alias}")
                print(f"Added 'launch' alias to PowerShell profile")
            
            # Check and add launch-code alias
            if "Set-Alias -Name launch-code" not in profile_content:
                with open(profile_path, 'a') as f:
                    f.write(f"\n# Code Preview Independent Alias\n{code_alias}")
                print(f"Added 'launch-code' alias to PowerShell profile")
            
            print(f"Profile updated: {profile_path}")
            return True
        
    except Exception as e:
        print(f"Failed to create PowerShell alias: {e}")
        return False

def main():
    print("Setting up 'launcher' command for Windows terminal...")
    
    # Create batch file
    batch_path = create_launcher_batch()
    print(f"Created batch file: {batch_path}")
    
    # Try to add to system PATH (requires admin)
    success = add_to_path(batch_path)
    
    if not success:
        print("Could not modify system PATH (requires admin privileges)")
        print("Trying user-level PowerShell alias...")
        
        # Fallback to PowerShell alias
        success = create_user_path_alias()
    
    if success:
        print("\nSetup completed successfully!")
        print("\nUsage:")
        print("   - Open a NEW terminal window")
        print("   - Type 'launch' and press Enter")
        print("   - The app will start automatically")
        print("\nNote: If you used PowerShell alias, make sure to use PowerShell terminal")
    else:
        print("\nSetup failed. You can still run the app manually:")
        print(f"   cd {batch_path.parent}")
        print("   npm run dev")

if __name__ == "__main__":
    main()
