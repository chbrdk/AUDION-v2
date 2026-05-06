"""
Tests for live viewport endpoint GET /run/{job_id}/live.
Run from ux-journey-agent dir: python -m unittest test_live
"""
from __future__ import annotations

import time
import unittest

from fastapi.testclient import TestClient

from main import _live_frames, app

client = TestClient(app)


class TestLiveEndpoint(unittest.TestCase):
    def setUp(self):
        _live_frames.clear()

    def tearDown(self):
        _live_frames.clear()

    def test_get_live_returns_404_when_no_frame(self):
        """GET /run/{job_id}/live returns 404 when no live frame exists."""
        res = client.get("/run/some-unknown-job-id/live")
        self.assertEqual(res.status_code, 404)

    def test_get_live_returns_200_and_jpeg_when_frame_exists(self):
        """GET /run/{job_id}/live returns 200 and image/jpeg when a frame is stored."""
        job_id = "test-job-with-frame"
        jpeg_bytes = b"\xff\xd8\xff\xff\xd9"
        _live_frames[job_id] = (time.monotonic(), jpeg_bytes)

        res = client.get(f"/run/{job_id}/live")

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.headers.get("content-type", "").startswith("image/jpeg"))
        self.assertEqual(res.headers.get("cache-control"), "no-store")
        self.assertEqual(res.content, jpeg_bytes)
