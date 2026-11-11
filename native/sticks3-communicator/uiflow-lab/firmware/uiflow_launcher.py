# After copying the project modules into /flash/civweave_pocket, paste this
# launcher into UIFlow2 Python Custom Edit and choose Run Once.
import sys
if '/flash/civweave_pocket' not in sys.path:
    sys.path.append('/flash/civweave_pocket')
from firmware.main import run
run()
