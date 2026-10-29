import unittest
from contextlib import redirect_stdout
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

import security_check


class SecurityCheckTests(unittest.TestCase):
    def run_check(self, *, python=(3, 12, 16), packages=None, names=()):
        installed = {"pip": "26.2.2", "certifi": "2026.10.19"}
        installed.update(packages or {})
        inventory = [SimpleNamespace(metadata={"Name": name}) for name in names]
        with (
            patch.object(security_check.sys, "version_info", python),
            patch.object(security_check, "version", side_effect=installed.__getitem__),
            patch.object(security_check, "distributions", return_value=inventory),
            redirect_stdout(StringIO()),
        ):
            security_check.check_security_requirements()

    def test_accepts_minimum_versions(self):
        self.run_check(names=("pydantic-ai-slim",))

    def test_accepts_newer_versions(self):
        self.run_check(
            python=(3, 12, 17),
            packages={"pip": "26.3", "certifi": "2026.11.1"},
        )

    def test_rejects_old_python(self):
        with self.assertRaisesRegex(RuntimeError, "Python"):
            self.run_check(python=(3, 12, 15))

    def test_rejects_old_pip(self):
        with self.assertRaisesRegex(RuntimeError, "pip"):
            self.run_check(packages={"pip": "26.2.1"})

    def test_rejects_old_certifi(self):
        with self.assertRaisesRegex(RuntimeError, "certifi"):
            self.run_check(packages={"certifi": "2026.10.18"})

    def test_rejects_litellm(self):
        with self.assertRaisesRegex(RuntimeError, "LiteLLM"):
            self.run_check(names=("LiteLLM",))

    def test_rejects_prerelease_version(self):
        with self.assertRaises(ValueError):
            self.run_check(packages={"pip": "26.2.2rc1"})

    def test_rejects_missing_package(self):
        with patch.object(security_check, "version", side_effect=LookupError("missing")):
            with self.assertRaises(LookupError):
                security_check.check_security_requirements()


if __name__ == "__main__":
    unittest.main()
