"""Check the built image's incident-specific security requirements.

This is not a replacement for a dependency vulnerability scanner.
"""

import sys
from importlib.metadata import distributions, version


def check_security_requirements() -> None:
    if sys.version_info < (3, 12, 16):
        raise RuntimeError("Python 3.12.16+ is required")

    for package, minimum in (("pip", (26, 2, 2)), ("certifi", (2026, 10, 19))):
        installed = version(package)
        # Fail closed for unexpected or prerelease version strings.
        if tuple(int(part) for part in installed.split(".")) < minimum:
            raise RuntimeError(f"{package} {installed} is below {minimum}")
        print(f"{package} {installed}")

    for distribution in distributions():
        name = distribution.metadata["Name"].lower().replace("_", "-").replace(".", "-")
        if name == "litellm":
            raise RuntimeError("LiteLLM must not be installed in the AI service")

    print(f"Python {sys.version.split()[0]}; LiteLLM is not installed")


if __name__ == "__main__":
    check_security_requirements()
