"""Write docs/narration.md: the narration with timecodes, from timeline.json."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def tc(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:04.1f}"


def main() -> None:
    timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
    out = [
        "# 旁白稿（带时间码）",
        "",
        f"总时长 {tc(timeline['duration'])} · 配音 Kokoro-82M-v1.1-zh `{timeline['voice']}` · 语速 {timeline['speed']}",
        "",
        "想换成自己的声音：按下面的分句录音，每句单独一个文件，替换 `.cache/tts/` 中对应的句子后重新构建即可；",
        "或者直接把 `output/jintaoblog-611-ai-slop.srt` 导入剪映，在无旁白版上重新配音。",
        "",
    ]
    chapter = None
    for scene in timeline["scenes"]:
        if scene["chapter"] != chapter:
            chapter = scene["chapter"]
            out += [f"## {chapter}", ""]
        out.append(f"**{tc(scene['start'])} · {scene['id']}**")
        out.append("")
        for line in scene["lines"]:
            out.append(f"- `{tc(line['start'])}` {line['text']}")
        out.append("")
    path = ROOT / "docs" / "narration.md"
    path.parent.mkdir(exist_ok=True)
    path.write_text("\n".join(out), encoding="utf-8")
    print(path)


if __name__ == "__main__":
    main()
