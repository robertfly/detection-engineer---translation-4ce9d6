# setuptools v69.0.2
import os
from setuptools import setup, find_packages

# Constants for file paths
README = "README.md"
REQUIREMENTS = "requirements.txt"

def read_requirements():
    """Read and parse the requirements.txt file."""
    requirements = []
    if os.path.exists(REQUIREMENTS):
        with open(REQUIREMENTS, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    requirements.append(line)
    return requirements

def read_readme():
    """Read the README.md file for the long description."""
    if os.path.exists(README):
        with open(README, "r", encoding="utf-8") as f:
            return f.read()
    return ""

setup(
    name="translation-service",
    version="1.0.0",
    description="AI-powered security detection translation service",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    author="Detection Translation Platform Team",
    license="MIT",
    python_requires=">=3.11",
    packages=find_packages(exclude=["tests*", "docs*"]),
    install_requires=[
        "fastapi==0.104.0",
        "uvicorn==0.24.0",
        "pydantic==2.4.0",
        "langchain==0.0.330",
        "openai==1.2.0",
        "prometheus-client==0.17.0",
        "python-json-logger==2.0.7",
        "pika==1.3.2",
        "python-multipart==0.0.6",
        "httpx==0.25.0",
        "cryptography==41.0.4",
        "pyyaml==6.0.1",
    ],
    extras_require={
        "dev": [
            "pytest==7.4.0",
            "black==23.10.0",
            "isort==5.12.0",
            "mypy==1.6.0",
            "flake8==6.1.0",
            "pytest-cov==4.1.0",
            "pytest-asyncio==0.21.1",
            "bandit==1.7.5",
            "safety==2.3.5",
        ]
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Information Technology", 
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Topic :: Security",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    project_urls={
        "Source": "https://github.com/org/detection-translation-platform",
        "Documentation": "https://github.com/org/detection-translation-platform/docs",
        "Bug Tracker": "https://github.com/org/detection-translation-platform/issues",
    },
    zip_safe=False,
    include_package_data=True,
)