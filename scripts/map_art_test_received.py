import hashlib
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parent.parent

MAP_SHEETS = [
    {
        "file": "map_sheet01_structures.png",
        "sha": "2F789E83274D973455C75B1CE57D01685A12F76DAFBA654B216A3784242502EF",
        "dimensions": (1145, 1374, 8, 6),
    },
    {
        "file": "map_sheet02_hazards.png",
        "sha": "551D6F8659AB164AEACC4F7B89EB1A25D1A23F9B65CE753606E61ECA3FC3819D",
        "dimensions": (1145, 1374, 8, 6),
    },
    {
        "file": "map_sheet03_forest.png",
        "sha": "DE21CE86FE9830B06B312CE2605256E3AF32B54BCAD3672A1EF3F392703FB133",
        "dimensions": (1145, 1374, 8, 6),
    },
    {
        "file": "map_sheet04_dungeon.png",
        "sha": "1BD940ABFB022E8EA66F70ED3251455E0BCA876D1A10C0B631216EFAF87F8C2F",
        "dimensions": (1145, 1374, 8, 6),
    },
]


class MapArtReceivedTests(unittest.TestCase):
    def test_all_received_map_sheets_exist_and_match_contract(self):
        for sheet in MAP_SHEETS:
            path = ROOT / sheet["file"]
            self.assertTrue(path.exists(), f"Missing map sheet: {sheet['file']}")
            data = path.read_bytes()

            # Hash check
            actual_sha = hashlib.sha256(data).hexdigest().upper()
            self.assertEqual(actual_sha, sheet["sha"], f"SHA mismatch on {sheet['file']}")

            # PNG header check
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(data[12:16], b"IHDR")
            width, height, depth, color = struct.unpack(">IIBB", data[16:26])
            self.assertEqual(
                (width, height, depth, color),
                sheet["dimensions"],
                f"Dimension mismatch on {sheet['file']}",
            )


if __name__ == "__main__":
    unittest.main()
