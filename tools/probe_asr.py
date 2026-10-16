# -*- coding: utf-8 -*-
"""
P7 可行性验证（路径 B）：不依赖 faster-whisper 的文件解码，自己用 PyAV 解成 PCM。

## 为什么绕开 faster_whisper.decode_audio

本机实测：faster-whisper 1.2.1 + PyAV 19.0.1 不兼容 ——
  faster_whisper/audio.py:46 -> av.open(input_file, ... metadata_errors="ignore")
  TypeError: open() got an unexpected keyword argument 'metadata_errors'
PyAV 19 把 `metadata_errors` 这个参数去掉了，而 faster-whisper 还在传。
这是上游版本错配，不是我们用法错。

## 因此的架构选择（重要）

**插件不直接把文件交给 faster-whisper，而是自己做 PyAV -> PCM 解码**
（`model.transcribe(numpy_array)` 接受 float32 波形数组，不走它的 decode_audio）。
好处有两条，缺一不可：
  1) 不受这个上游 bug 影响；
  2) **插件自己掌握「片段切在帧中间」的容错** —— 这正是本探测要验证的点。

用法: python tools/probe_asr.py [bvid] [maxSeconds]
"""
import json
import os
import sys
import tempfile
import time
import urllib.request

import numpy as np

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

bvid = sys.argv[1] if len(sys.argv) > 1 else "BV1GJ411x7h7"
max_seconds = int(sys.argv[2]) if len(sys.argv) > 2 else 60
TARGET_SR = 16000  # whisper 固定要求 16kHz 单声道


def api(path):
    req = urllib.request.Request(
        f"https://api.bilibili.com{path}",
        headers={"user-agent": UA, "referer": "https://www.bilibili.com/"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


print(f"对象: {bvid}  目标时长: {max_seconds}s\n")

detail = api(f"/x/web-interface/view/detail?bvid={bvid}")
View = detail["data"]["View"]
cid, dur = View["cid"], View["duration"]
print(f"[1] 详情 OK  {View['title'][:40]}  duration={dur}s  cid={cid}")

pu = api(f"/x/player/playurl?bvid={bvid}&cid={cid}&qn=64&fnval=16")
audios = pu["data"]["dash"]["audio"]
pick = min(audios, key=lambda a: a["bandwidth"])
bw = pick["bandwidth"]
print(f"[2] playurl OK  选中 id={pick['id']} bandwidth={bw}")

bytes_per_sec = bw / 8
want = min(int(bytes_per_sec * max_seconds), 4 * 1024 * 1024)
print(f"[3] 换算: {bytes_per_sec:.0f} 字节/秒 -> 下载 {want} 字节（约 {want/1024/1024:.2f} MB）")

req = urllib.request.Request(
    pick["baseUrl"],
    headers={"user-agent": UA, "referer": "https://www.bilibili.com/", "range": f"bytes=0-{want-1}"},
)
t0 = time.time()
with urllib.request.urlopen(req, timeout=30) as r:
    status = r.status
    data = r.read()
t1 = time.time()
print(f"     HTTP {status}  实收 {len(data)} 字节  耗时 {t1-t0:.2f}s")

tmp = tempfile.NamedTemporaryFile(suffix=".m4a", delete=False)
tmp.write(data)
tmp.close()

try:
    # ---- 自解码：m4a 片段 -> float32 PCM（绕开 faster_whisper.decode_audio）----
    import av

    print("[4] PyAV 自解码 m4a 片段 -> PCM")
    t0 = time.time()
    with av.open(tmp.name, mode="r") as container:
        stream = next(s for s in container.streams if s.type == "audio")
        stream.thread_type = "AUTO"
        resampler = av.AudioResampler(format="s16", layout="mono", rate=TARGET_SR)
        chunks = []
        for frame in container.decode(stream):
            for rf in resampler.resample(frame):
                chunks.append(rf.to_ndarray())
        # 冲刷重采样器里残留的样本
        for rf in resampler.resample(None):
            chunks.append(rf.to_ndarray())
    if not chunks:
        raise RuntimeError("解码得到 0 个样本")
    pcm = np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0
    dec_sec = len(pcm) / TARGET_SR
    print(f"     解码 OK  {len(pcm)} 样本 = {dec_sec:.2f}s  (耗时 {time.time()-t0:.2f}s)")
    print(f"     注意：下载的是约 {max_seconds}s 字节，实际解出 {dec_sec:.2f}s —— 差值即为帧对齐消耗")

    # ---- 转写：直接喂波形数组 ----
    from faster_whisper import WhisperModel

    print("[5] 加载 faster-whisper（transcribe 直接吃 numpy 数组）")
    t0 = time.time()
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    print(f"     模型就绪 {time.time()-t0:.1f}s")

    t0 = time.time()
    segments, info = model.transcribe(pcm, language=None, beam_size=1, vad_filter=False)
    segs = list(segments)
    elapsed = time.time() - t0

    rtf = info.duration / elapsed if elapsed else 0
    print(f"     语言={info.language} (p={info.language_probability:.2f})  "
          f"时长={info.duration:.1f}s  转写耗时={elapsed:.1f}s  实时率={rtf:.1f}x")
    print(f"     段数={len(segs)}")
    print("     文字稿:")
    for s in segs:
        print(f"       [{s.start:6.1f}-{s.end:6.1f}] {s.text.strip()}")
    if not segs:
        print("       (空 —— 需要检查片段边界容错)")
finally:
    os.unlink(tmp.name)
    print(f"\n已删除临时文件")
