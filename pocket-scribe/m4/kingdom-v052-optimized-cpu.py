#!/usr/bin/env python3
"""Force optimized ARM64 ggml kernels even in diagnostic debug APKs."""
from pathlib import Path
R=Path(__file__).resolve().parent/'workspace'
def change(path,old,new):
    f=R/path;s=f.read_text()
    if old not in s: raise RuntimeError(f"Expected 0.5.1 source in {path}: {old[:80]}")
    f.write_text(s.replace(old,new,1))
cmake='android/app/src/main/cpp/CMakeLists.txt'
change(cmake,'set(CMAKE_CXX_STANDARD 17)', '''set(CMAKE_CXX_STANDARD 17)
# Android Gradle's assembleDebug otherwise uses CMake Debug flags (-O0).
# Keep the diagnostic package debuggable but ggml CPU C/C++ code optimized.
set(CMAKE_C_FLAGS_DEBUG "-O3 -DNDEBUG" CACHE STRING "optimized CPU native debug" FORCE)
set(CMAKE_CXX_FLAGS_DEBUG "-O3 -DNDEBUG" CACHE STRING "optimized CPU native debug" FORCE)''')
cpp='android/app/src/main/cpp/qwen_jni.cpp'
change(cpp,'for(size_t off=0;off<tokens.size();off+=32){','for(size_t off=0;off<tokens.size();){')
change(cpp,'int count=(int)std::min((size_t)32,tokens.size()-off);', '''// Time a single first token before batching up. This separates the
        // model's cold native decode from later prompt processing.
        size_t chunk=(off==0)?1:(off<8?7:(off<24?16:32));
        int count=(int)std::min(chunk,tokens.size()-off);''')
change(cpp,'pos+=count;\n        long elapsedMs=','pos+=count;off+=(size_t)count;\n        long elapsedMs=')
change(cpp,'std::string report="Processed "+std::to_string(pos)+"/"+std::to_string(tokens.size())+" prompt tokens; batch "+std::to_string(elapsedMs)+" ms";', '''std::string report="Processed "+std::to_string(pos)+"/"+std::to_string(tokens.size())+" prompt tokens; batch "+std::to_string(elapsedMs)+" ms";
        if(elapsedMs>30000)report+=" (very slow first decode; CPU backend still running)";''')
change('tests/test_first_decode_diagnostics.py',"'off+=32'","'off+=(size_t)count;'")
(R/'tests/test_optimized_arm64_prefill.py').write_text('''from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]
class NativeOptimization(unittest.TestCase):
 def test_debug_c_kernels_are_optimized(self):
  cm=(R/'android/app/src/main/cpp/CMakeLists.txt').read_text()
  self.assertIn('CMAKE_C_FLAGS_DEBUG "-O3 -DNDEBUG"',cm)
  self.assertIn('CMAKE_CXX_FLAGS_DEBUG "-O3 -DNDEBUG"',cm)
 def test_first_token_probe(self):
  cpp=(R/'android/app/src/main/cpp/qwen_jni.cpp').read_text()
  self.assertIn('chunk=(off==0)?1:(off<8?7:(off<24?16:32))',cpp)
  self.assertIn('off+=(size_t)count;',cpp)
''')
(R/'docs/native-cpu-optimized-v052.md').write_text('''# Kingdom 0.5.2 CPU diagnostics
Android assembleDebug may compile native ggml kernels unoptimized.
This diagnostic forces -O3 on C and C++ native Debug compilation. First
prompt decode uses batches 1, 7, 16, 32 to expose the cold-start delay.
The physical Galaxy S25+ inference performance remains unverified.
No data migration; this is a separate side-by-side diagnostic package.
''')
print('Applied optimized native C/C++ debug backend and first-token probe')
