import concurrent.futures
import tempfile
import unittest
from pathlib import Path

from server.monitor import attempt, prepare_database


class MonitorTest(unittest.TestCase):
    def test_retry_reuses_run_and_works_after_database_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "runs.sqlite")
            prepare_database(path)
            failed, changed = attempt(path, False)
            self.assertTrue(changed)
            self.assertEqual(failed["status"], "failed")
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                recovered = list(pool.map(lambda _: attempt(path, True), range(2)))
            self.assertEqual(sum(changed for _, changed in recovered), 1)
            completed = recovered[-1][0]
            self.assertEqual(completed["id"], failed["id"])
            self.assertEqual([event["code"] for event in completed["events"]], ["PROVIDER_UNAVAILABLE", "PROVIDER_OK"])
            self.assertEqual(attempt(path, True), (completed, False))
