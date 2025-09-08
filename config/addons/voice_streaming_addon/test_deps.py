#!/usr/bin/env python3
"""
Test script to verify dependency installation
"""

import sys

def test_imports():
    """Test importing the required packages"""
    packages = [
        'aiohttp',
        'websockets', 
        'aiortc',
        'pyaudio',
        'numpy',
        'scipy',
        'pydantic',
        'uvloop'
    ]
    
    results = {}
    
    for package in packages:
        try:
            __import__(package)
            results[package] = "SUCCESS"
            print(f"✓ {package}: SUCCESS")
        except ImportError as e:
            results[package] = f"FAILED: {str(e)}"
            print(f"✗ {package}: FAILED - {str(e)}")
        except Exception as e:
            results[package] = f"ERROR: {str(e)}"
            print(f"✗ {package}: ERROR - {str(e)}")
    
    return results

if __name__ == "__main__":
    print("Testing Python package imports...")
    print("=" * 40)
    results = test_imports()
    
    success_count = sum(1 for status in results.values() if status == "SUCCESS")
    total_count = len(results)
    
    print("\n" + "=" * 40)
    print(f"Results: {success_count}/{total_count} packages imported successfully")
    
    if success_count == total_count:
        print("All packages imported successfully!")
        sys.exit(0)
    else:
        print("Some packages failed to import.")
        sys.exit(1)