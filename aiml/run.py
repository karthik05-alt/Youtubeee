import sys
import subprocess
import os

def check_and_install_dependencies():
    """Checks for required packages and installs them if missing."""
    print("Checking dependencies...")
    
    requirements_path = os.path.join(os.path.dirname(__file__), "backend", "requirements.txt")
    if not os.path.exists(requirements_path):
        print(f"Error: requirements.txt not found at {requirements_path}")
        sys.exit(1)

    # Read requirements
    with open(requirements_path, "r") as f:
        packages = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    # Extract clean package names (e.g., fastapi from fastapi>=0.100.0)
    package_names = []
    for pkg in packages:
        # split on standard specifiers: >=, ==, >, <, ~=
        for spec in (">=", "==", ">", "<", "~="):
            if spec in pkg:
                package_names.append(pkg.split(spec)[0].strip())
                break
        else:
            package_names.append(pkg.strip())

    # Map package names to import names for validation if they differ
    import_mapping = {
        "scikit-learn": "sklearn",
    }

    missing_packages = []
    for pkg in package_names:
        import_name = import_mapping.get(pkg, pkg)
        try:
            __import__(import_name)
        except ImportError:
            missing_packages.append(pkg)

    if missing_packages:
        print(f"Missing packages detected: {', '.join(missing_packages)}")
        print("Installing dependencies from requirements.txt...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", requirements_path])
            print("Dependencies installed successfully!")
        except subprocess.CalledProcessError as e:
            print(f"Error installing dependencies: {e}")
            sys.exit(1)
    else:
        print("All dependencies are already installed.")

def start_server():
    """Launches the Uvicorn development server."""
    print("\nStarting YouTube Views Predictor server...")
    print("Open http://127.0.0.1:8000 in your browser.\n")
    
    # We run uvicorn from the current workspace directory
    try:
        import uvicorn
        # Run with reload=True to auto-reload on changes
        uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
    except KeyboardInterrupt:
        print("\nServer stopped.")
    except Exception as e:
        print(f"Failed to start server: {e}")
        # Fallback to subprocess if uvicorn direct import fails
        print("Attempting launcher via subprocess...")
        subprocess.run([sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"])

if __name__ == "__main__":
    check_and_install_dependencies()
    start_server()
