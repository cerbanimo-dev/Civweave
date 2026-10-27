#!/usr/bin/env python3
"""Snapdragon-specific Qwen GGUF optimization and in-decode cancellation."""
from pathlib import Path
R=Path(__file__).resolve().parent/'workspace'
def change(p,old,new):
 f=R/p;s=f.read_text()
 if old not in s:raise RuntimeError("missing anchor in "+p+": "+old[:80])
 f.write_text(s.replace(old,new,1))
cm='android/app/src/main/cpp/CMakeLists.txt'
change(cm,'set(GGML_CPU_KLEIDIAI ON CACHE BOOL "" FORCE)', '''set(GGML_CPU_KLEIDIAI ON CACHE BOOL "" FORCE)
# Snapdragon 8 Elite only: speed up generic Q4_K / Q6_K kernels not
# covered by the KleidiAI quantization-specific dispatch.
set(GGML_CPU_ARM_ARCH "armv8.6-a+dotprod+i8mm+fp16" CACHE STRING "" FORCE)''')
cpp='android/app/src/main/cpp/qwen_jni.cpp'
change(cpp,'    auto cp=llama_context_default_params();', '''    struct ComputeDeadline { std::chrono::steady_clock::time_point start; int maxSeconds; };
    ComputeDeadline deadline{started,std::max(45,std::min(600,(int)deadline_seconds))};
    auto cp=llama_context_default_params();
    // Checked *inside* llama_decode on CPU, so Stop is no longer batch-bound.
    cp.abort_callback=[](void* opaque)->bool {
        auto* state=static_cast<ComputeDeadline*>(opaque);
        return cancel_requested.load() ||
            std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now()-state->start).count()>=state->maxSeconds;
    };
    cp.abort_callback_data=&deadline;''')
change(cpp,'cp.n_threads=4; cp.n_threads_batch=4;','cp.n_threads=4; cp.n_threads_batch=6;')
change(cpp,'size_t chunk=(off==0)?1:(off<8?7:(off<24?16:32));', '''// Avoid 16- and 32-token batches that stalled on the Galaxy S25+.
        size_t chunk=(off==0)?1:((off==1)?7:8);''')
old='if(llama_decode(ctx,batch)!=0){error=true;break;}'
new='''if(llama_decode(ctx,batch)!=0){
            if(cancel_requested.load())interrupted=true;
            else if(expired())timed_out=true;
            else error=true;
            break;
        }'''
change(cpp,old,new)
change(cpp,'llama_token next=llama_sampler_sample(sampler,ctx,-1);', '''llama_token next=llama_sampler_sample(sampler,ctx,-1);
        llama_sampler_accept(sampler,next);''')
change(cpp,old,new)
(R/'tests/test_snapdragon_8_elite_optimized_runtime.py').write_text('''from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]
class SnapdragonNativeRuntime(unittest.TestCase):
 def test_arm_quant_backend_targets_snapdragon(self):
  cm=(R/'android/app/src/main/cpp/CMakeLists.txt').read_text()
  self.assertIn('set(GGML_CPU_KLEIDIAI ON',cm)
  self.assertIn('GGML_CPU_ARM_ARCH "armv8.6-a+dotprod+i8mm+fp16"',cm)
 def test_stop_and_timeout_during_native_decode(self):
  cpp=(R/'android/app/src/main/cpp/qwen_jni.cpp').read_text()
  self.assertIn('cp.abort_callback=',cpp)
  self.assertIn('cp.abort_callback_data=&deadline;',cpp)
  self.assertIn('size_t chunk=(off==0)?1:((off==1)?7:8);',cpp)
  self.assertIn('cp.n_threads_batch=6;',cpp)
 def test_sampler_updates_after_each_token(self):
  cpp=(R/'android/app/src/main/cpp/qwen_jni.cpp').read_text()
  self.assertIn('llama_sampler_accept(sampler,next);',cpp)
''')
f=R/'tests/test_optimized_arm64_prefill.py'
if f.exists():
 s=f.read_text().replace("'chunk=(off==0)?1:(off<8?7:(off<24?16:32))'","'size_t chunk=(off==0)?1:((off==1)?7:8);'")
 f.write_text(s)
(R/'docs/snapdragon-qwen-v054.md').write_text('''The Galaxy S25+ completed 8 prompt tokens in v0.5.3 but stalled on the following 16-token batch. This targeted diagnostic adds ARM i8mm/dotprod/fp16 compilation to speed up fallback quantized tensor operations not covered by KleidiAI. Blocks stay at eight prompt tokens and native abort callback responds inside CPU decode. Built for Snapdragon 8 Elite, not general arm64 phones. Phone performance not verified. Separate Android package protects installed Kingdom/Kokoro files.\n''')
print('Applied Snapdragon Qwen optimization and in-decode abort')
