#!/usr/bin/env python3
"""Enable portable Android ARM matrix kernels for Qwen GGUF inference."""
from pathlib import Path
R=Path(__file__).resolve().parent/'workspace'
f=R/'android/app/src/main/cpp/CMakeLists.txt'
s=f.read_text()
needle='set(GGML_NATIVE OFF CACHE BOOL "" FORCE)'
if needle not in s: raise RuntimeError('Expected GGML_NATIVE option missing')
s=s.replace(needle, needle+'''
# Runtime-detected optimized ARM kernels for Q4_K_M, portable across arm64
# unlike a global ARMv8.6 i8mm instruction-set requirement.
set(GGML_CPU_KLEIDIAI ON CACHE BOOL "" FORCE)''',1)
f.write_text(s)
(R/'tests/test_android_kleidiai_backend.py').write_text('''from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]
class ARMBackend(unittest.TestCase):
 def test_kleidiai_enabled_portably(self):
  cm=(R/'android/app/src/main/cpp/CMakeLists.txt').read_text()
  self.assertIn('set(GGML_CPU_KLEIDIAI ON',cm)
  self.assertIn('set(GGML_NATIVE OFF',cm)
''')
print('Enabled portable ARM KleidiAI matrix kernels')
