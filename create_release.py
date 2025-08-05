import os
import subprocess
import zipfile

# Define plugin and zip name
PLUGIN_NAME = "offline_time_tracker"  
ZIP_NAME = f"{PLUGIN_NAME}.zip"

# 1. Run the npm build command
#subprocess.run(["npm", "run", "build"], check=True)

# 2. Create ZIP file
with zipfile.ZipFile(ZIP_NAME, "w", zipfile.ZIP_DEFLATED) as zipf:
    def add_file(filename):
        if os.path.exists(filename):
            zipf.write(filename)
            print(f"Added {filename}")
        else:
            print(f"WARNING: {filename} not found!")

    # Add required files
    add_file("package.json")
    add_file("plugin.json")
    add_file("main.py")

    # Add dist/ directory
    for root, _, files in os.walk("dist"):
        for file in files:
            filepath = os.path.join(root, file)
            arcname = os.path.relpath(filepath, ".")
            zipf.write(filepath, arcname)
            print(f"Added {arcname}")

    # Add any other necessary files below
    # Example: add_file("README.md")

print(f"Build and packaging complete: {ZIP_NAME}")